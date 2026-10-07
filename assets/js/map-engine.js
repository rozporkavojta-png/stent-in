/* Mapový modul: jedno rozhraní nad Google Maps (s klíčem) nebo Leaflet + OpenStreetMap (bez klíče).
   KPMap.create(el, opts) → Promise<adapter>
   adapter.setPlaces(list, { colorOf, onClick }) · fitTo(list) · setView(lat, lng, zoom) · focus(place)
   adapter.onMove(fn(bounds)) · adapter.bounds() → {s,w,n,e} · adapter.addLayer(features) · adapter.engine */
(function () {
  'use strict';
  const cfg = window.KP_CONFIG || {};
  const COLORS = { ok: '#1D7A3E', part: '#B26B00', no: '#B22A20', unk: '#5D6D66', park: '#1F4FB8' };

  // Značka: tvar podle stavu (kruh / trojúhelník / křížek / prázdný kruh) – rozlišitelné i bez barev
  function pinSvg(st, active) {
    const c = COLORS[st] || COLORS.unk, s = active ? 1.25 : 1;
    const inner = st === 'ok' ? '<circle cx="17" cy="15" r="6" fill="#fff"/>'
      : st === 'part' ? '<path d="M17 8.5 23 20H11Z" fill="#fff"/>'
      : st === 'no' ? '<path d="m12.5 10.5 9 9m0-9-9 9" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
      : st === 'park' ? '<path d="M14 21V9h4a3.2 3.2 0 0 1 0 6.4h-4" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<circle cx="17" cy="15" r="5.5" fill="none" stroke="#fff" stroke-width="2.6"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + 34 * s + '" height="' + 42 * s + '" viewBox="0 0 34 42"><path d="M17 41C17 41 3 26.5 3 15a14 14 0 0 1 28 0c0 11.5-14 26-14 26Z" fill="' + c + '" stroke="' + (active ? '#FFC629' : '#fff') + '" stroke-width="' + (active ? 3 : 2) + '"/>' + inner + '</svg>';
  }

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function loadCss(href) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }

  // ---------- Google Maps ----------
  async function createGoogle(el, opts) {
    await loadScript('https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(cfg.googleMapsApiKey) + '&language=cs&region=CZ&libraries=geometry');
    await loadScript('https://unpkg.com/@googlemaps/markerclusterer@2.5.3/dist/index.min.js');
    const map = new google.maps.Map(el, {
      center: { lat: opts.lat, lng: opts.lng }, zoom: opts.zoom, mapTypeControl: true, streetViewControl: true, fullscreenControl: false,
      clickableIcons: false, gestureHandling: 'greedy',
    });
    let markers = [], byId = {}, clusterer = null, active = null, colorOf = () => 'unk';
    const icon = (st, a) => ({ url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(pinSvg(st, a)), scaledSize: new google.maps.Size(a ? 42 : 34, a ? 52 : 42), anchor: new google.maps.Point(a ? 21 : 17, a ? 52 : 42) });
    const api = {
      engine: 'google', map,
      setPlaces(list, o) {
        colorOf = o.colorOf;
        if (clusterer) clusterer.clearMarkers();
        markers.forEach(m => m.setMap(null)); byId = {};
        markers = list.map(p => {
          const m = new google.maps.Marker({ position: { lat: p.la, lng: p.lo }, icon: icon(colorOf(p)), title: p.n });
          m.addListener('click', () => o.onClick(p)); byId[p.i] = m; return m;
        });
        clusterer = new markerClusterer.MarkerClusterer({ map, markers, renderer: { render: ({ count, position }) => new google.maps.Marker({ position, label: { text: String(count), color: '#fff', fontWeight: '700' }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 16 + Math.min(14, Math.log2(count) * 2), fillColor: '#12211C', fillOpacity: .92, strokeColor: '#FFC629', strokeWeight: 3 }, zIndex: 1000 + count }) } });
      },
      fitTo(list) { if (!list.length) return; const b = new google.maps.LatLngBounds(); list.forEach(p => b.extend({ lat: p.la, lng: p.lo })); map.fitBounds(b, 40); },
      setView(lat, lng, z) { map.setCenter({ lat, lng }); map.setZoom(z); },
      focus(p) {
        if (active && byId[active.i]) byId[active.i].setIcon(icon(colorOf(active)));
        active = p; if (!p) return;
        const m = byId[p.i]; if (m) { m.setIcon(icon(colorOf(p), true)); m.setZIndex(9999); }
        map.panTo({ lat: p.la, lng: p.lo }); if (map.getZoom() < 15) map.setZoom(16);
      },
      onMove(fn) { map.addListener('idle', () => fn(api.bounds())); },
      bounds() { const b = map.getBounds(); if (!b) return null; const ne = b.getNorthEast(), sw = b.getSouthWest(); return { s: sw.lat(), w: sw.lng(), n: ne.lat(), e: ne.lng() }; },
      zoom() { return map.getZoom(); },
      addLayer(features) { // features: [{type:'line'|'point', coords, color, title}]
        return features.map(f => f.type === 'line'
          ? new google.maps.Polyline({ map, path: f.coords.map(c => ({ lat: c[0], lng: c[1] })), strokeColor: f.color, strokeWeight: f.weight || 6, strokeOpacity: .9 })
          : new google.maps.Marker({ map, position: { lat: f.coords[0], lng: f.coords[1] }, title: f.title, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: f.color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } }));
      },
      clearLayer(objs) { (objs || []).forEach(o => o.setMap(null)); },
      locate() { return new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => { api.setView(p.coords.latitude, p.coords.longitude, 15); res(p.coords); }, rej) : rej()); },
    };
    return api;
  }

  // ---------- Leaflet + OpenStreetMap ----------
  async function createLeaflet(el, opts) {
    loadCss('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
    loadCss('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css');
    if (!window.L) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js');
    if (!L.markerClusterGroup) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js');
    const map = L.map(el, { zoomControl: true, preferCanvas: true }).setView([opts.lat, opts.lng], opts.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">přispěvatelé OpenStreetMap</a>' }).addTo(map);
    const cache = {};
    const icon = (st, a) => { const k = st + (a ? 'a' : ''); return cache[k] || (cache[k] = L.divIcon({ className: '', html: pinSvg(st, a), iconSize: a ? [42, 52] : [34, 42], iconAnchor: a ? [21, 52] : [17, 42] })); };
    let group = null, byId = {}, active = null, colorOf = () => 'unk';
    const api = {
      engine: 'leaflet', map,
      setPlaces(list, o) {
        colorOf = o.colorOf;
        if (group) map.removeLayer(group);
        group = L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50, disableClusteringAtZoom: 17,
          iconCreateFunction: c => L.divIcon({ className: '', html: '<div class="marker-cluster-kp" style="width:' + (34 + Math.min(16, Math.log2(c.getChildCount()) * 2)) + 'px;height:' + (34 + Math.min(16, Math.log2(c.getChildCount()) * 2)) + 'px">' + c.getChildCount() + '</div>', iconSize: [40, 40] }) });
        byId = {};
        const ms = list.map(p => { const m = L.marker([p.la, p.lo], { icon: icon(colorOf(p)), title: p.n, keyboard: false }); m.on('click', () => o.onClick(p)); byId[p.i] = m; return m; });
        group.addLayers(ms); map.addLayer(group);
      },
      fitTo(list) { if (!list.length) return; map.fitBounds(L.latLngBounds(list.map(p => [p.la, p.lo])), { padding: [40, 40], maxZoom: 16 }); },
      setView(lat, lng, z) { map.setView([lat, lng], z); },
      focus(p) {
        if (active && byId[active.i]) byId[active.i].setIcon(icon(colorOf(active)));
        active = p; if (!p) return;
        const m = byId[p.i];
        const go = () => { if (m) { m.setIcon(icon(colorOf(p), true)); m.setZIndexOffset(1000); } };
        if (m && group) group.zoomToShowLayer(m, go); else map.setView([p.la, p.lo], Math.max(map.getZoom(), 16));
      },
      onMove(fn) { map.on('moveend', () => fn(api.bounds())); },
      bounds() { const b = map.getBounds(); return { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }; },
      zoom() { return map.getZoom(); },
      addLayer(features) {
        return features.map(f => f.type === 'line'
          ? L.polyline(f.coords, { color: f.color, weight: f.weight || 6, opacity: .9 }).bindTooltip(f.title || '').addTo(map)
          : L.circleMarker(f.coords, { radius: 7, color: '#fff', weight: 2, fillColor: f.color, fillOpacity: 1 }).bindTooltip(f.title || '').addTo(map));
      },
      clearLayer(objs) { (objs || []).forEach(o => map.removeLayer(o)); },
      locate() { return new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => { api.setView(p.coords.latitude, p.coords.longitude, 15); res(p.coords); }, rej) : rej()); },
    };
    return api;
  }

  window.KPMap = {
    pinSvg,
    create(el, o) {
      const opts = Object.assign({ lat: (cfg.defaultCenter || {}).lat || 49.8, lng: (cfg.defaultCenter || {}).lng || 15.5, zoom: cfg.defaultZoom || 7 }, o || {});
      if (cfg.googleMapsApiKey) return createGoogle(el, opts).catch(err => { console.warn('Google Maps se nenačetly, používám OpenStreetMap', err); return createLeaflet(el, opts); });
      return createLeaflet(el, opts);
    },
  };
})();
