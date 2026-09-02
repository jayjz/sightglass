"use client";

import { useState } from "react";

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = () => {
    setIsStreaming(true);
    setLogs([]);
    const eventSource = new EventSource("http://localhost:8000/api/stream");

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
        setIsStreaming(false);
        return;
      }
      setLogs((prev) => [...prev, event.data]);
    };
  };

  return (
    <main className="flex min-h-screen flex-col p-8 bg-gray-950 text-gray-100">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Sightglass</h1>
        <p className="text-gray-400 mt-2">Local-first agentic control plane for field ops.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Business Pane */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-400">Business Pane</h2>
          <button
            onClick={startStream}
            disabled={isStreaming}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {isStreaming ? "Processing Ticket..." : "Process Field Ticket"}
          </button>
          <div className="mt-6 space-y-4">
            {logs.map((log, i) => {
              const data = JSON.parse(log);
              if (data.node === "risk_gate") {
                return (
                  <div key={i} className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                    <p className="font-bold text-yellow-500">Human Intervention Required</p>
                    <p className="text-sm mt-1">{data.data.reason}</p>
                    <button className="mt-3 bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm">
                      Approve Order
                    </button>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </section>

        {/* Engineering Pane */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 overflow-hidden">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Engineering Pane (Live State)</h2>
          <div className="bg-black rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto">
            {logs.length === 0 && <p className="text-gray-500">Waiting for stream...</p>}
            {logs.map((log, i) => (
              <pre key={i} className="text-green-300 mb-2 whitespace-pre-wrap">
                {JSON.stringify(JSON.parse(log), null, 2)}
              </pre>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}