export type InventoryStatus = {
  in_stock?: boolean;
  cost?: number;
};

export type GraphEvent = {
  event?: string;
  node: string | null;
  status: "running" | "completed" | "paused" | "error";
  thread_id?: string;
  data?: {
    ticket_text?: string;
    extracted_part?: string | null;
    inventory_status?: InventoryStatus | null;
    human_approval_required?: boolean;
    current_node?: string;
    message?: string;
    interrupts?: Array<{ message?: string; part?: string; inventory_status?: InventoryStatus }>;
    [key: string]: unknown;
  } | null;
};

export type AgentSnapshot = {
  ticket_text: string;
  extracted_part: string | null;
  inventory_status: InventoryStatus | null;
  human_approval_required: boolean;
  current_node: string | null;
};
