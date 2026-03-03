"""
FastAPI Backend — Crew Fatigue Intelligence System
Run: uvicorn main:app --reload --port 8000
"""
import os, json
from datetime import datetime, timedelta
from typing import Optional, List
import numpy as np

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
    cursor = replacements_col().find({"for_crew_id": crew_id}).sort("rank", 1)
    docs   = await cursor.to_list(length=10)
    if not docs:
        raise HTTPException(status_code=404, detail=f"No replacements found for {crew_id}")
    return {"for_crew_id": crew_id, "replacements": clean_many(docs), "count": len(docs)}


# ─── POST /assign_replacement ─────────────────────────────────────────────────
class AssignRequest(BaseModel):
    for_crew_id: str
    candidate_id: str

@app.post("/assign_replacement")
async def assign_replacement(req: AssignRequest):
    result = await replacements_col().update_one(
        {"for_crew_id": req.for_crew_id, "candidate_id": req.candidate_id},
        {"$set": {"assigned": True, "assigned_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Replacement not found")

    # Mark cascade as protected
    await cascade_col().update_many(
        {"crew_id": req.for_crew_id},
        {"$set": {"protected": True, "replacement_id": req.candidate_id}}
    )

    # Add resolution alert
    await alerts_col().insert_one({
        "crew_id": req.for_crew_id,
        "crew_name": "Captain Priya Sharma" if req.for_crew_id == "C9999" else req.for_crew_id,
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
    cursor = cascade_col().find({"crew_id": crew_id}).sort("departure_time", 1)
    docs   = await cursor.to_list(length=20)
    if not docs:
        raise HTTPException(status_code=404, detail=f"No cascade events for {crew_id}")

    protected_count = sum(1 for d in docs if d.get("protected"))
    at_risk_count   = len(docs) - protected_count

    return {
        "crew_id":         crew_id,
        "cascade_flights": clean_many(docs),
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
