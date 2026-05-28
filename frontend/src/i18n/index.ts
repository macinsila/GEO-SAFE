import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import tr from "./locales/tr.json";
import en from "./locales/en.json";

const STORAGE_KEY = "geosafe-lang";

const savedLang = localStorage.getItem(STORAGE_KEY);
const browserLang = navigator.language.startsWith("tr") ? "tr" : "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: savedLang || browserLang,
    fallbackLng: "tr",
    interpolation: { escapeValue: false },
  });

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

export default i18n;
