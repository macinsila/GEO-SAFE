/**
 * GS-131: BLE P2P mesh spike (native-only prototype).
 *
 * Implements an app-level flooding mesh over BLE GATT:
 *   scan → connect to GeoSafe peers → exchange messages via GATT notify/write → relay
 *
 * Deduplication uses `originId + id` pairs (GS-095 envelope spec).
 * Hop limit caps relay depth; seenBy list prevents re-relay to the same node.
 *
 * Limitations known before this spike (FEASIBILITY_BLUETOOTH.md §2–4):
 *  - Browsers cannot act as BLE peripheral or scan advertisements reliably → native only.
 *  - Range ~10–30 m open air; far less through reinforced concrete.
 *  - Each hop degrades reliability; mesh needs device density to be useful.
 *  - Continuous scan/advertise is battery-expensive — mesh is opt-in, not always-on.
 *  - iOS backgrounding moves advertisement UUID to overflow area; cross-platform
 *    background discovery is unreliable.
 *  - BLE default write MTU ≈ 20 B → messages are chunked and reassembled.
 *
 * Spike verdict (see ADR-001): beacon (GS-132) validates the native stack first;
 * full productionised mesh (GS-138) deferred until beacon pilot results are in.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const GEOSAFE_MESH_SERVICE_UUID = "0000a520-0000-1000-8000-00805f9b34fb";
export const GEOSAFE_MESH_CHAR_UUID    = "0000a521-0000-1000-8000-00805f9b34fb";

const MAX_HOP_LIMIT       = 3;
const CHUNK_SIZE          = 20;   // BLE default MTU
const SEEN_TTL_MS         = 5 * 60 * 1_000;

export type MeshMessageType = "chat" | "sos" | "ack";

/** GS-095 unified envelope (mesh fields only; full schema also has geo, priority, integrity) */
export interface MeshEnvelope {
  id: string;
  originId: string;
  hopCount: number;
  hopLimit: number;
  seenBy: string[];
  type: MeshMessageType;
  body: string;
  createdAt: string;  // ISO-8601
  schemaVersion: 1;
}

export interface UseBLEMeshResult {
  isScanning: boolean;
  messages: MeshEnvelope[];
  peers: string[];
  error: string | null;
  startMesh: (deviceId: string) => Promise<void>;
  stopMesh: () => Promise<void>;
  sendMessage: (body: string, type?: MeshMessageType) => Promise<void>;
}

