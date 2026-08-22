import { useEffect, useRef, useState } from 'react';

/**
 * Ensures Leaflet CSS and JS are loaded dynamically from CDN (Zero API Key needed).
 */
function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);

    // CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.head.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.L) {
          clearInterval(check);
          resolve(window.L);
        }
      }, 50);
    }
  });
}

// Fallback zone coordinates around HQ area if citizen did not share GPS
const ZONE_COORDS = {
  A: { lat: 28.6280, lng: 77.2180 },
  B: { lat: 28.6210, lng: 77.2280 },
  C: { lat: 28.6050, lng: 77.2240 },
  D: { lat: 28.6010, lng: 77.1980 },
  E: { lat: 28.6190, lng: 77.1920 },
  F: { lat: 28.6320, lng: 77.2040 },
};

function getFallbackCoords(label = '') {
  const match = label.match(/Sector ([A-F])/i);
  const key = match ? match[1].toUpperCase() : 'A';
  return ZONE_COORDS[key] || { lat: 28.6250, lng: 77.2150 };
}

export default function LiveMap({
  citizenLat, citizenLng,
  rescuerLat, rescuerLng,
  label = '',
  height = 260,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef  = useRef(null);
  const citizenMarkerRef = useRef(null);
  const rescuerMarkerRef = useRef(null);
  const polylineRef     = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // Compute effective coordinates (using fallback if GPS wasn't provided)
  const fallback = getFallbackCoords(label);
  const cLat = citizenLat != null ? Number(citizenLat) : fallback.lat;
  const cLng = citizenLng != null ? Number(citizenLng) : fallback.lng;
  const rLat = rescuerLat != null ? Number(rescuerLat) : 28.6139;
  const rLng = rescuerLng != null ? Number(rescuerLng) : 77.2090;

  useEffect(() => {
    let isMounted = true;

    loadLeaflet().then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance if exists on container
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize Leaflet Map
      const map = L.map(mapContainerRef.current, {
        center: [rLat, cLng],
        zoom: 13,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      // Clean, high-contrast light tiles (OpenStreetMap / CartoDB Positron)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Custom Citizen Pin (Red Marker)
      const citizenIcon = L.divIcon({
        className: 'custom-citizen-icon',
        html: `
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;width:24px;height:24px;background:rgba(185,28,28,0.25);border-radius:50%;animation:pulse-marker 1.5s infinite;"></div>
            <div style="position:absolute;top:4px;left:4px;width:16px;height:16px;background:#b91c1c;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const citizenMarker = L.marker([cLat, cLng], { icon: citizenIcon }).addTo(map);
      citizenMarker.bindPopup(`<b>📍 Citizen Location</b><br/>${label || 'Emergency Site'}`);
      citizenMarkerRef.current = citizenMarker;

      // Custom Rescuer Pin (Navy Blue Arrow)
      const rescuerIcon = L.divIcon({
        className: 'custom-rescuer-icon',
        html: `
          <div style="position:relative;width:28px;height:28px;background:#1d3557;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
            <span style="font-size:14px;color:#fff;">🚒</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const rescuerMarker = L.marker([rLat, rLng], { icon: rescuerIcon }).addTo(map);
      rescuerMarker.bindPopup('<b>🚒 Rescuer Team</b><br/>En route to location');
      rescuerMarkerRef.current = rescuerMarker;

      // Polyline route between Rescuer and Citizen
      const polyline = L.polyline([[rLat, rLng], [cLat, cLng]], {
        color: '#1d3557',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 8',
      }).addTo(map);
      polylineRef.current = polyline;

      // Fit map to show both markers
      const bounds = L.latLngBounds([[rLat, rLng], [cLat, cLng]]);
      map.fitBounds(bounds, { padding: [35, 35] });

      setLoaded(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-update the rescuer marker position smoothly when coordinates change
  useEffect(() => {
    if (!loaded || !window.L || !rescuerMarkerRef.current) return;

    const newPos = [rLat, rLng];
    rescuerMarkerRef.current.setLatLng(newPos);

    if (polylineRef.current) {
      polylineRef.current.setLatLngs([newPos, [cLat, cLng]]);
    }
  }, [rLat, rLng, cLat, cLng, loaded]);

  return (
    <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
      <div ref={mapContainerRef} style={{ height, width: '100%', background: '#f5f5f5' }} />

      {/* Map Legend Overlay */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '5px 10px',
        display: 'flex', gap: 14, fontSize: 11, fontWeight: 600,
        zIndex: 1000, pointerEvents: 'none',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#b91c1c', display: 'inline-block' }} />
          Citizen
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1d3557', display: 'inline-block' }} />
          Rescue Unit (Live)
        </span>
      </div>

      <style>{`
        @keyframes pulse-marker {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
