from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import json

app = FastAPI(title="Sightglass Control Plane")

# Allow Next.js to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def event_generator():
    """
    Simulates LangGraph state transitions.
    In Week 2, this will be replaced by actual LangGraph astream_events.
    """
    states = [
        {"node": "intake", "status": "running", "data": {"ticket": "Trane XR14 compressor shorted. Need replacement."}},
        {"node": "inventory_check", "status": "running", "data": {"part": "Compressor", "in_stock": True, "cost": 1250}},
        {"node": "risk_gate", "status": "paused", "data": {"reason": "Cost > $500. Awaiting Human Approval."}}
    ]
    for state in states:
        # Format for Server-Sent Events (SSE)
        yield f"data: {json.dumps(state)}\n\n"
        await asyncio.sleep(1.5)
    yield "data: [DONE]\n\n"

@app.get("/api/stream")
async def stream():
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/sync")
async def sync(payload: dict):
    """
    Receives offline payloads from the technician's PWA.
    """
    return {"status": "synced", "payload": payload}