# Sightglass 🔍

**Sightglass** is an open-source, local-first agentic control plane designed for high-stakes field operations (HVAC, plumbing, electrical). 

Most AI wrappers act as black boxes, exposing businesses to cloud latency, data leakage, and hallucinated purchase orders. Sightglass solves this by making the invisible engineering visible. It executes complex, multi-step LLM reasoning entirely on local hardware and streams the live LangGraph state transitions directly to a split-screen dashboard via Server-Sent Events (SSE). 

##  Core Capabilities

* **Split-Screen Observability:** A Next.js dual-pane dashboard. The **Business Pane** handles dispatcher logic, while the **Engineering Pane** visualizes the LangGraph state machine in real-time using React Flow.
* **Air-Gapped Inference:** LLM extraction and reasoning are powered entirely by local models (`llama3.1:8b`) via Ollama, ensuring 0% data leakage and zero API token costs.
* **Stateful Human-in-the-Loop (HITL):** Built on LangGraph `MemorySaver`. When an agent proposes a high-risk action (e.g., ordering a part over $500), the graph automatically pauses execution, persists its state to memory, and awaits an asynchronous webhook approval from a human dispatcher before resuming.
* **Streaming Asynchronous Architecture:** Utilizes FastAPI's `StreamingResponse` to push LangGraph `astream_events` to the frontend, eliminating UI blocking during heavy LLM inference.

## System Architecture

```mermaid
graph LR
    subgraph Edge ["Field Edge (PWA)"]
        Tech["Technician Input"]
        DB[("IndexedDB")]
        Tech --> DB
    end

    subgraph ControlPlane ["Control Plane (FastAPI)"]
        API["REST API"]
        Graph["LangGraph State Machine"]
        API --> Graph
    end

    subgraph Compute ["Local Compute"]
        Ollama["Ollama / RTX 4060"]
        Graph --> Ollama
    end

    subgraph Frontend ["Sightglass Dashboard"]
        BizPane["Business Pane (Next.js / Shadcn)"]
        EngPane["Engineering Pane (React Flow)"]
    end

    DB -- "Sync /api/sync" --> API
    Graph -- "SSE Stream" --> BizPane
    Graph -- "SSE Stream" --> EngPane
    EngPane -. "Human Interrupt (/api/resume)" .-> API

##  The Stack

* **AI & Orchestration:** LangGraph, LangChain Core, Ollama (Llama 3.1 8B), Pydantic (Structured Outputs).
* **Backend:** Python, FastAPI, Uvicorn, Server-Sent Events (SSE).
* **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, React Flow.

## The Graph Workflow

1. **`Intake`:** Synchronously parses messy, unstructured field tickets into a strict JSON schema using a local LLM.
2. **`Inventory`:** Queries a mock SQL warehouse for part availability and cost.
3. **`Routing (Edge)`:** Evaluates business logic. If `cost > $500`, routes to `HITL`. Otherwise, routes to `END`.
4. **`HITL`:** Checkpoints the graph state to memory and suspends execution until the frontend issues a `/api/resume` POST request.

##  Local Development Setup

Sightglass is designed to run on consumer-grade hardware (e.g., an NVIDIA RTX 4060) without requiring enterprise cloud budgets.

### Prerequisites

* Python 3.10+
* Node.js 18+
* [Ollama](https://ollama.com/) installed and serving `llama3.1:8b` locally at `http://localhost:11434`.

### 1. Boot the Control Plane (Backend)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

```

### 2. Boot the Dashboard (Frontend)

```bash
cd frontend
npm install
npm run dev

```

### 3. Run the Simulation

Open `http://localhost:3000` in your browser. Submit a mock field ticket on the left pane. Watch the engineering pane map the live node transitions. If you request an expensive part (like a Compressor), watch the graph pause at the risk gate until you click **Approve Order**.

```

