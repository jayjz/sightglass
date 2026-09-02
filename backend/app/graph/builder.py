from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.graph.edges.routing import route_after_inventory
from app.graph.nodes.hitl import hitl_node
from app.graph.nodes.intake import intake_node
from app.graph.nodes.inventory import inventory_node
from app.graph.state import AgentState

_checkpointer = MemorySaver()
_compiled = None


def build_graph():
    workflow = StateGraph(AgentState)
    workflow.add_node("intake", intake_node)
    workflow.add_node("inventory", inventory_node)
    workflow.add_node("hitl", hitl_node)

    workflow.add_edge(START, "intake")
    workflow.add_edge("intake", "inventory")
    workflow.add_conditional_edges(
        "inventory",
        route_after_inventory,
        {"hitl": "hitl", END: END},
    )
    workflow.add_edge("hitl", END)

    # Singleton checkpointer so a paused thread can be resumed from /api/resume.
    # interrupt_before=["hitl"] parks the graph on the HITL passthrough until a dispatcher approves.
    return workflow.compile(checkpointer=_checkpointer, interrupt_before=["hitl"])


def get_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_graph()
    return _compiled
