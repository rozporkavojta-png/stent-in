/* Stránka Trasy: bariéry v ulicích živě z OpenStreetMap (Overpass API, funguje v Česku i v Bavorsku) + plánovač mezi místy.
   Místa z databáze se načítají jen pro regiony ve výřezu (KP.loadPlacesInBounds), obce z data/regions/obce.json.
   Zobrazení bariér podle profilu potřeb (sklon nad limit, obrubníky, které zvládnu, skrýt kostky): kp.barrierPrefs.
   Vlastní trasy (PROTOTYP, jen v tomto prohlížeči přes KP.community.saveRoute): body z mapy, zastávky z míst, překážky,
   objížďky, fotky. Sdílení bez serveru: trasy.html#trasa=<base64 JSON> (bez fotek); přijímá i #route= z KP.community.routeShareUrl. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  const MIN_ZOOM = 15, MAX_AREA = 0.005, PAD = 0.1; // stupně², zhruba čtvrť velkého města

  // Typy bariér: barva + tvar + text (popisek v legendě, v seznamu i v tooltipu, nikdy jen barva)
  const TYPES = {
    steps: { label: KP.t('Schodiště'), plural: [KP.t('schodiště'), KP.t('schodiště'), KP.t('schodišť')], color: '#B22A20', kind: 'line', bad: true, dash: '3 3', w: 9 },
    kerbHigh: { label: KP.t('Vysoký obrubník'), plural: [KP.t('vysoký obrubník'), KP.t('vysoké obrubníky'), KP.t('vysokých obrubníků')], color: '#D9480F', kind: 'point', bad: true, shape: 'triangle' },
    kerbRolled: { label: KP.t('Šikmý obrubník'), plural: [KP.t('šikmý obrubník'), KP.t('šikmé obrubníky'), KP.t('šikmých obrubníků')], color: '#B26B00', kind: 'point', bad: false, shape: 'diamond' },
    kerbLow: { label: KP.t('Snížený obrubník (sjezd)'), plural: [KP.t('snížený obrubník'), KP.t('snížené obrubníky'), KP.t('snížených obrubníků')], color: '#1D7A3E', kind: 'point', bad: false, shape: 'check' },
    surface: { label: KP.t('Nevhodný povrch'), plural: [KP.t('úsek s nevhodným povrchem'), KP.t('úseky s nevhodným povrchem'), KP.t('úseků s nevhodným povrchem')], color: '#8A5A00', kind: 'line', bad: true, dash: '1 8', w: 7 },
    incline: { label: KP.t('Stoupání nad 6 %'), plural: [KP.t('prudké stoupání'), KP.t('prudká stoupání'), KP.t('prudkých stoupání')], color: '#7A3EA8', kind: 'line', bad: true, dash: '14 6', w: 6 },
    elevator: { label: KP.t('Výtah'), plural: [KP.t('výtah'), KP.t('výtahy'), KP.t('výtahů')], color: '#1F4FB8', kind: 'point', bad: false, shape: 'lift' },
    crossingOk: { label: KP.t('Přechod bez bariér'), plural: [KP.t('přechod bez bariér'), KP.t('přechody bez bariér'), KP.t('přechodů bez bariér')], color: '#0A6B5C', kind: 'point', bad: false, shape: 'zebra' },
    crossingBad: { label: KP.t('Přechod s bariérou'), plural: [KP.t('přechod s bariérou'), KP.t('přechody s bariérou'), KP.t('přechodů s bariérou')], color: '#6B1D16', kind: 'point', bad: true, shape: 'cross' },
  };
  const SURFACE_CS = { sett: KP.t('kamenná dlažba'), cobblestone: KP.t('kočičí hlavy'), unhewn_cobblestone: KP.t('kočičí hlavy (neopracované)'), gravel: KP.t('štěrk'), grass: KP.t('tráva'), sand: KP.t('písek'), dirt: KP.t('hlína') };
  const SMOOTH_CS = { bad: KP.t('rozbitý povrch'), very_bad: KP.t('velmi rozbitý povrch'), horrible: KP.t('téměř nesjízdný povrch'), very_horrible: KP.t('nesjízdný povrch'), impassable: KP.t('neprůjezdné') };

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

  // ---------- Zobrazení podle profilu potřeb ----------
  const prefs = Object.assign({ on: true, hideCobble: false }, K.store.get('barrierPrefs', {}) || {});
  function personal() { const n = K.getNeeds(); return prefs.on && n.active ? n : null; }
  function inclineLimit() { const n = personal(); return n && n.slopeMax !== null ? n.slopeMax : 6; }
  function isShown(f) {
    if (f.type === 'incline' && !(f.val > inclineLimit())) return false;
    const n = personal();
    if (n && f.type === 'surface' && prefs.hideCobble && f.cobble) return false;
    if (n && f.type === 'kerbHigh' && n.stepMax !== null && f.h != null && f.h <= n.stepMax) return false;
    return true;
  }
  function shownFeatures() { return features.filter(isShown); }
  function syncInclineLabel() {
    const n = personal(), lim = inclineLimit();
    TYPES.incline.label = K.t(n && n.slopeMax !== null ? KP.t('Sklon nad váš limit {n} %') : KP.t('Stoupání nad {n} %'), { n: K.fmt(lim) });
  }
  function renderPersonal() {
    const box = $('#tr-personal'), n = K.getNeeds();
    let h = ('<legend>' + KP.t('Podle mých potřeb') + '</legend>');
    if (!n.active) {
      h += ('<p class="small tr-layers-hint">' + KP.t('Nastavte si profil potřeb a mapa zvýrazní sklony nad váš limit a skryje obrubníky, které zvládnete.') + '</p>') +
        ('<button class="btn btn-ghost btn-sm" type="button" data-open-needs-tr>' + KP.t('Nastavit profil potřeb') + '</button>');
    } else {
      const lim = n.slopeMax !== null ? K.t('zvýraznit sklon nad {n} %', { n: K.fmt(n.slopeMax) }) : K.t('sklon od 6 % (limit v profilu nemáte)');
      const kerb = n.stepMax !== null ? K.t('skrýt obrubníky do {n} cm', { n: K.fmt(n.stepMax) }) : K.t('ukázat všechny obrubníky (výšku schodu v profilu nemáte)');
      h += '<label class="check"><input type="checkbox" id="pf-on"' + (prefs.on ? ' checked' : '') + '> ' + K.t('Řídit se mým profilem') + ': ' + lim + ', ' + kerb + '</label>' +
        '<label class="check"><input type="checkbox" id="pf-cobble"' + (prefs.hideCobble ? ' checked' : '') + (prefs.on ? '' : ' disabled') + ('> ' + KP.t('Skrýt kamennou dlažbu a kostky (zvládnu je)') + '</label>') +
        ('<button class="btn btn-quiet btn-sm" type="button" data-open-needs-tr>' + KP.t('Upravit profil (')) + K.esc(K.aidLabel(n)) + ')</button>';
    }
    box.innerHTML = h;
  }
  function applyPersonal() {
    syncInclineLabel(); renderPersonal(); renderToggles();
    if (map) { drawLayers(); if (loadedBox) renderSummary(); }
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
      if (i) setStatus(i === 1 ? KP.t('Hlavní server OpenStreetMap neodpovídá, zkouším záložní…') : KP.t('Zkouším hlavní server ještě jednou…'));
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
    const add = (type, detail, extra) => out.push(Object.assign({ id: e.type[0] + e.id, type, coords, detail, name: t.name || '' }, extra || {}));
    if (e.type === 'node') {
      if (t.highway === 'elevator') add('elevator', [t.wheelchair === 'yes' ? KP.t('přístupný na vozíku') : t.wheelchair === 'no' ? KP.t('není pro vozík') : '', t.level ? KP.t('patra') + ' ' + t.level : ''].filter(Boolean).join(', '));
      else if (t.highway === 'crossing' && t.wheelchair) { add(t.wheelchair === 'no' ? 'crossingBad' : 'crossingOk', t.wheelchair === 'yes' ? KP.t('přechod přístupný na vozíku') : t.wheelchair === 'limited' ? KP.t('přechod částečně přístupný') : KP.t('přechod nepřístupný na vozíku')); return out; }
      else if (t.highway === 'crossing' && (t.kerb === 'lowered' || t.kerb === 'flush')) { add('crossingOk', t.kerb === 'flush' ? KP.t('obrubník v úrovni vozovky') : KP.t('snížený obrubník')); return out; }
      else if (t.highway === 'crossing' && t.kerb === 'raised') { add('crossingBad', KP.t('vysoký obrubník') + (heightCm(t['kerb:height']) != null ? ', ' + heightCm(t['kerb:height']) + ' cm' : '')); return out; }
      if (t.kerb || t.barrier === 'kerb') {
        const h = heightCm(t['kerb:height']);
        const k = t.kerb || (h != null ? (h <= 2 ? 'lowered' : 'raised') : null);
        if (!k) return out;
        const hTxt = h != null ? K.t('výška {n} cm', { n: K.fmt(h) }) : K.t('výška neuvedena');
        if (k === 'raised') add('kerbHigh', hTxt, { h });
        else if (k === 'rolled') add('kerbRolled', hTxt);
        else if (k === 'lowered' || k === 'flush') add('kerbLow', (k === 'flush' ? KP.t('v úrovni vozovky') : KP.t('snížený')) + (h != null ? ', ' + h + ' cm' : ''));
      }
      return out;
    }
    if (t.highway === 'steps') {
      const d = [];
      const sc = parseInt(t.step_count, 10);
      d.push(sc > 0 ? sc + ' ' + K.plural(sc, 'schod', 'schody', KP.t('schodů')) : K.t('počet schodů neuveden'));
      if (t['ramp:wheelchair'] === 'yes') d.push(KP.t('s rampou pro vozík')); else if (t['ramp:stroller'] === 'yes' || t['ramp:bicycle'] === 'yes') d.push(KP.t('jen ližiny (ne pro vozík)')); else if (t.ramp === 'no' || t['ramp:wheelchair'] === 'no') d.push('bez rampy');
      if (t.handrail === 'yes' || t['handrail:left'] === 'yes' || t['handrail:right'] === 'yes') d.push(KP.t('zábradlí')); else if (t.handrail === 'no') d.push(KP.t('bez zábradlí'));
      add('steps', d.join(', '));
    }
    if (t.highway !== 'steps') {
      const sd = [SURFACE_CS[t.surface], SMOOTH_CS[t.smoothness]].filter(Boolean);
      // „jen kostky“ = kamenná dlažba bez dalšího problému; tu jde podle profilu skrýt
      if (sd.length) add('surface', sd.join(', '), { cobble: /^(sett|cobblestone|unhewn_cobblestone)$/.test(t.surface || '') && !SMOOTH_CS[t.smoothness] });
    }
    if (t.incline && t.highway !== 'steps') {
      // bereme od 3 %, aby šlo zvýraznit i nižší osobní limit; bez profilu se ukazuje až nad 6 %
      const m = String(t.incline).match(/-?([\d.,]+)\s*%/);
      const v = m ? parseFloat(m[1].replace(',', '.')) : NaN;
      if (v > 3) add('incline', K.t('sklon {n} %', { n: K.fmt(m[1]) }), { val: v });
    }
    return out;
  }

  function center(f) { const c = f.coords; return c[Math.floor(c.length / 2)]; }
  function distM(a, b) { return K.distanceKm({ la: a[0], lo: a[1] }, { la: b[0], lo: b[1] }) * 1000; }

  // Kreslíme sami (tvar a vzor čáry); adaptér map-engine umí jen barevné kroužky
  function drawOne(f) {
    const t = TYPES[f.type], title = t.label + (f.detail ? ': ' + f.detail : '') + (f.name ? ' (' + f.name + ')' : '');
    const line = t.kind === 'line' && f.coords.length > 1, M = map.map;
    const pn = personal(), w = (t.w || 6) + (f.type === 'incline' && pn && pn.slopeMax !== null ? 4 : 0); // sklon nad osobní limit silněji
    if (map.engine === 'leaflet') {
      const o = line
        ? L.polyline(f.coords, { color: t.color, weight: w, opacity: .95, dashArray: t.dash, lineCap: t.dash === '1 8' ? 'round' : 'butt' })
        : L.marker(f.coords[0], { icon: L.divIcon({ className: 'tr-mk', html: pointSvg(t, 22), iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, title });
      return o.bindTooltip(title).addTo(M);
    }
    if (line) {
      const seg = t.dash.split(' ').map(Number);
      return new google.maps.Polyline({ map: M, path: f.coords.map(c => ({ lat: c[0], lng: c[1] })), strokeOpacity: 0, strokeColor: t.color,
        icons: [{ icon: { path: 'M 0,0 0,' + Math.max(seg[0], 1), strokeOpacity: .95, strokeColor: t.color, strokeWeight: w, scale: 1 }, offset: '0', repeat: (seg[0] + seg[1]) + 'px' }] });
    }
    return new google.maps.Marker({ map: M, position: { lat: f.coords[0][0], lng: f.coords[0][1] }, title,
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(pointSvg(t, 22)), scaledSize: new google.maps.Size(22, 22), anchor: new google.maps.Point(11, 11) } });
  }
  function drawLayers() {
    Object.keys(TYPES).forEach(k => { map.clearLayer(layerObjs[k]); layerObjs[k] = []; });
    const list = shownFeatures();
    Object.keys(TYPES).forEach(k => { if (visible[k]) layerObjs[k] = list.filter(f => f.type === k).map(drawOne); });
  }

  function renderSummary() {
    const box = $('#summary'), list = shownFeatures();
    const counts = {}; list.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
    const parts = Object.keys(TYPES).filter(k => counts[k]).map(k => '<b class="num">' + counts[k] + '</b> ' + plural(k, counts[k]));
    // skryté podle profilu (sklony pod 6 % bez profilu se nepočítají, ty se neukazovaly nikdy)
    const hidden = personal() ? features.filter(f => !isShown(f) && !(f.type === 'incline' && f.val <= Math.min(6, inclineLimit()))).length : 0;
    box.hidden = false;
    box.innerHTML = (parts.length
      ? ('<p><b>' + KP.t('V této oblasti') + ':</b> ') + parts.join(', ') + '.</p>'
      : ('<p>' + KP.t('V OpenStreetMap tu nejsou zakreslené žádné schody, obrubníky ani problémové povrchy. To ale neznamená, že tu nejsou. Jen je zatím nikdo nezmapoval.') + '</p>')) +
      (hidden ? ('<p class="small muted">' + KP.t('Podle vašeho profilu skryto') + ': <span class="num">') + hidden + '</span>.</p>' : '');
    // seznam nejbližších ke středu mapy
    const b = map.bounds(); const c = [(b.s + b.n) / 2, (b.w + b.e) / 2];
    const near = list.map(f => ({ f, d: distM(c, center(f)) })).sort((a, z) => a.d - z.d).slice(0, 12);
    const n = $('#nearest');
    n.hidden = !near.length;
    n.innerHTML = ('<h3>' + KP.t('Nejblíž středu mapy') + '</h3><ol>') + near.map(({ f, d }) =>
      '<li><button type="button" class="tr-item" data-lat="' + center(f)[0] + '" data-lng="' + center(f)[1] + '">' +
      swatch(TYPES[f.type]) +
      '<span><b>' + TYPES[f.type].label + '</b>' + (f.detail ? ' · ' + K.esc(f.detail) : '') + (f.name ? '<br><span class="muted small">' + K.esc(f.name) + '</span>' : '') + '</span>' +
      '<span class="num small muted tr-dist">' + (d < 1000 ? Math.round(d) + ' m' : K.fmt((d / 1000).toFixed(1)) + ' km') + '</span></button></li>').join('') + '</ol>';
  }

  // Legenda ve dvou skupinách: co překáží a co pomůže; v panelu zároveň přepínače vrstev
  function renderToggles() {
    const groups = [[KP.t('Překáží'), true], [KP.t('Pomůže'), false]];
    $('#layer-toggles').innerHTML = groups.map(([title, bad]) => '<p class="tr-group">' + title + '</p>' +
      Object.entries(TYPES).filter(([, t]) => t.bad === bad).map(([k, t]) =>
        '<label class="check"><input type="checkbox" data-layer="' + k + '"' + (visible[k] ? ' checked' : '') + '> ' + swatch(t) + t.label + '</label>').join('')).join('');
    const pin = KPMap.pinSvg('ok').replace('width="34" height="42"', 'width="14" height="18"');
    $('#place-sw').innerHTML = pin;
    $('#legend').innerHTML = groups.map(([title, bad]) => '<p class="tr-group">' + title + '</p><ul>' +
      Object.values(TYPES).filter(t => t.bad === bad).map(t => '<li>' + swatch(t) + t.label + '</li>').join('') + '</ul>').join('') +
      ('<p class="tr-group">' + KP.t('Místa') + '</p><ul><li><span class="tr-sw" aria-hidden="true">') + pin + ('</span>' + KP.t('Místo z databáze, barva a tvar podle přístupnosti') + '</li></ul>');
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
    if (areaOf(q) > MAX_AREA) { setStatus(KP.t('Oblast je moc velká. Přibližte mapu ještě víc, ať server nezahltíme.')); return; }
    loading = true; setStatus(KP.t('Načítám bariéry z OpenStreetMap…')); $('#load').disabled = true;
    let done; pending = new Promise(r => { done = r; });
    try {
      const data = await overpass(buildQuery(q));
      const seen = new Set();
      features = [];
      (data.elements || []).forEach(e => classify(e).forEach(f => { const key = f.id + f.type; if (!seen.has(key)) { seen.add(key); features.push(f); } }));
      loadedBox = q;
      drawLayers(); renderSummary();
      setStatus(K.t('Načteno {n} prvků · stav OpenStreetMap {d}.', { n: features.length, d: data.osm3s && data.osm3s.timestamp_osm_base ? K.fmtDate(data.osm3s.timestamp_osm_base.slice(0, 10)) : K.t('dnes') }));
    } catch (e) {
      setStatus(KP.t('Server OpenStreetMap teď neodpovídá (bývá přetížený). Zkuste to za chvíli tlačítkem níže.'));
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
    ['#from', '#to', '#rec-place'].forEach(s => {
      const cur = $(s).value;
      $(s).innerHTML = '<option value="">' + K.t('Vyberte místo ({n} v oblasti)', { n: list.length }) + '</option>' + list.map(p => '<option value="' + p.i + '"' + (p.i === cur ? ' selected' : '') + '>' + K.esc(p.n) + ' (' + K.esc(p.s ? K.t(p.s) : p.o || '') + ')</option>').join('');
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
        (det.length ? '<br><span class="small muted">' + det.join('; ') + (g.length > 4 ? '; ' + K.t('a {n} dalších', { n: g.length - 4 }) : '') + '</span>' : '') + '</span></li>';
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
      if (areaOf(box) > MAX_AREA) { res.innerHTML = ('<p class="callout">' + KP.t('Místa jsou od sebe moc daleko na kontrolu bariér (zvládneme asi 2–3 km).') + ' <a href="') + url + ('" target="_blank" rel="noopener">' + KP.t('Trasa v Google Maps') + '</a></p>'); return; }
      res.innerHTML = ('<p>' + KP.t('Načítám bariéry podél trasy…') + '</p>');
      if (pending) await pending;
      if (!contains(loadedBox, box)) await loadBarriers(true, box);
      if (!contains(loadedBox, box)) { res.innerHTML = ('<p class="callout">' + KP.t('Bariéry podél trasy se teď nepodařilo načíst, takže kontrola neproběhla. Zkuste to za chvíli znovu.') + ' <a href="') + url + ('" target="_blank" rel="noopener">' + KP.t('Trasa v Google Maps') + '</a></p>'); return; }
    }
    const A = [a.la, a.lo], B = [b.la, b.lo];
    const hits = shownFeatures().filter(f => f.coords.some(c => segDist(c, A, B) <= 25)).filter(f => TYPES[f.type].bad || f.type === 'kerbLow' || f.type === 'elevator');
    const bad = hits.filter(f => TYPES[f.type].bad), good = hits.filter(f => !TYPES[f.type].bad);
    const len = distM(A, B);
    res.innerHTML = '<div class="tr-plan-out">' +
      '<p><b>' + K.esc(a.n) + '</b> → <b>' + K.esc(b.n) + '</b> · ' + K.t('vzdušnou čarou') + ' <span class="num">' + (len < 1000 ? Math.round(len) + ' m' : K.fmt((len / 1000).toFixed(1)) + ' km') + '</span></p>' +
      (bad.length ? '<p>' + K.statusHtml('part', K.t('Do 25 m od přímé spojnice: {n}', { n: bad.length + ' ' + K.plural(bad.length, KP.t('bariéra'), KP.t('bariéry'), KP.t('bariér')) })) + '</p><ul>' + groupHits(bad) + '</ul>'
        : '<p>' + K.statusHtml('ok', KP.t('Podél přímé spojnice OpenStreetMap žádné bariéry neuvádí')) + '</p>') +
      (good.length ? ('<p class="small">' + KP.t('Pomůže') + ': ') + good.map(f => K.lc(TYPES[f.type].label)).filter((x, i, arr) => arr.indexOf(x) === i).join(', ') + ' (' + good.length + '×).</p>' : '') +
      ('<p class="small muted">' + KP.t('Orientační kontrola: počítáme s přímou čarou, ne se skutečnou trasou z Google Maps. Projděte si trasu ve Street View.') + '</p>') +
      '<div class="row"><a class="btn btn-action" href="' + url + '" target="_blank" rel="noopener">' + K.icon('nav') + (KP.t('Trasa v Google Maps') + '</a><a class="btn btn-ghost" href="') + K.placeUrl(b) + ('">' + KP.t('Detail cíle') + '</a></div></div>');
  }

  // ---------- Vlastní trasy: záznam, uložení, sdílení odkazem (PROTOTYP, jen v tomto prohlížeči) ----------
  const C = K.community;
  const CB = { schody: KP.t('Schody'), sklon: KP.t('Prudký sklon'), kostky: KP.t('Kostky nebo hrubá dlažba'), obrubnik: KP.t('Vysoký obrubník'), povrch: KP.t('Rozbitý nebo měkký povrch'), uzavirka: KP.t('Uzavírka nebo stavba'), jine: KP.t('Jiná překážka') };
  const rec = Object.assign({ on: false, points: [], stops: [], barriers: [], hist: [] }, K.store.get('routeDraft', {}) || {});
  rec.on = false;
  let recLayers = [], viewLayers = [];
  const R5 = (x) => Math.round(x * 1e5) / 1e5;
  const okLL = (la, lo) => isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
  const pl = (n, a, b, c) => n + ' ' + K.plural(n, a, b, c);
  function lenM(pts) { let t = 0; for (let i = 1; i < pts.length; i++) t += distM(pts[i - 1], pts[i]); return t; }
  function lenTxt(m) { return m < 1000 ? Math.round(m) + ' m' : K.fmt((m / 1000).toFixed(1)) + ' km'; }
  function saveDraft() { K.store.set('routeDraft', { points: rec.points, stops: rec.stops, barriers: rec.barriers, hist: rec.hist }); }

  // kreslení (Leaflet i Google)
  function eLine(coords, o) {
    const M = map.map;
    if (map.engine === 'leaflet') return L.polyline(coords, { color: o.color, weight: o.weight, opacity: 1, dashArray: o.dash || null, interactive: false }).addTo(M);
    return new google.maps.Polyline({ map: M, path: coords.map(c => ({ lat: c[0], lng: c[1] })), strokeColor: o.color, strokeWeight: o.weight, strokeOpacity: 1, clickable: false });
  }
  function ePin(ll, svg, size, title) {
    const M = map.map;
    if (map.engine === 'leaflet') return L.marker(ll, { icon: L.divIcon({ className: 'tr-mk', html: svg, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), keyboard: false, title, interactive: !!title }).addTo(M);
    return new google.maps.Marker({ map: M, position: { lat: ll[0], lng: ll[1] }, title, icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size / 2, size / 2) } });
  }
  const VERTEX = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="#FFD400" stroke="#101010" stroke-width="2"/></svg>';
  // komunitní překážka: žlutý trojúhelník s černým okrajem a vykřičníkem (odlišný od tvarů z OpenStreetMap)
  const BAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M13 2 25 23H1Z" fill="#FFD400" stroke="#101010" stroke-width="2.4" stroke-linejoin="round"/><path d="M13 9v7M13 19v.5" stroke="#101010" stroke-width="2.6" stroke-linecap="round"/></svg>';
  function stopSvg(n) { return '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#101010" stroke="#FFFFFF" stroke-width="2"/><text x="13" y="17.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="12" fill="#FFFFFF">' + n + '</text></svg>'; }
  function drawRoute(r) {
    const out = [], pts = (r.points || []).filter(c => okLL(c[0], c[1]));
    if (pts.length > 1) { out.push(eLine(pts, { color: '#101010', weight: 8 })); out.push(eLine(pts, { color: '#FFD400', weight: 4 })); }
    pts.forEach(c => out.push(ePin(c, VERTEX, 12, '')));
    (r.stops || []).forEach((st, k) => { if (okLL(st.la, st.lo)) out.push(ePin([st.la, st.lo], stopSvg(k + 1), 26, (k + 1) + '. ' + (st.n || KP.t('Zastávka')))); });
    (r.barriers || []).forEach(b => { if (okLL(b.la, b.lo)) out.push(ePin([b.la, b.lo], BAR_SVG, 26, (CB[b.type] || CB.jine) + (b.note ? ': ' + b.note : ''))); });
    return out;
  }
  function routeBounds(r) {
    return (r.points || []).map(c => ({ la: c[0], lo: c[1] }))
      .concat((r.stops || []).filter(x => okLL(x.la, x.lo)).map(x => ({ la: x.la, lo: x.lo })))
      .concat((r.barriers || []).filter(x => okLL(x.la, x.lo)).map(x => ({ la: x.la, lo: x.lo })));
  }
  function drawRec() { if (!map) return; map.clearLayer(recLayers); recLayers = drawRoute(rec); }
  function showRouteOnMap(r) {
    if (!map) return;
    map.clearLayer(viewLayers); viewLayers = drawRoute(r);
    const b = routeBounds(r);
    if (b.length === 1) map.setView(b[0].la, b[0].lo, 17); else if (b.length) map.fitTo(b);
    if (mobile()) setSheet('peek');
  }

  function recUI() {
    const n = rec.points.length, len = lenM(rec.points);
    $('#rec-toggle').textContent = rec.on ? KP.t('Ukončit kreslení') : (n || rec.barriers.length ? KP.t('Pokračovat v kreslení') : KP.t('Začít kreslit do mapy'));
    $('#rec-toggle').setAttribute('aria-pressed', rec.on);
    $('#rec-live').hidden = !rec.on;
    $('#recbar').hidden = !rec.on;
    const mode = (document.querySelector('input[name="rec-mode"]:checked') || {}).value;
    $('#rec-bar-f').hidden = mode !== 'barrier';
    const txt = (mode === 'barrier' ? KP.t('Klikněte na místo překážky') : KP.t('Klikněte do mapy, kudy trasa vede')) + ' · ' + n + ' ' + K.plural(n, 'bod', 'body', KP.t('bodů')) + (n > 1 ? ' · ' + lenTxt(len) : '');
    $('#recbar-txt').textContent = txt;
    $('#rec-undo').disabled = !rec.hist.length;
    const el = document.querySelector('.tr-map'); if (el) el.classList.toggle('is-rec', rec.on);
    const list = $('#rec-list');
    if (!n && !rec.stops.length && !rec.barriers.length) { list.innerHTML = ''; return; }
    list.innerHTML = ('<p class="small"><b>' + KP.t('V záznamu') + ':</b> <span class="num">') + n + '</span> ' + K.plural(n, 'bod', 'body', KP.t('bodů')) + (n > 1 ? ', ' + K.t('asi') + ' <span class="num">' + lenTxt(len) + '</span>' : '') + ('. <button class="btn btn-quiet btn-sm tr-inline" type="button" data-rec-clear>' + KP.t('Smazat záznam') + '</button></p>') +
      (rec.stops.length ? ('<p class="tr-group">' + KP.t('Zastávky') + '</p><ol class="tr-rec-items">') + rec.stops.map((st, k) => '<li><span>' + (k + 1) + '. ' + K.esc(st.n || KP.t('Místo')) + '</span><button class="btn btn-quiet btn-sm" type="button" data-rec-del-stop="' + k + ('">' + KP.t('Odebrat') + '</button></li>')).join('') + '</ol>' : '') +
      (rec.barriers.length ? ('<p class="tr-group">' + KP.t('Překážky') + '</p><ul class="tr-rec-items">') + rec.barriers.map((b, k) => '<li><span><b>' + K.esc(CB[b.type] || CB.jine) + '</b>' + (b.note ? ': ' + K.esc(b.note) : '') + '</span><button class="btn btn-quiet btn-sm" type="button" data-rec-del-bar="' + k + ('">' + KP.t('Odebrat') + '</button></li>')).join('') + '</ul>' : '');
  }
  function setRec(on) {
    rec.on = on; recUI(); drawRec();
    if (on) { showTab('tab-moje'); if (mobile()) setSheet('peek'); K.toast(KP.t('Kreslení zapnuto. Klikejte do mapy.')); }
  }
  function onMapClick(la, lo) {
    if (!rec.on || !okLL(la, lo)) return;
    const mode = (document.querySelector('input[name="rec-mode"]:checked') || {}).value;
    if (mode === 'barrier') {
      if (rec.barriers.length >= 200) { K.toast(KP.t('Překážek je moc.')); return; }
      rec.barriers.push({ type: $('#rec-btype').value, note: $('#rec-bnote').value.trim().slice(0, 200), la: R5(la), lo: R5(lo) });
      rec.hist.push('b'); $('#rec-bnote').value = ''; K.toast(KP.t('Překážka přidána.'));
    } else {
      if (rec.points.length >= 2000) { K.toast(KP.t('Bodů je moc.')); return; }
      rec.points.push([R5(la), R5(lo)]); rec.hist.push('p');
    }
    saveDraft(); drawRec(); recUI();
  }
  function recAddPlace(p) {
    if (!p) return;
    if (rec.stops.length >= 30) { K.toast(KP.t('Zastávek je moc.')); return; }
    rec.stops.push({ i: p.i, r: p._r || '', n: p.n, la: R5(p.la), lo: R5(p.lo) });
    rec.points.push([R5(p.la), R5(p.lo)]); rec.hist.push('s');
    saveDraft(); drawRec(); recUI(); K.toast((KP.t('Zastávka přidána do záznamu') + ': ') + p.n);
  }
  function recUndo() {
    const h = rec.hist.pop(); if (!h) return;
    if (h === 'b') rec.barriers.pop();
    else if (h === 's') { rec.stops.pop(); rec.points.pop(); }
    else rec.points.pop();
    saveDraft(); drawRec(); recUI();
  }
  function recClear() { rec.points = []; rec.stops = []; rec.barriers = []; rec.hist = []; saveDraft(); drawRec(); recUI(); }

  // Sdílení bez serveru: celá trasa (bez fotek) v adrese za #trasa=
  function shareUrl(r) {
    const o = { v: 1, n: r.name || '', t: r.note || '', a: r.alt || '', d: r.aid || '', c: r.confirmed || '',
      p: (r.points || []).map(c => [R5(c[0]), R5(c[1])]),
      s: (r.stops || []).map(x => [x.i, x.r || '', x.n || '', x.la == null ? null : R5(x.la), x.lo == null ? null : R5(x.lo)]),
      b: (r.barriers || []).map(b => [b.type, R5(b.la), R5(b.lo), b.note || '']) };
    return location.href.replace(/[?#].*$/, '') + '#trasa=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
  }
  function decodeShared(hash) {
    const str = (x, n) => String(x == null ? '' : x).slice(0, n);
    const m = String(hash || '').match(/(?:^|[#&])trasa=([^&]+)/);
    if (m) {
      try {
        const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
        return {
          name: str(o.n, 80) || KP.t('Sdílená trasa'), note: str(o.t, 2000), alt: str(o.a, 1000), aid: str(o.d, 60), sharedConfirmed: /^\d{4}-\d{2}-\d{2}$/.test(o.c || '') ? o.c : '',
          points: (Array.isArray(o.p) ? o.p : []).slice(0, 2000).map(c => [Number(c[0]), Number(c[1])]).filter(c => okLL(c[0], c[1])),
          stops: (Array.isArray(o.s) ? o.s : []).slice(0, 30).filter(x => Array.isArray(x) && typeof x[0] === 'string').map(x => ({ i: str(x[0], 60), r: str(x[1], 60), n: str(x[2], 120), la: x[3] == null ? null : Number(x[3]), lo: x[4] == null ? null : Number(x[4]) })),
          barriers: (Array.isArray(o.b) ? o.b : []).slice(0, 200).filter(x => Array.isArray(x) && okLL(Number(x[1]), Number(x[2]))).map(x => ({ type: CB[x[0]] ? x[0] : 'jine', la: Number(x[1]), lo: Number(x[2]), note: str(x[3], 200) })),
        };
      } catch (e) { return null; }
    }
    const r = C.parseRouteShare(hash); // starší tvar z KP.community.routeShareUrl
    if (!r) return null;
    return { name: String(r.name).slice(0, 80), note: String(r.note || '').slice(0, 2000), alt: '', aid: '', sharedConfirmed: '', points: [],
      stops: (r.stops || []).slice(0, 30).filter(x => typeof x.i === 'string').map(x => ({ i: x.i.slice(0, 60), r: String(x.r || '').slice(0, 60), n: '', la: null, lo: null })),
      barriers: (r.barriers || []).filter(b => b && okLL(Number(b.la), Number(b.lo))).slice(0, 200).map(b => ({ type: CB[b.type] ? b.type : 'jine', la: Number(b.la), lo: Number(b.lo), note: String(b.note || '').slice(0, 200) })) };
  }
  async function shareRoute(r) {
    const url = shareUrl(r);
    if (navigator.share && mobile()) { try { await navigator.share({ title: r.name, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); K.toast(KP.t('Odkaz na trasu je zkopírovaný. Fotky se odkazem nesdílejí.')); } catch (e) { window.prompt((KP.t('Zkopírujte odkaz na trasu') + ':'), url); }
  }

  let sharedRoute = null;
  async function renderShared() {
    const box = $('#shared-route'), r = sharedRoute;
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    // zastávky ze staršího tvaru odkazu nemají polohu: doplníme z databáze míst
    for (const st of r.stops) {
      if (st.la != null && st.n) continue;
      const p = await K.findPlace(st.i, st.r).catch(() => null);
      if (p) { st.n = st.n || p.n; if (st.la == null) { st.la = p.la; st.lo = p.lo; } }
    }
    const len = lenM(r.points);
    box.hidden = false;
    box.innerHTML = ('<p class="kicker">' + KP.t('Trasa z odkazu') + '</p><h2 class="tr-h2">') + K.esc(r.name) + '</h2>' +
      '<p class="small">' + (r.points.length > 1 ? (KP.t('Asi') + ' <span class="num">') + lenTxt(len) + '</span> · ' : '') + pl(r.stops.length, KP.t('zastávka'), KP.t('zastávky'), KP.t('zastávek')) + ' · ' + pl(r.barriers.length, KP.t('překážka'), KP.t('překážky'), KP.t('překážek')) + (r.aid ? ' · ' + K.t('jel(a)') + ': ' + K.esc(K.t(r.aid)) : '') + '</p>' +
      (r.note ? '<p>' + K.esc(r.note) + '</p>' : '') +
      (r.alt ? ('<p><b>' + KP.t('Objížďky') + ':</b> ') + K.esc(r.alt) + '</p>' : '') +
      (r.stops.length ? '<ol class="tr-rec-items">' + r.stops.map(st => '<li><span>' + K.esc(st.n || KP.t('Místo')) + '</span></li>').join('') + '</ol>' : '') +
      (r.barriers.length ? '<ul class="tr-rec-items">' + r.barriers.map(b => '<li><span><b>' + K.esc(CB[b.type]) + '</b>' + (b.note ? ': ' + K.esc(b.note) : '') + '</span></li>').join('') + '</ul>' : '') +
      (r.sharedConfirmed ? ('<p class="small">' + KP.t('Autor odkazu u sebe potvrdil aktuálnost') + ' ') + K.fmtDate(r.sharedConfirmed) + '.</p>' : '') +
      ('<p class="small muted">' + KP.t('Trasu vám někdo poslal odkazem. Kdo ji zakreslil, nevíme a nic z ní jsme neověřili. Fotky se odkazem nepřenášejí.') + '</p>') +
      ('<div class="row"><button class="btn btn-primary btn-sm" type="button" data-shared-keep>' + KP.t('Uložit k sobě') + '</button><button class="btn btn-ghost btn-sm" type="button" data-shared-show>' + KP.t('Ukázat na mapě') + '</button><button class="btn btn-quiet btn-sm" type="button" data-shared-close>' + KP.t('Zavřít') + '</button></div>');
    showRouteOnMap(r);
  }

  function renderSaved() {
    const list = C.routes();
    if (!list.length) { $('#saved-routes').innerHTML = ''; return; }
    $('#saved-routes').innerHTML = ('<li class="tr-group">' + KP.t('Uložené trasy') + '</li>') + list.map(r => {
      const len = lenM((r.points || []).filter(c => okLL(c[0], c[1])));
      const meta = [len > 0 ? KP.t('asi') + ' ' + lenTxt(len) : '', (r.stops || []).length ? pl(r.stops.length, KP.t('zastávka'), KP.t('zastávky'), KP.t('zastávek')) : '', (r.barriers || []).length ? pl(r.barriers.length, KP.t('překážka'), KP.t('překážky'), KP.t('překážek')) : '', r.aid ? K.esc(K.t(r.aid)) : ''].filter(Boolean).join(' · ');
      const drawable = routeBounds(r).length > 0, id = K.esc(r.id);
      const cm = r.comments || [], rp = r.reports || [];
      return '<li class="tr-route" data-rid="' + id + '"><div class="tr-route-txt"><b>' + K.esc(r.name) + '</b> <span class="muted small">' + K.fmtDate(r.date) + '</span>' +
        (meta ? '<br><span class="small">' + meta + '</span>' : '') +
        (r.from ? '<br><span class="small">' + K.esc(r.from) + ' → ' + K.esc(r.to) + '</span>' : '') +
        (r.note ? '<br><span class="small muted">' + K.esc(r.note) + '</span>' : '') +
        (r.alt ? ('<br><span class="small"><b>' + KP.t('Objížďky') + ':</b> ') + K.esc(r.alt) + '</span>' : '') +
        (r.confirmed ? '<br>' + K.statusHtml('ok', (KP.t('Potvrdili jste aktuálnost') + ' ') + K.fmtDate(r.confirmed)) : '') +
        ((r.photos || []).length ? '<span class="tr-thumbs">' + r.photos.map(src => '<img src="' + K.esc(src) + ('" alt="' + KP.t('Fotka z trasy') + '" loading="lazy">')).join('') + '</span>' : '') +
        '</div><div class="tr-route-act">' +
        (drawable ? ('<button class="btn btn-ghost btn-sm" type="button" data-r-show>' + KP.t('Na mapě') + '</button>') : '') +
        ('<button class="btn btn-ghost btn-sm" type="button" data-r-share>' + KP.t('Sdílet odkaz') + '</button>') +
        '<button class="btn btn-quiet btn-sm" type="button" data-r-confirm>' + (r.confirmed ? KP.t('Zrušit potvrzení') : KP.t('Potvrdit aktuálnost')) + '</button>' +
        ('<button class="btn btn-quiet btn-sm" type="button" data-r-del>' + KP.t('Smazat') + '</button></div>') +
        ('<details class="tr-route-more"><summary>' + KP.t('Komentáře a hlášení změn (')) + (cm.length + rp.length) + ')</summary>' +
        (cm.length ? ('<p class="tr-group">' + KP.t('Komentáře') + '</p><ul class="tr-rec-items">') + cm.map(c => '<li><span>' + K.esc(c.text) + ' <span class="muted small">' + K.fmtDate(c.date) + '</span></span></li>').join('') + '</ul>' : '') +
        (rp.length ? ('<p class="tr-group">' + KP.t('Nahlášené změny') + '</p><ul class="tr-rec-items">') + rp.map(c => '<li><span>' + K.esc(c.text) + ' <span class="muted small">' + K.fmtDate(c.date) + '</span></span></li>').join('') + '</ul>' : '') +
        '<form class="tr-mini" data-r-comment><label class="sr-only" for="cm-' + id + ('">' + KP.t('Komentář k trase') + '</label><input id="cm-') + id + ('" type="text" maxlength="1000" placeholder="' + KP.t('Komentář') + '" required><button class="btn btn-ghost btn-sm" type="submit">' + KP.t('Přidat') + '</button></form>') +
        '<form class="tr-mini" data-r-report><label class="sr-only" for="rp-' + id + ('">' + KP.t('Co se na trase změnilo') + '</label><input id="rp-') + id + ('" type="text" maxlength="1000" placeholder="' + KP.t('Co se změnilo (stavba, nový schod…)') + '" required><button class="btn btn-ghost btn-sm" type="submit">' + KP.t('Nahlásit') + '</button></form>') +
        '</details></li>';
    }).join('');
  }

  async function saveRecorded(e) {
    e.preventDefault();
    const name = $('#r-name').value.trim(); if (!name) return;
    const files = [...($('#r-photos').files || [])].slice(0, 4);
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    let photos = [];
    try { photos = await Promise.all(files.map(f => K.resizePhoto(f, 1200, 0.8))); } catch (err) { btn.disabled = false; K.toast(KP.t('Fotku se nepodařilo zpracovat.')); return; }
    const item = C.saveRoute({ name: name.slice(0, 80), note: $('#r-note').value.trim().slice(0, 2000), alt: $('#r-alt').value.trim().slice(0, 1000), aid: $('#r-aid').value,
      points: rec.points.slice(), stops: rec.stops.slice(), barriers: rec.barriers.slice(), photos,
      from: rec.stops.length ? rec.stops[0].n : '', to: rec.stops.length > 1 ? rec.stops[rec.stops.length - 1].n : '' });
    btn.disabled = false;
    if (!item) { K.toast(KP.t('Úložiště prohlížeče je plné. Zkuste méně nebo menší fotky.')); return; }
    rec.on = false; recClear(); e.target.reset(); fillAid(); renderSaved();
    K.toast(KP.t('Trasa uložena v tomto prohlížeči. Sdílet ji můžete odkazem.'));
    const li = document.querySelector('.tr-route[data-rid="' + item.id + '"] [data-r-share]'); if (li) li.focus();
  }
  function fillAid() { const n = K.getNeeds(); $('#r-aid').innerHTML = K.AIDS.map(a => '<option value="' + K.esc(a) + '"' + (a === n.aid ? ' selected' : '') + '>' + K.esc(K.t(a)) + '</option>').join(''); }

  function bindRec() {
    $('#rec-proto').textContent = K.PROTOTYPE_NOTE + (' ' + KP.t('Odkazem ale trasu poslat jde: celá je zakódovaná v adrese.'));
    $('#rec-btype').innerHTML = Object.keys(CB).map(k => '<option value="' + k + '">' + CB[k] + '</option>').join('');
    fillAid();
    $('#rec-toggle').addEventListener('click', () => setRec(!rec.on));
    $('#rec-done').addEventListener('click', () => { setRec(false); showTab('tab-moje'); if (mobile()) setSheet('half'); $('#r-name').focus(); });
    $('#rec-undo').addEventListener('click', recUndo);
    document.querySelectorAll('input[name="rec-mode"]').forEach(r => r.addEventListener('change', recUI));
    $('#rec-place-add').addEventListener('click', () => { const p = places.find(x => x.i === $('#rec-place').value); if (p) recAddPlace(p); else K.toast(KP.t('Vyberte místo ze seznamu.')); });
    $('#rec-from-plan').addEventListener('click', () => {
      const a = places.find(p => p.i === $('#from').value), b = places.find(p => p.i === $('#to').value);
      if (!a && !b) { K.toast(KP.t('V plánovači zatím nemáte vybraná místa A a B.')); return; }
      if (a) recAddPlace(a); if (b && b !== a) recAddPlace(b);
    });
    $('#rec-list').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-rec-clear')) { if (window.confirm(KP.t('Smazat celý rozkreslený záznam?'))) recClear(); return; }
      if (b.dataset.recDelStop !== undefined) {
        const k = +b.dataset.recDelStop, st = rec.stops[k];
        rec.stops.splice(k, 1);
        const pi = rec.points.findIndex(c => c[0] === st.la && c[1] === st.lo); if (pi >= 0) rec.points.splice(pi, 1);
        const hi = rec.hist.lastIndexOf('s'); if (hi >= 0) rec.hist.splice(hi, 1);
      } else if (b.dataset.recDelBar !== undefined) {
        rec.barriers.splice(+b.dataset.recDelBar, 1);
        const hi = rec.hist.lastIndexOf('b'); if (hi >= 0) rec.hist.splice(hi, 1);
      } else return;
      saveDraft(); drawRec(); recUI();
    });
    $('#my-route').addEventListener('submit', saveRecorded);
    $('#saved-routes').addEventListener('click', e => {
      const b = e.target.closest('button'), li = e.target.closest('[data-rid]'); if (!b || !li) return;
      const id = li.dataset.rid, r = C.routes().find(x => x.id === id); if (!r) return;
      if (b.hasAttribute('data-r-show')) showRouteOnMap(r);
      else if (b.hasAttribute('data-r-share')) shareRoute(r);
      else if (b.hasAttribute('data-r-confirm')) { if (r.confirmed) C.updateRoute(id, { confirmed: null }); else C.confirmRoute(id); renderSaved(); }
      else if (b.hasAttribute('data-r-del')) { if (window.confirm(K.t('Smazat trasu „{name}“?', { name: r.name }))) { C.deleteRoute(id); map && map.clearLayer(viewLayers); viewLayers = []; renderSaved(); } }
    });
    $('#saved-routes').addEventListener('submit', e => {
      e.preventDefault();
      const li = e.target.closest('[data-rid]'), inp = e.target.querySelector('input'); if (!li || !inp.value.trim()) return;
      const ok = e.target.hasAttribute('data-r-comment') ? C.commentRoute(li.dataset.rid, inp.value) : C.reportRoute(li.dataset.rid, inp.value);
      if (!ok) { K.toast(KP.t('Uložit se nepodařilo, úložiště je možná plné.')); return; }
      K.toast(e.target.hasAttribute('data-r-comment') ? KP.t('Komentář uložen v tomto prohlížeči.') : KP.t('Hlášení uloženo v tomto prohlížeči.'));
      renderSaved();
      const det = document.querySelector('.tr-route[data-rid="' + li.dataset.rid + '"] details'); if (det) det.open = true;
    });
    $('#shared-route').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !sharedRoute) return;
      if (b.hasAttribute('data-shared-keep')) {
        const r = sharedRoute, item = C.saveRoute({ name: r.name, note: r.note, alt: r.alt, aid: r.aid, points: r.points, stops: r.stops, barriers: r.barriers, photos: [], shared: true,
          from: r.stops[0] ? r.stops[0].n : '', to: r.stops.length > 1 ? r.stops[r.stops.length - 1].n : '' });
        if (!item) { K.toast(KP.t('Úložiště prohlížeče je plné.')); return; }
        sharedRoute = null; history.replaceState(null, '', location.pathname + location.search); renderShared(); renderSaved();
        K.toast(KP.t('Trasa uložena k vašim trasám v tomto prohlížeči.'));
      } else if (b.hasAttribute('data-shared-show')) showRouteOnMap(sharedRoute);
      else if (b.hasAttribute('data-shared-close')) { sharedRoute = null; history.replaceState(null, '', location.pathname + location.search); map && map.clearLayer(viewLayers); viewLayers = []; renderShared(); }
    });
  }

  function bind() {
    $('#find-form').addEventListener('submit', e => {
      e.preventDefault();
      const q = $('#town').value.trim().toLowerCase(); if (!q || !map) return;
      const t = towns.find(x => x[0].toLowerCase() === q);
      if (!t) { setStatus(K.t('Obec „{q}“ v naší databázi nemáme. Posuňte mapu ručně.', { q: $('#town').value })); return; }
      // obec s nejvíce místy toho jména (Česko i Bavorsko); střed obalu míst v obci, přiblížení na úroveň ulic
      map.setView((t[3] + t[5]) / 2, (t[4] + t[6]) / 2, 16);
      if (mobile()) { $('#town').blur(); setSheet('peek'); }
    });
    $('#locate').addEventListener('click', () => map && map.locate().catch(() => K.toast(KP.t('Polohu se nepodařilo zjistit. Povolte ji v prohlížeči.'))));
    $('#load').addEventListener('click', () => loadBarriers(true));
    $('#tr-personal').addEventListener('change', e => {
      if (e.target.id === 'pf-on') prefs.on = e.target.checked;
      else if (e.target.id === 'pf-cobble') prefs.hideCobble = e.target.checked;
      else return;
      K.store.set('barrierPrefs', prefs); applyPersonal();
    });
    $('#tr-personal').addEventListener('click', e => { if (e.target.closest('[data-open-needs-tr]')) K.needsDrawer(); });
    document.addEventListener('kp:needs', () => { applyPersonal(); fillAid(); });
    $('#layer-toggles').addEventListener('change', e => { const k = e.target.dataset.layer; if (!k) return; visible[k] = e.target.checked; drawLayers(); });
    $('#show-places').addEventListener('change', showPlaces);
    $('#nearest').addEventListener('click', e => { const b = e.target.closest('.tr-item'); if (b) { map.setView(+b.dataset.lat, +b.dataset.lng, 18); if (mobile()) setSheet('peek'); } });
    $('#picked').addEventListener('click', e => {
      if (e.target.closest('[data-close-picked]')) { $('#picked').hidden = true; return; }
      const ra = e.target.closest('[data-rec-add]');
      if (ra) { recAddPlace(places.find(p => p.i === ra.dataset.id)); return; }
      const btn = e.target.closest('[data-set]'); if (!btn) return;
      fillPlanSelects(); const sel = $('#' + btn.dataset.set); sel.value = btn.dataset.id; updatePlanBtn();
      K.toast(btn.dataset.set === 'from' ? KP.t('Start nastaven.') : KP.t('Cíl nastaven.'));
      if ($('#from').value && $('#to').value) showTab('tab-plan');
    });
    $('#from').addEventListener('change', updatePlanBtn); $('#to').addEventListener('change', updatePlanBtn);
    $('#plan').addEventListener('click', plan);
  }

  function showPlaces() {
    if (!map) return;
    const on = $('#show-places').checked;
    map.setPlaces(on ? places.filter(p => p.c !== 'parkovani' && (p.w === 'yes' || p.w === 'limited' || p.t === 'yes')) : [], {
      colorOf: p => K.generalStatus(p),
      onClick: p => {
        const n = $('#picked'); n.hidden = false;
        n.innerHTML = '<div class="tr-picked-head"><div><h3>' + K.esc(p.n) + '</h3><p class="small muted">' + K.esc([p.s && K.t(p.s), p.o].filter(Boolean).join(' · ')) + '</p></div>' +
          ('<button class="icon-btn" type="button" data-close-picked aria-label="' + KP.t('Zavřít') + '">') + K.icon('close') + '</button></div>' +
          (p.img ? '<figure class="photo tr-ph"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async">' +
            '<figcaption><a href="' + K.esc(K.commonsPage(p.img)) + ('" target="_blank" rel="noopener">' + KP.t('Foto: Wikimedia Commons') + '</a></figcaption></figure>') : '') +
          '<p class="tr-picked-st">' + K.statusHtml(K.W[p.w || 'null'].st, K.W[p.w || 'null'].label) + (p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : '') + '</p>' +
          '<div class="tr-picked-act"><button class="btn btn-ghost btn-sm" type="button" data-set="from" data-id="' + p.i + ('">' + KP.t('Nastavit jako start A') + '</button><button class="btn btn-ghost btn-sm" type="button" data-set="to" data-id="') + p.i + ('">' + KP.t('Nastavit jako cíl B') + '</button><button class="btn btn-ghost btn-sm" type="button" data-rec-add data-id="') + p.i + ('">' + KP.t('Přidat do mé trasy') + '</button><a class="btn btn-quiet btn-sm" href="') + K.placeUrl(p) + ('">' + KP.t('Detail') + '</a><a class="btn btn-quiet btn-sm" href="itinerar.html?add=') + encodeURIComponent(p.i) + (p._r ? '&r=' + encodeURIComponent(p._r) : '') + ('">' + KP.t('Do itineráře') + '</a></div>');
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
    } catch (e) { setStatus(KP.t('Databázi míst se nepodařilo načíst. Bariéry ale fungují dál.')); }
    placesBusy = false;
  }

  async function init() {
    setTop(); window.addEventListener('resize', setTop);
    setSheet(mobile() ? 'peek' : 'half');
    syncInclineLabel(); renderPersonal(); renderToggles(); renderSaved(); bind(); bindRec(); bindTabs(); bindSheet(); recUI();
    sharedRoute = decodeShared(location.hash);
    if (sharedRoute) { showTab('tab-moje'); setSheet('half'); }
    const sp = new URLSearchParams(location.search);
    const la = parseFloat(sp.get('la')), lo = parseFloat(sp.get('lo'));
    const hasLL = isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
    map = await KPMap.create($('#map'), hasLL ? { lat: la, lng: lo, zoom: 17 } : undefined);
    if (map.engine === 'leaflet') map.map.on('click', e => onMapClick(e.latlng.lat, e.latlng.lng));
    else map.map.addListener('click', e => onMapClick(e.latLng.lat(), e.latLng.lng()));
    drawRec();
    if (sharedRoute) renderShared();
    window.addEventListener('hashchange', () => { const r = decodeShared(location.hash); if (r) { sharedRoute = r; showTab('tab-moje'); if (mobile()) setSheet('half'); renderShared(); } });
    map.onMove(() => {
      $('#load').disabled = map.zoom() < MIN_ZOOM || loading;
      if (map.zoom() < MIN_ZOOM && !loading) setStatus(KP.t('Přibližte mapu na ulice (měřítko asi 1 : 10 000) a bariéry se načtou samy.'));
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
