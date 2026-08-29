"""
Client for LTA DataMall's Carpark Availability API, filtered down to Curb's
Phase 1 shopping-mall beachhead.

The CarParkAvailability endpoint returns real-time lot counts for HDB, URA,
and "LTA" agency carparks. The LTA-agency subset covers major shopping malls
and developments in Orchard, Marina, HarbourFront and Jurong Lake District --
see https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html

If no DATAMALL_ACCOUNT_KEY is configured, this falls back to a small sample
dataset so the app is runnable / demoable without a key.
"""
import os
import time
from typing import Optional

import httpx

DATAMALL_URL = "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2"

# Curb Phase 1 target malls -- matched by substring against the API's
# "Development" field. Adjust/expand once you've inspected a live response,
# since agency-supplied naming isn't perfectly standardized.
TARGET_MALLS = [
    "VIVOCITY",
    "ION ORCHARD",
    "MARINA SQUARE",
    "SUNTEC",
    "PLAZA SINGAPURA",
    "JEM",
    "WESTGATE",
    "HARBOURFRONT",
    "313@SOMERSET",
    "FUNAN",
    "NGEE ANN CITY",
]

_cache = {"data": None, "ts": 0}
CACHE_TTL_SECONDS = 30

SAMPLE_FALLBACK = [
    {"CarParkID": "SAMPLE-VS", "Development": "VIVOCITY", "Area": "HarbourFront",
     "AvailableLots": 214, "LotType": "C", "Agency": "LTA",
     "Location": "1.2645 103.8222"},
    {"CarParkID": "SAMPLE-ION", "Development": "ION ORCHARD", "Area": "Orchard",
     "AvailableLots": 38, "LotType": "C", "Agency": "LTA",
     "Location": "1.3039 103.8318"},
    {"CarParkID": "SAMPLE-MS", "Development": "MARINA SQUARE", "Area": "Marina",
     "AvailableLots": 156, "LotType": "C", "Agency": "LTA",
     "Location": "1.2926 103.8573"},
    {"CarParkID": "SAMPLE-JEM", "Development": "JEM", "Area": "Jurong Lake District",
     "AvailableLots": 5, "LotType": "C", "Agency": "LTA",
     "Location": "1.3331 103.7436"},
    {"CarParkID": "SAMPLE-WG", "Development": "WESTGATE", "Area": "Jurong Lake District",
     "AvailableLots": 0, "LotType": "C", "Agency": "LTA",
     "Location": "1.3345 103.7430"},
]


def _account_key() -> Optional[str]:
    return os.environ.get("DATAMALL_ACCOUNT_KEY", "").strip() or None


async def fetch_carparks(force: bool = False):
    """Return live (or sample) carpark records for Curb's target malls."""
    now = time.time()
    if not force and _cache["data"] and (now - _cache["ts"] < CACHE_TTL_SECONDS):
        return _cache["data"], _cache.get("source", "cache")

    key = _account_key()
    if not key:
        _cache.update(data=SAMPLE_FALLBACK, ts=now, source="sample-fallback")
        return SAMPLE_FALLBACK, "sample-fallback"

    headers = {"AccountKey": key, "accept": "application/json"}
    all_records = []
    skip = 0
    async with httpx.AsyncClient(timeout=10) as client:
        # DataMall paginates ~500 records per call; page through a few times
        # to make sure we don't miss target malls.
        for _ in range(6):
            resp = await client.get(DATAMALL_URL, headers=headers, params={"$skip": skip})
            resp.raise_for_status()
            batch = resp.json().get("value", [])
            if not batch:
                break
            all_records.extend(batch)
            skip += 500

    filtered = [
        r for r in all_records
        if any(name in (r.get("Development") or "").upper() for name in TARGET_MALLS)
    ]

    _cache.update(data=filtered, ts=now, source="live")
    return filtered, "live"
