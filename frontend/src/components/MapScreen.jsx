import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { MALLS, availabilityClass, busyLevel, busyPercent } from "../mockData";
import { ArrowIcon, LogoGlyph, PinIcon, SearchIcon } from "./icons.jsx";

// Pins closer than this on screen (in pixels, at the current zoom/pan) get
// grouped into a single cluster pin instead of stacking illegibly -- e.g.
// Jem and Westgate, which are only ~150m apart in real life.
const CLUSTER_PIXEL_THRESHOLD = 48;

// Initial view frames every mall, padded to clear the search card on top
// and the mall carousel + tab bar along the bottom.
const MALL_BOUNDS = MALLS.map((m) => [m.lat, m.lng]);

// Leaflet needs an actual DOM element for each marker icon -- we build a
// small white pill (status dot + free-lot count) as raw HTML, since that's
// how divIcon works. When another mall is focused, every other pin is
// dimmed and greyed out so the focused one stands out.
function pinIcon(mall, focusedId) {
  const cls = busyLevel(busyPercent(mall, mall.availableNow), mall.availableNow).id;
  const focused = mall.id === focusedId;
  const dimmed = focusedId && !focused;
  return L.divIcon({
    className: `mall-pin-wrapper ${dimmed ? "pin-dimmed" : ""}`,
    html: `<div class="mall-pin ${cls} ${focused ? "focused" : ""}"><div class="mall-pin-body"><i></i>${mall.availableNow}</div><div class="mall-pin-tail"></div></div>`,
    iconSize: [64, 40],
    iconAnchor: [32, 38],
  });
}

