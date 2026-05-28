import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./i18n";
import App from "./App";
import "leaflet/dist/leaflet.css";
import "./styles/App.css";

const sentryDsn = process.env.REACT_APP_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.2,
    // Don't capture errors from browser extensions or third-party scripts
    denyUrls: [/extensions\//i, /^chrome:\/\//i],
  });
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {
        // Keep the main app usable even when cleanup fails.
      });
  });
}
