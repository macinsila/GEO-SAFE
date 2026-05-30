/**
 * GS-121: Low-power emergency mode.
 *
 * When enabled:
 *   - Applies `data-low-power="true"` to <html> so CSS variables switch to
 *     OLED-black theme and all animations/transitions are suppressed.
 *   - Preference is persisted in localStorage so it survives page reloads.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "geosafe_low_power";

interface PowerModeCtx {
  lowPower: boolean;
  toggle: () => void;
}

const PowerModeContext = createContext<PowerModeCtx>({
  lowPower: false,
  toggle: () => {},
});

export function PowerModeProvider({ children }: { children: React.ReactNode }) {
  const [lowPower, setLowPower] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-low-power", lowPower ? "true" : "false");
    localStorage.setItem(STORAGE_KEY, lowPower ? "1" : "0");
  }, [lowPower]);

  const toggle = useCallback(() => setLowPower((v) => !v), []);

  return (
    <PowerModeContext.Provider value={{ lowPower, toggle }}>
      {children}
    </PowerModeContext.Provider>
  );
}

export function usePowerMode(): PowerModeCtx {
  return useContext(PowerModeContext);
}
