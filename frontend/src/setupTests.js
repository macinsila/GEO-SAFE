import i18n from "./i18n";

// Tests run in jsdom where navigator.language is "en".
// The app is Turkish-first, so force Turkish for all component tests.
i18n.changeLanguage("tr");

// jsdom does not implement EventSource (SSE). Stub it so components that open
// an SSE connection in useEffect do not throw "EventSource is not defined".
if (typeof global.EventSource === "undefined") {
  global.EventSource = class EventSource {
    constructor() {
      this.readyState = 0;
      this.onmessage = null;
      this.onerror = null;
      this.onopen = null;
    }
    addEventListener() {}
    removeEventListener() {}
    close() {
      this.readyState = 2;
    }
  };
  global.EventSource.CONNECTING = 0;
  global.EventSource.OPEN = 1;
  global.EventSource.CLOSED = 2;
}
