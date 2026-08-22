import { useEffect, useRef, useState } from 'react';

function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

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

export default function UserLiveMap({
  citizenLat, citizenLng,
  rescuerLat, rescuerLng,
  label = '',
  height = 220,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef  = useRef(null);
  const rescuerMarkerRef = useRef(null);
  const polylineRef     = useRef(null);
  const [loaded, setLoaded] = useState(false);

  const fallback = getFallbackCoords(label);
  const cLat = citizenLat != null ? Number(citizenLat) : fallback.lat;
  const cLng = citizenLng != null ? Number(citizenLng) : fallback.lng;
  const rLat = rescuerLat != null ? Number(rescuerLat) : 28.6139;
  const rLng = rescuerLng != null ? Number(rescuerLng) : 77.2090;

  useEffect(() => {
    let isMounted = true;

    loadLeaflet().then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [rLat, cLng],
        zoom: 13,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Citizen Pin
      const citizenIcon = L.divIcon({
        className: 'custom-citizen-icon',
        html: `
          <div style="position:relative;width:22px;height:22px;">
            <div style="position:absolute;width:22px;height:22px;background:rgba(185,28,28,0.25);border-radius:50%;animation:pulse-marker 1.5s infinite;"></div>
            <div style="position:absolute;top:3px;left:3px;width:16px;height:16px;background:#b91c1c;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const citizenMarker = L.marker([cLat, cLng], { icon: citizenIcon }).addTo(map);
      citizenMarker.bindPopup(`<b>📍 Your Location</b><br/>${label}`);

      // Rescuer Pin
      const rescuerIcon = L.divIcon({
        className: 'custom-rescuer-icon',
        html: `
          <div style="position:relative;width:28px;height:28px;background:#1d3557;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.3);">
            <span style="font-size:14px;color:#fff;">🚒</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const rescuerMarker = L.marker([rLat, rLng], { icon: rescuerIcon }).addTo(map);
      rescuerMarker.bindPopup('<b>🚒 Rescue Unit</b><br/>En route to your location');
      rescuerMarkerRef.current = rescuerMarker;

      // Polyline route
      const polyline = L.polyline([[rLat, rLng], [cLat, cLng]], {
        color: '#1d3557',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 8',
      }).addTo(map);
      polylineRef.current = polyline;

      const bounds = L.latLngBounds([[rLat, rLng], [cLat, cLng]]);
      map.fitBounds(bounds, { padding: [30, 30] });

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

  useEffect(() => {
    if (!loaded || !window.L || !rescuerMarkerRef.current) return;

    const newPos = [rLat, rLng];
    rescuerMarkerRef.current.setLatLng(newPos);

    if (polylineRef.current) {
      polylineRef.current.setLatLngs([newPos, [cLat, cLng]]);
    }
  }, [rLat, rLng, cLat, cLng, loaded]);

  return (
    <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db', position: 'relative', marginTop: 10 }}>
      <div ref={mapContainerRef} style={{ height, width: '100%', background: '#f5f5f5' }} />

      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(255,255,255,0.92)', border: '1px solid #d1d5db',
        borderRadius: 4, padding: '4px 8px',
        display: 'flex', gap: 10, fontSize: 11, fontWeight: 600,
        zIndex: 1000, pointerEvents: 'none',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b91c1c', display: 'inline-block' }} />
          You
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1d3557', display: 'inline-block' }} />
          Rescue Team (Live)
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
