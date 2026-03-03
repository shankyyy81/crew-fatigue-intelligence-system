# Crew Fatigue Intelligence System (CFIS)

**IndiGo-style airline crew fatigue prediction and disruption management platform**

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB running locally (`mongod`) or provide a MongoDB Atlas URI

### 1. Backend Setup
```bash
cd "hindustan hackathon/backend"

# Install dependencies
pip3 install -r ../requirements.txt

# Copy env file
cp ../.env.example .env
# Edit .env if using MongoDB Atlas

# Train the ML model (one-time, ~60s)
python3 ml/train.py

# Seed the database
python3 seed.py

# Start the API server
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd "hindustan hackathon/frontend"
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Architecture

```
frontend/       React 18 + Vite + TypeScript + Tailwind + Recharts
backend/
  main.py       FastAPI app (9 endpoints)
  database.py   MongoDB/Motor async connection
  seed.py       Synthetic data + Captain Sharma demo scenario
  ml/
    train.py    XGBoost 3-layer training pipeline + SHAP
    predict.py  Per-crew prediction (Layer1+2+3)
```

## Three-Layer Fatigue Model

| Layer | Model | Output |
|-------|-------|--------|
| Layer 1 | SAFTE biomathematical formula | `fatigue_base_score` (0–100) |
| Layer 2 | XGBoost classifier | `fatigue_ml_score` (0–100) |
| Layer 3 | Behavioral signals | `behavioral_boost` (0–15) |

**Final Score** = `clamp(0.45×L1 + 0.45×L2 + L3, 0, 100)`

**Tiers**: 🟢 GREEN (0–60) · 🟡 AMBER (61–80) · 🔴 RED (81–100)

## Demo Scenario

Captain Priya Sharma (C9999) is pre-seeded as a RED-tier crew member with duty DEL→LHR in 14 hours.

1. Click **"Activate Demo"** on the Overview page
2. View Sharma's escalating fatigue trajectory
3. Go to **Replacement Console** → assign a replacement
4. Check **Cascade Impact** → flights flip to 🛡 Protected

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/crew` | List crew (filters: base, role, tier) |
| GET | `/crew/{id}` | Full profile + trajectory + SHAP |
| GET | `/alerts` | Alert feed |
| POST | `/alerts/simulate` | Trigger demo scenario |
| GET | `/replacements/{crew_id}` | Top 3 candidates |
| POST | `/assign_replacement` | Assign replacement |
| GET | `/cascade/{crew_id}` | Downstream flight risk |
| GET | `/model/metrics` | AUC, AP, confusion matrix |
| POST | `/model/retrain` | Retrain (background) |
| GET | `/stats` | Dashboard KPIs |

Swagger UI: **http://localhost:8000/docs**
