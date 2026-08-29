import React, { useLayoutEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { MALLS, availabilityClass } from "../mockData";

// Pins closer than this on screen (in pixels, at the current zoom/pan) get
// grouped into a single cluster pin instead of stacking illegibly -- e.g.
// Jem and Westgate, which are only ~150m apart in real life.
const CLUSTER_PIXEL_THRESHOLD = 40;

// Leaflet needs an actual DOM element for each marker icon -- we build a
// small colour-coded (by current availability) circle as raw HTML, since
// that's how divIcon works. The mall name is shown via a hover Tooltip
// instead of a permanent label, so nearby pins don't overlap each other.
function pinIcon(mall) {
  const cls = availabilityClass(mall.availableNow);
  return L.divIcon({
    className: "mall-pin-wrapper",
    html: `<div class="mall-pin ${cls}"><span>${mall.availableNow}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
  });
}

function clusterIcon(count) {
  return L.divIcon({
    className: "mall-pin-wrapper",
    html: `<div class="mall-pin cluster"><span>${count}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
  });
}

// Groups malls within CLUSTER_PIXEL_THRESHOLD screen pixels of each other,
// recomputing whenever the map is panned or zoomed (screen distance between
// two fixed lat/lngs changes with both). A lone mall is its own group of 1.
function useMallClusters(malls) {
  const map = useMap();
  const [groups, setGroups] = useState(() => malls.map((m) => [m]));

  useLayoutEffect(() => {
    function recompute() {
      const points = malls.map((m) => ({ mall: m, pt: map.latLngToContainerPoint([m.lat, m.lng]) }));
      const next = [];
      for (const p of points) {
        const existing = next.find((g) => g.pt.distanceTo(p.pt) < CLUSTER_PIXEL_THRESHOLD);
        if (existing) existing.malls.push(p.mall);
        else next.push({ pt: p.pt, malls: [p.mall] });
      }
      setGroups(next.map((g) => g.malls));
    }
    recompute();
    map.on("zoomend moveend", recompute);
    return () => map.off("zoomend moveend", recompute);
  }, [map, malls]);

  return groups;
}

function ClusterMarker({ malls, onSelectMall }) {
  const map = useMap();
  const center = [
    malls.reduce((s, m) => s + m.lat, 0) / malls.length,
    malls.reduce((s, m) => s + m.lng, 0) / malls.length,
  ];

  if (malls.length === 1) {
    const m = malls[0];
    return (
      <Marker position={center} icon={pinIcon(m)} eventHandlers={{ click: () => onSelectMall(m) }}>
        <Tooltip direction="top" offset={[0, -28]}>
          {m.name}
        </Tooltip>
      </Marker>
    );
  }

  // Overlapping pins: tapping zooms in until they separate, rather than
  // guessing which mall the tap meant.
  return (
    <Marker
      position={center}
      icon={clusterIcon(malls.length)}
      eventHandlers={{ click: () => map.setView(center, map.getZoom() + 3, { animate: true }) }}
    >
      <Tooltip direction="top" offset={[0, -16]}>
        {malls.map((m) => m.name).join(", ")}
      </Tooltip>
    </Marker>
  );
}

function MallMarkers({ onSelectMall }) {
  const groups = useMallClusters(MALLS);
  return groups.map((malls, i) => (
    <ClusterMarker key={malls.map((m) => m.id).join("+") || i} malls={malls} onSelectMall={onSelectMall} />
  ));
}

// Landing screen after login: a dark map with a pin per mall, plus a
// search box that filters the same mall list as an autocomplete dropdown.
// Picking a mall either way (pin tap or search result) hands it to App
// via onSelectMall, which moves the flow on to MallDetail.
export default function MapScreen({ onSelectMall }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q ? MALLS.filter((m) => m.name.toLowerCase().includes(q)) : [];

  return (
    <div className="screen map-screen">
      <div className="map-search-bar">
        <input
          placeholder="Search a mall (e.g. VivoCity)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <div className="map-search-results">
            {matches.map((m) => (
              <button key={m.id} className="map-search-result" onClick={() => onSelectMall(m)}>
                <span>
                  <span className="map-search-result-name">{m.name}</span>
                  <span className="carpark-area">{m.area}</span>
                </span>
                <span className={`lots-badge ${availabilityClass(m.availableNow)}`}>
                  {m.availableNow === 0 ? "Full" : `${m.availableNow} lots`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        center={[1.316, 103.82]}
        zoom={12}
        zoomControl={false}
        className="leaflet-map"
      >
        {/* Wikimedia's OSM-data tiles -- free, open-source, no API key ever
            required, and noticeably cleaner typography/road styling than
            the default OSM Mapnik tiles. Dark mode is faked with a CSS
            filter on the tile pane (see .leaflet-map .leaflet-tile-pane in
            styles.css) rather than a separate dark tile provider, so this
            one source covers both themes. */}
        <TileLayer
          url="https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors, &copy; Wikimedia'
        />
        <MallMarkers onSelectMall={onSelectMall} />
      </MapContainer>
    </div>
  );
}
