import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/** @param {{center?: import('leaflet').LatLngTuple, zoom?: number, height?: number | string, className?: string, tileUrl?: string, attribution?: string}} props */
export default function MapaTempoReal({
  center = [-23.55052, -46.633308], // São Paulo (default)
  zoom = 12,
  height = 360,
  className = "",
  tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}) {
  const containerStyle = { height: typeof height === "number" ? `${height}px` : height, width: "100%" };

  // Guard for non-DOM environments just in case (SSR/preview safety)
  if (typeof window === "undefined") {
    return <div className={`w-full ${className}`} style={containerStyle} />;
  }

  return (
    <div className={`w-full overflow-hidden rounded-lg ${className}`} style={containerStyle}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer url={tileUrl} attribution={attribution} />
      </MapContainer>
    </div>
  );
}
