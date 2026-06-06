// Mock for @react-leaflet/core used by HeatmapLayer.
// Returns a minimal context so HeatmapLayer can render without a real MapContainer.
const noopLayer = { addLayer: () => {}, removeLayer: () => {} };

const useLeafletContext = () => ({
  map: noopLayer,
  layerContainer: null,
});

module.exports = { useLeafletContext };
module.exports.default = module.exports;
