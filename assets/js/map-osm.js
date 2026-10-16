/* Mapa míst: zapínatelné vrstvy s prvky přístupnosti živě z OpenStreetMap (Overpass API).
   Schody, obrubníky, rampy a výtahy, zastávky s údajem wheelchair. Nic nedopočítáváme, ukazujeme jen značky z OSM.
   Stahuje se jen od přiblížení 16, jedním sloučeným dotazem pro všechny zapnuté vrstvy, po dlaždicích z15 s cache.
   Posun mapy: počkat 450 ms, rozpracovaný požadavek zrušit. Stav vrstev: K.store('map.osm') a v adrese ?vrstvy=.
   KPOsm.init(adapter, { pop, legend, note }) volá mapa.js po vytvoření mapy. */
(function () {
  'use strict';
  const K = window.KP;
  // hlavní server a zálohy v tomto pořadí (servery bývají přetížené; při chybě nebo časovém limitu jde dotaz na další)
  const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter'];
  const MIN_ZOOM = 16, TZ = 15, MAX_TILES = 48, DEBOUNCE = 450, CACHE_MAX = 600;
  const C = { ok: '#2E6B3A', part: '#8A5A00', no: '#B3261E', unk: '#5D6A58', brand: '#3A4A34' };
  const URL_KEY = 'vrstvy';
  const URL_CODE = { steps: 'schody', kerb: 'obrubniky', ramp: 'rampy', stop: 'zastavky' };
  const LAYERS = ['steps', 'kerb', 'ramp', 'stop'];

  // ---------- Značky: tvar + barva (legenda tvarem i textem) ----------
  const SH = {
    kerbLow: (c) => '<circle cx="10" cy="10" r="8.2" fill="' + c + '" stroke="#fff" stroke-width="1.8"/><path d="m6 10.3 2.7 2.7L14 7.6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    kerbHigh: (c) => '<path d="M10 1.6 18.8 17.6H1.2Z" fill="' + c + '" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 7v4.6M10 14.2v.3" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    kerbUnk: (c) => '<circle cx="10" cy="10" r="7.4" fill="#fff" stroke="' + c + '" stroke-width="3"/>',
    lift: (c) => '<rect x="1.5" y="1.5" width="17" height="17" rx="3" fill="' + c + '" stroke="#fff" stroke-width="1.6"/><path d="M10 4.6 13.4 8.4H6.6ZM10 15.4 6.6 11.6h6.8Z" fill="#fff"/>',
    ramp: (c) => '<circle cx="10" cy="10" r="8.6" fill="' + c + '" stroke="#fff" stroke-width="1.6"/><path d="M4.6 14h10.8V7.2Z" fill="#fff"/>',
    stopOk: (c) => '<rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="' + c + '" stroke="#fff" stroke-width="1.6"/><path d="m5.8 10.3 2.8 2.8L14.4 7.4" stroke="#fff" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    stopPart: (c) => '<rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="' + c + '" stroke="#fff" stroke-width="1.6"/><path d="M10 5.2 14.6 14H5.4Z" fill="#fff"/>',
    stopNo: (c) => '<rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="' + c + '" stroke="#fff" stroke-width="1.6"/><path d="m6.4 6.4 7.2 7.2m0-7.2-7.2 7.2" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>',
  };
  const SYM = {
    kerbLow: { sh: 'kerbLow', c: C.ok, size: 18, z: 10, label: 'Snížený obrubník' },
    kerbHigh: { sh: 'kerbHigh', c: C.no, size: 18, z: 20, label: 'Vysoký obrubník' },
    kerbUnk: { sh: 'kerbUnk', c: C.unk, size: 16, z: 0, label: 'Obrubník bez údaje' },
    lift: { sh: 'lift', c: C.brand, size: 24, z: 40, label: 'Výtah' },
    ramp: { sh: 'ramp', c: C.ok, size: 24, z: 40, label: 'Rampa pro vozík' },
    stopOk: { sh: 'stopOk', c: C.ok, size: 24, z: 60, label: 'Zastávka bezbariérová' },
    stopPart: { sh: 'stopPart', c: C.part, size: 24, z: 55, label: 'Zastávka částečně' },
    stopNo: { sh: 'stopNo', c: C.no, size: 24, z: 50, label: 'Zastávka nepřístupná' },
  };
  const LINE = { steps: { color: C.no, weight: 6, dash: '4 3', label: 'Schody' }, rampLine: { color: C.ok, weight: 6, dash: null, label: 'Rampa pro vozík' } };
  const svg = (k, size) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 20 20">' + SH[SYM[k].sh](SYM[k].c) + '</svg>';
  const lineSw = (l) => '<svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true"><path d="M2 6h26" stroke="#fff" stroke-width="' + (l.weight + 3) + '"/><path d="M3 6h24" stroke="' + l.color + '" stroke-width="' + l.weight + '"' + (l.dash ? ' stroke-dasharray="' + l.dash + '"' : '') + '/></svg>';
  // Co patří ke které vrstvě (v nabídce i v legendě)
  const KEYS = {
    steps: [['line', 'steps']],
    kerb: [['pt', 'kerbLow'], ['pt', 'kerbHigh'], ['pt', 'kerbUnk']],
    ramp: [['pt', 'ramp'], ['line', 'rampLine'], ['pt', 'lift']],
    stop: [['pt', 'stopOk'], ['pt', 'stopPart'], ['pt', 'stopNo']],
  };
  const swatch = (kind, k) => '<span class="osm-sw" aria-hidden="true">' + (kind === 'line' ? lineSw(LINE[k]) : svg(k, 18)) + '</span>';

  // ---------- Hodnoty z OSM do češtiny (jen to, co v datech je) ----------
  const YN_CS = { yes: 'ano', no: 'ne', limited: 'částečně', partial: 'částečně', incorrect: 'nesprávně' };
  const YN = (v) => YN_CS[v] ? KP.t(YN_CS[v]) : v;
  function heightCm(v) {
    const m = String(v).match(/([\d.,]+)\s*(cm|mm|m)?/); if (!m) return null;
    const x = parseFloat(m[1].replace(',', '.'));
    if (m[2] === 'mm') return Math.round(x / 10);
    return m[2] === 'cm' || (!m[2] && x > 1) ? Math.round(x) : Math.round(x * 100);
  }
  function handrail(t) {
    if (t.handrail) return YN(t.handrail);
    const l = t['handrail:left'] === 'yes', r = t['handrail:right'] === 'yes', c = t['handrail:center'] === 'yes';
    const parts = [];
    if (l && r) parts.push(KP.t('po obou stranách')); else if (l) parts.push(KP.t('vlevo')); else if (r) parts.push(KP.t('vpravo'));
    if (c) parts.push(KP.t('uprostřed'));
    if (parts.length) return parts.join(', ');
    if (t['handrail:left'] === 'no' && t['handrail:right'] === 'no') return KP.t('ne');
    return null;
  }
  const KERB_CS = { lowered: 'snížený', flush: 'v úrovni vozovky', no: 'bez obrubníku', raised: 'vysoký', rolled: 'šikmý', yes: 'ano, výška neuvedena' };
  function kerbSym(t) {
    const v = t.kerb;
    if (v === 'lowered' || v === 'flush' || v === 'no') return 'kerbLow';
    if (v === 'raised' || v === 'rolled' || v === 'yes') return 'kerbHigh';
    return 'kerbUnk';
  }
  function stopKind(t) {
    if (t.railway === 'station') return KP.t('Nádraží');
    if (t.railway === 'halt') return KP.t('Železniční zastávka');
    if (t.railway === 'tram_stop') return KP.t('Tramvajová zastávka');
    if (t.highway === 'bus_stop') return KP.t('Autobusová zastávka');
    return KP.t('Nástupiště');
  }

  function popupHtml(title, rows, e) {
    const link = 'https://www.openstreetmap.org/' + e.type + '/' + e.id;
    return '<div class="osm-pop"><p class="osm-pop-t">' + K.esc(title) + '</p>' +
      (rows.length ? '<dl>' + rows.map(([k, v]) => '<div><dt>' + K.esc(k) + '</dt><dd>' + K.esc(v) + '</dd></div>').join('') + '</dl>' : '') +
      '<p class="osm-pop-src">' + K.esc(KP.t('Zdroj')) + ': © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">' + K.esc(KP.t('přispěvatelé OpenStreetMap')) + '</a>, ' + K.esc(KP.t('živě z OpenStreetMap')) +
      ' · <a href="' + link + '" target="_blank" rel="noopener">' + K.esc(KP.t('Prvek v OSM')) + '</a></p></div>';
  }
  const row = (rows, k, v) => { if (v != null && v !== '') rows.push([KP.t(k), String(v)]); };

  // OSM prvek → položky vrstev (jeden prvek může patřit do víc vrstev, např. schody s rampou)
  function classify(e, layers) {
    const t = e.tags || {}, out = [];
    const geom = (e.geometry || []).filter(Boolean).map(g => [g.lat, g.lon]);
    const pt = e.type === 'node' ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : geom.length ? geom[Math.floor(geom.length / 2)] : null;
    const id = e.type[0] + e.id;
    const name = t.name || t['name:' + (KP.lang ? KP.lang() : 'cs')] || '';
    const isSteps = t.highway === 'steps';
    const point = (layer, sym, titleFn, rowsFn) => {
      if (!pt) return;
      const s = SYM[sym];
      out.push({ layer, sym, id: layer + ':' + id, kind: 'point', coords: pt, size: s.size, z: s.z, svg: svg(sym, s.size), title: KP.t(s.label) + (name ? ': ' + name : ''),
        popup: () => { const rows = []; rowsFn(rows); return popupHtml(titleFn(), rows, e); } });
    };
    if (layers.has('steps') && isSteps && geom.length > 1) {
      const l = LINE.steps;
      out.push({ layer: 'steps', sym: 'steps', id: 'steps:' + id, kind: 'line', coords: geom, color: l.color, weight: l.weight, dash: l.dash, casing: true, title: KP.t('Schody'),
        popup: () => {
          const rows = [];
          row(rows, 'Název', name);
          row(rows, 'Počet schodů', t.step_count);
          row(rows, 'Zábradlí', handrail(t));
          row(rows, 'Rampa', t.ramp ? YN(t.ramp) : null);
          row(rows, 'Rampa pro vozík', t['ramp:wheelchair'] ? YN(t['ramp:wheelchair']) : null);
          row(rows, 'Rampa pro kočárek', t['ramp:stroller'] ? YN(t['ramp:stroller']) : null);
          row(rows, 'Vhodné pro vozík', t.wheelchair ? YN(t.wheelchair) : null);
          return popupHtml(KP.t('Schody'), rows, e);
        } });
    }
    if (layers.has('ramp') && t['ramp:wheelchair'] === 'yes') {
      const rr = (rows) => { row(rows, 'Název', name); row(rows, 'Počet schodů', isSteps ? t.step_count : null); row(rows, 'Sklon', t.incline); row(rows, 'Šířka', t.width ? t.width + (/^[\d.,]+$/.test(t.width) ? ' m' : '') : null); row(rows, 'Zábradlí', handrail(t)); };
      if (e.type === 'way' && !isSteps && geom.length > 1) {
        const l = LINE.rampLine;
        out.push({ layer: 'ramp', sym: 'rampLine', id: 'ramp:' + id, kind: 'line', coords: geom, color: l.color, weight: l.weight, casing: true, title: KP.t('Rampa pro vozík'),
          popup: () => { const rows = []; rr(rows); return popupHtml(KP.t('Rampa pro vozík'), rows, e); } });
      } else {
        point('ramp', 'ramp', () => isSteps ? KP.t('Schody s rampou pro vozík') : KP.t('Rampa pro vozík'), rr);
      }
    }
    if (layers.has('ramp') && t.highway === 'elevator') {
      point('ramp', 'lift', () => KP.t('Výtah'), (rows) => {
        row(rows, 'Název', name);
        row(rows, 'Vhodné pro vozík', t.wheelchair ? YN(t.wheelchair) : null);
        row(rows, 'Patra', t.level || t['level:ref']);
        row(rows, 'Otevírací doba', t.opening_hours);
        row(rows, 'Poznámka', t['wheelchair:description'] || t.description);
      });
    }
    if (layers.has('kerb') && e.type === 'node' && (t.kerb || t.barrier === 'kerb')) {
      const h = t['kerb:height'];
      point('kerb', kerbSym(t), () => KP.t('Obrubník'), (rows) => {
        row(rows, 'Obrubník', t.kerb ? (KERB_CS[t.kerb] ? KP.t(KERB_CS[t.kerb]) : t.kerb) : KP.t('typ neuveden'));
        row(rows, 'Výška obrubníku', h ? (heightCm(h) != null ? heightCm(h) + ' cm' : h) : null);
        row(rows, 'Hmatová dlažba', t.tactile_paving ? YN(t.tactile_paving) : null);
        row(rows, 'Vhodné pro vozík', t.wheelchair ? YN(t.wheelchair) : null);
      });
    }
    const isStop = t.public_transport === 'platform' || t.highway === 'bus_stop' || /^(tram_stop|station|halt)$/.test(t.railway || '');
    if (layers.has('stop') && isStop && /^(yes|limited|no)$/.test(t.wheelchair || '')) {
      const sym = t.wheelchair === 'yes' ? 'stopOk' : t.wheelchair === 'limited' ? 'stopPart' : 'stopNo';
      point('stop', sym, () => name || stopKind(t), (rows) => {
        row(rows, 'Druh', stopKind(t));
        row(rows, 'Bezbariérová', YN(t.wheelchair));
        row(rows, 'Poznámka', t['wheelchair:description']);
        row(rows, 'Hmatová dlažba', t.tactile_paving ? YN(t.tactile_paving) : null);
        row(rows, 'Linky', t.route_ref);
      });
    }
    return out;
  }

  // ---------- Dotaz pro Overpass: jeden pro všechny vrstvy ----------
  function buildQuery(layers, b) {
    const L = [], P = [];
    if (layers.has('steps')) L.push('way["highway"="steps"];');
    if (layers.has('ramp')) { L.push('way["ramp:wheelchair"="yes"];'); P.push('node["ramp:wheelchair"="yes"];node["highway"="elevator"];way["highway"="elevator"];'); }
    if (layers.has('kerb')) P.push('node["kerb"];node["barrier"="kerb"];');
    if (layers.has('stop')) {
      ['node', 'way'].forEach(x => P.push(x + '["public_transport"="platform"]["wheelchair"];' + x + '["highway"="bus_stop"]["wheelchair"];' + x + '["railway"~"^(tram_stop|station|halt)$"]["wheelchair"];'));
    }
    const bb = [b.s, b.w, b.n, b.e].map(x => x.toFixed(6)).join(',');
    return '[out:json][timeout:25][bbox:' + bb + '];' +
      (L.length ? '(' + L.join('') + ')->.l;.l out tags geom qt;' : '') +
      (P.length ? '(' + P.join('') + ')->.p;.p out tags center qt;' : '');
  }

  // ---------- Dlaždice z15 ----------
  const N = Math.pow(2, TZ);
  const tx = (lon) => Math.floor((lon + 180) / 360 * N);
  const ty = (lat) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * N); };
  const tLon = (x) => x / N * 360 - 180;
  const tLat = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / N))) * 180 / Math.PI;
  function tilesOf(b) {
    const x0 = tx(b.w), x1 = tx(b.e), y0 = ty(b.n), y1 = ty(b.s), out = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(x + '/' + y);
    return out;
  }
  const keyOf = (la, lo) => tx(lo) + '/' + ty(la);

  // ---------- Stav ----------
  let map = null, ov = null, els = {}, enabled = new Set(), timer = null, ctl = null, status = { s: 'off' }, reqSeq = 0;
  const cache = new Map(); // 'vrstva|x/y' → [položky]

  function readState() {
    let fromUrl = null;
    try { fromUrl = new URLSearchParams(location.search).get(URL_KEY); } catch (e) { /* nic */ }
    if (fromUrl !== null) {
      const codes = fromUrl.split(',');
      return LAYERS.filter(k => codes.includes(URL_CODE[k]));
    }
    const s = K.store.get('map.osm', []);
    return Array.isArray(s) ? s.filter(k => LAYERS.includes(k)) : [];
  }
  function saveState() {
    const arr = LAYERS.filter(k => enabled.has(k));
    K.store.set('map.osm', arr);
    try {
      const u = new URL(location.href);
      if (arr.length) u.searchParams.set(URL_KEY, arr.map(k => URL_CODE[k]).join(',')); else u.searchParams.delete(URL_KEY);
      const next = u.pathname + u.search + u.hash;
      if (next !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', next);
    } catch (e) { /* bez historie */ }
  }

  function setStatus(s, extra) {
    status = Object.assign({ s }, extra || {});
    const msg = {
      off: '',
      zoom: KP.t('Přibližte mapu, aby se ukázaly schody a obrubníky'),
      loading: KP.t('Načítám z OpenStreetMap…'),
      retry: KP.t('Hlavní server OpenStreetMap neodpovídá, zkouším záložní…'),
      error: KP.t('Data z OpenStreetMap se nepodařilo načíst. Server může být přetížený.'),
      done: status.n ? KP.t('Živě z OpenStreetMap, ve výřezu {n} prvků', { n: K.nf ? K.nf(status.n) : status.n }) : KP.t('Ve výřezu nejsou v OpenStreetMap žádné takové prvky'),
    }[s] || '';
    const retryBtn = s === 'error' ? ' <button type="button" class="osm-retry" data-osm-retry>' + K.esc(KP.t('Zkusit znovu')) + '</button>' : '';
    if (els.status) { els.status.innerHTML = K.esc(msg) + retryBtn; els.status.dataset.state = s; els.status.hidden = !msg; }
    // Na mapě jen to, co se uživatele týká hned: přiblížit, načítání, chyba
    if (els.note) {
      const show = s === 'zoom' || s === 'loading' || s === 'retry' || s === 'error';
      els.note.hidden = !show;
      els.note.dataset.state = s;
      els.note.innerHTML = show ? (s === 'zoom' ? K.icon('search') : s === 'error' ? K.icon('warn') : '<span class="osm-spin" aria-hidden="true"></span>') + '<span>' + K.esc(msg) + '</span>' + retryBtn : '';
    }
  }

  function updateCounts(items) {
    const n = {}; LAYERS.forEach(k => { n[k] = 0; });
    (items || []).forEach(f => { n[f.layer]++; });
    LAYERS.forEach(k => {
      const el = els.pop && els.pop.querySelector('[data-osm-n="' + k + '"]');
      if (el) el.textContent = enabled.has(k) && items ? (K.nf ? K.nf(n[k]) : n[k]) : '';
    });
  }

  function renderLegend() {
    if (!els.legend) return;
    const on = LAYERS.filter(k => enabled.has(k));
    els.legend.hidden = !on.length;
    if (!on.length) { els.legend.innerHTML = ''; return; }
    els.legend.innerHTML = '<span class="legend-t">' + K.esc(KP.t('Z OpenStreetMap, živě')) + '</span>' +
      on.map(k => KEYS[k].map(([kind, s]) => '<span class="osm-lg">' + swatch(kind, s) + '<span>' + K.esc(KP.t(kind === 'line' ? LINE[s].label : SYM[s].label)) + '</span></span>').join('')).join('');
  }

  function visibleItems(b) {
    const seen = new Set(), out = [];
    tilesOf(b).forEach(tk => enabled.forEach(l => {
      const arr = cache.get(l + '|' + tk); if (!arr) return;
      arr.forEach(f => {
        if (seen.has(f.id)) return;
        const inside = f.kind === 'point' ? (f.coords[0] >= b.s && f.coords[0] <= b.n && f.coords[1] >= b.w && f.coords[1] <= b.e)
          : f.coords.some(c => c[0] >= b.s && c[0] <= b.n && c[1] >= b.w && c[1] <= b.e);
        if (!inside) return;
        seen.add(f.id); out.push(f);
      });
    }));
    return out;
  }

  function draw() {
    const b = map.bounds();
    const items = visibleItems(b);
    ov.set(items);
    updateCounts(items);
    return items;
  }

  async function overpass(q, signal) {
    let last;
    for (let i = 0; i < SERVERS.length; i++) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      if (i) setStatus('retry');
      const own = new AbortController();
      const stop = () => own.abort();
      signal.addEventListener('abort', stop);
      const tm = setTimeout(() => own.abort(), i ? 15000 : 18000);
      try {
        const r = await fetch(SERVERS[i], { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: own.signal });
        if (!r.ok) { last = new Error('HTTP ' + r.status); continue; }
        const j = await r.json();
        if (j && j.remark && /runtime error/i.test(j.remark)) { last = new Error(j.remark); continue; }
        return j;
      } catch (e) {
        if (signal.aborted) throw e;
        last = e;
      } finally { clearTimeout(tm); signal.removeEventListener('abort', stop); }
    }
    throw last || new Error('Overpass');
  }

  function prune() {
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }

  async function refresh() {
    clearTimeout(timer); timer = null;
    if (ctl) { ctl.abort(); ctl = null; reqSeq++; }
    if (!enabled.size) { ov.clear(); updateCounts(null); setStatus('off'); return; }
    const z = map.zoom ? map.zoom() : MIN_ZOOM;
    const b = map.bounds();
    const tiles = b ? tilesOf(b) : [];
    if (z < MIN_ZOOM - 0.01 || !tiles.length || tiles.length > MAX_TILES) { ov.clear(); updateCounts(null); setStatus('zoom'); return; }
    const need = [...enabled].filter(l => tiles.some(tk => !cache.has(l + '|' + tk)));
    if (!need.length) { const it = draw(); setStatus('done', { n: it.length }); return; }
    draw(); // co už je v cache, ukážeme hned
    const miss = tiles.filter(tk => need.some(l => !cache.has(l + '|' + tk))).map(tk => tk.split('/').map(Number));
    const x0 = Math.min(...miss.map(m => m[0])), x1 = Math.max(...miss.map(m => m[0])), y0 = Math.min(...miss.map(m => m[1])), y1 = Math.max(...miss.map(m => m[1]));
    const box = { w: tLon(x0), e: tLon(x1 + 1), n: tLat(y0), s: tLat(y1 + 1) };
    const layers = new Set(need);
    const my = ++reqSeq;
    ctl = new AbortController();
    setStatus('loading');
    try {
      const data = await overpass(buildQuery(layers, box), ctl.signal);
      if (my !== reqSeq) return;
      ctl = null;
      // všechny dlaždice obdélníku dotazu jsou teď načtené pro tyto vrstvy
      const fresh = new Map();
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) layers.forEach(l => fresh.set(l + '|' + x + '/' + y, []));
      (data.elements || []).forEach(e => classify(e, layers).forEach(f => {
        const keys = new Set(f.kind === 'point' ? [keyOf(f.coords[0], f.coords[1])] : f.coords.map(c => keyOf(c[0], c[1])));
        keys.forEach(tk => { const arr = fresh.get(f.layer + '|' + tk); if (arr) arr.push(f); });
      }));
      fresh.forEach((v, k) => { cache.delete(k); cache.set(k, v); });
      prune();
      const it = draw();
      setStatus('done', { n: it.length });
    } catch (e) {
      if (my !== reqSeq) return;
      ctl = null;
      setStatus('error');
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, DEBOUNCE); }

  function bindUi() {
    const pop = els.pop;
    pop.querySelectorAll('[data-osm-sw]').forEach(el => { const k = el.dataset.osmSw; el.innerHTML = KEYS[k].map(([kind, s]) => swatch(kind, s)).join(''); });
    pop.querySelectorAll('input[data-osm]').forEach(inp => {
      inp.checked = enabled.has(inp.dataset.osm);
      inp.addEventListener('change', () => {
        if (inp.checked) enabled.add(inp.dataset.osm); else enabled.delete(inp.dataset.osm);
        saveState(); renderLegend(); refresh();
      });
    });
    [els.status, els.note].forEach(el => el && el.addEventListener('click', (e) => { if (e.target.closest('[data-osm-retry]')) refresh(); }));
  }

  window.KPOsm = {
    init(adapter, o) {
      if (!adapter || !adapter.overlay) return;
      map = adapter; els = o || {}; ov = adapter.overlay();
      enabled = new Set(readState());
      if (enabled.size) saveState();
      bindUi(); renderLegend();
      adapter.onMove(() => {
        if (!enabled.size) return;
        if (ctl) { ctl.abort(); ctl = null; reqSeq++; }
        const z = map.zoom ? map.zoom() : MIN_ZOOM;
        if (z < MIN_ZOOM - 0.01) { refresh(); return; }
        schedule();
      });
      refresh();
    },
  };
})();
