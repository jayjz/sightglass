"use client";

import { useMemo } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GraphEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type NodeStatus = "idle" | "running" | "done" | "paused";

type SightNodeData = {
  label: string;
  status: NodeStatus;
};

type SightNodeType = Node<SightNodeData, "sight">;

type Props = {
  activeNode: string | null;
  completedNodes: string[];
  paused: boolean;
  events: GraphEvent[];
};

function SightNode({ data }: NodeProps<SightNodeType>) {
  const status = data.status;
  return (
    <div
      className={cn(
        "min-w-40 rounded-lg border bg-surface px-5 py-3 text-center transition-shadow duration-300",
        status === "running" && "node-glow-active border-active",
        status === "paused" && "node-glow-paused border-warn",
        status === "done" && "border-cyan/70",
        status === "idle" && "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-cyan !bg-cyan" />
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">node</p>
      <p className="mt-1 font-medium text-fg">{data.label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-[10px] uppercase tracking-wider",
          status === "running" && "text-active",
          status === "paused" && "text-warn",
          status === "done" && "text-cyan",
          status === "idle" && "text-muted",
        )}
      >
        {status}
      </p>
      <Handle type="source" position={Position.Right} className="!size-2 !border-cyan !bg-cyan" />
    </div>
  );
}

const nodeTypes = { sight: SightNode };

function statusFor(id: string, activeNode: string | null, completed: string[], paused: boolean): NodeStatus {
  if (id === "hitl" && paused) return "paused";
  if (activeNode === id) return "running";
  if (completed.includes(id)) return "done";
  return "idle";
}

export function EngPane({ activeNode, completedNodes, paused, events }: Props) {
  const nodes: SightNodeType[] = useMemo(
    () => [
      {
        id: "intake",
        type: "sight",
        position: { x: 24, y: 110 },
        data: { label: "Intake", status: statusFor("intake", activeNode, completedNodes, paused) },
      },
      {
        id: "inventory",
        type: "sight",
        position: { x: 280, y: 110 },
        data: { label: "Inventory", status: statusFor("inventory", activeNode, completedNodes, paused) },
      },
      {
        id: "hitl",
        type: "sight",
        position: { x: 536, y: 110 },
        data: { label: "HITL", status: statusFor("hitl", activeNode, completedNodes, paused) },
      },
    ],
    [activeNode, completedNodes, paused],
  );

  const edges: Edge[] = useMemo(
    () => [
      {
        id: "e-intake-inventory",
        source: "intake",
        target: "inventory",
        animated: activeNode === "inventory" || completedNodes.includes("inventory"),
        style: { stroke: "var(--color-cyan)", strokeWidth: 1.5 },
      },
      {
        id: "e-inventory-hitl",
        source: "inventory",
        target: "hitl",
        animated: activeNode === "hitl" || paused,
        style: { stroke: paused ? "var(--color-warn)" : "var(--color-cyan)", strokeWidth: 1.5 },
      },
    ],
    [activeNode, completedNodes, paused],
  );

  const latest = events.at(-1);

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden bg-surface/80 py-0 backdrop-blur-sm">
      <CardHeader className="border-b border-border py-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-active">Live graph</p>
        <CardTitle>Engineering Pane</CardTitle>
        <CardDescription>Intake → Inventory → HITL. Active node glows with the stream.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        <div className="relative min-h-[280px] flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            panOnDrag
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
          >
            <Background color="var(--color-border)" gap={18} size={1} />
          </ReactFlow>
        </div>
        <div className="max-h-40 overflow-y-auto border-t border-border bg-bg/70 px-4 py-3 font-mono text-[11px] leading-5 text-active">
          {events.length === 0 ? (
            <p className="text-muted">Waiting for stream…</p>
          ) : (
            events.map((evt, i) => (
              <pre key={`${evt.node}-${evt.status}-${i}`} className="whitespace-pre-wrap text-active/90">
                {JSON.stringify(
                  { event: evt.event, node: evt.node, status: evt.status, data: evt.data },
                  null,
                  0,
                )}
              </pre>
            ))
          )}
          {latest?.status === "running" ? <p className="text-muted">streaming {latest.node}…</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
