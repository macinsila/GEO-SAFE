const fs = require("fs");
const path = require("path");

describe("public route and public client safety", () => {
  const appPath = path.resolve(__dirname, "./App.tsx");
  const appSource = fs.readFileSync(appPath, "utf8");
  const apiPath = path.resolve(__dirname, "./services/api.ts");
  const apiSource = fs.readFileSync(apiPath, "utf8");
  const queuePath = path.resolve(__dirname, "./offlineQueue/queue.ts");
  const queueSource = fs.readFileSync(queuePath, "utf8");
  const swPath = path.resolve(__dirname, "../public/service-worker.js");
  const swSource = fs.readFileSync(swPath, "utf8");

  it("keeps emergency route public", () => {
    expect(appSource).toContain('<Route path="/emergency" element={<EmergencyPage />} />');
    expect(appSource).not.toContain('path="/emergency" element={<ProtectedRoute><EmergencyPage /></ProtectedRoute>}');
  });

  it("keeps volunteer route public", () => {
    expect(appSource).toContain('<Route path="/volunteer" element={<VolunteerPage />} />');
    expect(appSource).not.toContain('path="/volunteer" element={<ProtectedRoute><VolunteerPage /></ProtectedRoute>}');
  });

  it("keeps shelter offer route public", () => {
    expect(appSource).toContain('<Route path="/shelter-offer" element={<ShelterOfferPage />} />');
    expect(appSource).not.toContain('path="/shelter-offer" element={<ProtectedRoute><ShelterOfferPage /></ProtectedRoute>}');
  });

  it("keeps admin route protected", () => {
    expect(appSource).toContain('path="/admin"');
    expect(appSource).toContain('<ProtectedRoute roles={["admin"]}>');
    expect(appSource).toContain("<AdminDashboard />");
  });

  it("uses public client for public form submission endpoints", () => {
    expect(apiSource).toContain('this.publicClient = axios.create({ baseURL: API_BASE_URL });');
    expect(apiSource).toContain('await this.publicClient.post("/api/v1/emergency", payload);');
    expect(apiSource).toContain('await this.publicClient.post<ApiEnvelope<VolunteerApplicationPublic>>(');
    expect(apiSource).toContain('"/api/v1/volunteers"');
    expect(apiSource).toContain('await this.publicClient.post<ApiEnvelope<ShelterOfferPublic>>(');
    expect(apiSource).toContain('"/api/v1/shelter-offers"');
  });

  it("continues to avoid token or jwt persistence in queue storage", () => {
    expect(queueSource).not.toContain("token:");
    expect(queueSource).not.toContain("jwt:");
  });

  it("keeps sensitive public create endpoints out of the service worker allowlist", () => {
    expect(swSource).toContain('"/api/v1/volunteers"');
    expect(swSource).toContain('"/api/v1/shelter-offers"');
    expect(swSource).toContain('"/api/v1/emergency"');
    expect(swSource).toContain('request.method !== "GET"');
    expect(swSource).not.toContain('SAME_ORIGIN_PUBLIC_API_ALLOWLIST = new Set([\\n  "/api/v1/volunteers"');
    expect(swSource).not.toContain('SAME_ORIGIN_PUBLIC_API_ALLOWLIST = new Set([\\n  "/api/v1/shelter-offers"');
    expect(swSource).not.toContain('SAME_ORIGIN_PUBLIC_API_ALLOWLIST = new Set([\\n  "/api/v1/emergency"');
  });
});
