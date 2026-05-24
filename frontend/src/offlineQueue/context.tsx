import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  OfflineQueueItem,
  OfflineQueueItemType,
  OfflineQueuePayloadMap,
  createLocalStorageQueueStore,
  deleteOfflineItem,
  listQueueItems,
  maskQueueItemSummary,
  submitWithOfflineSupport,
  syncOfflineQueue,
} from "./queue";

const store = createLocalStorageQueueStore();

interface OfflineQueueContextValue {
  isOnline: boolean;
  items: OfflineQueueItem[];
  syncMessage: string;
  isSyncing: boolean;
  submitOrQueue: <T extends OfflineQueueItemType>(options: {
    type: T;
    payload: OfflineQueuePayloadMap[T];
    hasConsent: boolean;
    submitOnline: (payload: OfflineQueuePayloadMap[T]) => Promise<void>;
  }) => Promise<"submitted" | "queued" | "consent_required">;
  syncNow: () => Promise<void>;
  deleteItem: (id: string) => void;
  refreshItems: () => void;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

function getNavigatorOnline() {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<OfflineQueueItem[]>(() => listQueueItems(store));
  const [isOnline, setIsOnline] = useState(getNavigatorOnline);
  const [syncMessage, setSyncMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshItems = useCallback(() => {
    setItems(listQueueItems(store));
  }, []);

  const syncNow = useCallback(async () => {
    if (!getNavigatorOnline()) {
      setSyncMessage("Çevrim dışıyken bekleyen kayıtlar gönderilemez.");
      return;
    }

    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage("");
    try {
      const result = await syncOfflineQueue(store);
      refreshItems();
      if (result.synced > 0 && result.failed === 0) {
        setSyncMessage("Bekleyen tüm formlar başarıyla gönderildi.");
      } else if (result.synced > 0 && result.failed > 0) {
        setSyncMessage(
          `${result.synced} kayıt gönderildi, ${result.failed} kayıt daha sonra tekrar denenecek.`
        );
      } else if (result.failed > 0) {
        setSyncMessage("Bekleyen formlar gönderilemedi. Bağlantı veya sunucu durumunu kontrol edin.");
      } else {
        setSyncMessage("Bekleyen form bulunmuyor.");
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshItems]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncMessage("İnternet bağlantısı geri geldi. Bekleyen formlar gönderilebilir.");
      if (listQueueItems(store).length > 0) {
        void syncNow();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncMessage("Şu anda çevrim dışısınız. Bazı formlar cihazınızda geçici olarak bekletilebilir.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  const submitOrQueue = useCallback<OfflineQueueContextValue["submitOrQueue"]>(
    async ({ type, payload, hasConsent, submitOnline }) => {
      const result = await submitWithOfflineSupport({
        isOnline: getNavigatorOnline(),
        hasConsent,
        type,
        payload,
        submitOnline,
        store,
      });

      refreshItems();

      if (result.kind === "queued") {
        setSyncMessage("Form internet gelene kadar bu cihazda geçici olarak saklanacak.");
      }

      if (result.kind === "consent_required") {
        setSyncMessage("Çevrim dışı kayıt için önce açık onay vermelisiniz.");
      }

      return result.kind;
    },
    [refreshItems]
  );

  const deleteItem = useCallback(
    (id: string) => {
      deleteOfflineItem(store, id);
      refreshItems();
      setSyncMessage("Bekleyen kayıt cihazdan silindi.");
    },
    [refreshItems]
  );

  const value = useMemo(
    () => ({
      isOnline,
      items,
      syncMessage,
      isSyncing,
      submitOrQueue,
      syncNow,
      deleteItem,
      refreshItems,
    }),
    [deleteItem, isOnline, isSyncing, items, refreshItems, submitOrQueue, syncMessage, syncNow]
  );

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) {
    throw new Error("useOfflineQueue must be used within OfflineQueueProvider");
  }
  return ctx;
}

export function OfflineStatusBanner() {
  const { isOnline, items, syncMessage, isSyncing, syncNow } = useOfflineQueue();
  const hasPending = items.length > 0;

  if (isOnline && !hasPending && !syncMessage) {
    return null;
  }

  const background = isOnline ? "#ecfeff" : "#fff7ed";
  const border = isOnline ? "#67e8f9" : "#fdba74";
  const color = isOnline ? "#155e75" : "#9a3412";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        padding: "10px 16px",
        background,
        borderBottom: `1px solid ${border}`,
        color,
        fontSize: 13,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span>
        {isOnline
          ? syncMessage || "İnternet bağlantısı geri geldi. Bekleyen formlar gönderilebilir."
          : "Şu anda çevrim dışısınız. Bazı formlar cihazınızda geçici olarak bekletilebilir."}
      </span>
      {isOnline && hasPending && (
        <button
          onClick={() => void syncNow()}
          disabled={isSyncing}
          style={{
            border: "1px solid #0891b2",
            background: "#fff",
            color: "#0f766e",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: isSyncing ? "not-allowed" : "pointer",
          }}
        >
          {isSyncing ? "Gönderiliyor..." : "Bekleyenleri Gönder"}
        </button>
      )}
    </div>
  );
}

export function OfflineQueuePanel() {
  const { items, deleteItem, syncNow, isSyncing, isOnline } = useOfflineQueue();

  if (items.length === 0) {
    return null;
  }

  return (
    <aside
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 320,
        maxWidth: "calc(100vw - 32px)",
        background: "#ffffff",
        border: "1px solid #dbeafe",
        borderRadius: 16,
        boxShadow: "0 18px 42px rgba(15, 23, 42, 0.16)",
        padding: 16,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Bekleyen Formlar</div>
          <div style={{ fontSize: 12, color: "#475569" }}>{items.length} kayıt cihazda geçici olarak bekliyor.</div>
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing}
          style={{
            border: "none",
            background: isOnline ? "#0f766e" : "#94a3b8",
            color: "#fff",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: !isOnline || isSyncing ? "not-allowed" : "pointer",
          }}
        >
          {isSyncing ? "Eşitleniyor..." : "Gönder"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 12,
              background: item.status === "failed" ? "#fff7ed" : "#f8fafc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                  {item.type === "emergency"
                    ? "Acil durum"
                    : item.type === "volunteer"
                      ? "Gönüllü"
                      : "Barınma"}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
                  {maskQueueItemSummary(item)}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {new Date(item.createdAt).toLocaleString("tr-TR")}
                </div>
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                style={{
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  color: "#b91c1c",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Sil
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 8 }}>
              Durum: {item.status}
              {item.retryCount > 0 ? ` • Deneme: ${item.retryCount}` : ""}
            </div>
            {item.lastError && (
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                Son hata: {item.lastError}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function OfflineConsentNotice({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      style={{
        background: "#fff7ed",
        border: "1px solid #fdba74",
        borderRadius: 14,
        padding: 14,
        color: "#9a3412",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Çevrim dışı kayıt onayı gerekir</div>
      <div>
        Bu form internet gelene kadar bu cihazda geçici olarak saklanacaktır. Paylaşımlı cihaz
        kullanıyorsanız kaydetmeyin. Dilerseniz bekleyen kaydı daha sonra silebilirsiniz.
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10 }}>
        <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span>Bu bilgilerin internet gelene kadar bu cihazda geçici olarak saklanmasını kabul ediyorum.</span>
      </label>
    </div>
  );
}
