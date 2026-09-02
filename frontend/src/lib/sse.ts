import type { GraphEvent } from "@/lib/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function parseSseChunk(buffer: string): { frames: GraphEvent[]; rest: string } {
  const frames: GraphEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    const line = part
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!line || line === "[DONE]") continue;
    try {
      frames.push(JSON.parse(line) as GraphEvent);
    } catch {
      // skip malformed frames
    }
  }
  return { frames, rest };
}

export async function consumeSseStream(
  response: Response,
  onEvent: (event: GraphEvent) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error("No response body");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseSseChunk(buffer);
    buffer = rest;
    frames.forEach(onEvent);
  }
}
