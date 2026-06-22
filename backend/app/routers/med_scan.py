from fastapi import APIRouter, Depends, File, UploadFile
from app.deps import require_role
from app.services import med_scan, scan_store

router = APIRouter(prefix="/api", tags=["med-scan"])
_admin = require_role("admin")

@router.post("/people/{pid}/medications/scan")
def scan(pid: int, file: UploadFile = File(...), _=Depends(_admin)):
    """Read a pharmacy label and return editable candidates. WRITES NOTHING — the admin confirms via the normal add path."""
    image = file.file.read()
    scan_store.sweep()                       # opportunistic cleanup of abandoned scans
    candidates = med_scan.get_extractor().extract(image)
    scan_id = scan_store.stash(image)
    return {"scan_id": scan_id,
            "candidates": [{"name": c.name, "dose": c.dose, "slot": c.slot, "prescriber": c.prescriber}
                           for c in candidates]}
