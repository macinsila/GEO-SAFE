import i18n from "./i18n";

// Tests run in jsdom where navigator.language is "en".
// The app is Turkish-first, so force Turkish for all component tests.
i18n.changeLanguage("tr");
