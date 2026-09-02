"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { BusinessPane } from "@/components/BusinessPane";
import { EngPane } from "@/components/EngPane";
import { API_BASE, consumeSseStream } from "@/lib/sse";
import type { AgentSnapshot, GraphEvent } from "@/lib/types";

const DEFAULT_TICKET = "Trane XR14 compressor shorted. Need replacement.";

const EMPTY_SNAPSHOT: AgentSnapshot = {
  ticket_text: DEFAULT_TICKET,
  extracted_part: null,
  inventory_status: null,
  human_approval_required: false,
  current_node: null,
};

function mergeSnapshot(prev: AgentSnapshot, event: GraphEvent): AgentSnapshot {
  const data = event.data ?? {};
  return {
    ticket_text: (data.ticket_text as string | undefined) ?? prev.ticket_text,
    extracted_part:
      data.extracted_part !== undefined ? (data.extracted_part as string | null) : prev.extracted_part,
    inventory_status:
      data.inventory_status !== undefined
        ? (data.inventory_status as AgentSnapshot["inventory_status"])
        : prev.inventory_status,
    human_approval_required:
      data.human_approval_required !== undefined
        ? Boolean(data.human_approval_required)
        : prev.human_approval_required,
    current_node: event.node ?? (data.current_node as string | undefined) ?? prev.current_node,
  };
}

export default function Home() {
  const [ticket, setTicket] = useState(DEFAULT_TICKET);
  const [events, setEvents] = useState<GraphEvent[]>([]);
  const [snapshot, setSnapshot] = useState<AgentSnapshot>(EMPTY_SNAPSHOT);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [completedNodes, setCompletedNodes] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const applyEvent = useCallback((event: GraphEvent) => {
    if (event.thread_id) threadIdRef.current = event.thread_id;
    setEvents((prev) => [...prev, event]);
    setSnapshot((prev) => mergeSnapshot(prev, event));

    if (event.status === "error") {
      setError(event.data?.message ?? "Graph failed.");
      return;
    }
    if (event.node && event.status === "running") {
      setActiveNode(event.node);
      if (event.node === "hitl") setPaused(true);
    }
    if (event.node && event.status === "completed") {
      setCompletedNodes((prev) => (prev.includes(event.node!) ? prev : [...prev, event.node!]));
      if (event.node === "hitl") setPaused(false);
    }
    if (event.status === "paused" || event.event === "paused" || event.node === "hitl") {
      setPaused(true);
      setActiveNode("hitl");
    }
    if (event.event === "completed" && event.status === "completed") {
      setActiveNode(null);
    }
  }, []);

  const startStream = useCallback(() => {
    sourceRef.current?.close();
    const threadId = crypto.randomUUID();
    threadIdRef.current = threadId;
    setEvents([]);
    setCompletedNodes([]);
    setActiveNode("intake");
    setPaused(false);
    setError(null);
    setIsStreaming(true);
    setSnapshot({
      ...EMPTY_SNAPSHOT,
      ticket_text: ticket,
    });

    const params = new URLSearchParams({
      ticket_text: ticket,
      thread_id: threadId,
    });
    const source = new EventSource(`${API_BASE}/api/stream?${params.toString()}`);
    sourceRef.current = source;
    let gotFrame = false;

    source.onmessage = (message) => {
      if (message.data === "[DONE]") {
        source.close();
        setIsStreaming(false);
        return;
      }
      gotFrame = true;
      try {
        applyEvent(JSON.parse(message.data) as GraphEvent);
      } catch {
        setError("Malformed SSE frame");
      }
    };
    source.onerror = () => {
      source.close();
      setIsStreaming(false);
      if (!gotFrame) setError("Lost connection to the control plane.");
    };
  }, [applyEvent, ticket]);

  const approveOrder = useCallback(async () => {
    const threadId = threadIdRef.current;
    if (!threadId) return;
    sourceRef.current?.close();
    setIsStreaming(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, approved: true }),
      });
      if (!response.ok) {
        throw new Error(`Resume failed (${response.status})`);
      }
      await consumeSseStream(response, applyEvent);
      setPaused(false);
      setCompletedNodes((prev) => (prev.includes("hitl") ? prev : [...prev, "hitl"]));
      setActiveNode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume graph");
    } finally {
      setIsStreaming(false);
    }
  }, [applyEvent]);

  const headerStatus = useMemo(() => {
    if (error) return "fault";
    if (paused) return "paused";
    if (isStreaming) return "live";
    if (events.length) return "idle";
    return "ready";
  }, [error, paused, isStreaming, events.length]);

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="sightglass-lens" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sightglass</h1>
            <p className="text-sm text-muted">Local-first HVAC control plane</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          <span
            className={
              headerStatus === "live"
                ? "text-active"
                : headerStatus === "paused"
                  ? "text-warn"
                  : headerStatus === "fault"
                    ? "text-warn"
                    : "text-cyan"
            }
          >
            {headerStatus}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-4 lg:grid-cols-2 lg:p-6">
        <BusinessPane
          ticket={ticket}
          onTicketChange={setTicket}
          snapshot={snapshot}
          events={events}
          isStreaming={isStreaming}
          paused={paused}
          error={error}
          onProcess={startStream}
          onApprove={approveOrder}
        />
        <EngPane
          activeNode={activeNode}
          completedNodes={completedNodes}
          paused={paused}
          events={events}
        />
      </div>
    </main>
  );
}
