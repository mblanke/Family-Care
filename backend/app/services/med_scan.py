import base64
import json
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.config import get_settings
from app.models.medication import MED_SLOTS


class ScanUnavailable(Exception):
    pass


@dataclass
class ExtractedMed:
    name: str
    dose: str
    slot: str
    prescriber: str | None


_SLOT_SYNONYMS = {
    "morning": "morning",
    "am": "morning",
    "breakfast": "morning",
    "noon": "noon",
    "lunch": "noon",
    "midday": "noon",
    "evening": "evening",
    "supper": "evening",
    "supper-time": "evening",
    "dinner": "evening",
    "pm": "evening",
    "bedtime": "bedtime",
    "bed": "bedtime",
    "night": "bedtime",
    "hs": "bedtime",
}


def normalize_slot(raw: str) -> str:
    key = (raw or "").strip().lower()
    for token, slot in _SLOT_SYNONYMS.items():
        if token in key:
            return slot
    return "morning"  # never drop a med over an unreadable slot; default so admin can fix it


def parse_candidates(payload: dict) -> list[ExtractedMed]:
    out: list[ExtractedMed] = []
    for m in payload.get("medications", []):
        name = (m.get("name") or "").strip()
        if not name:
            continue
        out.append(ExtractedMed(
            name=name,
            dose=(m.get("dose") or "").strip(),
            slot=normalize_slot(m.get("time_of_day", "")),
            prescriber=(m.get("prescriber") or None),
        ))
    return out


# Transcription-only — the model must NOT interpret, compute, or infer anything.
_PROMPT = (
    "You are transcribing a pharmacy medication label/printout into structured data. "
    'Return ONLY JSON: {"medications":[{"name","dose","time_of_day","prescriber"}]}. '
    "Copy text exactly as printed. Do NOT calculate, infer, correct, or add doses. "
    "Do NOT comment on interactions or appropriateness. If a field is absent, use null."
)


class MedicationLabelExtractor(Protocol):
    def extract(self, image_bytes: bytes) -> list[ExtractedMed]: ...


class LlmRouterExtractor:
    def extract(self, image_bytes: bytes) -> list[ExtractedMed]:
        s = get_settings()
        if not s.llm_router_url:
            raise ScanUnavailable(
                "Scanning is not configured. Set LLM_ROUTER_URL (and token) in .env."
            )
        b64 = base64.b64encode(image_bytes).decode()
        try:
            r = httpx.post(
                s.llm_router_url,
                headers={"Authorization": f"Bearer {s.llm_router_token}"},
                json={
                    "model": s.llm_router_vision_model,
                    "prompt": _PROMPT,
                    "image_base64": b64,
                    "response_format": "json",
                },
                timeout=60.0,
            )
            r.raise_for_status()
            payload = r.json()
            # router may return the model's JSON text as a string or wrapped in {"content": ...}
            if isinstance(payload, str):
                payload = json.loads(payload)
            if "medications" not in payload and "content" in payload:
                payload = json.loads(payload["content"])
        except (httpx.HTTPError, json.JSONDecodeError, KeyError) as e:
            raise ScanUnavailable(
                f"Could not read the label via llm-router: {e}. You can enter it manually."
            )
        return parse_candidates(payload)


def get_extractor() -> MedicationLabelExtractor:
    return LlmRouterExtractor()
