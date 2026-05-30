import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, extractRole, useAuth } from "./AuthContext";

global.IS_REACT_ACT_ENVIRONMENT = true;

function makeJwt(payloadObj) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify(payloadObj));
  return `${header}.${payload}.fakesig`;
}

// ── extractRole (pure logic) ──────────────────────────────────────────────────

describe("extractRole", () => {
  it("returns null for a null token", () => {
    expect(extractRole(null)).toBeNull();
  });

  it("returns null for a token without enough segments", () => {
    expect(extractRole("notavalidtoken")).toBeNull();
  });

  it("returns the role string from a valid JWT payload", () => {
    const token = makeJwt({ sub: "user1", role: "admin" });
    expect(extractRole(token)).toBe("admin");
  });

  it("returns null when the payload has no role field", () => {
    const token = makeJwt({ sub: "user1" });
    expect(extractRole(token)).toBeNull();
  });

  it("returns null when role is a non-string value", () => {
    const token = makeJwt({ role: 42 });
    expect(extractRole(token)).toBeNull();
  });

  it("handles each citizen/volunteer/operator/admin role correctly", () => {
    for (const role of ["citizen", "volunteer", "operator", "admin"]) {
      expect(extractRole(makeJwt({ role }))).toBe(role);
    }
  });
});

// ── AuthProvider component ────────────────────────────────────────────────────

function AuthConsumer({ onValues }) {
  const ctx = useAuth();
  onValues(ctx);
  return (
    <div>
      <span data-testid="status">{ctx.isAuthenticated ? "authenticated" : "guest"}</span>
      <span data-testid="role">{ctx.role ?? "none"}</span>
      <button
        data-testid="login"
        onClick={() => ctx.login(makeJwt({ role: "operator" }))}
      >
        login
      </button>
      <button data-testid="logout" onClick={ctx.logout}>
        logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  let container;
  let root;
  let captured = {};

  const render = async (initialToken) => {
    if (initialToken) {
      localStorage.setItem("geosafe_token", initialToken);
    } else {
      localStorage.removeItem("geosafe_token");
    }

    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter>
          <AuthProvider>
            <AuthConsumer onValues={(v) => { captured = v; }} />
          </AuthProvider>
        </MemoryRouter>
      );
    });
  };

  beforeEach(() => {
    localStorage.clear();
    captured = {};
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

  it("renders children and starts as unauthenticated when no token exists", async () => {
    await render(null);
    expect(container.querySelector('[data-testid="status"]').textContent).toBe("guest");
    expect(container.querySelector('[data-testid="role"]').textContent).toBe("none");
  });

  it("reads an existing token from localStorage on mount", async () => {
    await render(makeJwt({ role: "admin" }));
    expect(container.querySelector('[data-testid="status"]').textContent).toBe("authenticated");
    expect(container.querySelector('[data-testid="role"]').textContent).toBe("admin");
  });

  it("login() saves the token to localStorage and updates state", async () => {
    await render(null);

    await act(async () => {
      container.querySelector('[data-testid="login"]').dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(localStorage.getItem("geosafe_token")).toBeTruthy();
    expect(container.querySelector('[data-testid="status"]').textContent).toBe("authenticated");
    expect(container.querySelector('[data-testid="role"]').textContent).toBe("operator");
  });

  it("logout() removes the token from localStorage and clears state", async () => {
    await render(makeJwt({ role: "citizen" }));

    await act(async () => {
      container.querySelector('[data-testid="logout"]').dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(localStorage.getItem("geosafe_token")).toBeNull();
    expect(container.querySelector('[data-testid="status"]').textContent).toBe("guest");
  });

  it("clears state when the geosafe-auth-expired event fires", async () => {
    await render(makeJwt({ role: "citizen" }));
    expect(container.querySelector('[data-testid="status"]').textContent).toBe("authenticated");

    await act(async () => {
      window.dispatchEvent(new Event("geosafe-auth-expired"));
    });

    expect(container.querySelector('[data-testid="status"]').textContent).toBe("guest");
    expect(container.querySelector('[data-testid="role"]').textContent).toBe("none");
  });

  it("syncs token updates from other tabs via storage event", async () => {
    await render(null);

    await act(async () => {
      window.dispatchEvent(
        Object.assign(new Event("storage"), {
          key: "geosafe_token",
          newValue: makeJwt({ role: "volunteer" }),
        })
      );
    });

    expect(container.querySelector('[data-testid="status"]').textContent).toBe("authenticated");
    expect(container.querySelector('[data-testid="role"]').textContent).toBe("volunteer");
  });
});
