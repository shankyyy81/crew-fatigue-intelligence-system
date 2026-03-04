"""
Seed script — populates MongoDB with crew profiles, predictions,
alerts, replacements, and cascade events.
Run: python seed.py
"""
import os, sys, json, random
from datetime import datetime, timedelta
import pymongo
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ml.predict import compute_layer1, compute_layer3, get_tier
import numpy as np

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "crew_fatigue")

client = pymongo.MongoClient(MONGO_URI)
db     = client[DB_NAME]

BASES     = ["DEL", "BOM", "BLR", "MAA", "HYD", "COK", "PNQ"]
ROLES     = ["Captain", "First Officer", "Cabin Crew"]
AIRCRAFT  = ["A320", "A321", "B737", "B787"]
NOW       = datetime.utcnow()

random.seed(42)
np.random.seed(42)

# ─── Indian Names ──────────────────────────────────────────────────────────────
MALE_FIRST = [
    "Rajesh", "Vikram", "Arjun", "Rahul", "Arun", "Suresh", "Manish", "Deepak",
    "Rohit", "Amit", "Sanjay", "Nikhil", "Karthik", "Pradeep", "Anand", "Ravi",
    "Manoj", "Vishal", "Gaurav", "Varun", "Sachin", "Vivek", "Kunal", "Ajay",
    "Vijay", "Ramesh", "Sunil", "Aakash", "Pranav", "Harish", "Girish", "Dinesh",
    "Bhavesh", "Neeraj", "Tarun", "Pankaj", "Ankur", "Sumit", "Saurabh", "Akhil",
    "Nitin", "Mohit", "Lalit", "Hemant", "Yogesh", "Abhishek", "Pratik", "Kartik",
    "Rohan", "Yash", "Akash", "Dev", "Harsh", "Jay", "Kiran", "Naveen",
    "Omkar", "Parth", "Rajan", "Sameer", "Tejas", "Uday", "Vinay", "Wasim",
    "Xavier", "Yogendra", "Zubin", "Aarav", "Bhuvan", "Chirag", "Darshan", "Eshan",
    "Farhan", "Gauransh", "Hitesh", "Ishaan", "Jatin", "Kedar", "Lakshman", "Mihir",
    "Naresh", "Omkar", "Prathamesh", "Ruchit", "Shivam", "Tushar", "Utkarsh", "Vipul",
    "Waqar", "Yuvraj", "Zeeshan", "Abhinav", "Balaji", "Chetan", "Dushyant", "Eknath",
]
FEMALE_FIRST = [
    "Priya", "Anjali", "Meera", "Sneha", "Kavita", "Anita", "Shreya", "Preeti",
    "Nisha", "Pooja", "Asha", "Divya", "Geeta", "Hema", "Ila", "Jyoti",
    "Kamini", "Lata", "Madhuri", "Nalini", "Poonam", "Radha", "Savita", "Tara",
    "Uma", "Varsha", "Wanita", "Yamini", "Zara", "Aditi", "Bhavna", "Chhaya",
    "Disha", "Ekta", "Falguni", "Gargi", "Harshita", "Isha", "Janaki", "Komal",
    "Lavanya", "Manju", "Neha", "Ojasvini", "Pallavi", "Ritu", "Shweta", "Tanvi",
    "Urvashi", "Vandana", "Wasundhara", "Yashoda", "Zeenat", "Aishwarya", "Bindu",
    "Charu", "Deepika", "Esha", "Falak", "Geetanjali", "Harini", "Indira", "Jhanvi",
    "Kritika", "Lipika", "Manasi", "Nandini", "Ovi", "Parvati", "Rekha", "Sunaina",
    "Trisha", "Urmila", "Vidya", "Winnie", "Xeniya", "Yukta", "Zoya", "Aakanksha",
    "Bharati", "Charulata", "Daksha", "Elakshi", "Fiona", "Gunjan", "Himani", "Ishita",
]
LAST_NAMES = [
    "Sharma", "Patel", "Kumar", "Singh", "Gupta", "Verma", "Nair", "Iyer",
    "Rao", "Reddy", "Shah", "Mehta", "Joshi", "Pandey", "Mishra", "Dubey",
    "Tiwari", "Agarwal", "Chauhan", "Yadav", "Menon", "Pillai", "Krishnan", "Mukherjee",
    "Chatterjee", "Banerjee", "Das", "Ghosh", "Roy", "Bose", "Sen", "Kapoor",
    "Malhotra", "Khanna", "Chopra", "Arora", "Bhatia", "Sinha", "Saxena", "Tripathi",
    "Bajaj", "Desai", "Kulkarni", "Patil", "Naik", "Sawant", "More", "Shinde",
    "Kaur", "Gill", "Bains", "Dhillon", "Sandhu", "Randhawa", "Oberoi", "Walia",
    "Raju", "Subramanian", "Venkatesh", "Srinivas", "Narayan", "Prakash", "Raman", "Subramaniam",
]

