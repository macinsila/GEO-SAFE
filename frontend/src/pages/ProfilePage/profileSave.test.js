import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "./index";

global.IS_REACT_ACT_ENVIRONMENT = true;

var mockGeoSafeAPI;

jest.mock("../../services", () => {
  mockGeoSafeAPI = {
    fetchProfile: jest.fn(),
    updateProfile: jest.fn(),
    // GS-023: ProfilePage embeds GeofenceAlertCard, which loads the subscription on mount.
    fetchGeofenceSubscription: jest.fn().mockResolvedValue({
      id: null,
      user_id: 1,
      enabled: false,
      center_lat: null,
      center_lon: null,
      radius_km: 5,
    }),
    updateGeofenceSubscription: jest.fn(),
  };

  return {
    geoSafeAPI: mockGeoSafeAPI,
  };
});

jest.mock("qrcode.react", () => {
  const React = require("react");
  return {
    QRCodeSVG: ({ value }) => <svg data-testid="qr-code" data-value={value} />,
  };
});

const profile = {
  name: "Ayse Yilmaz",
  blood: "A Rh+",
  allergy: "Penisilin",
  meds: "Metformin",
  chronic: "Diyabet",
  disability_notes: "Tekerlekli sandalye",
  emergency_contact_name: "Mehmet Yilmaz",
  emergency_contact_phone: "05321234567",
  phone: "05327654321",
};

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("profile save flow", () => {
  let container;
  let root;

  const renderProfile = async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={["/profile"]}>
          <ProfilePage />
        </MemoryRouter>
      );
    });
    await flushEffects();
  };

  const saveButton = () =>
    Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Profili Kaydet"
    );

  beforeEach(() => {
    mockGeoSafeAPI.fetchProfile.mockResolvedValue(profile);
    mockGeoSafeAPI.updateProfile.mockResolvedValue(undefined);
    // GS-023: GeofenceAlertCard (embedded in ProfilePage) loads its subscription on mount.
    mockGeoSafeAPI.fetchGeofenceSubscription.mockResolvedValue({
      id: null,
      user_id: 1,
      enabled: false,
      center_lat: null,
      center_lon: null,
      radius_km: 5,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    document.body.removeChild(container);
    container = null;
    root = null;
  });

  it("shows success feedback after saving a valid profile", async () => {
    await renderProfile();

    await act(async () => {
      saveButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(mockGeoSafeAPI.updateProfile).toHaveBeenCalledWith(expect.objectContaining(profile));
    expect(container.textContent).toContain("Profil kaydedildi");
  });

  it("shows failure feedback when profile save is rejected", async () => {
    mockGeoSafeAPI.updateProfile.mockRejectedValue(new Error("network down"));
    await renderProfile();

    await act(async () => {
      saveButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(mockGeoSafeAPI.updateProfile).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Profil kaydedilemedi");
  });
});
