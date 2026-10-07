/* Stránka Trasy: bariéry v ulicích živě z OpenStreetMap (Overpass API, funguje v Česku i v Bavorsku) + plánovač mezi místy.
   Místa z databáze se načítají jen pro regiony ve výřezu (KP.loadPlacesInBounds), obce z data/regions/obce.json. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  const MIN_ZOOM = 15, MAX_AREA = 0.005, PAD = 0.1; // stupně², zhruba čtvrť velkého města

  // Typy bariér: barva + tvar + text (popisek v legendě, v seznamu i v tooltipu, nikdy jen barva)
  const TYPES = {
    steps: { label: 'Schodiště', plural: ['schodiště', 'schodiště', 'schodišť'], color: '#B22A20', kind: 'line', bad: true, dash: '3 3', w: 9 },
    kerbHigh: { label: 'Vysoký obrubník', plural: ['vysoký obrubník', 'vysoké obrubníky', 'vysokých obrubníků'], color: '#D9480F', kind: 'point', bad: true, shape: 'triangle' },
    kerbRolled: { label: 'Šikmý obrubník', plural: ['šikmý obrubník', 'šikmé obrubníky', 'šikmých obrubníků'], color: '#B26B00', kind: 'point', bad: false, shape: 'diamond' },
    kerbLow: { label: 'Snížený obrubník (sjezd)', plural: ['snížený obrubník', 'snížené obrubníky', 'snížených obrubníků'], color: '#1D7A3E', kind: 'point', bad: false, shape: 'check' },
    surface: { label: 'Nevhodný povrch', plural: ['úsek s nevhodným povrchem', 'úseky s nevhodným povrchem', 'úseků s nevhodným povrchem'], color: '#8A5A00', kind: 'line', bad: true, dash: '1 8', w: 7 },
    incline: { label: 'Stoupání nad 6 %', plural: ['prudké stoupání', 'prudká stoupání', 'prudkých stoupání'], color: '#7A3EA8', kind: 'line', bad: true, dash: '14 6', w: 6 },
    elevator: { label: 'Výtah', plural: ['výtah', 'výtahy', 'výtahů'], color: '#1F4FB8', kind: 'point', bad: false, shape: 'lift' },
    crossingOk: { label: 'Přechod bez bariér', plural: ['přechod bez bariér', 'přechody bez bariér', 'přechodů bez bariér'], color: '#0A6B5C', kind: 'point', bad: false, shape: 'zebra' },
    crossingBad: { label: 'Přechod s bariérou', plural: ['přechod s bariérou', 'přechody s bariérou', 'přechodů s bariérou'], color: '#6B1D16', kind: 'point', bad: true, shape: 'cross' },
  };
  const SURFACE_CS = { sett: 'kamenná dlažba', cobblestone: 'kočičí hlavy', unhewn_cobblestone: 'kočičí hlavy (neopracované)', gravel: 'štěrk', grass: 'tráva', sand: 'písek', dirt: 'hlína' };
  const SMOOTH_CS = { bad: 'rozbitý povrch', very_bad: 'velmi rozbitý povrch', horrible: 'téměř nesjízdný povrch', very_horrible: 'nesjízdný povrch', impassable: 'neprůjezdné' };

  const PLACES_ZOOM = 11; // od tohoto přiblížení načítáme místa z regionů ve výřezu
  let towns = [];
  let map = null, places = [], features = [], layerObjs = {}, visible = {}, loadedBox = null, loading = false, pending = null, timer = null;
  Object.keys(TYPES).forEach(k => { visible[k] = true; layerObjs[k] = []; });

  // Tvar značky jako SVG (bod) nebo vzorek čáry; stejný tvar na mapě, v legendě i v seznamu
  function shapeInner(t) {
    const c = t.color, st = 'stroke="#fff" stroke-width="1.6"';
    switch (t.shape) {
      case 'triangle': return '<path d="M10 1.5 19 18H1Z" fill="' + c + '" ' + st + '/><path d="M10 7v5M10 14.6v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>';
      case 'diamond': return '<path d="M10 1 19 10 10 19 1 10Z" fill="' + c + '" ' + st + '/>';
      case 'check': return '<circle cx="10" cy="10" r="8.5" fill="' + c + '" ' + st + '/><path d="m6 10.3 2.7 2.7L14 7.6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      case 'lift': return '<rect x="1.5" y="1.5" width="17" height="17" fill="' + c + '" ' + st + '/><path d="M10 4.5 13.5 8.5h-7ZM10 15.5 6.5 11.5h7Z" fill="#fff"/>';
      case 'zebra': return '<circle cx="10" cy="10" r="8.5" fill="' + c + '" ' + st + '/><path d="M5.5 7h9M5.5 10h9M5.5 13h9" stroke="#fff" stroke-width="1.8"/>';
      case 'cross': return '<rect x="1.5" y="1.5" width="17" height="17" fill="' + c + '" ' + st + '/><path d="m6 6 8 8m0-8-8 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';
    }
    return '';
  }
  function pointSvg(t, size) { return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 20 20">' + shapeInner(t) + '</svg>'; }
  function swatch(t) {
    if (t.kind === 'point') return '<span class="tr-sw" aria-hidden="true">' + pointSvg(t, 18) + '</span>';
    const dots = t.dash === '1 8';
    return '<span class="tr-sw" aria-hidden="true"><svg width="30" height="12" viewBox="0 0 30 12"><path d="M3 6h24" stroke="' + t.color + '" stroke-width="' + Math.min(t.w || 6, 8) + '" stroke-dasharray="' + (dots ? '0.1 8' : t.dash) + '" stroke-linecap="' + (dots ? 'round' : 'butt') + '"/></svg></span>';
  }

  function plural(t, n) { const p = TYPES[t].plural; return n === 1 ? p[0] : n > 1 && n < 5 ? p[1] : p[2]; }
  function heightCm(v) {
    if (!v) return null;
    const m = String(v).match(/([\d.,]+)\s*(cm|m)?/); if (!m) return null;
    const x = parseFloat(m[1].replace(',', '.'));
    return m[2] === 'cm' || (!m[2] && x > 1) ? Math.round(x) : Math.round(x * 100);
  }

  function buildQuery(b) {
    const bb = [b.s, b.w, b.n, b.e].map(x => x.toFixed(5)).join(',');
    return '[out:json][timeout:25][bbox:' + bb + '];(' +
      'way["highway"="steps"];' +
      'node["barrier"="kerb"];node["kerb"~"^(raised|rolled|lowered|flush)$"];' +
      'way["highway"~"^(footway|path|pedestrian|living_street|residential|service|cycleway|track|steps)$"]["surface"~"^(sett|cobblestone|unhewn_cobblestone|gravel|grass|sand|dirt)$"];' +
      'way["highway"~"^(footway|path|pedestrian|living_street|residential|service)$"]["smoothness"~"^(bad|very_bad|horrible|very_horrible|impassable)$"];' +
      'way["highway"~"^(footway|path|pedestrian|living_street|residential|service|steps)$"]["incline"];' +
      'node["highway"="elevator"];' +
      'node["highway"="crossing"]["wheelchair"];node["highway"="crossing"]["kerb"~"^(lowered|flush|raised)$"];' +
      ');out tags geom qt;';
  }

  async function overpass(q) {
    // hlavní server, záloha, a po krátké pauze ještě jednou hlavní (při přetížení vrací 504/429)
    const tries = [[SERVERS[0], 0, 25000], [SERVERS[1], 0, 15000], [SERVERS[0], 3000, 25000]];
    let last;
    for (const [i, [url, wait, limit]] of tries.entries()) {
      if (i) setStatus(i === 1 ? 'Hlavní server OpenStreetMap neodpovídá, zkouším záložní…' : 'Zkouším hlavní server ještě jednou…');
      if (wait) await new Promise(r => setTimeout(r, wait));
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), limit);
      try {
        const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        if (!r.ok) { clearTimeout(t); last = new Error('HTTP ' + r.status); continue; }
        const j = await r.json(); // časový limit hlídá i stahování odpovědi
        clearTimeout(t);
        return j;
      } catch (e) { clearTimeout(t); last = e; }
    }
    throw last;
  }

  // OSM prvek → 0–n bariér (jeden úsek může mít víc problémů)
  function classify(e) {
    const t = e.tags || {}, out = [];
    const coords = e.type === 'node' ? [[e.lat, e.lon]] : (e.geometry || []).map(g => [g.lat, g.lon]);
    if (!coords.length) return out;
    const add = (type, detail) => out.push({ id: e.type[0] + e.id, type, coords, detail, name: t.name || '' });
    if (e.type === 'node') {
      if (t.highway === 'elevator') add('elevator', [t.wheelchair === 'yes' ? 'přístupný na vozíku' : t.wheelchair === 'no' ? 'není pro vozík' : '', t.level ? 'patra ' + t.level : ''].filter(Boolean).join(', '));
      else if (t.highway === 'crossing' && t.wheelchair) { add(t.wheelchair === 'no' ? 'crossingBad' : 'crossingOk', t.wheelchair === 'yes' ? 'přechod přístupný na vozíku' : t.wheelchair === 'limited' ? 'přechod částečně přístupný' : 'přechod nepřístupný na vozíku'); return out; }
      else if (t.highway === 'crossing' && (t.kerb === 'lowered' || t.kerb === 'flush')) { add('crossingOk', t.kerb === 'flush' ? 'obrubník v úrovni vozovky' : 'snížený obrubník'); return out; }
      else if (t.highway === 'crossing' && t.kerb === 'raised') { add('crossingBad', 'vysoký obrubník' + (heightCm(t['kerb:height']) != null ? ', ' + heightCm(t['kerb:height']) + ' cm' : '')); return out; }
      if (t.kerb || t.barrier === 'kerb') {
        const h = heightCm(t['kerb:height']);
        const k = t.kerb || (h != null ? (h <= 2 ? 'lowered' : 'raised') : null);
        if (!k) return out;
        const hTxt = h != null ? 'výška ' + h + ' cm' : 'výška neuvedena';
        if (k === 'raised') add('kerbHigh', hTxt);
        else if (k === 'rolled') add('kerbRolled', hTxt);
        else if (k === 'lowered' || k === 'flush') add('kerbLow', (k === 'flush' ? 'v úrovni vozovky' : 'snížený') + (h != null ? ', ' + h + ' cm' : ''));
      }
      return out;
    }
    if (t.highway === 'steps') {
      const d = [];
      const sc = parseInt(t.step_count, 10);
      d.push(sc > 0 ? sc + (sc === 1 ? ' schod' : sc < 5 ? ' schody' : ' schodů') : 'počet schodů neuveden');
      if (t['ramp:wheelchair'] === 'yes') d.push('s rampou pro vozík'); else if (t['ramp:stroller'] === 'yes' || t['ramp:bicycle'] === 'yes') d.push('jen ližiny (ne pro vozík)'); else if (t.ramp === 'no' || t['ramp:wheelchair'] === 'no') d.push('bez rampy');
      if (t.handrail === 'yes' || t['handrail:left'] === 'yes' || t['handrail:right'] === 'yes') d.push('zábradlí'); else if (t.handrail === 'no') d.push('bez zábradlí');
      add('steps', d.join(', '));
    }
    if (t.highway !== 'steps') {
      const sd = [SURFACE_CS[t.surface], SMOOTH_CS[t.smoothness]].filter(Boolean);
      if (sd.length) add('surface', sd.join(', '));
    }
    if (t.incline && t.highway !== 'steps') {
      const m = String(t.incline).match(/-?([\d.,]+)\s*%/);
      if (m && parseFloat(m[1].replace(',', '.')) > 6) add('incline', 'sklon ' + m[1].replace('.', ',') + ' %');
    }
    return out;
  }

  function center(f) { const c = f.coords; return c[Math.floor(c.length / 2)]; }
  function distM(a, b) { return K.distanceKm({ la: a[0], lo: a[1] }, { la: b[0], lo: b[1] }) * 1000; }

  // Kreslíme sami (tvar a vzor čáry); adaptér map-engine umí jen barevné kroužky
  function drawOne(f) {
    const t = TYPES[f.type], title = t.label + (f.detail ? ': ' + f.detail : '') + (f.name ? ' (' + f.name + ')' : '');
    const line = t.kind === 'line' && f.coords.length > 1, M = map.map;
    if (map.engine === 'leaflet') {
      const o = line
        ? L.polyline(f.coords, { color: t.color, weight: t.w || 6, opacity: .95, dashArray: t.dash, lineCap: t.dash === '1 8' ? 'round' : 'butt' })
        : L.marker(f.coords[0], { icon: L.divIcon({ className: 'tr-mk', html: pointSvg(t, 22), iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, title });
      return o.bindTooltip(title).addTo(M);
    }
    if (line) {
      const seg = t.dash.split(' ').map(Number);
      return new google.maps.Polyline({ map: M, path: f.coords.map(c => ({ lat: c[0], lng: c[1] })), strokeOpacity: 0, strokeColor: t.color,
        icons: [{ icon: { path: 'M 0,0 0,' + Math.max(seg[0], 1), strokeOpacity: .95, strokeColor: t.color, strokeWeight: t.w || 6, scale: 1 }, offset: '0', repeat: (seg[0] + seg[1]) + 'px' }] });
    }
    return new google.maps.Marker({ map: M, position: { lat: f.coords[0][0], lng: f.coords[0][1] }, title,
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(pointSvg(t, 22)), scaledSize: new google.maps.Size(22, 22), anchor: new google.maps.Point(11, 11) } });
  }
  function drawLayers() {
    Object.keys(TYPES).forEach(k => { map.clearLayer(layerObjs[k]); layerObjs[k] = []; });
    Object.keys(TYPES).forEach(k => { if (visible[k]) layerObjs[k] = features.filter(f => f.type === k).map(drawOne); });
  }

  function renderSummary() {
    const box = $('#summary');
    const counts = {}; features.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
    const parts = Object.keys(TYPES).filter(k => counts[k]).map(k => '<b class="num">' + counts[k] + '</b> ' + plural(k, counts[k]));
    box.hidden = false;
    box.innerHTML = parts.length
      ? '<p><b>V této oblasti:</b> ' + parts.join(', ') + '.</p>'
      : '<p>V OpenStreetMap tu nejsou zakreslené žádné schody, obrubníky ani problémové povrchy. To ale neznamená, že tu nejsou. Jen je zatím nikdo nezmapoval.</p>';
    // seznam nejbližších ke středu mapy
    const b = map.bounds(); const c = [(b.s + b.n) / 2, (b.w + b.e) / 2];
    const near = features.map(f => ({ f, d: distM(c, center(f)) })).sort((a, z) => a.d - z.d).slice(0, 12);
    const n = $('#nearest');
    n.hidden = !near.length;
    n.innerHTML = '<h3>Nejblíž středu mapy</h3><ol>' + near.map(({ f, d }) =>
      '<li><button type="button" class="tr-item" data-lat="' + center(f)[0] + '" data-lng="' + center(f)[1] + '">' +
      swatch(TYPES[f.type]) +
      '<span><b>' + TYPES[f.type].label + '</b>' + (f.detail ? ' · ' + K.esc(f.detail) : '') + (f.name ? '<br><span class="muted small">' + K.esc(f.name) + '</span>' : '') + '</span>' +
      '<span class="num small muted tr-dist">' + (d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1).replace('.', ',') + ' km') + '</span></button></li>').join('') + '</ol>';
  }

  // Legenda ve dvou skupinách: co překáží a co pomůže; v panelu zároveň přepínače vrstev
  function renderToggles() {
    const groups = [['Překáží', true], ['Pomůže', false]];
    $('#layer-toggles').innerHTML = groups.map(([title, bad]) => '<p class="tr-group">' + title + '</p>' +
      Object.entries(TYPES).filter(([, t]) => t.bad === bad).map(([k, t]) =>
        '<label class="check"><input type="checkbox" data-layer="' + k + '"' + (visible[k] ? ' checked' : '') + '> ' + swatch(t) + t.label + '</label>').join('')).join('');
    const pin = KPMap.pinSvg('ok').replace('width="34" height="42"', 'width="14" height="18"');
    $('#place-sw').innerHTML = pin;
    $('#legend').innerHTML = groups.map(([title, bad]) => '<p class="tr-group">' + title + '</p><ul>' +
      Object.values(TYPES).filter(t => t.bad === bad).map(t => '<li>' + swatch(t) + t.label + '</li>').join('') + '</ul>').join('') +
      '<p class="tr-group">Místa</p><ul><li><span class="tr-sw" aria-hidden="true">' + pin + '</span>Místo z databáze, barva a tvar podle přístupnosti</li></ul>';
  }

  // ---------- Panel: záložky a spodní panel na mobilu ----------
  const mobile = () => matchMedia('(max-width: 899px)').matches;
  const SHEET = ['peek', 'half', 'full'];
  function setSheet(st) { $('.tr-app').dataset.sheet = st; $('#grip').setAttribute('aria-expanded', st !== 'peek'); }
  function sheetHeights() { const H = $('.tr-app').clientHeight; return { peek: 156, half: Math.round(H * 0.5), full: Math.round(H * 0.94) }; }
  function cycleSheet() { const cur = $('.tr-app').dataset.sheet; setSheet(SHEET[(SHEET.indexOf(cur) + 1) % 3]); }
  function bindSheet() {
    const panel = $('#tr-panel'), row = $('.tr-grip-row');
    let y0 = null, h0 = 0, moved = false;
    row.addEventListener('pointerdown', e => {
      if (!mobile()) return;
      y0 = e.clientY; h0 = panel.getBoundingClientRect().height; moved = false;
      row.setPointerCapture(e.pointerId); panel.style.transition = 'none';
    });
    row.addEventListener('pointermove', e => {
      if (y0 === null) return;
      const dy = e.clientY - y0; if (Math.abs(dy) > 6) moved = true;
      if (moved) { const hs = sheetHeights(); panel.style.height = Math.max(hs.peek, Math.min(hs.full, h0 - dy)) + 'px'; }
    });
    const end = () => {
      if (y0 === null) return;
      y0 = null; panel.style.transition = '';
      if (moved) {
        const h = panel.getBoundingClientRect().height, hs = sheetHeights();
        panel.style.height = '';
        setSheet(SHEET.reduce((a, b) => Math.abs(hs[b] - h) < Math.abs(hs[a] - h) ? b : a));
      } else cycleSheet();
    };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
    // klávesnice (Enter, mezerník); klik myší a dotyk už vyřídil pointerup
    $('#grip').addEventListener('click', e => { if (e.detail === 0) cycleSheet(); });
    // při psaní se panel roztáhne, aby pole nebylo schované
    panel.addEventListener('focusin', e => { if (mobile() && e.target.matches('input, select, textarea') && $('.tr-app').dataset.sheet === 'peek') setSheet('half'); });
  }
  function showTab(id) {
    document.querySelectorAll('.tr-tabs [role="tab"]').forEach(t => {
      const on = t.id === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  function bindTabs() {
    const tabs = Array.from(document.querySelectorAll('.tr-tabs [role="tab"]'));
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { showTab(t.id); if (mobile() && $('.tr-app').dataset.sheet === 'peek') setSheet('half'); });
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
        e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; showTab(n.id); n.focus();
      });
    });
  }
  function setTop() {
    const m = $('.tr-app'); if (!m) return;
    document.documentElement.style.setProperty('--tr-top', Math.ceil(m.getBoundingClientRect().top + window.scrollY) + 'px');
  }

  function contains(outer, b) { return outer && b.s >= outer.s && b.n <= outer.n && b.w >= outer.w && b.e <= outer.e; }
  function areaOf(b) { return (b.n - b.s) * (b.e - b.w); }

  async function loadBarriers(force, box) {
    const b = box || map.bounds(); if (!b || loading) return;
    if (!box && map.zoom() < MIN_ZOOM) return;
    if (!force && contains(loadedBox, b)) return;
    const padLat = (b.n - b.s) * PAD, padLng = (b.e - b.w) * PAD;
    const q = { s: b.s - padLat, n: b.n + padLat, w: b.w - padLng, e: b.e + padLng };
    if (areaOf(q) > MAX_AREA) { setStatus('Oblast je moc velká. Přibližte mapu ještě víc, ať server nezahltíme.'); return; }
    loading = true; setStatus('Načítám bariéry z OpenStreetMap…'); $('#load').disabled = true;
    let done; pending = new Promise(r => { done = r; });
    try {
      const data = await overpass(buildQuery(q));
      const seen = new Set();
      features = [];
      (data.elements || []).forEach(e => classify(e).forEach(f => { const key = f.id + f.type; if (!seen.has(key)) { seen.add(key); features.push(f); } }));
      loadedBox = q;
      drawLayers(); renderSummary();
      setStatus('Načteno ' + features.length + ' prvků · stav OpenStreetMap ' + (data.osm3s && data.osm3s.timestamp_osm_base ? K.fmtDate(data.osm3s.timestamp_osm_base.slice(0, 10)) : 'dnes') + '.');
    } catch (e) {
      setStatus('Server OpenStreetMap teď neodpovídá (bývá přetížený). Zkuste to za chvíli tlačítkem níže.');
    } finally { loading = false; done(); pending = null; $('#load').disabled = map.zoom() < MIN_ZOOM; }
  }

  function setStatus(t) { $('#status').textContent = t; }

  function placesInView() {
    const b = map.bounds(); if (!b) return [];
    return places.filter(p => p.la >= b.s && p.la <= b.n && p.lo >= b.w && p.lo <= b.e);
  }
  function fillPlanSelects() {
    if (!map || map.zoom() < 13) return;
    const list = placesInView().filter(p => p.c !== 'parkovani').sort((a, b) => a.n.localeCompare(b.n, 'cs')).slice(0, 300);
    ['#from', '#to'].forEach(s => {
      const cur = $(s).value;
      $(s).innerHTML = '<option value="">Vyberte místo (' + list.length + ' v oblasti)</option>' + list.map(p => '<option value="' + p.i + '"' + (p.i === cur ? ' selected' : '') + '>' + K.esc(p.n) + ' (' + K.esc(p.s || p.o || '') + ')</option>').join('');
    });
    updatePlanBtn();
  }
  function updatePlanBtn() { $('#plan').disabled = !($('#from').value && $('#to').value && $('#from').value !== $('#to').value); }

  // vzdálenost bodu od úsečky v metrech (rovinná aproximace, na pár km stačí)
  function segDist(p, a, b) {
    const ky = 111320, kx = 111320 * Math.cos(a[0] * Math.PI / 180);
    const ax = a[1] * kx, ay = a[0] * ky, bx = b[1] * kx, by = b[0] * ky, px = p[1] * kx, py = p[0] * ky;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // bariéry podél spojnice seskupené podle typu, u každého typu nejvýš 4 podrobnosti
  function groupHits(list) {
    return Object.keys(TYPES).map(k => {
      const g = list.filter(f => f.type === k); if (!g.length) return '';
      const det = g.slice(0, 4).map(f => K.esc(f.detail || '') + (f.name ? ' (' + K.esc(f.name) + ')' : '')).filter(Boolean);
      return '<li>' + swatch(TYPES[k]) + '<span><b>' + TYPES[k].label + ' ' + g.length + '×</b>' +
        (det.length ? '<br><span class="small muted">' + det.join('; ') + (g.length > 4 ? '; a ' + (g.length - 4) + ' dalších' : '') + '</span>' : '') + '</span></li>';
    }).join('');
  }

  async function plan() {
    const a = places.find(p => p.i === $('#from').value), b = places.find(p => p.i === $('#to').value);
    if (!a || !b) return;
    const url = K.gmaps.route(a, b);
    window.open(url, '_blank', 'noopener');
    const box = { s: Math.min(a.la, b.la) - 0.0005, n: Math.max(a.la, b.la) + 0.0005, w: Math.min(a.lo, b.lo) - 0.0007, e: Math.max(a.lo, b.lo) + 0.0007 };
    const res = $('#plan-result'); res.hidden = false;
    if (!contains(loadedBox, box)) {
      if (areaOf(box) > MAX_AREA) { res.innerHTML = '<p class="callout">Místa jsou od sebe moc daleko na kontrolu bariér (zvládneme asi 2–3 km). <a href="' + url + '" target="_blank" rel="noopener">Trasa v Google Maps</a></p>'; return; }
      res.innerHTML = '<p>Načítám bariéry podél trasy…</p>';
      if (pending) await pending;
      if (!contains(loadedBox, box)) await loadBarriers(true, box);
      if (!contains(loadedBox, box)) { res.innerHTML = '<p class="callout">Bariéry podél trasy se teď nepodařilo načíst, takže kontrola neproběhla. Zkuste to za chvíli znovu. <a href="' + url + '" target="_blank" rel="noopener">Trasa v Google Maps</a></p>'; return; }
    }
    const A = [a.la, a.lo], B = [b.la, b.lo];
    const hits = features.filter(f => f.coords.some(c => segDist(c, A, B) <= 25)).filter(f => TYPES[f.type].bad || f.type === 'kerbLow' || f.type === 'elevator');
    const bad = hits.filter(f => TYPES[f.type].bad), good = hits.filter(f => !TYPES[f.type].bad);
    const len = distM(A, B);
    res.innerHTML = '<div class="tr-plan-out">' +
      '<p><b>' + K.esc(a.n) + '</b> → <b>' + K.esc(b.n) + '</b> · vzdušnou čarou <span class="num">' + (len < 1000 ? Math.round(len) + ' m' : (len / 1000).toFixed(1).replace('.', ',') + ' km') + '</span></p>' +
      (bad.length ? '<p>' + K.statusHtml('part', 'Do 25 m od přímé spojnice je ' + bad.length + ' ' + (bad.length === 1 ? 'bariéra' : bad.length < 5 ? 'bariéry' : 'bariér')) + '</p><ul>' + groupHits(bad) + '</ul>'
        : '<p>' + K.statusHtml('ok', 'Podél přímé spojnice OpenStreetMap žádné bariéry neuvádí') + '</p>') +
      (good.length ? '<p class="small">Pomůže: ' + good.map(f => TYPES[f.type].label.toLowerCase()).filter((x, i, arr) => arr.indexOf(x) === i).join(', ') + ' (' + good.length + '×).</p>' : '') +
      '<p class="small muted">Orientační kontrola: počítáme s přímou čarou, ne se skutečnou trasou z Google Maps. Projděte si trasu ve Street View.</p>' +
      '<div class="row"><a class="btn btn-action" href="' + url + '" target="_blank" rel="noopener">' + K.icon('nav') + 'Trasa v Google Maps</a><a class="btn btn-ghost" href="' + K.placeUrl(b) + '">Detail cíle</a></div></div>';
  }

  function renderSaved() {
    const list = K.store.get('routes', []);
    $('#saved-routes').innerHTML = list.length ? '<li class="tr-group">Uložené trasy</li>' + list.map((r, i) => '<li class="tr-route"><span class="tr-route-txt"><b>' + K.esc(r.name) + '</b> <span class="muted small">' + K.fmtDate(r.date) + '</span>' +
      (r.from ? '<br><span class="small">' + K.esc(r.from) + ' → ' + K.esc(r.to) + '</span>' : '') + (r.note ? '<br><span class="small muted">' + K.esc(r.note) + '</span>' : '') + '</span>' +
      '<button class="btn btn-quiet btn-sm" type="button" data-del="' + i + '">Smazat</button></li>').join('') : '';
  }

  function bind() {
    $('#find-form').addEventListener('submit', e => {
      e.preventDefault();
      const q = $('#town').value.trim().toLowerCase(); if (!q || !map) return;
      const t = towns.find(x => x[0].toLowerCase() === q);
      if (!t) { setStatus('Obec „' + $('#town').value + '“ v naší databázi nemáme. Posuňte mapu ručně.'); return; }
      // obec s nejvíce místy toho jména (Česko i Bavorsko); střed obalu míst v obci, přiblížení na úroveň ulic
      map.setView((t[3] + t[5]) / 2, (t[4] + t[6]) / 2, 16);
      if (mobile()) { $('#town').blur(); setSheet('peek'); }
    });
    $('#locate').addEventListener('click', () => map && map.locate().catch(() => K.toast('Polohu se nepodařilo zjistit. Povolte ji v prohlížeči.')));
    $('#load').addEventListener('click', () => loadBarriers(true));
    $('#layer-toggles').addEventListener('change', e => { const k = e.target.dataset.layer; if (!k) return; visible[k] = e.target.checked; drawLayers(); });
    $('#show-places').addEventListener('change', showPlaces);
    $('#nearest').addEventListener('click', e => { const b = e.target.closest('.tr-item'); if (b) { map.setView(+b.dataset.lat, +b.dataset.lng, 18); if (mobile()) setSheet('peek'); } });
    $('#picked').addEventListener('click', e => {
      if (e.target.closest('[data-close-picked]')) { $('#picked').hidden = true; return; }
      const btn = e.target.closest('[data-set]'); if (!btn) return;
      fillPlanSelects(); const sel = $('#' + btn.dataset.set); sel.value = btn.dataset.id; updatePlanBtn();
      K.toast(btn.dataset.set === 'from' ? 'Start nastaven.' : 'Cíl nastaven.');
      if ($('#from').value && $('#to').value) showTab('tab-plan');
    });
    $('#from').addEventListener('change', updatePlanBtn); $('#to').addEventListener('change', updatePlanBtn);
    $('#plan').addEventListener('click', plan);
    $('#my-route').addEventListener('submit', e => {
      e.preventDefault();
      const list = K.store.get('routes', []);
      const withPlan = $('#r-plan').checked;
      const a = places.find(p => p.i === $('#from').value), b = places.find(p => p.i === $('#to').value);
      list.push({ name: $('#r-name').value.trim(), note: $('#r-note').value.trim(), date: new Date().toISOString().slice(0, 10), from: withPlan && a ? a.n : '', to: withPlan && b ? b.n : '' });
      K.store.set('routes', list); e.target.reset(); renderSaved(); K.toast('Trasa uložena v tomto prohlížeči.');
    });
    $('#saved-routes').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; const list = K.store.get('routes', []); list.splice(+b.dataset.del, 1); K.store.set('routes', list); renderSaved(); });
  }

  function showPlaces() {
    if (!map) return;
    const on = $('#show-places').checked;
    map.setPlaces(on ? places.filter(p => p.c !== 'parkovani' && (p.w === 'yes' || p.w === 'limited' || p.t === 'yes')) : [], {
      colorOf: p => K.generalStatus(p),
      onClick: p => {
        const n = $('#picked'); n.hidden = false;
        n.innerHTML = '<div class="tr-picked-head"><div><h3>' + K.esc(p.n) + '</h3><p class="small muted">' + K.esc([p.s, p.o].filter(Boolean).join(' · ')) + '</p></div>' +
          '<button class="icon-btn" type="button" data-close-picked aria-label="Zavřít">' + K.icon('close') + '</button></div>' +
          (p.img ? '<figure class="photo tr-ph"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async">' +
            '<figcaption><a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">Foto: Wikimedia Commons</a></figcaption></figure>' : '') +
          '<p class="tr-picked-st">' + K.statusHtml(K.W[p.w || 'null'].st, K.W[p.w || 'null'].label) + (p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : '') + '</p>' +
          '<div class="tr-picked-act"><button class="btn btn-ghost btn-sm" type="button" data-set="from" data-id="' + p.i + '">Nastavit jako start A</button><button class="btn btn-ghost btn-sm" type="button" data-set="to" data-id="' + p.i + '">Nastavit jako cíl B</button><a class="btn btn-quiet btn-sm" href="' + K.placeUrl(p) + '">Detail</a></div>';
        const ph = n.querySelector('.tr-ph img');
        if (ph) ph.addEventListener('error', () => ph.closest('figure').remove(), { once: true });
        if (mobile() && $('.tr-app').dataset.sheet === 'peek') setSheet('half');
        $('#tr-scroll').scrollTop = 0;
      },
    });
  }

  // Místa z databáze jen pro regiony ve výřezu (od přiblížení PLACES_ZOOM); načtené regiony zůstávají v cache
  let placesBusy = false, placesKey = '';
  async function loadPlacesHere() {
    if (!map || placesBusy || map.zoom() < PLACES_ZOOM) return;
    const b = map.bounds(); if (!b) return;
    placesBusy = true;
    try {
      const list = await K.loadPlacesInBounds(b);
      const key = list.length + ':' + (list[0] ? list[0].i : '');
      if (key !== placesKey) { placesKey = key; places = list; showPlaces(); fillPlanSelects(); }
    } catch (e) { setStatus('Databázi míst se nepodařilo načíst. Bariéry ale fungují dál.'); }
    placesBusy = false;
  }

  async function init() {
    setTop(); window.addEventListener('resize', setTop);
    setSheet(mobile() ? 'peek' : 'half');
    renderToggles(); renderSaved(); bind(); bindTabs(); bindSheet();
    const sp = new URLSearchParams(location.search);
    const la = parseFloat(sp.get('la')), lo = parseFloat(sp.get('lo'));
    const hasLL = isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
    map = await KPMap.create($('#map'), hasLL ? { lat: la, lng: lo, zoom: 17 } : undefined);
    map.onMove(() => {
      $('#load').disabled = map.zoom() < MIN_ZOOM || loading;
      if (map.zoom() < MIN_ZOOM && !loading) setStatus('Přibližte mapu na ulice (měřítko asi 1 : 10 000) a bariéry se načtou samy.');
      clearTimeout(timer); timer = setTimeout(() => { loadBarriers(false); loadPlacesHere(); fillPlanSelects(); }, 900);
    });
    try {
      towns = await K.loadTowns();
      $('#towns').innerHTML = towns.slice(0, 1500).map(x => '<option value="' + K.esc(x[0]) + '">').join('');
    } catch (e) { /* hledání obce nepůjde, mapa ano */ }
    loadPlacesHere();
    if (hasLL) setTimeout(() => { loadBarriers(true); fillPlanSelects(); }, 300);
    else if (sp.get('obec')) { $('#town').value = sp.get('obec'); $('#find-form').requestSubmit(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
