"""
FastAPI Backend — Crew Fatigue Intelligence System
Run: uvicorn main:app --reload --port 8000
"""
import os, json
from datetime import datetime, timedelta
from typing import Optional, List
import numpy as np
import random

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import motor.motor_asyncio

load_dotenv()

from database import (
    crew_col, predictions_col, alerts_col, replacements_col,
    cascade_col, metrics_col, close_db
)

app = FastAPI(
    title="Crew Fatigue Intelligence API",
    description="IndiGo-style airline crew fatigue prediction and disruption management",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helpers ──────────────────────────────────────────────────────────────────
def clean(doc):
    """Convert MongoDB doc to JSON-serialisable dict."""
    if doc is None:
        return None
    d = dict(doc)
    d.pop("_id", None)
    return d


def clean_many(docs):
    return [clean(d) for d in docs]


# ─── Startup/Shutdown ──────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    print("[API] starting up — connected to MongoDB")

@app.on_event("shutdown")
async def shutdown():
    await close_db()


# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "ok", "service": "Crew Fatigue Intelligence API", "version": "1.0.0"}


# ─── GET /crew ────────────────────────────────────────────────────────────────
@app.get("/crew")
async def list_crew(
    base: Optional[str] = None,
    role: Optional[str] = None,
    aircraft_type: Optional[str] = None,
    tier: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(300, le=500),
    skip: int = 0,
):
    filt = {}
    if base:          filt["base"] = base.upper()
    if role:          filt["role"] = role
    if aircraft_type: filt["aircraft_type"] = aircraft_type.upper()
    if tier:          filt["prediction.tier"] = tier.upper()
    if search:
        filt["$or"] = [
            {"crew_id": {"$regex": search, "$options": "i"}},
            {"name":    {"$regex": search, "$options": "i"}},
        ]

    cursor = crew_col().find(filt, {
        "crew_id": 1, "name": 1, "role": 1, "base": 1,
        "aircraft_type": 1, "prediction": 1, "next_duties": 1,
        "updated_at": 1,
    }).skip(skip).limit(limit)

    docs = await cursor.to_list(length=limit)
    result = clean_many(docs)

    # Summary counts
    all_cursor = crew_col().find({}, {"prediction.tier": 1})
    all_docs   = await all_cursor.to_list(length=1000)
    tiers = [d.get("prediction", {}).get("tier", "GREEN") for d in all_docs]

    return {
        "crew": result,
        "total": len(result),
        "summary": {
            "green": tiers.count("GREEN"),
            "amber": tiers.count("AMBER"),
            "red":   tiers.count("RED"),
            "total": len(tiers),
        }
    }


# ─── GET /crew/{id} ───────────────────────────────────────────────────────────
@app.get("/crew/{crew_id}")
async def get_crew(crew_id: str):
    doc = await crew_col().find_one({"crew_id": crew_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Crew {crew_id} not found")
    return clean(doc)


# ─── GET /alerts ─────────────────────────────────────────────────────────────
@app.get("/alerts")
async def get_alerts(limit: int = Query(50, le=200)):
    cursor = alerts_col().find({}).sort("timestamp", -1).limit(limit)
    docs   = await cursor.to_list(length=limit)

    # Fetch latest data from master crew collection
    crew_ids = [d["crew_id"] for d in docs]
    if crew_ids:
        master_cursor = crew_col().find({"crew_id": {"$in": crew_ids}})
        master_data = await master_cursor.to_list(length=limit)
        master_map = {c["crew_id"]: c for c in master_data}
        
        for doc in docs:
            cid = doc["crew_id"]
            if cid in master_map:
                master = master_map[cid]
                # If tier_to isn't PROTECTED, ensure it matches current live tier
                current_live_tier = master.get("prediction", {}).get("tier", "GREEN")
                if doc.get("tier_to") != "PROTECTED":
                    doc["tier_to"] = current_live_tier
                # Fetch live name
                doc["crew_name"] = master.get("name", doc.get("crew_name", cid))

    return {"alerts": clean_many(docs), "total": len(docs)}


# ─── POST /alerts/simulate ───────────────────────────────────────────────────
class SimulateRequest(BaseModel):
    scenario: str = "sharma_escalation"

@app.post("/alerts/simulate")
async def simulate_alert(req: SimulateRequest):
    now = datetime.utcnow().isoformat()

    if req.scenario == "sharma_escalation":
        alert = {
            "crew_id": "C9999",
            "crew_name": "Captain Priya Sharma",
            "tier_from": "AMBER",
            "tier_to": "RED",
            "reason": "CRITICAL: Score 87.3 — Duty DEL→LHR in 14 hours. Circadian misalignment 0.92, wellness 0.18, 7 consecutive duty days.",
            "top_factors": ["circadian_misalignment", "wellness_score", "consecutive_duty_days"],
            "timestamp": now,
            "status": "new",
            "responsible_team": "ops_control",
            "demo": True,
        }
        await alerts_col().insert_one(alert)
        return {"success": True, "alert": {**alert, "_id": None}, "message": "Sharma alert triggered"}

    return {"success": False, "message": "Unknown scenario"}


# ─── GET /replacements/{crew_id} ─────────────────────────────────────────────
@app.get("/replacements/{crew_id}")
async def get_replacements(crew_id: str):
    target_crew = await crew_col().find_one({"crew_id": crew_id})
    if not target_crew:
        raise HTTPException(status_code=404, detail=f"Crew {crew_id} not found")

    target_role = target_crew.get("role")
    target_aircraft = target_crew.get("aircraft_type")
    assigned_doc = await replacements_col().find_one({"for_crew_id": crew_id, "assigned": True})

    target_duties = sorted_duties(target_crew.get("next_duties", []))
    replaced_duty = target_duties[0] if target_duties else None
    if not replaced_duty:
        return {"for_crew_id": crew_id, "replacements": [], "count": 0}

    replaced_dep, _ = duty_times(replaced_duty)
    replaced_origin, _ = extract_route(replaced_duty)
    if not (replaced_dep and replaced_origin):
        raise HTTPException(status_code=422, detail=f"Invalid upcoming duty data for {crew_id}")

    candidate_pool = await crew_col().find({
        "crew_id": {"$ne": crew_id},
        "prediction.tier": "GREEN"
    }).to_list(length=500)

    if not candidate_pool:
        return {"for_crew_id": crew_id, "replacements": [], "count": 0}

    # Progressive fallback to avoid empty replacement panels when strict matching has no hits.
    candidate_stages = [
        [c for c in candidate_pool if c.get("role") == target_role and c.get("aircraft_type") == target_aircraft],
        [c for c in candidate_pool if c.get("aircraft_type") == target_aircraft],
        [c for c in candidate_pool if c.get("role") == target_role],
        candidate_pool,
    ]
    candidates = next((stage for stage in candidate_stages if stage), [])

    ranked = []
    for candidate in candidates:
        candidate_duties = sorted_duties(candidate.get("next_duties", []))
        has_conflict = has_time_conflict(candidate_duties, replaced_duty)
        can_reach = can_reach_origin(candidate_duties, candidate.get("base", ""), replaced_duty)
        limit_violation = violates_duty_limits(candidate_duties, replaced_duty)

        current_loc, available_from = candidate_position_state(candidate_duties, candidate.get("base", ""), replaced_dep)
        travel = reposition_time_hours(current_loc or "", replaced_origin)
        reach_dt = available_from + timedelta(hours=travel)
        reach_time_hrs = max(0.0, (reach_dt - datetime.utcnow()).total_seconds() / 3600.0)

        fatigue = float(candidate.get("prediction", {}).get("final_fatigue_score", 0.0) or 0.0)
        rep_day_hours = duty_hours_on_date(candidate_duties, replaced_dep.date())
        rep_duration = float(replaced_duty.get("duration_hrs", 2.0) or 2.0)
        hours_available = max(0.0, MAX_DUTY_HOURS_PER_DAY - (rep_day_hours + rep_duration))

        ranked.append({
            "candidate": candidate,
            "has_conflict": has_conflict,
            "can_reach": can_reach,
            "limit_violation": limit_violation,
            "feasible": (not has_conflict and can_reach and not limit_violation),
            "reach_time_hrs": reach_time_hrs,
            "fatigue": fatigue,
            "hours_available": hours_available,
        })

    if not ranked:
        return {"for_crew_id": crew_id, "replacements": [], "count": 0}

    ranked.sort(
        key=lambda x: (
            0 if x["feasible"] else 1,
            x["reach_time_hrs"],
            x["fatigue"],
            -x["hours_available"],
        )
    )
    top_candidates = ranked[:3]

    docs = []
    for i, row in enumerate(top_candidates):
        candidate = row["candidate"]
        is_assigned = assigned_doc and assigned_doc["candidate_id"] == candidate["crew_id"]
        if row["feasible"]:
            why_eligible = "No overlap, reachable with rest+travel, and duty limits compliant"
        elif row["limit_violation"]:
            why_eligible = "Closest available candidate; flagged for duty-limit review before assignment"
        elif row["has_conflict"]:
            why_eligible = "Closest available candidate; overlapping duty must be rescheduled"
        elif not row["can_reach"]:
            why_eligible = "Closest available candidate; reposition timing is tight and needs ops approval"
        else:
            why_eligible = "Closest available candidate based on current fatigue and reachability"

        docs.append({
            "for_crew_id": crew_id,
            "rank": i + 1,
            "candidate_id": candidate["crew_id"],
            "candidate_name": candidate["name"],
            "base": candidate.get("base", ""),
            "aircraft_type": candidate.get("aircraft_type", ""),
            "role": candidate.get("role", ""),
            "tier": "GREEN",
            "final_fatigue_score": candidate.get("prediction", {}).get("final_fatigue_score", 0),
            "reach_time_hrs": round(row["reach_time_hrs"], 1),
            "dgca_compliant": not row["limit_violation"],
            "hours_flown_28d": candidate.get("features", {}).get("hours_flown_72h", 0),
            "hours_available": round(row["hours_available"], 1),
            "why_eligible": why_eligible,
            "disruption_cost_impact": round(0.08 + (i * 0.05), 2),
            "assigned": is_assigned,
        })

    return {"for_crew_id": crew_id, "replacements": clean_many(docs), "count": len(docs)}

# ─── POST /assign_replacement ─────────────────────────────────────────────────
class AssignRequest(BaseModel):
    for_crew_id: str
    candidate_id: str

import math

AIRPORTS = {
    "DEL": (28.5562, 77.1000), "BOM": (19.0886, 72.8679), "BLR": (13.1986, 77.7066),
    "MAA": (12.9941, 80.1709), "HYD": (17.2403, 78.4294), "COK": (10.1520, 76.3930),
    "PNQ": (18.5822, 73.9197), "LHR": (51.4700, -0.4543), "DXB": (25.2532, 55.3657),
    "SIN": (1.3644, 103.9915), "CCU": (22.6520, 88.4467)
}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * (2 * math.asin(math.sqrt(a)))

MIN_REST_HOURS = 8
AVG_REPOSITION_SPEED_KMPH = 750.0
REPOSITION_BUFFER_HOURS = 0.5
MAX_DUTY_HOURS_PER_DAY = 8.0
MAX_CONSECUTIVE_DUTIES = 4


def extract_route(duty):
    """Helper to safely extract the origin and destination of a duty."""
    route = duty.get("route", [])
    if isinstance(route, list) and len(route) >= 2:
        return route[0], route[-1]
    elif isinstance(route, str) and " \u2192 " in route:
        parts = route.split(" \u2192 ")
        return parts[0], parts[-1]
    elif isinstance(route, str) and "->" in route:
        parts = route.split("->")
        return parts[0].strip(), parts[-1].strip()
    return "", ""


def parse_iso_dt(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    except Exception:
        return None


def duty_times(duty):
    dep = parse_iso_dt(duty.get("departure_time", ""))
    if not dep:
        return None, None
    try:
        dur = float(duty.get("duration_hrs", 2.0) or 2.0)
    except Exception:
        dur = 2.0
    arr = dep + timedelta(hours=dur)
    return dep, arr


def reposition_time_hours(origin: str, destination: str) -> float:
    if origin == destination:
        return 0.0
    if origin in AIRPORTS and destination in AIRPORTS:
        dist = haversine(*AIRPORTS[origin], *AIRPORTS[destination])
        return (dist / AVG_REPOSITION_SPEED_KMPH) + REPOSITION_BUFFER_HOURS
    return 5.0


def duty_key(duty):
    route = duty.get("route", [])
    route_key = "->".join(route) if isinstance(route, list) else str(route)
    return (duty.get("duty_id", ""), duty.get("departure_time", ""), route_key)


def duties_overlap(left, right) -> bool:
    l_dep, l_arr = duty_times(left)
    r_dep, r_arr = duty_times(right)
    if not (l_dep and l_arr and r_dep and r_arr):
        return False
    return l_dep < r_arr and l_arr > r_dep


def sorted_duties(duties):
    return sorted(duties, key=lambda d: parse_iso_dt(d.get("departure_time", "")) or datetime.max)


def last_state(accepted_duties):
    if not accepted_duties:
        return None, None
    prev = accepted_duties[-1]
    _, prev_dest = extract_route(prev)
    _, prev_arr = duty_times(prev)
    if not prev_arr:
        return None, None
    return prev_dest, (prev_arr + timedelta(hours=MIN_REST_HOURS))


def can_append_duty(accepted_duties, new_duty):
    origin, _ = extract_route(new_duty)
    dep, _ = duty_times(new_duty)
    if not dep:
        return False
    if not accepted_duties:
        return True

    current_location, available_from = last_state(accepted_duties)
    if not available_from:
        return False
    travel = reposition_time_hours(current_location or "", origin or "")
    return available_from + timedelta(hours=travel) <= dep


def has_time_conflict(duties, replaced_duty) -> bool:
    return any(duties_overlap(d, replaced_duty) for d in duties)


def candidate_position_state(candidate_duties, candidate_base, replaced_dep):
    last_duty = None
    for duty in sorted_duties(candidate_duties):
        dep, arr = duty_times(duty)
        if not (dep and arr):
            continue
        if arr <= replaced_dep:
            last_duty = duty
        else:
            break

    if last_duty:
        _, last_dest = extract_route(last_duty)
        _, last_arr = duty_times(last_duty)
        return last_dest or candidate_base, (last_arr + timedelta(hours=MIN_REST_HOURS))

    return candidate_base, datetime.utcnow()


def can_reach_origin(candidate_duties, candidate_base, replaced_duty) -> bool:
    replaced_dep, _ = duty_times(replaced_duty)
    replaced_origin, _ = extract_route(replaced_duty)
    if not (replaced_dep and replaced_origin):
        return False

    current_loc, available_from = candidate_position_state(candidate_duties, candidate_base, replaced_dep)
    travel = reposition_time_hours(current_loc or "", replaced_origin)
    return available_from + timedelta(hours=travel) <= replaced_dep


def duty_hours_on_date(duties, duty_date):
    total = 0.0
    for d in duties:
        dep, _ = duty_times(d)
        if dep and dep.date() == duty_date:
            try:
                total += float(d.get("duration_hrs", 0) or 0)
            except Exception:
                pass
    return total


def max_consecutive_streak(dates):
    if not dates:
        return 0
    ordered = sorted(dates)
    streak = 1
    best = 1
    for i in range(1, len(ordered)):
        if (ordered[i] - ordered[i - 1]).days == 1:
            streak += 1
            best = max(best, streak)
        elif (ordered[i] - ordered[i - 1]).days > 1:
            streak = 1
    return best


def violates_duty_limits(candidate_duties, replaced_duty) -> bool:
    rep_dep, _ = duty_times(replaced_duty)
    if not rep_dep:
        return True
    rep_day = rep_dep.date()
    try:
        rep_dur = float(replaced_duty.get("duration_hrs", 2.0) or 2.0)
    except Exception:
        rep_dur = 2.0

    if duty_hours_on_date(candidate_duties, rep_day) + rep_dur > MAX_DUTY_HOURS_PER_DAY:
        return True

    duty_dates = set()
    for d in candidate_duties:
        dep, _ = duty_times(d)
        if dep:
            duty_dates.add(dep.date())
    duty_dates.add(rep_day)
    return max_consecutive_streak(duty_dates) > MAX_CONSECUTIVE_DUTIES


def build_feasible_merged_schedule(candidate_duties, transferred_duties):
    transfer_sorted = sorted_duties(transferred_duties)
    transfer_keys = {duty_key(d) for d in transfer_sorted}

    # Candidate duties that directly overlap transferred duties are removed first.
    candidate_non_overlap = [
        d for d in sorted_duties(candidate_duties)
        if not any(duties_overlap(d, t) for t in transfer_sorted)
    ]

    merged = sorted(
        transfer_sorted + candidate_non_overlap,
        key=lambda d: (
            parse_iso_dt(d.get("departure_time", "")) or datetime.max,
            0 if duty_key(d) in transfer_keys else 1
        )
    )

    accepted = []
    for duty in merged:
        key = duty_key(duty)
        if can_append_duty(accepted, duty):
            accepted.append(duty)
            continue

        # If a transferred duty becomes infeasible, back out trailing candidate duties first.
        if key in transfer_keys:
            while accepted and duty_key(accepted[-1]) not in transfer_keys and not can_append_duty(accepted, duty):
                accepted.pop()
            if can_append_duty(accepted, duty):
                accepted.append(duty)
            # If still infeasible, skip to avoid impossible chains.

    return accepted

@app.post("/assign_replacement")
async def assign_replacement(req: AssignRequest):
    await replacements_col().update_one(
        {"for_crew_id": req.for_crew_id, "candidate_id": req.candidate_id},
        {"$set": {"assigned": True, "assigned_at": datetime.utcnow().isoformat()}},
        upsert=True
    )

    # Mark cascade as protected
    await cascade_col().update_many(
        {"crew_id": req.for_crew_id},
        {"$set": {"protected": True, "replacement_id": req.candidate_id}}
    )

    # Fetch crew name and duties from master database
    master_crew = await crew_col().find_one({"crew_id": req.for_crew_id})
    crew_name = master_crew.get("name", req.for_crew_id) if master_crew else req.for_crew_id
    duties_to_transfer = master_crew.get("next_duties", []) if master_crew else []

    # Demote original crew's tier to PROTECTED and clear their schedule to remove from RED list
    await crew_col().update_one(
        {"crew_id": req.for_crew_id},
        {"$set": {
            "prediction.tier": "PROTECTED",
            "prediction.final_fatigue_score": 0,
            "next_duties": []
        }}
    )

    # Fetch candidate to get their existing duties
    candidate_crew = await crew_col().find_one({"crew_id": req.candidate_id})
    candidate_duties = candidate_crew.get("next_duties", []) if candidate_crew else []

    # Assign transferred duties to candidate with transfer-priority feasibility merge
    if duties_to_transfer:
        valid_duties = build_feasible_merged_schedule(candidate_duties, duties_to_transfer)
        await crew_col().update_one(
            {"crew_id": req.candidate_id},
            {"$set": {"next_duties": valid_duties}}
        )

    # Add resolution alert
    await alerts_col().insert_one({
        "crew_id": req.for_crew_id,
        "crew_name": crew_name,
        "tier_from": "RED",
        "tier_to": "PROTECTED",
        "reason": f"Replacement assigned: {req.candidate_id}. Cascade risk resolved.",
        "top_factors": [],
        "timestamp": datetime.utcnow().isoformat(),
        "status": "resolved",
        "responsible_team": "ops_control",
    })

    return {
        "success": True,
        "message": f"Replacement {req.candidate_id} assigned for {req.for_crew_id}",
        "cascade_protected": True,
        "estimated_savings_inr_lakhs": 65,
    }


# ─── GET /cascade/{crew_id} ───────────────────────────────────────────────────
@app.get("/cascade/{crew_id}")
async def get_cascade(crew_id: str):
    # Fetch details for the requested crew member
    target_crew = await crew_col().find_one({"crew_id": crew_id})
    if not target_crew:
        raise HTTPException(status_code=404, detail=f"Crew {crew_id} not found")

    # Check if this crew member has been protected by a replacement
    assigned_doc = await replacements_col().find_one({"for_crew_id": crew_id, "assigned": True})
    is_protected = bool(assigned_doc)

    # Use crew_id to seed random for deterministic generation (so it doesn't change on refresh)
    seed = int("".join(c for c in crew_id if c.isdigit()))
    random.seed(seed)
    
    base = target_crew.get("base", "DEL")
    destinations = [d for d in ["DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "DXB", "SIN", "LHR"] if d != base]
    aircraft = target_crew.get("aircraft_type", "A320")
    
    num_flights = random.randint(2, 4)
    docs = []
    
    current_time = datetime.now() + timedelta(hours=random.randint(6, 18))
    current_loc = base

    for i in range(num_flights):
        dest = random.choice([d for d in destinations if d != current_loc])
        flight_id = f"6E-{random.randint(100, 999)}"
        pax = random.randint(120, 300)
        
        # Risk degrades (gets higher) further into the future if unprotected
        if is_protected:
            risk = "LOW"
        else:
            risk = "HIGH" if i == 0 else ("MEDIUM" if i == 1 else "LOW")

        docs.append({
            "crew_id": crew_id,
            "flight_id": flight_id,
            "departure_time": current_time.isoformat(),
            "route": f"{current_loc} \u2192 {dest}",
            "station": current_loc,
            "aircraft": aircraft,
            "risk_level": risk,
            "protected": is_protected,
            "passengers": pax
        })
        
        current_loc = dest
        current_time += timedelta(hours=random.randint(6, 12))

    protected_count = sum(1 for d in docs if d.get("protected"))
    at_risk_count   = len(docs) - protected_count

    return {
        "crew_id":         crew_id,
        "cascade_flights": docs,
        "total_flights":   len(docs),
        "at_risk":         at_risk_count,
        "protected":       protected_count,
        "estimated_passengers_impacted": sum(d.get("passengers", 0) for d in docs if not d.get("protected")),
    }


# ─── GET /model/metrics ───────────────────────────────────────────────────────
@app.get("/model/metrics")
async def get_model_metrics():
    doc = await metrics_col().find_one({"_id": "latest"})
    if not doc:
        # Fallback to JSON file if available
        try:
            ml_dir    = os.path.join(os.path.dirname(__file__), "ml")
            json_path = os.path.join(ml_dir, "model_metrics.json")
            with open(json_path) as f:
                return json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Model metrics not found. Run python ml/train.py first.")
    return clean(doc)


# ─── POST /model/retrain ──────────────────────────────────────────────────────
@app.post("/model/retrain")
async def retrain_model(background_tasks: BackgroundTasks):
    def _retrain():
        import subprocess, sys
        ml_script = os.path.join(os.path.dirname(__file__), "ml", "train.py")
        try:
            subprocess.run([sys.executable, ml_script], check=True, timeout=300)
            print("[RETRAIN] ✓ Completed")
        except Exception as e:
            print(f"[RETRAIN] Failed: {e}")

    background_tasks.add_task(_retrain)
    return {
        "success":  True,
        "message":  "Retraining triggered in background. This may take ~60 seconds.",
        "demo_note": "In demo mode, uses existing train_samples.csv with synthetic augmentation.",
    }


# ─── GET /stats ───────────────────────────────────────────────────────────────
@app.get("/stats")
async def get_stats():
    """Dashboard KPIs."""
    all_crew = await crew_col().find({}, {"prediction.tier": 1, "prediction.final_fatigue_score": 1}).to_list(1000)
    tiers  = [d.get("prediction", {}).get("tier", "GREEN") for d in all_crew]
    scores = [d.get("prediction", {}).get("final_fatigue_score", 0) for d in all_crew]

    red_count   = tiers.count("RED")
    amber_count = tiers.count("AMBER")
    green_count = tiers.count("GREEN")

    return {
        "total_crew":               len(all_crew),
        "green_count":              green_count,
        "amber_count":              amber_count,
        "red_count":                red_count,
        "avg_fatigue_score":        round(float(np.mean(scores)) if scores else 0, 2),
        "predicted_cancellations_avoided": red_count,
        "estimated_savings_inr_lakhs": red_count * 65,
        "demo_crew_id":             "C9999",
        "demo_crew_name":           "Captain Priya Sharma",
        "demo_duty_in_hours":       14,
    }

