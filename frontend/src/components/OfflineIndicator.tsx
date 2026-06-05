/**
 * GS-033: Offline status indicator.
 *
 * Shows a small banner when the browser goes offline so the user knows the map
 * is being served from the pre-cached tiles rather than the live network.
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const OfflineIndicator: React.FC = () => {
  const { t } = useTranslation();
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="offline-indicator" role="status" aria-live="polite">
      <span className="offline-dot" aria-hidden="true" />
      {t("offline.offline")}
    </div>
  );
};

export default OfflineIndicator;
