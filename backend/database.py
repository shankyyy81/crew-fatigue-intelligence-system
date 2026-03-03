"""
MongoDB connection and helpers using Motor (async).
DB name: crew_fatigue
Collections: crew_profiles, predictions, alerts, replacements, cascade_events, model_metrics
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "crew_fatigue")

_client: AsyncIOMotorClient = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[DB_NAME]


# Collection helpers
def crew_col():
    return get_db()["crew_profiles"]


def predictions_col():
    return get_db()["predictions"]


def alerts_col():
    return get_db()["alerts"]


def replacements_col():
    return get_db()["replacements"]


def cascade_col():
    return get_db()["cascade_events"]


def metrics_col():
    return get_db()["model_metrics"]


async def close_db():
    global _client
    if _client:
        _client.close()
        _client = None
