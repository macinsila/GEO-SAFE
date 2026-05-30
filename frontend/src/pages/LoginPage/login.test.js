import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import LoginPage, {
  getErrorMessage,
  getReturnPath,
  withTimeout,
} from "./index";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    token: null,
    role: null,
  }),
}));

jest.mock("../../services", () => ({
  geoSafeAPI: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

// ── getErrorMessage (pure logic) ──────────────────────────────────────────────

describe("getErrorMessage", () => {
  it("returns fallback for unknown error", () => {
    expect(getErrorMessage({}, "default msg")).toBe("default msg");
  });

  it("returns fallback for non-Error/non-axios error", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("returns Error.message for a plain Error", () => {
    expect(getErrorMessage(new Error("something broke"), "fb")).toBe("something broke");
  });

  it("returns ECONNABORTED message for axios timeout", () => {
    const err = { isAxiosError: true, code: "ECONNABORTED", response: undefined };
    expect(getErrorMessage(err, "fb")).toContain("60 saniye");
  });

  it("returns network error message when no response", () => {
    const err = {
      isAxiosError: true,
      code: undefined,
      response: undefined,
      message: "Network Error",
    };
    expect(getErrorMessage(err, "fb")).toContain("CORS");
  });

  it("returns the detail string from an axios response", () => {
    const err = {
      isAxiosError: true,
      response: { status: 401, data: { detail: "geçersiz şifre" } },
      message: "Request failed",
    };
    expect(getErrorMessage(err, "fb")).toBe("geçersiz şifre");
  });

  it("returns the first msg from an array detail", () => {
    const err = {
      isAxiosError: true,
      response: { status: 422, data: { detail: [{ msg: "field required" }] } },
      message: "Unprocessable",
    };
    expect(getErrorMessage(err, "fb")).toBe("field required");
  });

  it("returns error.message when detail is absent but message exists", () => {
    const err = {
      isAxiosError: true,
      response: { status: 500, data: {} },
      message: "Internal Server Error",
    };
    expect(getErrorMessage(err, "fb")).toBe("Internal Server Error");
  });
});

// ── getReturnPath (pure logic) ────────────────────────────────────────────────

describe("getReturnPath", () => {
  it("returns /ops when state is null", () => {
    expect(getReturnPath(null)).toBe("/ops");
  });

  it("returns /ops when from.pathname is /login", () => {
    expect(getReturnPath({ from: { pathname: "/login" } })).toBe("/ops");
  });

  it("returns the original pathname when coming from another route", () => {
    expect(getReturnPath({ from: { pathname: "/ops/logistics" } })).toBe(
      "/ops/logistics"
    );
  });

  it("appends search string when present", () => {
    expect(
      getReturnPath({ from: { pathname: "/ops/map", search: "?zoom=8" } })
    ).toBe("/ops/map?zoom=8");
  });
});

// ── withTimeout (pure logic) ──────────────────────────────────────────────────

describe("withTimeout", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("resolves with the promise result when it settles before the timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), "too slow");
    expect(result).toBe("ok");
  });

  it("rejects with the timeout message when the promise takes too long", async () => {
    const pending = new Promise(() => {});
    const race = withTimeout(pending, "backend did not respond");

    jest.runAllTimers();

    await expect(race).rejects.toThrow("backend did not respond");
  });
});

// ── LoginPage component ───────────────────────────────────────────────────────

describe("LoginPage", () => {
  let container;
  let root;

  const render = async (path = "/login", sessionNotice = null) => {
    if (sessionNotice) {
      sessionStorage.setItem("geosafe_auth_notice", sessionNotice);
    }
    await act(async () => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <LoginPage />
        </MemoryRouter>
      );
    });
  };

  beforeEach(() => {
    sessionStorage.clear();
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

  it("renders the login form tab by default", async () => {
    await render();
    expect(container.textContent).toContain("Sisteme giriş yap");
    expect(container.querySelector('input[type="email"]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
  });

  it("shows the register form when the register tab is clicked", async () => {
    await render();
    const registerTab = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Yeni Kayıt"
    );
    await act(async () => {
      registerTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Hesabı oluştur");
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
  });

  it("displays the auth notice from sessionStorage on mount", async () => {
    await render("/login", "Oturum süreniz doldu.");
    expect(container.textContent).toContain("Oturum süreniz doldu.");
    expect(sessionStorage.getItem("geosafe_auth_notice")).toBeNull();
  });

  it("renders public navigation links", async () => {
    await render();
    expect(container.textContent).toContain("Acil yardım bildir");
    expect(container.textContent).toContain("Gönüllü ol");
  });

  it("shows the 'forgot password' info message when the button is clicked", async () => {
    await render();
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Şifremi unuttum"
    );
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("sistem yöneticisiyle iletişime geçin");
  });
});
