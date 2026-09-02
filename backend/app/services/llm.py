import json
import os
import re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from app.graph.state import PartExtraction

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

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


def get_llm() -> ChatOllama:
    """Local Ollama chat model — llama3.1:8b on the field box."""
    return ChatOllama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
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
    """Run structured extraction against local Ollama."""
    llm = get_llm()
    messages = [
        SystemMessage(content=EXTRACT_SYSTEM),
        HumanMessage(content=ticket_text),
    ]

    structured = llm.with_structured_output(PartExtraction)
    try:
        result = await structured.ainvoke(messages)
        if isinstance(result, PartExtraction):
            return result
        return PartExtraction.model_validate(result)
    except Exception:
        raw = await llm.ainvoke(messages)
        content = raw.content if isinstance(raw.content, str) else json.dumps(raw.content)
        return PartExtraction.model_validate_json(_strip_fences(content))