def generate_name(role: str) -> str:
    """Generate a realistic Indian name, prefixed with role title."""
    is_female = random.random() < 0.40  # 40% female crew
    first = random.choice(FEMALE_FIRST if is_female else MALE_FIRST)
    last  = random.choice(LAST_NAMES)
    prefix = "Capt." if role == "Captain" else ("F/O" if role == "First Officer" else "CA")
    return f"{prefix} {first} {last}"


# ─── Helper ────────────────────────────────────────────────────────────────────
def rand_score_row(tier_target: str = None):
    """Generate synthetic feature row biased toward a tier."""
    if tier_target == "RED":
        duty = random.uniform(8, 12)
        rest = random.uniform(3, 6)
        consec = random.randint(5, 10)
        circ = random.uniform(0.6, 1.0)
        tz = random.choice([3, 4, 5])
        swap = random.randint(2, 4)
        wellness = round(random.uniform(0.1, 0.35), 2)
        late = random.randint(2, 4)
        fat_r = random.randint(1, 3)
    elif tier_target == "AMBER":
        duty = random.uniform(7, 9)
        rest = random.uniform(6, 8)
        consec = random.randint(3, 6)
        circ = random.uniform(0.3, 0.6)
        tz = random.choice([1, 2])
        swap = random.randint(1, 2)
        wellness = round(random.uniform(0.35, 0.6), 2)
        late = random.randint(0, 2)
        fat_r = random.randint(0, 2)
    else:  # GREEN
        duty = random.uniform(2, 7)
        rest = random.uniform(8, 12)
        consec = random.randint(0, 3)
        circ = random.uniform(0.0, 0.3)
        tz = random.choice([0, 1])
        swap = random.randint(0, 1)
        wellness = round(random.uniform(0.6, 1.0), 2)
        late = random.randint(0, 1)
        fat_r = 0

    return {
        "hours_flown_24h": round(duty, 2),
        "hours_flown_72h": round(duty * 2.5, 2),
        "sectors_last_7_days": random.randint(0, 25),
        "timezone_displacement_hours": tz,
        "layover_quality_score": round(random.uniform(0.3, 0.95), 2),
        "circadian_misalignment": round(circ, 2),
        "sick_leave_last_90_days": random.randint(0, 4),
        "consecutive_duty_days": consec,
        "forward_schedule_stress": round(random.uniform(0.1, 0.9), 2),
        "swap_request_count_7d": swap,
        "wellness_score": wellness,
        "fatigue_report_count": fat_r,
        "late_checkin_count_30d": late,
        "sleep_opportunity_hours": round(rest, 2),
        "night_duty": random.choice([0, 0, 0, 1]),
    }


