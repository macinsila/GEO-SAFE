describe("API auth interceptor", () => {
  const createdClients = [];

  beforeEach(() => {
    jest.resetModules();
    createdClients.length = 0;
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, "", "/login");
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
        default: { create, isAxiosError: (error) => Boolean(error?.isAxiosError) },
        create,
        isAxiosError: (error) => Boolean(error?.isAxiosError),
      };
    });
  });

  afterEach(() => {
    jest.dontMock("axios");
  });

  it("clears token and stores an auth notice after a 401 response", async () => {
    localStorage.setItem("geosafe_token", "expired-token");
    const authExpiredListener = jest.fn();
    window.addEventListener("geosafe-auth-expired", authExpiredListener);

    require("./services/api");
    const authenticatedClient = createdClients[0];
    const responseRejected = authenticatedClient.interceptors.response.use.mock.calls[0][1];

    await expect(
      responseRejected({ isAxiosError: true, response: { status: 401 } })
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(localStorage.getItem("geosafe_token")).toBeNull();
    expect(sessionStorage.getItem("geosafe_auth_notice")).toContain("Oturum");
    expect(authExpiredListener).toHaveBeenCalled();

    window.removeEventListener("geosafe-auth-expired", authExpiredListener);
  });

  it("accepts the legacy REACT_APP_API_URL deployment variable", () => {
    process.env.REACT_APP_API_BASE_URL = "";
    process.env.REACT_APP_API_URL = "https://geosafe-backend.onrender.com";

    const { API_DIAGNOSTICS } = require("./services/api");

    expect(createdClients[0].config.baseURL).toBe("https://geosafe-backend.onrender.com");
    expect(createdClients[1].config.baseURL).toBe("https://geosafe-backend.onrender.com");
    expect(API_DIAGNOSTICS.baseUrl).toBe("https://geosafe-backend.onrender.com");
    expect(API_DIAGNOSTICS.env).toBe("REACT_APP_API_URL");
  });
});
