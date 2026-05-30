/**
 * GS-110: Ops chat panel.
 *
 * A collapsible floating panel mounted inside OperationsLayout.
 * - Loads the last 50 messages on open.
 * - Receives new messages via the SSE stream (type === "chat_message").
 * - Sends messages through the POST /api/v1/chat/messages API.
 */

import React, { useEffect, useRef, useState } from "react";
import { geoSafeAPI } from "../../services";
import { ChatMessage } from "../../types";
import { useSSEStream } from "../../hooks/useSSEStream";

interface Props {
  open: boolean;
  onClose: () => void;
  room?: string;
}

export default function ChatPanel({ open, onClose, room = "ops" }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastEvent = useSSEStream(open);

  // Load history when panel opens
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadError("");
    geoSafeAPI
      .fetchChatHistory(room)
      .then((msgs) => { if (mounted) setMessages(msgs); })
      .catch(() => { if (mounted) setLoadError("Mesajlar yüklenemedi."); });
    return () => { mounted = false; };
  }, [open, room]);

  // Receive live messages via SSE
  useEffect(() => {
    if (!lastEvent || lastEvent.type !== "chat_message") return;
    const incoming = lastEvent.data as unknown as ChatMessage;
    if (incoming.room !== room) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === incoming.id)) return prev;
      return [...prev, incoming];
    });
  }, [lastEvent, room]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const msg = await geoSafeAPI.sendChatMessage({ body, room });
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      setDraft("");
    } catch {
      // swallow — SSE will deliver the message if it succeeded server-side
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="chat-panel" role="dialog" aria-label="Operasyon sohbet kanalı">
      <div className="chat-panel-header">
        <span>Ops Kanalı — #{room}</span>
        <button type="button" onClick={onClose} aria-label="Sohbeti kapat">
          ✕
        </button>
      </div>

      <div className="chat-panel-messages">
        {loadError ? (
          <p className="chat-error">{loadError}</p>
        ) : messages.length === 0 ? (
          <p className="chat-empty">Henüz mesaj yok.</p>
        ) : (
          messages.map((msg) => (
            <article key={msg.id} className="chat-message">
              <span className="chat-author">{msg.user_name}</span>
              <span className="chat-time">
                {new Date(msg.created_at).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <p>{msg.body}</p>
            </article>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-panel-input" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Mesaj yaz..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          disabled={sending}
          aria-label="Mesaj metni"
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          {sending ? "…" : "Gönder"}
        </button>
      </form>
    </div>
  );
}