def compute_prediction(features: dict) -> dict:
    l1 = compute_layer1(features)
    l3 = compute_layer3(features)
    # Simple proxy for ML score (no model needed for seed)
    raw = (65 - features.get("wellness_score", 0.5) * 50
           + features.get("circadian_misalignment", 0) * 20
           + features.get("consecutive_duty_days", 0) * 4
           + features.get("swap_request_count_7d", 0) * 5)
    l2 = float(np.clip(raw, 0, 100))
    final = float(np.clip(0.45 * l1 + 0.45 * l2 + l3, 0, 100))
    tier  = get_tier(final)
    return {
        "fatigue_base_score": round(l1, 2),
        "fatigue_ml_score":   round(l2, 2),
        "behavioral_boost":   round(l3, 2),
        "final_fatigue_score": round(final, 2),
        "tier": tier,
        "unfit_risk_probability": round(min(1.0, final / 100), 4),
        "shap_drivers": [
            {"feature": "wellness_score",           "impact": -(features.get("wellness_score", 0.5) * 10), "abs_impact": features.get("wellness_score", 0.5) * 10},
            {"feature": "circadian_misalignment",   "impact": features.get("circadian_misalignment", 0) * 8, "abs_impact": features.get("circadian_misalignment", 0) * 8},
            {"feature": "sleep_opportunity_hours",  "impact": -(features.get("sleep_opportunity_hours", 8) * 0.5), "abs_impact": features.get("sleep_opportunity_hours", 8) * 0.5},
            {"feature": "consecutive_duty_days",    "impact": features.get("consecutive_duty_days", 0) * 1.5, "abs_impact": features.get("consecutive_duty_days", 0) * 1.5},
            {"feature": "swap_request_count_7d",    "impact": features.get("swap_request_count_7d", 0) * 2, "abs_impact": features.get("swap_request_count_7d", 0) * 2},
        ]
    }


def make_trajectory(crew_id: str, base_tier: str, days: int = 7):
    """Generate 7-day fatigue trajectory."""
    trajectory = []
    for d in range(-days + 1, 1):
        t_target = base_tier if d == 0 else ("GREEN" if d < -4 else ("AMBER" if d < -2 else base_tier))
        row = rand_score_row(t_target)
        pred = compute_prediction(row)
        trajectory.append({
            "date": (NOW + timedelta(days=d)).strftime("%Y-%m-%d"),
            "final_fatigue_score": pred["final_fatigue_score"],
            "tier": pred["tier"],
        })
    return trajectory


def make_next_duties(base: str, aircraft: str, days: int = 5):
    routes = {
        "DEL": [["DEL","BOM"], ["DEL","BLR"], ["DEL","MAA"]],
        "BOM": [["BOM","DEL"], ["BOM","COK"], ["BOM","HYD"]],
        "BLR": [["BLR","DEL"], ["BLR","MAA"], ["BLR","HYD"]],
        "MAA": [["MAA","DEL"], ["MAA","BOM"], ["MAA","COK"]],
        "HYD": [["HYD","BOM"], ["HYD","BLR"], ["HYD","DEL"]],
        "COK": [["COK","BOM"], ["COK","MAA"], ["COK","BLR"]],
        "PNQ": [["PNQ","BOM"], ["PNQ","DEL"], ["PNQ","BLR"]],
    }.get(base, [["DEL", "BOM"]])
    duties = []
    for d in range(1, days + 1):
        rt = random.choice(routes)
        dep = NOW + timedelta(days=d, hours=random.randint(4, 18))
        duties.append({
            "duty_id": f"FWD{random.randint(10000,99999)}",
            "departure_time": dep.isoformat(),
            "route": rt,
            "aircraft_type": aircraft,
            "duration_hrs": round(random.uniform(1.5, 8.0), 1),
            "station": base,
        })
    return duties


# ─── Clear and Seed ────────────────────────────────────────────────────────────
print("[SEED] Clearing existing data...")
for col in ["crew_profiles", "predictions", "alerts", "replacements", "cascade_events", "model_metrics"]:
    db[col].drop()

print("[SEED] Generating crew profiles...")
crew_ids = [f"C{i}" for i in range(1023, 1223)]

# Tier distribution: 20% GREEN, 35% AMBER, 45% RED (Per user request)
tier_map = {}
for cid in crew_ids:
    r = random.random()
    tier = "RED" if r < 0.45 else ("AMBER" if r < 0.80 else "GREEN")
    tier_map[cid] = tier

crew_docs = []
pred_docs = []
alert_docs = []

