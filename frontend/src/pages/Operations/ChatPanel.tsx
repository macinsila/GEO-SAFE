/**
 * GS-110 / GS-112: Ops chat panel.
 *
 * Features:
 *   GS-110 — load history, send messages, receive via SSE
 *   GS-112 — presence indicator, read receipts, message search
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { geoSafeAPI } from "../../services";
import { ChatMessage, ChatPresence } from "../../types";
import { useSSEStream } from "../../hooks/useSSEStream";

interface Props {
  open: boolean;
  onClose: () => void;
  room?: string;
  onUnreadChange?: (count: number) => void;
}

export default function ChatPanel({ open, onClose, room = "ops", onUnreadChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [presence, setPresence] = useState<ChatPresence | null>(null);
  const unreadRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastEvent = useSSEStream(open || true); // always listen for unread counting

  // ── Presence lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      geoSafeAPI.leaveChatPresence(room).catch(() => {});
      return;
    }
    geoSafeAPI.joinChatPresence(room)
      .then(setPresence)
      .catch(() => {});

    // Heartbeat every 30s to maintain presence while panel is open
    const hb = setInterval(() => {
      geoSafeAPI.joinChatPresence(room).then(setPresence).catch(() => {});
    }, 30_000);
    return () => {
      clearInterval(hb);
      geoSafeAPI.leaveChatPresence(room).catch(() => {});
    };
  }, [open, room]);

  // ── Load history when panel opens ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadError("");
    setSearchQuery("");
    geoSafeAPI
      .fetchChatHistory(room)
      .then((msgs) => {
        if (!mounted) return;
        setMessages(msgs);
        // Mark all as read
        if (msgs.length > 0) {
          const lastId = msgs[msgs.length - 1].id;
          geoSafeAPI.markChatRead(room, lastId).catch(() => {});
        }
        unreadRef.current = 0;
        onUnreadChange?.(0);
      })
      .catch(() => { if (mounted) setLoadError("Mesajlar yüklenemedi."); });
    return () => { mounted = false; };
  }, [open, room, onUnreadChange]);

  // ── SSE events ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "chat_message") {
      const incoming = lastEvent.data as unknown as ChatMessage;
      if (incoming.room !== room) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      if (open) {
        // Panel open — mark as read immediately
        geoSafeAPI.markChatRead(room, incoming.id).catch(() => {});
      } else {
        // Panel closed — increment unread badge
        unreadRef.current += 1;
        onUnreadChange?.(unreadRef.current);
      }
    }

    if (lastEvent.type === "presence_update") {
      const p = lastEvent.data as unknown as ChatPresence;
      if (p.room === room) setPresence(p);
    }
  }, [lastEvent, room, open, onUnreadChange]);

  // ── Scroll to bottom on new messages ───────────────────────────────────────
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const msg = await geoSafeAPI.sendChatMessage({ body, room });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setDraft("");
    } catch {
      // SSE will deliver if server-side succeeded
    } finally {
      setSending(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      // Restore full history
      geoSafeAPI.fetchChatHistory(room).then(setMessages).catch(() => {});
      return;
    }
    setSearching(true);
    try {
      const results = await geoSafeAPI.searchChatMessages(room, q);
      setMessages(results);
    } catch {
      // keep existing messages on error
    } finally {
      setSearching(false);
    }
  }, [room]);

  if (!open) return null;

  return (
    <div className="chat-panel" role="dialog" aria-label="Operasyon sohbet kanalı">
      <div className="chat-panel-header">
        <div className="chat-panel-title">
          <span>Ops Kanalı — #{room}</span>
          {presence !== null && (
            <span className="chat-presence" title={presence.users.join(", ") || "Kimse yok"}>
              {presence.count > 0
                ? `${presence.count} çevrimiçi`
                : "Çevrimdışı"}
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Sohbeti kapat">✕</button>
      </div>

      <div className="chat-panel-search">
        <input
          type="search"
          placeholder="Mesajlarda ara..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          aria-label="Mesajlarda ara"
        />
        {searching && <span className="chat-searching">…</span>}
      </div>

      <div className="chat-panel-messages">
        {loadError ? (
          <p className="chat-error">{loadError}</p>
        ) : messages.length === 0 ? (
          <p className="chat-empty">
            {searchQuery ? "Sonuç bulunamadı." : "Henüz mesaj yok."}
          </p>
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
