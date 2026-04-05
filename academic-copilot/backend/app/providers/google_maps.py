"""Google Maps commute estimation provider."""
from __future__ import annotations
from .base import CommuteProvider
from app.config import get_settings

# Building coordinates on ASU Tempe campus (approximate)
ASU_BUILDINGS = {
    "Brickyard Engineering": {"lat": 33.4242, "lng": -111.9400, "abbr": "BYENG"},
    "Coor Hall": {"lat": 33.4210, "lng": -111.9340, "abbr": "COOR"},
    "Wexler Hall": {"lat": 33.4205, "lng": -111.9315, "abbr": "WXLR"},
    "Language & Literature": {"lat": 33.4175, "lng": -111.9345, "abbr": "LL"},
}

# Default walking times between campus buildings (minutes)
CAMPUS_WALK_TIMES = {
    ("BYENG", "COOR"): 8,
    ("BYENG", "WXLR"): 10,
    ("BYENG", "LL"): 12,
    ("COOR", "WXLR"): 5,
    ("COOR", "LL"): 7,
    ("WXLR", "LL"): 6,
}


def _get_walk_time(bldg1: str, bldg2: str) -> float:
    """Get walking time between two campus buildings."""
    if bldg1 == bldg2:
        return 0.0
    key1 = (bldg1, bldg2)
    key2 = (bldg2, bldg1)
    return float(CAMPUS_WALK_TIMES.get(key1, CAMPUS_WALK_TIMES.get(key2, 10)))


class GoogleMapsCommuteProvider(CommuteProvider):
    """Commute provider using Google Maps API with campus fallback."""

    async def estimate_commute(self, origin: str, destination: str) -> float:
        settings = get_settings()

        # Try to find campus building abbreviations
        origin_abbr = self._extract_building(origin)
        dest_abbr = self._extract_building(destination)

        if origin_abbr and dest_abbr:
            return _get_walk_time(origin_abbr, dest_abbr)

        # If we have a Maps API key and a real address, use the API
        if settings.google_maps_api_key and not origin_abbr:
            return await self._api_commute(origin, destination, settings.google_maps_api_key)

        # Default: assume 15 min commute from off-campus to campus
        return 15.0

    def estimate_campus_walk(self, origin: str, destination: str) -> float:
        origin_abbr = self._extract_building(origin)
        dest_abbr = self._extract_building(destination)
        if origin_abbr and dest_abbr:
            return _get_walk_time(origin_abbr, dest_abbr)
        return 0.0

    def _extract_building(self, location: str) -> str | None:
        for name, info in ASU_BUILDINGS.items():
            if info["abbr"] in location or name.lower() in location.lower():
                return info["abbr"]
        return None

    async def _api_commute(self, origin: str, destination: str, api_key: str) -> float:
        """Call Google Maps Distance Matrix API."""
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins": origin,
                        "destinations": destination,
                        "mode": "driving",
                        "key": api_key,
                    },
                    timeout=10,
                )
                data = resp.json()
                if data["status"] == "OK":
                    element = data["rows"][0]["elements"][0]
                    if element["status"] == "OK":
                        return element["duration"]["value"] / 60.0
        except Exception:
            pass
        return 15.0
