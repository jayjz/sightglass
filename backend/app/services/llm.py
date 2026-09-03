import json
import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from app.graph.state import PartExtraction

try:
    from openai import APIConnectionError as OpenAIAPIConnectionError
except ImportError:
    OpenAIAPIConnectionError = None  # type: ignore[misc, assignment]

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

_UNREACHABLE_ERRORS: tuple[type[BaseException], ...] = (
    httpx.RequestError,
    httpx.HTTPStatusError,
)
if OpenAIAPIConnectionError is not None:
    _UNREACHABLE_ERRORS = _UNREACHABLE_ERRORS + (OpenAIAPIConnectionError,)

EXTRACT_SYSTEM = """You are the intake parser for Sightglass, a local-first HVAC control plane.
Extract the primary replacement part a technician needs from a field ticket.
Return ONLY valid JSON that matches this schema:
{
  "part_name": string,          // canonical lowercase part, e.g. "compressor"
  "equipment_brand": string|null,
  "equipment_model": string|null,
  "issue": string               // one sentence
}
Do not invent a part that is not implied by the ticket. Prefer the failed component over accessories.
"""


def _provider() -> str:
    return os.getenv("LLM_PROVIDER", "ollama").strip().lower()


def _active_base_url() -> str:
    if _provider() == "grok":
        return os.getenv("XAI_BASE_URL") or "https://api.x.ai/v1"
    return os.getenv("OLLAMA_BASE_URL", OLLAMA_BASE_URL)


def _raise_unreachable(exc: Exception) -> None:
    raise ValueError(
        f"LLM Provider API unreachable at {_active_base_url()}. Check your network and API keys."
    ) from exc


def get_llm() -> BaseChatModel:
    """Return the configured chat model. Grok uses ChatOpenAI + xAI; otherwise local Ollama."""
    if _provider() == "grok":
        timeout = httpx.Timeout(60.0, connect=10.0)
        return ChatOpenAI(
            model=os.getenv("GROK_MODEL", "grok-beta"),
            api_key=os.getenv("XAI_API_KEY"),
            base_url=os.getenv("XAI_BASE_URL"),
            temperature=0,
            timeout=60,
            max_retries=1,
            http_client=httpx.Client(timeout=timeout, follow_redirects=True),
            http_async_client=httpx.AsyncClient(timeout=timeout, follow_redirects=True),
        )
    return ChatOllama(
        model=os.getenv("OLLAMA_MODEL", OLLAMA_MODEL),
        base_url=os.getenv("OLLAMA_BASE_URL", OLLAMA_BASE_URL),
        temperature=0,
        format="json",
    )


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


async def extract_part(ticket_text: str) -> PartExtraction:
    """Run structured extraction against the configured LLM provider."""
    llm = get_llm()
    messages = [
        SystemMessage(content=EXTRACT_SYSTEM),
        HumanMessage(content=ticket_text),
    ]

    try:
        structured = llm.with_structured_output(PartExtraction)
        result = await structured.ainvoke(messages)
        if isinstance(result, PartExtraction):
            return result
        return PartExtraction.model_validate(result)
    except _UNREACHABLE_ERRORS as exc:
        _raise_unreachable(exc)
    except Exception:
        try:
            raw = await llm.ainvoke(messages)
            content = raw.content if isinstance(raw.content, str) else json.dumps(raw.content)
            return PartExtraction.model_validate_json(_strip_fences(content))
        except _UNREACHABLE_ERRORS as exc:
            _raise_unreachable(exc)
