/**
 * GS-111: Neighborhood / area channels.
 *
 * Lists area channels (location-sorted with "suggested" badges for channels whose
 * radius covers the user), lets the user join/leave, and opens a live message view
 * per channel. Messages persist server-side and stream over the existing SSE channel
 * (type "chat_message", room === slug). Operators/admins get moderation actions
 * (remove message); everyone can report.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { geoSafeAPI } from "../services";
import { Channel, ChannelMessage } from "../types";
import { useSSEStream } from "../hooks/useSSEStream";
import { useLocation } from "../hooks/useLocation";
import { useAuth } from "../context/AuthContext";

export default function ChannelsPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const { lat, lon, requestLocation } = useLocation({ lowPower: true });

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canModerate = role === "admin" || role === "operator";
  const lastEvent = useSSEStream(activeSlug !== null);

  const activeChannel = useMemo(
    () => channels.find((c) => c.slug === activeSlug) || null,
    [channels, activeSlug]
  );

  const loadChannels = useCallback(() => {
    geoSafeAPI
      .fetchChannels(lat ?? undefined, lon ?? undefined)
      .then(setChannels)
      .catch(() => setError(t("common.error")));
  }, [lat, lon, t]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Load history when a channel is opened.
  useEffect(() => {
    if (!activeSlug) return;
    let mounted = true;
    geoSafeAPI
      .fetchChannelMessages(activeSlug)
      .then((msgs) => mounted && setMessages(msgs))
      .catch(() => mounted && setMessages([]));
    return () => {
      mounted = false;
    };
  }, [activeSlug]);

  // Live messages for the active channel.
  useEffect(() => {
    if (!lastEvent || lastEvent.type !== "chat_message" || !activeSlug) return;
    const incoming = lastEvent.data as unknown as ChannelMessage;
    if (incoming.room !== activeSlug) return;
    setMessages((prev) =>
      prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
    );
  }, [lastEvent, activeSlug]);

  const handleJoin = async (slug: string) => {
    await geoSafeAPI.joinChannel(slug);
    loadChannels();
    setActiveSlug(slug);
  };

  const handleLeave = async (slug: string) => {
    await geoSafeAPI.leaveChannel(slug);
    if (activeSlug === slug) setActiveSlug(null);
    loadChannels();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeSlug) return;
    setError("");
    try {
      const msg = await geoSafeAPI.sendChannelMessage(activeSlug, body);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setDraft("");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setError(t("channels.muted"));
      else setError(t("common.error"));
    }
  };

  const handleReport = async (id: number) => {
    await geoSafeAPI.reportChannelMessage(id);
    setNotice(t("channels.reported"));
  };

  const handleRemove = async (id: number) => {
    await geoSafeAPI.removeChannelMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setNotice(t("channels.removed"));
  };

  return (
    <div className="channels-page">
      <aside className="channels-sidebar">
        <h2>{t("channels.title")}</h2>
        <p className="channels-subtitle">{t("channels.subtitle")}</p>
        <button type="button" onClick={requestLocation} className="channel-join-btn">
          {t("channels.useLocation")}
        </button>

        {error && <p className="offline-map-status">{error}</p>}

        {channels.length === 0 ? (
          <p>{t("channels.empty")}</p>
        ) : (
          <ul className="channel-list">
            {channels.map((c) => (
              <li
                key={c.id}
                className={`channel-item ${c.slug === activeSlug ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="channel-name"
                  onClick={() => setActiveSlug(c.slug)}
                  style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1 }}
                >
                  {c.name}
                  {c.suggested && (
                    <span className="channel-suggested-badge">{t("channels.suggested")}</span>
                  )}
                  <span className="channel-meta">
                    {c.distance_km !== null
                      ? t("channels.distanceKm", { km: c.distance_km })
                      : ""}
                  </span>
                </button>
                {c.joined ? (
                  <button
                    type="button"
                    className="channel-leave-btn"
                    onClick={() => handleLeave(c.slug)}
                  >
                    {t("channels.leave")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="channel-join-btn"
                    onClick={() => handleJoin(c.slug)}
                  >
                    {t("channels.join")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="channel-view">
        {!activeChannel ? (
          <div className="channel-view-header">{t("channels.nearby")}</div>
        ) : (
          <>
            <div className="channel-view-header">#{activeChannel.slug} — {activeChannel.name}</div>

            <div className="channel-messages">
              {messages.length === 0 ? (
                <p>{t("channels.noMessages")}</p>
              ) : (
                messages.map((m) => (
                  <article key={m.id} className="channel-msg">
                    <div className="channel-msg-head">
                      <span>{m.user_name}</span>
                      <span>
                        {new Date(m.created_at).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p>{m.body}</p>
                    <div>
                      <button
                        type="button"
                        className="channel-msg-report"
                        onClick={() => handleReport(m.id)}
                      >
                        {t("channels.report")}
                      </button>
                      {canModerate && (
                        <button
                          type="button"
                          className="channel-msg-report"
                          onClick={() => handleRemove(m.id)}
                        >
                          {t("channels.remove")}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>

            {activeChannel.joined ? (
              <form className="channel-input" onSubmit={handleSend}>
                <input
                  type="text"
                  placeholder={t("channels.message")}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={1000}
                  aria-label={t("channels.message")}
                />
                <button type="submit" disabled={!draft.trim()}>
                  {t("channels.send")}
                </button>
              </form>
            ) : (
              <p className="channel-view-header">{t("channels.joinToPost")}</p>
            )}
          </>
        )}
        {notice && <p className="offline-map-status">{notice}</p>}
      </main>
    </div>
  );
}
