from app.graph.state import AgentState
from app.services.llm import extract_part


async def intake_node(state: AgentState) -> dict:
    """Parse ticket_text with local Ollama and write extracted_part onto state."""
    extraction = await extract_part(state["ticket_text"])
    return {
        "extracted_part": extraction.part_name,
        "current_node": "intake",
    }
