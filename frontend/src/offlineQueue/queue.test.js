const {
  createMemoryQueueStore,
  deleteOfflineItem,
  listQueueItems,
  submitWithOfflineSupport,
  syncOfflineQueue,
} = require("./queue");

describe("offline queue", () => {
  it("does not write to queue without user consent while offline", async () => {
    const store = createMemoryQueueStore();
    const submitOnline = jest.fn().mockResolvedValue(undefined);

    const result = await submitWithOfflineSupport({
      isOnline: false,
      hasConsent: false,
      type: "volunteer",
      payload: {
        full_name: "Test User",
        contact_info: "5551234567",
        skills: ["Ilk yardim"],
      },
      submitOnline,
      store,
    });

    expect(result.kind).toBe("consent_required");
    expect(listQueueItems(store)).toHaveLength(0);
    expect(submitOnline).not.toHaveBeenCalled();
  });

  it("writes to queue after explicit user consent while offline", async () => {
    const store = createMemoryQueueStore();

    const result = await submitWithOfflineSupport({
      isOnline: false,
      hasConsent: true,
      type: "volunteer",
      payload: {
        full_name: "Test User",
        contact_info: "5551234567",
        district: "Kadikoy",
        skills: ["Ilk yardim"],
      },
      submitOnline: jest.fn(),
      store,
    });

    expect(result.kind).toBe("queued");
    expect(listQueueItems(store)).toHaveLength(1);
    expect(listQueueItems(store)[0].status).toBe("pending");
  });

  it("does not persist token or jwt fields in queued payloads", async () => {
    const store = createMemoryQueueStore();

    await submitWithOfflineSupport({
      isOnline: false,
      hasConsent: true,
      type: "emergency",
      payload: {
        durum: "Acil",
        saat: "2026-05-16 12:00",
        harita_link: "https://maps.example",
        enlem: 41.01,
        boylam: 28.97,
        token: "secret",
        jwt: "secret-jwt",
      },
      submitOnline: jest.fn(),
      store,
    });

    expect(listQueueItems(store)[0].payload).toEqual({
      durum: "Acil",
      saat: "2026-05-16 12:00",
      harita_link: "https://maps.example",
      enlem: 41.01,
      boylam: 28.97,
    });
  });

  it("removes item after successful sync", async () => {
    const store = createMemoryQueueStore([
      {
        id: "1",
        type: "volunteer",
        payload: {
          full_name: "Test User",
          contact_info: "5551234567",
          skills: ["Ilk yardim"],
        },
        createdAt: "2026-05-16T00:00:00.000Z",
        status: "pending",
        retryCount: 0,
      },
    ]);

    const result = await syncOfflineQueue(store, {
      volunteer: jest.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(listQueueItems(store)).toHaveLength(0);
  });

  it("keeps item and stores error after failed sync", async () => {
    const store = createMemoryQueueStore([
      {
        id: "1",
        type: "shelter",
        payload: {
          host_name: "Host",
          contact_info: "5551234567",
          capacity: 3,
        },
        createdAt: "2026-05-16T00:00:00.000Z",
        status: "pending",
        retryCount: 0,
      },
    ]);

    const result = await syncOfflineQueue(store, {
      shelter: jest.fn().mockRejectedValue(new Error("network down")),
    });

    const [item] = listQueueItems(store);
    expect(result).toEqual({ synced: 0, failed: 1 });
    expect(item.status).toBe("failed");
    expect(item.retryCount).toBe(1);
    expect(item.lastError).toContain("network down");
  });

  it("deletes pending item on user request", () => {
    const store = createMemoryQueueStore([
      {
        id: "1",
        type: "emergency",
        payload: {
          durum: "Acil",
          saat: "2026-05-16 12:00",
          harita_link: "https://maps.example",
          enlem: 41.01,
          boylam: 28.97,
        },
        createdAt: "2026-05-16T00:00:00.000Z",
        status: "pending",
        retryCount: 0,
      },
    ]);

    deleteOfflineItem(store, "1");
    expect(listQueueItems(store)).toHaveLength(0);
  });
});
