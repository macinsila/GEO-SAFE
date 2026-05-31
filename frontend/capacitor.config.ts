import type { CapacitorConfig } from "@capacitor/cli";

// GS-130: Capacitor hybrid shell spike
// Wraps the existing React build (webDir: "build") so all web routes, CSS, and state
// continue to work unchanged inside the native container.
//
// Required packages (add to package.json when adopting):
//   @capacitor/core @capacitor/cli @capacitor/app @capacitor/geolocation
//   @capacitor-community/bluetooth-le
//
// Build: npx cap add android  (or ios)
//        npm run build && npx cap sync
//        npx cap run android

const config: CapacitorConfig = {
  appId: "com.geosafe.app",
  appName: "GeoSafe",
  webDir: "build",
  server: {
    androidScheme: "https",
  },
  plugins: {
    Geolocation: {
      // iOS: NSLocationWhenInUseUsageDescription must be set in Info.plist
      // Android: ACCESS_FINE_LOCATION in AndroidManifest.xml (already granted for BLE scan)
    },
    BluetoothLe: {
      // @capacitor-community/bluetooth-le configuration
      // displayStrings: { scanning: "Çevre taranıyor...", cancel: "İptal", ... }
    },
  },
  android: {
    // Foreground service required for background BLE advertising/scanning (GS-131, GS-132)
    // Add <uses-permission android:name="android.permission.FOREGROUND_SERVICE" /> to manifest
  },
  ios: {
    // Background modes: bluetooth-central, bluetooth-peripheral
    // Required in Info.plist for GS-131/132 beacon/mesh features
    // Note: iOS moves service UUIDs to the "overflow" area when backgrounded;
    //       cross-platform background discovery is unreliable (see FEASIBILITY_BLUETOOTH.md §4)
  },
};

export default config;
