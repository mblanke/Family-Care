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


def _media_type(image_bytes: bytes) -> str:
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"  # default — phone-camera labels are JPEG


def _json_from_content(content: str) -> dict:
    # The model returns the JSON as its message text; isolate the object in case it
    # wraps it in ```json fences or stray prose (find first '{' .. last '}').
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise json.JSONDecodeError("no JSON object in model output", content or "", 0)
    return json.loads(content[start : end + 1])


class LlmRouterExtractor:
    """Posts to an OpenAI-compatible vision endpoint (e.g. LiteLLM /v1/chat/completions).

    LLM_ROUTER_URL must be the full chat-completions URL and LLM_ROUTER_VISION_MODEL a
    vision-capable model alias served by the router (e.g. `sonnet`).
    """

    def extract(self, image_bytes: bytes) -> list[ExtractedMed]:
        s = get_settings()
        if not s.llm_router_url:
            raise ScanUnavailable(
                "Scanning is not configured. Set LLM_ROUTER_URL (and token) in .env."
            )
        b64 = base64.b64encode(image_bytes).decode()
        data_url = f"data:{_media_type(image_bytes)};base64,{b64}"
        try:
            r = httpx.post(
                s.llm_router_url,
                headers={"Authorization": f"Bearer {s.llm_router_token}"},
                json={
                    "model": s.llm_router_vision_model,
                    "max_tokens": 1024,
                    "temperature": 0,  # transcription must be deterministic, not creative
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": _PROMPT},
                                {"type": "image_url", "image_url": {"url": data_url}},
                            ],
                        }
                    ],
                },
                timeout=60.0,
            )
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            payload = _json_from_content(content)
        except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError) as e:
            raise ScanUnavailable(
                f"Could not read the label via llm-router: {e}. You can enter it manually."
            )
        return parse_candidates(payload)


def get_extractor() -> MedicationLabelExtractor:
    return LlmRouterExtractor()
