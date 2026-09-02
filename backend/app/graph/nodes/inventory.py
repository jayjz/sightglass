from app.graph.state import AgentState
from app.services.db import APPROVAL_THRESHOLD, lookup_part


async def inventory_node(state: AgentState) -> dict:
    """Mock warehouse lookup. Parts over $500 require a human signature."""
    status = lookup_part(state.get("extracted_part"))
    return {
        "inventory_status": status,
        "human_approval_required": status["cost"] > APPROVAL_THRESHOLD,
        "current_node": "inventory",
    }
