"""Official highway CCTV catalog for the game page."""

import asyncio
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlsplit
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

CATALOG_URL = "https://tisvcloud.freeway.gov.tw/history/motc20/CCTV.xml"
SCHEMA = "{http://traffic.transportdata.tw/standard/traffic/schema/}"
ALLOWED_HOSTS = frozenset({
    "cctvn.freeway.gov.tw",
    "cctvc.freeway.gov.tw",
    "cctvs.freeway.gov.tw",
    "cctvn5.freeway.gov.tw",
})
CATALOG_TTL_SECONDS = 3600
MAX_CATALOG_BYTES = 3_000_000

router = APIRouter(prefix="/api/game/cctv", tags=["game-cctv"])


@dataclass(frozen=True)
class Camera:
    id: str
    stream_url: str
    road_name: str
    direction: str
    mile: str


_catalog: dict[str, Camera] = {}
_catalog_expires_at = 0.0
_catalog_lock = asyncio.Lock()


def _text(element: ElementTree.Element, name: str) -> str:
    return (element.findtext(f"{SCHEMA}{name}") or "").strip()


def parse_catalog(xml_bytes: bytes) -> dict[str, Camera]:
    """Parse the current CCTVList; only approved HTTPS camera hosts are usable."""
    if len(xml_bytes) > MAX_CATALOG_BYTES:
        raise ValueError("CCTV 清單過大")
    root = ElementTree.fromstring(xml_bytes)
    if root.tag != f"{SCHEMA}CCTVList":
        raise ValueError("CCTV 清單格式不符")

    cameras: dict[str, Camera] = {}
    for item in root.findall(f"./{SCHEMA}CCTVs/{SCHEMA}CCTV"):
        camera_id = _text(item, "CCTVID")
        stream_url = _text(item, "VideoStreamURL")
        road_name = _text(item, "RoadName")
        try:
            parsed = urlsplit(stream_url)
            allowed = (
                bool(camera_id)
                and parsed.scheme == "https"
                and parsed.hostname in ALLOWED_HOSTS
                and parsed.username is None
                and parsed.password is None
                and parsed.port in (None, 443)
                and (road_name.startswith("國道") or road_name == "國1高架")
            )
        except ValueError:
            allowed = False
        if not allowed:
            continue
        cameras[camera_id] = Camera(
            id=camera_id,
            stream_url=stream_url,
            road_name=road_name,
            direction=_text(item, "RoadDirection"),
            mile=_text(item, "LocationMile"),
        )
    if not cameras:
        raise ValueError("CCTV 清單沒有可用的國道鏡頭")
    return cameras


async def _download_catalog() -> bytes:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            response = await client.get(CATALOG_URL)
            response.raise_for_status()
            return response.content
    except httpx.ConnectError as exc:
        # Some official servers use a chain rejected by OpenSSL but accepted by
        # the system curl trust store. Curl still verifies the CA and hostname.
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
        process = await asyncio.create_subprocess_exec(
            "curl", "--fail", "--silent", "--show-error", "--max-time", "15",
            "--max-filesize", str(MAX_CATALOG_BYTES), CATALOG_URL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        output, _ = await process.communicate()
        if process.returncode != 0:
            raise ValueError("無法下載官方 CCTV 清單") from exc
        return output


async def get_catalog() -> dict[str, Camera]:
    global _catalog, _catalog_expires_at
    if _catalog and time.monotonic() < _catalog_expires_at:
        return _catalog
    async with _catalog_lock:
        if _catalog and time.monotonic() < _catalog_expires_at:
            return _catalog
        try:
            cameras = parse_catalog(await _download_catalog())
        except (httpx.HTTPError, ElementTree.ParseError, OSError, ValueError) as exc:
            if _catalog:
                return _catalog
            raise HTTPException(status_code=503, detail="暫時無法取得國道 CCTV 清單") from exc
        _catalog = cameras
        _catalog_expires_at = time.monotonic() + CATALOG_TTL_SECONDS
        return _catalog


@router.get("")
async def camera_stream(uuid: str = Query(min_length=1, max_length=120)):
    """Return an approved stream URL for an exact official CCTVID."""
    camera = (await get_catalog()).get(uuid)
    if camera is None:
        raise HTTPException(status_code=404, detail="找不到這支國道 CCTV")
    return JSONResponse(
        {"cctvID": camera.id, "imageURL": camera.stream_url},
        headers={"Cache-Control": "no-store"},
    )


@router.get("/random")
async def random_camera():
    """Provide the question service a random official CCTVID and road data."""
    camera = secrets.choice(tuple((await get_catalog()).values()))
    return {
        "cctvID": camera.id,
        "roadName": camera.road_name,
        "roadDirection": camera.direction,
        "locationMile": camera.mile,
    }
