/**
 * GS-120: SSE stream hook.
 *
 * Connects to /api/v1/sse/announcements and exposes typed events so
 * components can replace polling with a live push-based update.
 *
 * The SSE endpoint is unauthenticated — the stream carries public events
 * (announcements, low_stock_alert, chat_message) to all connected browsers.
 *
 * Usage:
 *   const lastEvent = useSSEStream();
 *   useEffect(() => {
 *     if (!lastEvent) return;
 *     if (lastEvent.type === "announcement") { ... }
 *   }, [lastEvent]);
 */

import { useEffect, useRef, useState } from "react";

export interface SSEEvent {
  type: "announcement" | "low_stock_alert" | "chat_message" | string;
  data: Record<string, unknown>;
}

const SSE_URL = `${
  (process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/+$/, "")
}/api/v1/sse/announcements`;

const RECONNECT_DELAY_MS = 5_000;

export function useSSEStream(enabled = true): SSEEvent | null {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (cancelled) return;

      const es = new EventSource(SSE_URL);
      esRef.current = es;

      es.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data as string) as SSEEvent;
          if (!cancelled) setLastEvent(parsed);
        } catch {
          // malformed frame — ignore
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled]);

  return lastEvent;
}