function clusterIcon(count, dimmed) {
  return L.divIcon({
    className: `mall-pin-wrapper ${dimmed ? "pin-dimmed" : ""}`,
    html: `<div class="mall-pin cluster"><div class="mall-pin-body">${count} malls</div><div class="mall-pin-tail"></div></div>`,
    iconSize: [72, 40],
    iconAnchor: [36, 38],
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

function ClusterMarker({ malls, focusedId, onFocus }) {
  const map = useMap();
  const center = [
    malls.reduce((s, m) => s + m.lat, 0) / malls.length,
    malls.reduce((s, m) => s + m.lng, 0) / malls.length,
  ];

  if (malls.length === 1) {
    const m = malls[0];
    return (
      <Marker
        position={center}
        icon={pinIcon(m, focusedId)}
        zIndexOffset={m.id === focusedId ? 1000 : 0}
        eventHandlers={{ click: () => onFocus(m.id) }}
      >
        <Tooltip direction="top" offset={[0, -34]}>
          {m.name}
        </Tooltip>
      </Marker>
    );
  }

  // Overlapping pins: tapping zooms in until they separate, rather than
  // guessing which mall the tap meant.
  const dimmed = focusedId && !malls.some((m) => m.id === focusedId);
  return (
    <Marker
      position={center}
      icon={clusterIcon(malls.length, dimmed)}
      eventHandlers={{ click: () => map.setView(center, map.getZoom() + 3, { animate: true }) }}
    >
      <Tooltip direction="top" offset={[0, -34]}>
        {malls.map((m) => m.name).join(", ")}
      </Tooltip>
    </Marker>
  );
}

function MallMarkers({ focusedId, onFocus }) {
  const groups = useMallClusters(MALLS);
  return groups.map((malls, i) => (
    <ClusterMarker key={malls.map((m) => m.id).join("+") || i} malls={malls} focusedId={focusedId} onFocus={onFocus} />
  ));
}

// Flies the map to whichever mall gets focused, and clears focus when the
// driver taps empty map.
function FocusController({ focusedId, onClear }) {
  const map = useMap();
  useMapEvents({ click: onClear });
  useEffect(() => {
    const mall = MALLS.find((m) => m.id === focusedId);
    if (mall) map.flyTo([mall.lat, mall.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [focusedId, map]);
  return null;
}

function MallCard({ mall, focused, onFocus, onOpen, cardRef }) {
  const pct = busyPercent(mall, mall.availableNow);
  const level = busyLevel(pct, mall.availableNow);
  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      className={`mall-card ${focused ? "focused" : ""}`}
      onClick={() => (focused ? onOpen(mall) : onFocus(mall.id))}
      onKeyDown={(e) => e.key === "Enter" && (focused ? onOpen(mall) : onFocus(mall.id))}
    >
      <div className="mall-card-top">
        <div>
          <div className="mall-card-name">{mall.name}</div>
          <div className="carpark-area">
            <PinIcon />
            {mall.area}
          </div>
        </div>
        <span className="mall-card-go">
          <ArrowIcon />
        </span>
      </div>
      <div className="mall-card-bottom">
        <span className="mall-card-free">
          <b>{mall.availableNow}</b> free now
        </span>
        <span className={`level-pill ${level.id}`}>{level.label}</span>
      </div>
      <div className="mall-card-extra" aria-hidden={!focused}>
        <div>
          <div className="mini-meter">
            <div className="mini-meter-track">
              <div className="mini-meter-fill" style={{ width: `${focused ? pct : 0}%`, background: level.color }} />
            </div>
            <div className="mini-meter-legend">
              <span>{pct}% full right now</span>
              <span>{mall.capacity} lots</span>
            </div>
          </div>
          <button
            className="primary mall-card-cta"
            tabIndex={focused ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(mall);
            }}
          >
            See busy meter &amp; book
          </button>
        </div>
      </div>
    </div>
  );
}

// Landing screen after login: a light map with a pin per mall, a search
// card on top, and a swipeable row of mall cards along the bottom. Tapping
// a pin or card "focuses" that mall -- its card expands, everything else
// greys out, and the map flies to it. A second tap (or the card's button)
// hands it to App via onSelectMall, which moves the flow on to MallDetail.
export default function MapScreen({ onSelectMall }) {
  const [query, setQuery] = useState("");
  const [focusedId, setFocusedId] = useState(null);
  const cardRefs = useRef({});
  const q = query.trim().toLowerCase();
  const matches = q ? MALLS.filter((m) => m.name.toLowerCase().includes(q)) : [];

  useEffect(() => {
    const el = focusedId && cardRefs.current[focusedId];
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focusedId]);

  return (
    <div className="screen map-screen">
      <div className="map-top">
        <div className="map-greeting">
          <div>
            <div className="eyebrow">
              <PinIcon />
              Singapore
            </div>
            <div className="map-title">Find a spot</div>
          </div>
          <div className="mini-logo">
            <LogoGlyph size={20} />
          </div>
        </div>
        <div className="search-field">
          <SearchIcon />
          <input placeholder="Search a mall (e.g. VivoCity)" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {matches.length > 0 && (
          <div className="map-search-results">
            {matches.map((m) => (
              <button key={m.id} className="map-search-result" onClick={() => onSelectMall(m)}>
                <span>
                  <span className="map-search-result-name">{m.name}</span>
                  <span className="carpark-area">{m.area}</span>
                </span>
                <span className={`lots-badge ${availabilityClass(m.availableNow)}`}>
                  {m.availableNow === 0 ? "Full" : `${m.availableNow} free`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        bounds={MALL_BOUNDS}
        boundsOptions={{ paddingTopLeft: [24, 170], paddingBottomRight: [24, 250] }}
        zoomControl={false}
        className="leaflet-map"
      >
        {/* Wikimedia's OSM-data tiles -- free, open-source, no API key ever
            required, and noticeably cleaner typography/road styling than
            the default OSM Mapnik tiles. */}
        <TileLayer
          url="https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors, &copy; Wikimedia'
        />
        <MallMarkers focusedId={focusedId} onFocus={setFocusedId} />
        <FocusController focusedId={focusedId} onClear={() => setFocusedId(null)} />
      </MapContainer>

      <div className={`mall-carousel ${focusedId ? "has-focus" : ""}`}>
        {MALLS.map((m) => (
          <MallCard
            key={m.id}
            mall={m}
            focused={m.id === focusedId}
            onFocus={setFocusedId}
            onOpen={onSelectMall}
            cardRef={(el) => (cardRefs.current[m.id] = el)}
          />
        ))}
      </div>
    </div>
  );
}
