import json
import uuid
from typing import Any, AsyncIterator, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langgraph.errors import GraphInterrupt
from pydantic import BaseModel

from app.graph.builder import get_graph

app = FastAPI(title="Sightglass Control Plane")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NODE_NAMES = {"intake", "inventory", "hitl"}
DEFAULT_TICKET = "Trane XR14 compressor shorted. Need replacement."
SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


class ResumePayload(BaseModel):
    thread_id: str
    approved: bool = True


def _jsonable(obj: Any) -> Any:
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_jsonable(v) for v in obj]
    if hasattr(obj, "model_dump"):
        return _jsonable(obj.model_dump())
    if hasattr(obj, "dict") and callable(obj.dict):
        try:
            return _jsonable(obj.dict())
        except Exception:
            pass
    if hasattr(obj, "__dict__"):
        return _jsonable(vars(obj))
    return str(obj)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


def _serialize_langgraph_event(event: dict, thread_id: str) -> Optional[dict]:
    kind = event.get("event")
    name = event.get("name")
    if name not in NODE_NAMES:
        return None

    data = event.get("data") or {}
    if kind == "on_chain_start":
        return {
            "event": "node_start",
            "node": name,
            "status": "running",
            "thread_id": thread_id,
            "data": _jsonable(data.get("input")),
        }
    if kind == "on_chain_end":
        return {
            "event": "node_end",
            "node": name,
            "status": "completed",
            "thread_id": thread_id,
            "data": _jsonable(data.get("output")),
        }
    return None


def _interrupt_values(snapshot) -> list:
    values = []
    for task in getattr(snapshot, "tasks", ()) or ():
        for item in getattr(task, "interrupts", ()) or ():
            values.append(_jsonable(getattr(item, "value", item)))
    extra = getattr(snapshot, "interrupts", None)
    if extra:
        for item in extra:
            values.append(_jsonable(getattr(item, "value", item)))
    return values


async def event_generator(
    ticket_text: str,
    thread_id: str,
    resume: bool = False,
    resume_value: Any = None,
) -> AsyncIterator[str]:
    """Stream compiled LangGraph transitions as SSE JSON frames."""
    graph = get_graph()
    config = {"configurable": {"thread_id": thread_id}}

    if resume:
        # Continue past interrupt_before=["hitl"]. resume_value is accepted for API symmetry.
        payload: Any = None
    else:
        payload = {
            "ticket_text": ticket_text,
            "extracted_part": None,
            "inventory_status": None,
            "human_approval_required": False,
            "current_node": "intake",
        }

    try:
        async for event in graph.astream_events(payload, config, version="v2"):
            frame = _serialize_langgraph_event(event, thread_id)
            if frame:
                yield _sse(frame)
    except GraphInterrupt:
        pass
    except Exception as exc:
        yield _sse(
            {
                "event": "error",
                "node": None,
                "status": "error",
                "thread_id": thread_id,
                "data": {"message": str(exc)},
            }
        )
        yield "data: [DONE]\n\n"
        return

    snapshot = await graph.aget_state(config)
    values = _jsonable(snapshot.values) if snapshot.values is not None else {}
    interrupts = _interrupt_values(snapshot)
    next_nodes = list(snapshot.next or ())

    if interrupts or "hitl" in next_nodes:
        data = dict(values) if isinstance(values, dict) else {"state": values}
        if not interrupts:
            inventory = data.get("inventory_status") or {}
            interrupts = [
                {
                    "type": "approval_required",
                    "part": data.get("extracted_part"),
                    "inventory_status": inventory,
                    "message": (
                        f"Cost ${inventory.get('cost', 0)} exceeds the $500 risk gate. "
                        "Awaiting human approval."
                    ),
                }
            ]
        data["interrupts"] = interrupts
        yield _sse(
            {
                "event": "paused",
                "node": "hitl",
                "status": "paused",
                "thread_id": thread_id,
                "data": data,
            }
        )
    else:
        yield _sse(
            {
                "event": "completed",
                "node": values.get("current_node") if isinstance(values, dict) else None,
                "status": "completed",
                "thread_id": thread_id,
                "data": values,
            }
        )

    yield "data: [DONE]\n\n"


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "sightglass"}


@app.get("/api/stream")
async def stream(
    ticket_text: str = Query(default=DEFAULT_TICKET),
    thread_id: Optional[str] = Query(default=None),
):
    tid = thread_id or str(uuid.uuid4())
    return StreamingResponse(
        event_generator(ticket_text, tid, resume=False),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@app.post("/api/resume")
async def resume(body: ResumePayload):
    return StreamingResponse(
        event_generator(
            ticket_text="",
            thread_id=body.thread_id,
            resume=True,
            resume_value={"approved": body.approved},
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@app.post("/api/sync")
async def sync(payload: dict):
    """Receives offline payloads from the technician's PWA."""
    return {"status": "synced", "payload": payload}
