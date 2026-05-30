describe("GeoSafeAPI methods", () => {
  const createdClients = [];

  beforeEach(() => {
    jest.resetModules();
    createdClients.length = 0;
    localStorage.clear();
    delete process.env.REACT_APP_API_BASE_URL;
    delete process.env.REACT_APP_API_URL;

    jest.doMock("axios", () => {
      const create = jest.fn((config) => {
        const client = {
          config,
          interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
          },
          get: jest.fn(),
          post: jest.fn(),
          put: jest.fn(),
          patch: jest.fn(),
          delete: jest.fn(),
        };
        createdClients.push(client);
        return client;
      });

      return {
        __esModule: true,
        default: { create, isAxiosError: () => false },
        create,
        isAxiosError: () => false,
      };
    });
  });

  afterEach(() => {
    jest.dontMock("axios");
  });

  // client[0] = this.client (authenticated), client[1] = this.publicClient
  // IMPORTANT: require the module first in each test to populate createdClients
  const loadAPI = () => require("./api").geoSafeAPI;

  // ── login ──────────────────────────────────────────────────────────────────

  it("login() calls /auth/token as form-encoded and extracts access_token", async () => {
    const instance = loadAPI();
    createdClients[1].post.mockResolvedValue({
      data: { data: { access_token: "tok-abc" } },
    });

    const token = await instance.login("user@example.com", "secret");

    expect(createdClients[1].post).toHaveBeenCalledWith(
      "/api/v1/auth/token",
      expect.any(Object),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    expect(token).toBe("tok-abc");
  });

  // ── register ───────────────────────────────────────────────────────────────

  it("register() POSTs to /auth/register via the public client", async () => {
    const instance = loadAPI();
    createdClients[1].post.mockResolvedValue({ data: {} });

    await instance.register("Ali Veli", "ali@example.com", "password1");

    expect(createdClients[1].post).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      { name: "Ali Veli", email: "ali@example.com", password: "password1" }
    );
  });

  // ── sendEmergency ──────────────────────────────────────────────────────────

  it("sendEmergency() uses the public client, not the authenticated one", async () => {
    const instance = loadAPI();
    createdClients[1].post.mockResolvedValue({ data: {} });

    const payload = {
      durum: "Enkaz Altindayim",
      saat: "12:00",
      harita_link: "https://maps.example",
      enlem: 41.01,
      boylam: 28.97,
    };
    await instance.sendEmergency(payload);

    expect(createdClients[1].post).toHaveBeenCalledWith("/api/v1/emergency", payload);
    expect(createdClients[0].post).not.toHaveBeenCalled();
  });

  // ── fetchNearestDepot ──────────────────────────────────────────────────────

  it("fetchNearestDepot() passes lat/lon/item_name/radius_km as query params", async () => {
    const instance = loadAPI();
    createdClients[0].get.mockResolvedValue({
      data: { data: [{ warehouse_id: 1, distance_km: 2.5 }] },
    });

    const results = await instance.fetchNearestDepot(41.01, 28.97, "su", 5);

    expect(createdClients[0].get).toHaveBeenCalledWith(
      "/api/v1/spatial/nearest-depot",
      { params: { lat: 41.01, lon: 28.97, item_name: "su", radius_km: 5 } }
    );
    expect(results).toEqual([{ warehouse_id: 1, distance_km: 2.5 }]);
  });

  // ── fetchWarehouses ────────────────────────────────────────────────────────

  it("fetchWarehouses() unwraps the API envelope", async () => {
    const instance = loadAPI();
    const warehouses = [{ id: 1, name: "Depo A" }, { id: 2, name: "Depo B" }];
    createdClients[0].get.mockResolvedValue({ data: { data: warehouses } });

    const result = await instance.fetchWarehouses();
    expect(result).toEqual(warehouses);
  });

  it("fetchWarehouses() handles a bare array response (no envelope)", async () => {
    const instance = loadAPI();
    const warehouses = [{ id: 3, name: "Depo C" }];
    createdClients[0].get.mockResolvedValue({ data: warehouses });

    const result = await instance.fetchWarehouses();
    expect(result).toEqual(warehouses);
  });

  // ── fetchSafeZones ─────────────────────────────────────────────────────────

  it("fetchSafeZones() calls /safe-zones and unwraps the envelope", async () => {
    const instance = loadAPI();
    const zones = [{ id: 1, name: "Toplanma Alanı 1" }];
    createdClients[0].get.mockResolvedValue({ data: { data: zones } });

    const result = await instance.fetchSafeZones();
    expect(createdClients[0].get).toHaveBeenCalledWith("/api/v1/safe-zones");
    expect(result).toEqual(zones);
  });

  // ── fetchAnnouncements ─────────────────────────────────────────────────────

  it("fetchAnnouncements() uses the public client", async () => {
    const instance = loadAPI();
    createdClients[1].get.mockResolvedValue({ data: { data: [] } });

    await instance.fetchAnnouncements();

    expect(createdClients[1].get).toHaveBeenCalledWith(
      "/api/v1/announcements",
      expect.anything()
    );
    expect(createdClients[0].get).not.toHaveBeenCalled();
  });

  // ── healthCheck ────────────────────────────────────────────────────────────

  it("healthCheck() returns true on a 200 response", async () => {
    const instance = loadAPI();
    createdClients[0].get.mockResolvedValue({ status: 200 });
    expect(await instance.healthCheck()).toBe(true);
  });

  it("healthCheck() returns false when the request throws", async () => {
    const instance = loadAPI();
    createdClients[0].get.mockRejectedValue(new Error("network down"));
    expect(await instance.healthCheck()).toBe(false);
  });
});