export function useBLEMesh(): UseBLEMeshResult {
  const [isScanning, setIsScanning]   = useState(false);
  const [messages, setMessages]       = useState<MeshEnvelope[]>([]);
  const [peers, setPeers]             = useState<string[]>([]);
  const [error, setError]             = useState<string | null>(null);

  const deviceIdRef         = useRef<string>("");
  const seenRef             = useRef<Map<string, number>>(new Map());
  const connectedPeersRef   = useRef<Set<string>>(new Set());
  const inboundBuffersRef   = useRef<Map<string, Uint8Array[]>>(new Map());

  // Prune stale dedup entries every minute
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - SEEN_TTL_MS;
      for (const [key, ts] of seenRef.current.entries()) {
        if (ts < cutoff) seenRef.current.delete(key);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const markSeen = (originId: string, id: string): boolean => {
    const key = `${originId}:${id}`;
    if (seenRef.current.has(key)) return true;
    seenRef.current.set(key, Date.now());
    return false;
  };

  const relayToAll = useCallback(
    async (
      BleClient: (typeof import("@capacitor-community/bluetooth-le"))["BleClient"],
      envelope: MeshEnvelope
    ) => {
      const relay: MeshEnvelope = {
        ...envelope,
        hopCount: envelope.hopCount + 1,
        seenBy: [...envelope.seenBy, deviceIdRef.current],
      };
      const encoded = new TextEncoder().encode(JSON.stringify(relay));
      for (const peerId of connectedPeersRef.current) {
        if (relay.seenBy.includes(peerId)) continue; // already visited this node
        for (let offset = 0; offset < encoded.length; offset += CHUNK_SIZE) {
          const chunk = encoded.slice(offset, offset + CHUNK_SIZE);
          await BleClient.write(
            peerId,
            GEOSAFE_MESH_SERVICE_UUID,
            GEOSAFE_MESH_CHAR_UUID,
            new DataView(chunk.buffer)
          ).catch(() => {});
        }
      }
    },
    []
  );

  const handleNotification = useCallback(
    (
      BleClient: (typeof import("@capacitor-community/bluetooth-le"))["BleClient"],
      peerId: string,
      raw: DataView
    ) => {
      // Accumulate chunks until we can parse valid JSON
      const buffers = inboundBuffersRef.current.get(peerId) ?? [];
      buffers.push(new Uint8Array(raw.buffer));
      inboundBuffersRef.current.set(peerId, buffers);

      const merged = new Uint8Array(buffers.reduce((acc, b) => acc + b.length, 0));
      let offset = 0;
      for (const b of buffers) { merged.set(b, offset); offset += b.length; }

      try {
        const text = new TextDecoder().decode(merged);
        const envelope: MeshEnvelope = JSON.parse(text);
        inboundBuffersRef.current.delete(peerId); // successful parse → clear buffer

        if (markSeen(envelope.originId, envelope.id)) return;
        if (envelope.hopCount >= envelope.hopLimit) return;

        setMessages((prev) => [...prev, envelope]);
        relayToAll(BleClient, envelope);
      } catch {
        // incomplete chunk — keep buffer and wait for next chunk
      }
    },
    [relayToAll]
  );

  const startMesh = useCallback(async (deviceId: string) => {
    let BleClient: (typeof import("@capacitor-community/bluetooth-le"))["BleClient"];
    try {
      ({ BleClient } = await import("@capacitor-community/bluetooth-le"));
    } catch {
      setError("BLE plugin unavailable — requires native Capacitor build (GS-130)");
      return;
    }

    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      deviceIdRef.current = deviceId;
      setIsScanning(true);
      setError(null);

      await BleClient.requestLEScan(
        { services: [GEOSAFE_MESH_SERVICE_UUID] },
        (result) => {
          const peerId = result.device.deviceId;
          if (connectedPeersRef.current.has(peerId)) return;

          BleClient.connect(peerId, () => {
            // onDisconnect
            connectedPeersRef.current.delete(peerId);
            inboundBuffersRef.current.delete(peerId);
            setPeers((prev) => prev.filter((p) => p !== peerId));
          })
            .then(async () => {
              connectedPeersRef.current.add(peerId);
              setPeers((prev) => [...new Set([...prev, peerId])]);
              await BleClient.startNotifications(
                peerId,
                GEOSAFE_MESH_SERVICE_UUID,
                GEOSAFE_MESH_CHAR_UUID,
                (data) => handleNotification(BleClient, peerId, data)
              );
            })
            .catch((err: unknown) => setError(String(err)));
        }
      );
    } catch (err) {
      setError(String(err));
      setIsScanning(false);
    }
  }, [handleNotification]);

  const stopMesh = useCallback(async () => {
    let BleClient: (typeof import("@capacitor-community/bluetooth-le"))["BleClient"];
    try {
      ({ BleClient } = await import("@capacitor-community/bluetooth-le"));
      await BleClient.stopLEScan().catch(() => {});
      for (const peerId of connectedPeersRef.current) {
        await BleClient.disconnect(peerId).catch(() => {});
      }
    } catch {}
    connectedPeersRef.current.clear();
    inboundBuffersRef.current.clear();
    setPeers([]);
    setIsScanning(false);
  }, []);

  const sendMessage = useCallback(async (body: string, type: MeshMessageType = "chat") => {
    const myId = deviceIdRef.current;
    if (!myId) {
      setError("Mesh not started — call startMesh() first");
      return;
    }

    const envelope: MeshEnvelope = {
      id: crypto.randomUUID(),
      originId: myId,
      hopCount: 0,
      hopLimit: MAX_HOP_LIMIT,
      seenBy: [myId],
      type,
      body,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    markSeen(envelope.originId, envelope.id); // own message already seen
    setMessages((prev) => [...prev, envelope]);

    let BleClient: (typeof import("@capacitor-community/bluetooth-le"))["BleClient"];
    try {
      ({ BleClient } = await import("@capacitor-community/bluetooth-le"));
    } catch {
      setError("BLE plugin unavailable — requires native Capacitor build (GS-130)");
      return;
    }

    const encoded = new TextEncoder().encode(JSON.stringify(envelope));
    for (const peerId of connectedPeersRef.current) {
      for (let offset = 0; offset < encoded.length; offset += CHUNK_SIZE) {
        const chunk = encoded.slice(offset, offset + CHUNK_SIZE);
        await BleClient.write(
          peerId,
          GEOSAFE_MESH_SERVICE_UUID,
          GEOSAFE_MESH_CHAR_UUID,
          new DataView(chunk.buffer)
        ).catch(() => {});
      }
    }
  }, []);

  return { isScanning, messages, peers, error, startMesh, stopMesh, sendMessage };
}
