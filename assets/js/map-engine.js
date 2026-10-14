/* Mapový modul: jedno rozhraní nad Google Maps (s klíčem) nebo Leaflet + OpenStreetMap (bez klíče).
   KPMap.create(el, opts) → Promise<adapter>
   adapter.setPlaces(list, { colorOf, onClick, iconOf? → olivová kapka s ikonou kategorie }) · fitTo(list) · setView(lat, lng, zoom) · focus(place)
   adapter.onMove(fn(bounds)) · adapter.bounds() → {s,w,n,e} · adapter.addLayer(features) · adapter.engine */
(function () {
  'use strict';
  const cfg = window.KP_CONFIG || {};
  const COLORS = { ok: '#2E6B3A', part: '#8A5A00', no: '#B3261E', unk: '#5D6A58', park: '#3A4A34' };
  const BRAND = '#3A4A34', SAGE = '#7D8F76';

  // Značka: tvar podle stavu (kruh / trojúhelník / křížek / prázdný kruh) – rozlišitelné i bez barev
  function pinSvg(st, active) {
    const c = COLORS[st] || COLORS.unk, s = active ? 1.25 : 1;
    const inner = st === 'ok' ? '<circle cx="17" cy="15" r="6" fill="#fff"/>'
      : st === 'part' ? '<path d="M17 8.5 23 20H11Z" fill="#fff"/>'
      : st === 'no' ? '<path d="m12.5 10.5 9 9m0-9-9 9" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
      : st === 'park' ? '<path d="M14 21V9h4a3.2 3.2 0 0 1 0 6.4h-4" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<circle cx="17" cy="15" r="5.5" fill="none" stroke="#fff" stroke-width="2.6"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + 34 * s + '" height="' + 42 * s + '" viewBox="0 0 34 42"><path d="M17 41C17 41 3 26.5 3 15a14 14 0 0 1 28 0c0 11.5-14 26-14 26Z" fill="' + c + '" stroke="' + (active ? SAGE : '#fff') + '" stroke-width="' + (active ? 3 : 2) + '"/>' + inner + '</svg>';
  }

  // Značka v4: olivová kapka s bílou ikonou kategorie (assets/icons, KP_ICONS); stav vstupu jako malý odznak vpravo
  // nahoře (tvar + barva: kruh s fajfkou / trojúhelník / křížek / prázdný kruh). Vybraná značka je větší se šalvějovým obrysem.
  function catPinSvg(iconName, st, active) {
    const set = window.KP_ICONS || {}, al = window.KP_ICON_ALIASES || {};
    const body = set[iconName] || set[al[iconName]] || set.pin || '';
    const s = active ? 1.3 : 1;
    const badge = st === 'ok' ? '<circle cx="30" cy="8" r="6.5" fill="' + COLORS.ok + '" stroke="#fff" stroke-width="2"/><path d="m27.2 8.2 2 2 3.8-4" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      : st === 'part' ? '<circle cx="30" cy="8" r="6.5" fill="' + COLORS.part + '" stroke="#fff" stroke-width="2"/><path d="M30 4.6 33.3 10.6H26.7Z" fill="#fff"/>'
      : st === 'no' ? '<circle cx="30" cy="8" r="6.5" fill="' + COLORS.no + '" stroke="#fff" stroke-width="2"/><path d="m27.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/>'
      : st === 'unk' ? '<circle cx="30" cy="8" r="6" fill="#fff" stroke="' + COLORS.unk + '" stroke-width="2.4"/>'
      : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(38 * s) + '" height="' + Math.round(46 * s) + '" viewBox="0 0 38 46">' +
      '<path d="M18 44C18 44 3 29 3 17a15 15 0 0 1 30 0c0 12-15 27-15 27Z" fill="' + BRAND + '" stroke="' + (active ? SAGE : '#fff') + '" stroke-width="' + (active ? 3.2 : 2) + '"/>' +
      '<g transform="translate(9.6 8.6) scale(.7)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + body + '</g>' + badge + '</svg>';
  }

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function loadCss(href) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }

  // ---------- Google Maps ----------
  async function createGoogle(el, opts) {
    await loadScript('https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(cfg.googleMapsApiKey) + '&language=' + ((window.KP && KP.lang) ? KP.lang() : 'cs') + '&region=CZ&libraries=geometry');
    await loadScript('https://unpkg.com/@googlemaps/markerclusterer@2.5.3/dist/index.min.js');
    const map = new google.maps.Map(el, {
      center: { lat: opts.lat, lng: opts.lng }, zoom: opts.zoom, mapTypeControl: true, streetViewControl: true, fullscreenControl: false,
      clickableIcons: false, gestureHandling: 'greedy',
    });
    let markers = [], byId = {}, clusterer = null, active = null, colorOf = () => 'unk', iconOf = null;
    const gicon = (st, a, ic) => ic
      ? { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(catPinSvg(ic, st, a)), scaledSize: new google.maps.Size(a ? 49 : 38, a ? 60 : 46), anchor: new google.maps.Point(a ? 23 : 18, a ? 57 : 44) }
      : { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(pinSvg(st, a)), scaledSize: new google.maps.Size(a ? 42 : 34, a ? 52 : 42), anchor: new google.maps.Point(a ? 21 : 17, a ? 52 : 42) };
    const icon = (p, a) => gicon(colorOf(p), a, iconOf ? iconOf(p) : null);
    const api = {
      engine: 'google', map,
      setPlaces(list, o) {
        colorOf = o.colorOf; iconOf = o.iconOf || null;
        if (clusterer) clusterer.clearMarkers();
        markers.forEach(m => m.setMap(null)); byId = {};
        markers = list.map(p => {
          const m = new google.maps.Marker({ position: { lat: p.la, lng: p.lo }, icon: icon(p), title: p.n });
          m.addListener('click', () => o.onClick(p)); byId[p.i] = m; return m;
        });
        clusterer = new markerClusterer.MarkerClusterer({ map, markers, renderer: { render: ({ count, position }) => new google.maps.Marker({ position, label: { text: String(count), color: '#fff', fontWeight: '700' }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 16 + Math.min(14, Math.log2(count) * 2), fillColor: SAGE, fillOpacity: .95, strokeColor: '#fff', strokeWeight: 3 }, zIndex: 1000 + count }) } });
      },
      fitTo(list) { if (!list.length) return; const b = new google.maps.LatLngBounds(); list.forEach(p => b.extend({ lat: p.la, lng: p.lo })); map.fitBounds(b, 40); },
      setView(lat, lng, z) { map.setCenter({ lat, lng }); map.setZoom(z); },
      focus(p) {
        if (active && byId[active.i]) byId[active.i].setIcon(icon(active));
        active = p; if (!p) return;
        const m = byId[p.i]; if (m) { m.setIcon(icon(p, true)); m.setZIndex(9999); }
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
    const map = L.map(el, { zoomControl: true, preferCanvas: true, zoomSnap: 0.25 }).setView([opts.lat, opts.lng], opts.zoom);
    if (opts.zoom <= 7) map.fitBounds([[47.3, 9.0], [51.1, 18.9]], { padding: [8, 8], animate: false }); // celé Česko + Bavorsko i na mobilu
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">' + (window.KP && KP.t ? KP.t('přispěvatelé OpenStreetMap') : 'přispěvatelé OpenStreetMap') + '</a>' }).addTo(map);
    const cache = {};
    let fits = 0;
    const csz = (c) => Math.round(34 + Math.min(16, Math.log2(c.getChildCount()) * 2));
    // Značka jako <img> s SVG v data URI – výrazně lehčí pro prohlížeč než vložené SVG v každé značce
    const licon = (st, a, ic) => {
      const k = (ic || '') + '|' + st + (a ? 'a' : '');
      if (cache[k]) return cache[k];
      return (cache[k] = ic
        ? L.icon({ iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(catPinSvg(ic, st, a)), iconSize: a ? [49, 60] : [38, 46], iconAnchor: a ? [23, 57] : [18, 44] })
        : L.icon({ iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(pinSvg(st, a)), iconSize: a ? [42, 52] : [34, 42], iconAnchor: a ? [21, 52] : [17, 42] }));
    };
    let group = null, byId = {}, active = null, colorOf = () => 'unk', iconOf = null, onClick = () => {}, styleKey = null;
    const icon = (p, a) => licon(colorOf(p), a, iconOf ? iconOf(p) : null);
    const mk = (p) => { const m = L.marker([p.la, p.lo], { icon: icon(p), title: p.n, alt: p.n, keyboard: false }); m.on('click', () => onClick(p)); byId[p.i] = m; return m; };
    const api = {
      engine: 'leaflet', map,
      setPlaces(list, o) {
        colorOf = o.colorOf; onClick = o.onClick; iconOf = o.iconOf || null;
        // S o.key (styl značek, např. potřeby uživatele) jen přidáme / odebereme rozdíl místo stavby celé vrstvy znovu
        if (group && o.key !== undefined && o.key === styleKey) {
          const next = new Set(list.map(p => p.i)), rem = [], add = [];
          for (const id in byId) if (!next.has(id)) { rem.push(byId[id]); delete byId[id]; }
          list.forEach(p => { if (!byId[p.i]) add.push(mk(p)); });
          if (rem.length) group.removeLayers(rem);
          if (add.length) group.addLayers(add);
          return;
        }
        styleKey = o.key;
        // Stará skupina může ještě po částech (chunkedLoading) přidávat značky; po odebrání z mapy by spadla na _map = null
        if (group) {
          map.removeLayer(group);
          const noop = function () {};
          group._addLayer = noop; group._refreshClustersIcons = noop;
          group._topClusterLevel = new Proxy({}, { get: () => noop });
        }
        group = L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50, disableClusteringAtZoom: 17,
          iconCreateFunction: c => L.divIcon({ className: '', html: '<div class="marker-cluster-kp" style="width:' + csz(c) + 'px;height:' + csz(c) + 'px">' + c.getChildCount() + '</div>', iconSize: [csz(c), csz(c)] }) });
        byId = {};
        const ms = list.map(mk);
        group.addLayers(ms); map.addLayer(group);
      },
      // První výřez bez animace: jinak by konec animace přepsal výřez nastavený hned po něm (obec nebo hledání z odkazu)
      fitTo(list) {
        if (!list.length) return;
        map.fitBounds(L.latLngBounds(list.map(p => [p.la, p.lo])), { padding: [40, 40], maxZoom: 16, animate: fits++ > 0 });
      },
      setView(lat, lng, z) { map.setView([lat, lng], z); },
      focus(p) {
        if (active && byId[active.i]) { byId[active.i].setIcon(icon(active)); byId[active.i].setZIndexOffset(0); }
        active = p; if (!p) return;
        const m = byId[p.i];
        const go = () => { if (m) { m.setIcon(icon(p, true)); m.setZIndexOffset(1000); } };
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
    pinSvg, catPinSvg,
    create(el, o) {
      const opts = Object.assign({ lat: (cfg.defaultCenter || {}).lat || 49.8, lng: (cfg.defaultCenter || {}).lng || 15.5, zoom: cfg.defaultZoom || 7 }, o || {});
      if (cfg.googleMapsApiKey) return createGoogle(el, opts).catch(err => { console.warn('Google Maps se nenačetly, používám OpenStreetMap', err); return createLeaflet(el, opts); });
      return createLeaflet(el, opts);
    },
  };
})();
