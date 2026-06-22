import os, shutil, time, uuid
TEMP_DIR = os.environ.get("SCAN_TEMP_DIR", "/tmp/familyhub-scans")
KEEP_DIR = os.environ.get("MED_PHOTO_DIR", "/data/med-photos")

def _ensure(d): os.makedirs(d, exist_ok=True)

def stash(image_bytes: bytes) -> str:
    _ensure(TEMP_DIR)
    scan_id = uuid.uuid4().hex
    with open(os.path.join(TEMP_DIR, scan_id), "wb") as f:
        f.write(image_bytes)
    return scan_id

def peek(scan_id: str) -> bytes | None:
    path = os.path.join(TEMP_DIR, scan_id)
    if not os.path.isfile(path): return None
    with open(path, "rb") as f:
        return f.read()

def keep(scan_id: str) -> str | None:
    src = os.path.join(TEMP_DIR, scan_id)
    if not os.path.isfile(src): return None
    _ensure(KEEP_DIR)
    rel = f"{scan_id}.jpg"
    shutil.move(src, os.path.join(KEEP_DIR, rel))
    return rel

def discard(scan_id: str) -> None:
    path = os.path.join(TEMP_DIR, scan_id)
    if os.path.isfile(path): os.remove(path)

def sweep(max_age_seconds: int = 3600) -> int:
    _ensure(TEMP_DIR)
    now = time.time(); n = 0
    for name in os.listdir(TEMP_DIR):
        p = os.path.join(TEMP_DIR, name)
        if os.path.isfile(p) and now - os.path.getmtime(p) > max_age_seconds:
            os.remove(p); n += 1
    return n
