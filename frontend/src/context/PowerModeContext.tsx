/**
 * GS-121: Low-power emergency mode.
 * GS-073: High-contrast / large-text accessibility mode.
 *
 * Low-power: `data-low-power="true"` on <html> → OLED-black theme + no animations.
 * High-contrast: `data-high-contrast="true"` on <html> → high-contrast colours + larger text.
 * Both preferences persist in localStorage.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const LP_KEY = "geosafe_low_power";
const HC_KEY = "geosafe_high_contrast";

interface PowerModeCtx {
  lowPower: boolean;
  toggle: () => void;
  highContrast: boolean;
  toggleHighContrast: () => void;
}

const PowerModeContext = createContext<PowerModeCtx>({
  lowPower: false,
  toggle: () => {},
  highContrast: false,
  toggleHighContrast: () => {},
});

export function PowerModeProvider({ children }: { children: React.ReactNode }) {
  const [lowPower, setLowPower] = useState<boolean>(
    () => localStorage.getItem(LP_KEY) === "1"
  );
  const [highContrast, setHighContrast] = useState<boolean>(
    () => localStorage.getItem(HC_KEY) === "1"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-low-power", lowPower ? "true" : "false");
    localStorage.setItem(LP_KEY, lowPower ? "1" : "0");
  }, [lowPower]);

  useEffect(() => {
    document.documentElement.setAttribute("data-high-contrast", highContrast ? "true" : "false");
    localStorage.setItem(HC_KEY, highContrast ? "1" : "0");
  }, [highContrast]);

  const toggle = useCallback(() => setLowPower((v) => !v), []);
  const toggleHighContrast = useCallback(() => setHighContrast((v) => !v), []);

  return (
    <PowerModeContext.Provider value={{ lowPower, toggle, highContrast, toggleHighContrast }}>
      {children}
    </PowerModeContext.Provider>
  );
}

export function usePowerMode(): PowerModeCtx {
  return useContext(PowerModeContext);
}
