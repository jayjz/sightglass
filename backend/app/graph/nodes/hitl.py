from app.graph.state import AgentState


async def hitl_node(state: AgentState) -> dict:
    """Passthrough after human approval. The graph pauses *before* this node."""
    return {
        "human_approval_required": False,
        "current_node": "hitl",
    }
