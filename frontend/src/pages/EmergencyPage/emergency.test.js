import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EmergencyPage, { validateManualCoordinates } from "./index";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../offlineQueue/context", () => ({
  useOfflineQueue: () => ({
    isOnline: true,
    submitOrQueue: jest.fn().mockResolvedValue("submitted"),
  }),
  OfflineConsentNotice: () => null,
}));

jest.mock("../../services", () => ({
  geoSafeAPI: {
    sendEmergency: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../components/FormUX", () => ({
  FieldError: ({ message }) => (message ? <span>{message}</span> : null),
  FormStatus: ({ title, children }) => (
    <div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  ),
}));

// ── validateManualCoordinates (pure logic) ────────────────────────────────────

describe("validateManualCoordinates", () => {
  it("returns no errors for valid Istanbul coordinates", () => {
    expect(validateManualCoordinates("41.01", "28.97")).toEqual({});
  });

  it("errors on empty lat", () => {
    const errs = validateManualCoordinates("", "28.97");
    expect(errs.manualLat).toBeTruthy();
    expect(errs.manualLon).toBeUndefined();
  });

  it("errors on empty lon", () => {
    const errs = validateManualCoordinates("41.01", "");
    expect(errs.manualLat).toBeUndefined();
    expect(errs.manualLon).toBeTruthy();
  });

  it("errors on both fields being empty", () => {
    const errs = validateManualCoordinates("", "");
    expect(errs.manualLat).toBeTruthy();
    expect(errs.manualLon).toBeTruthy();
  });

  it("errors when lat is out of the -90..90 range", () => {
    expect(validateManualCoordinates("91", "28.97").manualLat).toBeTruthy();
    expect(validateManualCoordinates("-91", "28.97").manualLat).toBeTruthy();
  });

  it("errors when lon is out of the -180..180 range", () => {
    expect(validateManualCoordinates("41.01", "181").manualLon).toBeTruthy();
    expect(validateManualCoordinates("41.01", "-181").manualLon).toBeTruthy();
  });

  it("errors on non-numeric input", () => {
    expect(validateManualCoordinates("abc", "28.97").manualLat).toBeTruthy();
    expect(validateManualCoordinates("41.01", "xyz").manualLon).toBeTruthy();
  });

  it("accepts boundary values exactly at -90/90 and -180/180", () => {
    expect(validateManualCoordinates("90", "180")).toEqual({});
    expect(validateManualCoordinates("-90", "-180")).toEqual({});
  });
});

// ── EmergencyPage component ───────────────────────────────────────────────────

describe("EmergencyPage", () => {
  let container;
  let root;

  const render = async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter>
          <EmergencyPage />
        </MemoryRouter>
      );
    });
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

  it("renders the category dropdown and submit button", async () => {
    await render();
    expect(container.querySelector("select")).not.toBeNull();
    expect(container.textContent).toContain("Yardım Çağır");
  });

  it("renders all five emergency categories", async () => {
    await render();
    const options = container.querySelectorAll("select option");
    expect(options.length).toBe(5);
    const texts = Array.from(options).map((o) => o.textContent);
    expect(texts).toContain("Enkaz Altındayım");
    expect(texts).toContain("Yangın Var");
  });

  it("shows a description textarea", async () => {
    await render();
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("renders the back-to-home button", async () => {
    await render();
    const backBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Ana Sayfa"
    );
    expect(backBtn).not.toBeUndefined();
  });
});
