import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./App";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./context/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    isAuthenticated: true,
    role: "admin",
    token: "test-token",
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock("./offlineQueue/context", () => ({
  OfflineQueueProvider: ({ children }) => children,
  OfflineStatusBanner: () => null,
  OfflineQueuePanel: () => null,
  OfflineConsentNotice: () => <div />,
  useOfflineQueue: () => ({
    isOnline: true,
    submitOrQueue: jest.fn(),
  }),
}));

jest.mock("./services", () => ({
  geoSafeAPI: {
    fetchProfile: () => Promise.resolve({ name: "Test Operator" }),
    fetchEmergenciesAdmin: () => Promise.resolve([]),
    fetchWarehouses: () => Promise.resolve([]),
    fetchSafeZones: () => Promise.resolve([]),
    fetchCriticalStockAdmin: () => Promise.resolve([]),
    fetchCriticalStock: () => Promise.resolve([]),
    fetchAnnouncements: () => Promise.resolve([]),
    fetchPublishedAnnouncements: () => Promise.resolve([]),
    fetchEarthquakes: () => Promise.resolve({ result: [] }),
    fetchWarehouseInventory: () => Promise.resolve({ items: [] }),
    fetchNearestDepot: () => Promise.resolve([]),
    sendEmergency: () => Promise.resolve(),
    updateProfile: () => Promise.resolve(),
    fetchOpenVolunteerTasks: () => Promise.resolve([]),
    fetchMyVolunteerTasks: () => Promise.resolve([]),
    fetchVolunteerTasksAdmin: () => Promise.resolve([]),
    fetchKPISummary: () => Promise.resolve({
      emergencies: { total: 0, new: 0, resolved: 0 },
      tasks: { total: 0, open: 0, done: 0 },
      warehouses: { total: 0, active: 0 },
      safe_zones: { total: 0, active: 0, total_capacity: 0 },
      critical_stock_count: 0,
      volunteer_applications_pending: 0,
    }),
    fetchChatHistory: () => Promise.resolve({ messages: [], total: 0 }),
    joinChatPresence: () => Promise.resolve(),
    leaveChatPresence: () => Promise.resolve(),
    sendChatMessage: () => Promise.resolve(),
    markChatRead: () => Promise.resolve(),
    searchChatMessages: () => Promise.resolve([]),
    claimVolunteerTask: () => Promise.resolve(),
    completeVolunteerTask: () => Promise.resolve(),
    createVolunteerTask: () => Promise.resolve(),
    fetchTaskCandidates: () => Promise.resolve([]),
    updateVolunteerTaskStatus: () => Promise.resolve(),
    fetchHeatmapPoints: () => Promise.resolve([]),
  },
}));

jest.mock("leaflet", () => {
  function Icon(options) {
    this.options = options;
  }
  Icon.Default = { prototype: {}, mergeOptions: jest.fn() };
  return {
    __esModule: true,
    default: { Icon },
    Icon,
  };
});

jest.mock("react-leaflet", () => {
  const React = require("react");
  const LayerGroup = ({ children }) => <div data-testid="layer-group">{children}</div>;
  const LayersControl = ({ children }) => <div data-testid="layers-control">{children}</div>;
  LayersControl.Overlay = ({ children }) => <div data-testid="layers-overlay">{children}</div>;

  return {
    __esModule: true,
    LayerGroup,
    LayersControl,
    MapContainer: React.forwardRef(({ children }, ref) => {
      React.useEffect(() => {
        const map = { flyTo: () => undefined };
        if (typeof ref === "function") ref(map);
        else if (ref) ref.current = map;

        return () => {
          if (typeof ref === "function") ref(null);
          else if (ref) ref.current = null;
        };
      }, [ref]);

      return <div data-testid="map-container">{children}</div>;
    }),
    TileLayer: () => null,
    Marker: () => null,
    Popup: ({ children }) => <div>{children}</div>,
    Polygon: () => null,
    Polyline: () => null,
    useMap: () => ({
      flyTo: jest.fn(),
      getBounds: () => ({
        pad: () => ({ contains: () => true }),
      }),
    }),
    useMapEvents: jest.fn(),
  };
});

describe("/ops nested routes", () => {
  let container;
  let root;

  const renderRoute = async (path) => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      );
    });

    await act(async () => {
      await Promise.resolve();
    });
  };

  beforeEach(() => {
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

  it.each([
    ["/ops", ".decision-command", "Karar"],
    ["/ops/map", ".map-panel", "Harita"],
    ["/ops/earthquakes", ".ops-table", "Depremler"],
    ["/ops/logistics", ".ops-logistics-grid", "Lojistik"],
    ["/ops/announcements", ".ops-announcement-toolbar", "Duyurular"],
    ["/ops/tasks", ".ops-announcement-toolbar", "Görev"],
  ])("renders %s inside the shared operations layout", async (path, childSelector, childText) => {
    await renderRoute(path);

    expect(container.textContent).toContain("Operasyon");
    expect(container.querySelector(childSelector)).not.toBeNull();
    expect(container.textContent).toContain(childText);
  });
});
