import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  OfflineQueueProvider,
  OfflineStatusBanner,
  OfflineConsentNotice,
  OfflineQueuePanel,
  useOfflineQueue,
} from "./context";

global.IS_REACT_ACT_ENVIRONMENT = true;

// ── OfflineConsentNotice ──────────────────────────────────────────────────────

describe("OfflineConsentNotice", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => { root.unmount(); });
    }
    document.body.removeChild(container);
    container = null;
    root = null;
  });

  it("renders a checkbox with the correct initial checked state", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<OfflineConsentNotice checked={false} onChange={jest.fn()} />);
    });
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it("renders as checked when checked prop is true", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<OfflineConsentNotice checked={true} onChange={jest.fn()} />);
    });
    expect(container.querySelector('input[type="checkbox"]').checked).toBe(true);
  });

  it("renders the consent warning text", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<OfflineConsentNotice checked={false} onChange={jest.fn()} />);
    });
    expect(container.textContent).toContain("Çevrim dışı kayıt onayı");
  });
});

// ── OfflineStatusBanner via OfflineQueueProvider ──────────────────────────────

function BannerHost() {
  return (
    <OfflineQueueProvider>
      <OfflineStatusBanner />
    </OfflineQueueProvider>
  );
}

describe("OfflineStatusBanner", () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => { root.unmount(); });
    }
    document.body.removeChild(container);
    container = null;
    root = null;
  });

  it("renders nothing when online and the queue is empty", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<BannerHost />);
    });

    // navigator.onLine is true in jsdom — banner should not appear
    expect(container.textContent).toBe("");
  });

  it("renders an offline notice when the window goes offline", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<BannerHost />);
    });

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(container.textContent).toContain("çevrim dışı");
  });

  it("shows reconnection message when the window comes back online", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<BannerHost />);
    });

    // First go offline, then come back online
    await act(async () => { window.dispatchEvent(new Event("offline")); });
    await act(async () => { window.dispatchEvent(new Event("online")); });

    expect(container.textContent).toContain("bağlantısı");
  });
});

// ── useOfflineQueue hook ───────────────────────────────────────────────────────

function QueueConsumer({ onValues }) {
  const ctx = useOfflineQueue();
  onValues(ctx);
  return <div data-testid="online">{String(ctx.isOnline)}</div>;
}

describe("useOfflineQueue", () => {
  let container;
  let root;
  let captured;

  beforeEach(() => {
    localStorage.clear();
    captured = null;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => { root.unmount(); });
    }
    document.body.removeChild(container);
    container = null;
    root = null;
  });

  it("provides isOnline=true when navigator.onLine is true", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <OfflineQueueProvider>
          <QueueConsumer onValues={(v) => { captured = v; }} />
        </OfflineQueueProvider>
      );
    });
    expect(container.querySelector('[data-testid="online"]').textContent).toBe("true");
  });

  it("exposes submitOrQueue, deleteItem, syncNow, and refreshItems", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <OfflineQueueProvider>
          <QueueConsumer onValues={(v) => { captured = v; }} />
        </OfflineQueueProvider>
      );
    });
    expect(typeof captured.submitOrQueue).toBe("function");
    expect(typeof captured.deleteItem).toBe("function");
    expect(typeof captured.syncNow).toBe("function");
    expect(typeof captured.refreshItems).toBe("function");
  });

  it("throws if useOfflineQueue is called outside a provider", () => {
    expect(() => {
      const { renderHook } = require("react");
      // Call the hook directly (outside provider) — should throw
      useOfflineQueue();
    }).toThrow();
  });
});

// ── OfflineQueuePanel ─────────────────────────────────────────────────────────

describe("OfflineQueuePanel", () => {
  it("renders nothing when the queue is empty", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root;

    localStorage.clear();
    await act(async () => {
      root = createRoot(container);
      root.render(
        <OfflineQueueProvider>
          <OfflineQueuePanel />
        </OfflineQueueProvider>
      );
    });

    expect(container.textContent).toBe("");
    await act(async () => { root.unmount(); });
    document.body.removeChild(container);
  });
});
