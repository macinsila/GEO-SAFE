const fs = require("fs");
const path = require("path");

describe("service worker safety policy", () => {
  const serviceWorkerPath = path.resolve(__dirname, "../public/service-worker.js");
  const source = fs.readFileSync(serviceWorkerPath, "utf8");
  const indexPath = path.resolve(__dirname, "./index.tsx");
  const indexSource = fs.readFileSync(indexPath, "utf8");

  it("does not cache mutating HTTP methods", () => {
    expect(source).toContain('request.method !== "GET"');
  });

  it("skips requests that carry authorization headers", () => {
    expect(source).toContain('request.headers.get("authorization")');
    expect(source).toContain("if (hasAuthorizationHeader(request))");
  });

  it("blocks admin and sensitive intake paths from cache handling", () => {
    expect(source).toContain('"/admin"');
    expect(source).toContain('"/api/v1/auth"');
    expect(source).toContain('"/api/v1/profile"');
    expect(source).toContain('"/api/v1/volunteers"');
    expect(source).toContain('"/api/v1/shelter-offers"');
    expect(source).toContain('"/api/v1/emergency"');
    expect(source).toContain('"/api/v1/inventory"');
  });

  it("keeps the public API allowlist narrow", () => {
    expect(source).toContain("SAME_ORIGIN_PUBLIC_API_ALLOWLIST");
    expect(source).toContain('"/api/v1/warehouses"');
    expect(source).toContain('"/api/v1/safe-zones"');
    expect(source).toContain('"/api/v1/earthquakes"');
    expect(source).toContain('"/health"');
  });

  it("cleans up service worker caches in production and handles failures safely", () => {
    expect(indexSource).toContain('process.env.NODE_ENV === "production"');
    expect(indexSource).toContain("navigator.serviceWorker.getRegistrations()");
    expect(indexSource).toContain("registration.unregister()");
    expect(indexSource).toContain("caches.delete(key)");
    expect(indexSource).toContain(".catch(() => {");
  });
});
