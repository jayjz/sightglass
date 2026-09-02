from langgraph.graph import END

from app.graph.state import AgentState


def route_after_inventory(state: AgentState) -> str:
    """Send high-cost parts to HITL; cheap in-policy parts complete immediately."""
    if state.get("human_approval_required"):
        return "hitl"
    return END
