import i18n from "./i18n";

// Tests run in jsdom where navigator.language is "en".
// The app is Turkish-first, so force Turkish for all component tests.
i18n.changeLanguage("tr");

if (typeof global.EventSource === "undefined") {
  class MockEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.onmessage = null;
      this.onerror = null;
    }

    close() {
      this.readyState = 2;
    }
  }

  global.EventSource = MockEventSource;
}
