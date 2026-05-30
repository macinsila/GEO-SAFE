import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import QRCardPage, { encode } from "./index";

global.IS_REACT_ACT_ENVIRONMENT = true;

var mockFetchQRIdentity;

jest.mock("../../services", () => {
  mockFetchQRIdentity = jest.fn();
  return { geoSafeAPI: { fetchQRIdentity: (...args) => mockFetchQRIdentity(...args) } };
});

jest.mock("qrcode.react", () => {
  const React = require("react");
  return {
    QRCodeSVG: ({ value }) => <svg data-testid="qr-svg" data-value={value} />,
    QRCodeCanvas: ({ value }) => <canvas data-testid="qr-canvas" data-value={value} />,
  };
});

// ── encode (pure logic) ───────────────────────────────────────────────────────

describe("encode", () => {
  it("produces a non-empty base64 string", () => {
    const result = encode({ v: 1, name: "Ali V." });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("round-trips through JSON.parse(decodeURIComponent(escape(atob(...))))", () => {
    const obj = { v: 1, name: "Ayşe Y.", blood: "A Rh+" };
    const encoded = encode(obj);
    const decoded = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    expect(decoded).toEqual(obj);
  });

  it("encodes an empty object without throwing", () => {
    expect(() => encode({})).not.toThrow();
  });
});

// ── QRCardPage component ──────────────────────────────────────────────────────

const sampleQRData = {
  qr_payload: {
    v: 1,
    name: "Ayşe Y.",
    blood: "A Rh+",
    allergies: "Penisilin",
    medications: "",
    conditions: "",
    disability: "",
    issued: "2026-05-29",
  },
  display_name: "Ayşe Yılmaz",
  issued_at: "2026-05-29",
};

describe("QRCardPage", () => {
  let container;
  let root;

  const render = async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter>
          <QRCardPage />
        </MemoryRouter>
      );
    });
  };

  const flushEffects = async () => {
    await act(async () => { await Promise.resolve(); });
  };

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

  it("shows the loading state while data is being fetched", async () => {
    mockFetchQRIdentity.mockReturnValue(new Promise(() => {}));
    await render();
    expect(container.textContent).toContain("yükleniyor");
  });

  it("shows the error state when fetchQRIdentity rejects", async () => {
    mockFetchQRIdentity.mockRejectedValue(new Error("network error"));
    await render();
    await flushEffects();
    expect(container.textContent).toContain("alınamadı");
  });

  it("renders the QR card when data loads successfully", async () => {
    mockFetchQRIdentity.mockResolvedValue(sampleQRData);
    await render();
    await flushEffects();
    expect(container.textContent).toContain("Ayşe Yılmaz");
    expect(container.querySelector('[data-testid="qr-svg"]')).not.toBeNull();
  });

  it("shows health fields from the payload on the card", async () => {
    mockFetchQRIdentity.mockResolvedValue(sampleQRData);
    await render();
    await flushEffects();
    expect(container.textContent).toContain("Penisilin");
    expect(container.textContent).toContain("A Rh+");
  });

  it("shows 'no health info' message when all health fields are empty", async () => {
    mockFetchQRIdentity.mockResolvedValue({
      ...sampleQRData,
      qr_payload: {
        ...sampleQRData.qr_payload,
        allergies: "",
        medications: "",
        conditions: "",
        disability: "",
      },
    });
    await render();
    await flushEffects();
    expect(container.textContent).toContain("Sağlık bilgisi girilmemiş");
  });

  it("renders PNG download and print buttons", async () => {
    mockFetchQRIdentity.mockResolvedValue(sampleQRData);
    await render();
    await flushEffects();
    expect(container.textContent).toContain("PNG İndir");
    expect(container.textContent).toContain("Yazdır");
  });
});