for cid in crew_ids:
    base      = random.choice(BASES)
    role      = random.choice(ROLES)
    aircraft  = random.choice(AIRCRAFT)
    tier_now  = tier_map[cid]
    features  = rand_score_row(tier_now)
    pred      = compute_prediction(features)
    trajectory = make_trajectory(cid, tier_now)
    next_duties = make_next_duties(base, aircraft)

    h_start = f"{random.randint(21,23):02d}:{random.choice(['00','15','30','45'])}"
    h_end   = f"{random.randint(6,8):02d}:{random.choice(['00','15','30','45'])}"

    name = generate_name(role)

    crew_doc = {
        "_id": cid,
        "crew_id": cid,
        "name": name,
        "role": role,
        "base": base,
        "aircraft_type": aircraft,
        "habitual_sleep_start": h_start,
        "habitual_sleep_end":   h_end,
        "sick_leave_last_90_days": features["sick_leave_last_90_days"],
        "features": features,
        "prediction": pred,
        "trajectory": trajectory,
        "next_duties": next_duties,
        "updated_at": NOW.isoformat(),
    }
    crew_docs.append(crew_doc)

    if tier_now in ["AMBER", "RED"]:
        prev_tier = "GREEN" if tier_now == "AMBER" else "AMBER"
        alert_docs.append({
            "crew_id": cid,
            "crew_name": name,
            "tier_from": prev_tier,
            "tier_to": tier_now,
            "reason": f"Score {pred['final_fatigue_score']:.0f}: high circadian misalignment + low wellness",
            "top_factors": [d["feature"] for d in pred["shap_drivers"][:3]],
            "timestamp": (NOW - timedelta(hours=random.randint(1, 12))).isoformat(),
            "status": random.choice(["new", "acknowledged", "wellness_sent"]),
            "responsible_team": "scheduler" if tier_now == "AMBER" else "ops_control",
        })

# ─── Captain Priya Sharma (C9999) — Demo Crew ─────────────────────────────────
print("[SEED] Adding Captain Priya Sharma (demo scenario)...")

sharma_features = {
    "hours_flown_24h": 9.5,
    "hours_flown_72h": 22.0,
    "sectors_last_7_days": 20,
    "timezone_displacement_hours": 5,
    "layover_quality_score": 0.28,
    "circadian_misalignment": 0.92,
    "sick_leave_last_90_days": 2,
    "consecutive_duty_days": 7,
    "forward_schedule_stress": 0.85,
    "swap_request_count_7d": 3,
    "wellness_score": 0.18,
    "fatigue_report_count": 2,
    "late_checkin_count_30d": 3,
    "sleep_opportunity_hours": 4.5,
    "night_duty": 1,
}

sharma_pred = {
    "fatigue_base_score": 72.5,
    "fatigue_ml_score":   89.0,
    "behavioral_boost":   14.5,
    "final_fatigue_score": 87.3,
    "tier": "RED",
    "unfit_risk_probability": 0.91,
    "shap_drivers": [
        {"feature": "wellness_score",           "impact": -9.0,  "abs_impact": 9.0},
        {"feature": "sleep_opportunity_hours",  "impact": -8.5,  "abs_impact": 8.5},
        {"feature": "circadian_misalignment",   "impact":  7.8,  "abs_impact": 7.8},
        {"feature": "consecutive_duty_days",    "impact":  6.5,  "abs_impact": 6.5},
        {"feature": "fatigue_base_score",       "impact":  5.2,  "abs_impact": 5.2},
        {"feature": "swap_request_count_7d",    "impact":  4.9,  "abs_impact": 4.9},
        {"feature": "hours_flown_72h",          "impact":  3.8,  "abs_impact": 3.8},
        {"feature": "timezone_displacement_hours","impact": 3.2, "abs_impact": 3.2},
        {"feature": "layover_quality_score",    "impact": -2.8,  "abs_impact": 2.8},
        {"feature": "forward_schedule_stress",  "impact":  2.1,  "abs_impact": 2.1},
    ]
}

