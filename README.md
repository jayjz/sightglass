# Sightglass

**Sightglass** is a local-first, human-in-the-loop agentic control plane for field operations. It makes the invisible engineering visible by streaming live LangGraph state transitions directly to a split-screen dashboard.

## Architecture

```mermaid
graph LR
    subgraph Edge ["Field Edge (PWA)"]
        Tech[Technician Input]
        DB[(IndexedDB)]
        Tech --> DB
    end

    subgraph ControlPlane ["Control Plane (FastAPI)"]
        API[REST API]
        Graph[LangGraph State Machine]
        API --> Graph
    end

    subgraph Compute ["Local Compute"]
        Ollama[Ollama / RTX 4060]
        Graph --> Ollama
    end

    subgraph Frontend ["Sightglass Dashboard"]
        BizPane[Business Pane]
        EngPane[Engineering Pane]
    end

    DB -- "Sync /api/sync" --> API
    Graph -- "SSE Stream" --> BizPane
    Graph -- "SSE Stream" --> EngPane
    EngPane -. "Human Interrupt" .-> API
```

## Principles
* **Observable:** Every node transition is streamed via SSE.
* **Interruptible:** Human-in-the-loop gates prevent hallucinated orders.
* **Local-First:** Runs entirely on local hardware (RTX 4060 / Ollama).