import React from "react";
import { useTranslation } from "react-i18next";

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const current = i18n.language;

  const toggle = () => {
    i18n.changeLanguage(current === "tr" ? "en" : "tr");
  };

  return (
    <button
      onClick={toggle}
      title={current === "tr" ? "Switch to English" : "Türkçe'ye geç"}
      style={{
        background: "none",
        border: "1px solid currentColor",
        borderRadius: 4,
        padding: "2px 8px",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        opacity: 0.85,
      }}
    >
      {current === "tr" ? "EN" : "TR"}
    </button>
  );
};

export default LanguageSwitcher;