sharma_trajectory = [
    {"date": (NOW - timedelta(days=3)).strftime("%Y-%m-%d"), "final_fatigue_score": 52.0, "tier": "GREEN"},
    {"date": (NOW - timedelta(days=2)).strftime("%Y-%m-%d"), "final_fatigue_score": 64.5, "tier": "AMBER"},
    {"date": (NOW - timedelta(days=1)).strftime("%Y-%m-%d"), "final_fatigue_score": 75.8, "tier": "AMBER"},
    {"date": NOW.strftime("%Y-%m-%d"),                        "final_fatigue_score": 87.3, "tier": "RED"},
    {"date": (NOW + timedelta(days=1)).strftime("%Y-%m-%d"),  "final_fatigue_score": 87.3, "tier": "RED"},
]

sharma_duties = [
    {
        "duty_id": "FWD88001",
        "departure_time": (NOW + timedelta(hours=14)).isoformat(),
        "route": ["DEL", "LHR"],
        "aircraft_type": "B787",
        "duration_hrs": 8.5,
        "station": "DEL",
    },
    {
        "duty_id": "FWD88002",
        "departure_time": (NOW + timedelta(days=2, hours=6)).isoformat(),
        "route": ["LHR", "DEL"],
        "aircraft_type": "B787",
        "duration_hrs": 8.5,
        "station": "LHR",
    },
]

sharma_doc = {
    "_id": "C9999",
    "crew_id": "C9999",
    "name": "Captain Priya Sharma",
    "role": "Captain",
    "base": "DEL",
    "aircraft_type": "B787",
    "habitual_sleep_start": "22:30",
    "habitual_sleep_end": "06:30",
    "sick_leave_last_90_days": 2,
    "features": sharma_features,
    "prediction": sharma_pred,
    "trajectory": sharma_trajectory,
    "next_duties": sharma_duties,
    "updated_at": NOW.isoformat(),
    "is_demo": True,
}
crew_docs.append(sharma_doc)

# Sharma alert
alert_docs.append({
    "crew_id": "C9999",
    "crew_name": "Captain Priya Sharma",
    "tier_from": "AMBER",
    "tier_to": "RED",
    "reason": "Score 87.3 — Duty in 14 hours. Critical: Circadian misalignment 0.92, wellness 0.18, 7 consecutive duty days.",
    "top_factors": ["circadian_misalignment", "wellness_score", "consecutive_duty_days"],
    "timestamp": (NOW - timedelta(minutes=22)).isoformat(),
    "status": "new",
    "responsible_team": "ops_control",
    "demo": True,
})

# ─── Replacement Candidates for Sharma ────────────────────────────────────────
print("[SEED] Adding replacement candidates for Sharma...")

# Find GREEN candidates
green_candidates = [c for c in crew_docs if c["prediction"]["tier"] == "GREEN" and c["crew_id"] != "C9999"]
selected_candidates = random.sample(green_candidates, min(3, len(green_candidates)))

repl_docs = []
for i, candidate in enumerate(selected_candidates):
    # Ensure they match constraints ideally
    if i == 0:
        candidate["base"] = "DEL"
        candidate["aircraft_type"] = "B787"
        why = f"Same base (DEL), B787 rated, GREEN tier, DGCA hours compliant"
    elif i == 1:
        candidate["base"] = "DEL"
        candidate["aircraft_type"] = "B787"
        why = f"Same base (DEL), B787 rated, GREEN tier, standby duty"
    else:
        candidate["base"] = "BOM"
        candidate["aircraft_type"] = "B787"
        why = f"BOM base, B787 rated, GREEN tier — can position in time"

    repl_docs.append({
        "for_crew_id": "C9999",
        "rank": i + 1,
        "candidate_id": candidate["crew_id"],
        "candidate_name": candidate["name"],
        "base": candidate["base"],
        "aircraft_type": candidate["aircraft_type"],
        "role": candidate["role"],
        "tier": "GREEN",
        "final_fatigue_score": candidate["prediction"]["final_fatigue_score"],
        "reach_time_hrs": round(random.uniform(0.5, 2.5), 1),
        "dgca_compliant": True,
        "hours_flown_28d": round(random.uniform(40, 65), 1),
        "hours_available": round(random.uniform(15, 35), 1),
        "why_eligible": why,
        "disruption_cost_impact": round(random.uniform(0.05, 0.25), 2),
        "assigned": False,
    })


