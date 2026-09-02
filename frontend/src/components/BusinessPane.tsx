"use client";

import { AlertTriangle, CheckCircle2, Package, Play, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentSnapshot, GraphEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  ticket: string;
  onTicketChange: (value: string) => void;
  snapshot: AgentSnapshot;
  events: GraphEvent[];
  isStreaming: boolean;
  paused: boolean;
  error: string | null;
  onProcess: () => void;
  onApprove: () => void;
};

export function BusinessPane({
  ticket,
  onTicketChange,
  snapshot,
  events,
  isStreaming,
  paused,
  error,
  onProcess,
  onApprove,
}: Props) {
  const showApprove = paused;
  const interruptMessage =
    snapshot.inventory_status?.cost != null
      ? `Cost $${snapshot.inventory_status.cost} exceeds the $500 risk gate. Awaiting human approval.`
      : "High-cost part. Awaiting human approval.";

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden bg-surface/80 py-0 backdrop-blur-sm">
      <CardHeader className="border-b border-border py-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">Dispatcher</p>
        <CardTitle>Business Pane</CardTitle>
        <CardDescription>Field ticket in. Purchase order out. Humans still sign the big ones.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-6">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Field ticket</span>
          <textarea
            value={ticket}
            onChange={(e) => onTicketChange(e.target.value)}
            rows={4}
            className="min-h-24 w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none ring-cyan/40 placeholder:text-muted focus:ring-2"
            placeholder="Describe the failure and the part you need…"
          />
        </label>

        <Button onClick={onProcess} disabled={isStreaming || !ticket.trim()} className="h-11 w-full sm:w-auto">
          <Play className="size-4" />
          {isStreaming ? "Processing ticket…" : "Process Field Ticket"}
        </Button>

        {error ? (
          <div className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{error}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Fact
            icon={<Package className="size-4 text-cyan" />}
            label="Extracted part"
            value={snapshot.extracted_part ?? "—"}
          />
          <Fact
            icon={<ShieldCheck className="size-4 text-cyan" />}
            label="Inventory"
            value={
              snapshot.inventory_status
                ? `${snapshot.inventory_status.in_stock ? "In stock" : "Backorder"} · $${snapshot.inventory_status.cost ?? "—"}`
                : "—"
            }
          />
        </div>

        {showApprove ? (
          <div className="rounded-lg border border-warn/50 bg-warn/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-warn">Human intervention required</p>
                <p className="mt-1 text-sm text-fg/80">{interruptMessage}</p>
                {snapshot.extracted_part ? (
                  <p className="mt-2 font-mono text-xs text-muted">
                    {snapshot.extracted_part}
                    {snapshot.inventory_status?.cost != null ? ` · $${snapshot.inventory_status.cost}` : ""}
                  </p>
                ) : null}
                <Button
                  onClick={onApprove}
                  disabled={isStreaming}
                  className="mt-4 h-11 bg-active text-bg hover:bg-active/90"
                >
                  <CheckCircle2 className="size-4" />
                  Approve Order
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {events.some((e) => e.event === "completed") && !paused && snapshot.extracted_part ? (
          <div className="rounded-lg border border-active/40 bg-active/10 p-4 text-sm">
            <p className="font-semibold text-active">Ticket cleared</p>
            <p className="mt-1 text-fg/80">{snapshot.extracted_part} is cleared to order.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-bg/60 p-3")}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate font-mono text-sm text-fg">{value}</p>
    </div>
  );
}
