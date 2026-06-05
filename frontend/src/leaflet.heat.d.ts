import * as L from "leaflet";

type HeatLatLngTuple = [number, number, number?];

interface HeatLayerOptions {
  minOpacity?: number;
  maxZoom?: number;
  max?: number;
  radius?: number;
  blur?: number;
  gradient?: Record<number, string>;
}

interface HeatLayer extends L.Layer {
  setLatLngs(latlngs: HeatLatLngTuple[]): this;
  addLatLng(latlng: HeatLatLngTuple): this;
  setOptions(options: HeatLayerOptions): this;
}

declare module "leaflet" {
  function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatLayerOptions): HeatLayer;
}