# ─── Cascade Events for Sharma ────────────────────────────────────────────────
print("[SEED] Adding cascade events for Sharma...")
cascade_docs = [
    {
        "crew_id": "C9999",
        "flight_id": "6E-201",
        "departure_time": (NOW + timedelta(hours=14)).isoformat(),
        "route": "DEL → LHR",
        "station": "DEL",
        "aircraft": "B787",
        "risk_level": "HIGH",
        "protected": False,
        "passengers": 280,
    },
    {
        "crew_id": "C9999",
        "flight_id": "6E-202",
        "departure_time": (NOW + timedelta(days=2, hours=6)).isoformat(),
        "route": "LHR → DEL",
        "station": "LHR",
        "aircraft": "B787",
        "risk_level": "MEDIUM",
        "protected": False,
        "passengers": 260,
    },
    {
        "crew_id": "C9999",
        "flight_id": "6E-350",
        "departure_time": (NOW + timedelta(days=3, hours=10)).isoformat(),
        "route": "DEL → BOM",
        "station": "DEL",
        "aircraft": "B787",
        "risk_level": "LOW",
        "protected": False,
        "passengers": 180,
    },
]

# ─── Model Metrics placeholder ────────────────────────────────────────────────
metrics_doc = {
    "_id": "latest",
    "roc_auc": 1.0,
    "avg_precision": 1.0,
    "accuracy": 1.0,
    "precision": 1.0,
    "recall": 1.0,
    "confusion_matrix": [[47, 0], [0, 23]],
    "false_positives_count": 0,
    "false_negatives_count": 0,
    "train_size": 280,
    "test_size": 70,
    "top_shap_features": [
        {"feature": "wellness_score",           "importance": 2.098},
        {"feature": "sleep_opportunity_hours",  "importance": 1.986},
        {"feature": "circadian_misalignment",   "importance": 0.303},
        {"feature": "fatigue_base_score",       "importance": 0.209},
        {"feature": "layover_quality_score",    "importance": 0.125},
        {"feature": "forward_schedule_stress",  "importance": 0.048},
        {"feature": "hours_flown_24h",          "importance": 0.035},
        {"feature": "sectors_last_7_days",      "importance": 0.031},
        {"feature": "consecutive_duty_days",    "importance": 0.017},
        {"feature": "hours_flown_72h",          "importance": 0.009},
    ],
    "last_trained": (NOW - timedelta(hours=2)).isoformat(),
}

# ─── Insert ────────────────────────────────────────────────────────────────────
print(f"[SEED] Inserting {len(crew_docs)} crew profiles...")
db["crew_profiles"].insert_many(crew_docs)
print(f"[SEED] Inserting {len(alert_docs)} alerts...")
db["alerts"].insert_many(alert_docs)
print(f"[SEED] Inserting {len(repl_docs)} replacements...")
db["replacements"].insert_many(repl_docs)
print(f"[SEED] Inserting {len(cascade_docs)} cascade events...")
db["cascade_events"].insert_many(cascade_docs)
db["model_metrics"].insert_one(metrics_doc)

# Indexes
db["crew_profiles"].create_index("crew_id")
db["predictions"].create_index("crew_id")
db["alerts"].create_index([("timestamp", -1)])
db["replacements"].create_index("for_crew_id")
db["cascade_events"].create_index("crew_id")

print(f"[SEED] ✓ Done! Crew: {len(crew_docs)} | Alerts: {len(alert_docs)}")
print(f"[SEED] ✓ Demo crew: Captain Priya Sharma (C9999) — RED tier, duty in 14h")

# Summary
red_count   = sum(1 for d in crew_docs if d["prediction"]["tier"] == "RED")
amber_count = sum(1 for d in crew_docs if d["prediction"]["tier"] == "AMBER")
green_count = sum(1 for d in crew_docs if d["prediction"]["tier"] == "GREEN")
print(f"[SEED] ✓ Tiers — GREEN: {green_count} | AMBER: {amber_count} | RED: {red_count}")
client.close()
