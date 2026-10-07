/* Stezky: katalog bezbariérových tras v Česku a v Bavorsku a detail trasy (stezky.html?id=…).
   Data: data/trasy/trasy_cz.json a trasy_by.json (OpenStreetMap + výškový model EU-DEM 25 m, skripty tools/trasy_*_build.py).
   Komunitní části (potvrzení, hlášení změny, zkušenosti, uložené trasy) jsou PROTOTYP: ukládají se jen do localStorage
   tohoto prohlížeče (kp.trailConfirm, kp.trailReports, kp.trailExp, kp.trailSaved). Nic se nedopočítává ani nevymýšlí.
   Sdílené funkce pro itinerar.js: window.KPTrails. Stránkové UI běží jen na body.page-stezky. */
(function () {
  'use strict';
  const K = window.KP;
  const esc = K.esc, fmt = K.fmt;
  const FILES = ['data/trasy/trasy_cz.json', 'data/trasy/trasy_by.json'];

  // ---------- Data ----------
  let TP = null; const BY = new Map();
  function load() {
    if (!TP) {
      const pr = Promise.allSettled(FILES.map(f => fetch(f).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })))
        .then(res => {
          const ok = res.filter(x => x.status === 'fulfilled');
          if (!ok.length) throw new Error(KP.t('Data tras se nepodařilo načíst.'));
          const all = [].concat(...ok.map(x => x.value));
          all.forEach(t => BY.set(t.id, t));
          all.partial = ok.length < res.length;
          return all;
        });
      TP = pr; pr.catch(() => { if (TP === pr) TP = null; });
    }
    return TP;
  }
  const byId = (id) => BY.get(id) || null;

  // ---------- Popisky ----------
  const TYP = { 'A→B': KP.t('Z bodu do bodu'), okruh: KP.t('Okruh'), 'tam a zpět': KP.t('Tam a zpět') };
  const ZEME = { CZ: KP.t('Česko'), DE: KP.t('Bavorsko') };
  const WH = {
    yes: ['ok', KP.t('V OpenStreetMap sjízdná na vozíku')], limited: ['part', KP.t('V OpenStreetMap částečně sjízdná')],
    no: ['no', KP.t('V OpenStreetMap nesjízdná na vozíku')], null: ['unk', KP.t('Sjízdnost v OpenStreetMap neuvedena')],
  };
  const SMOOTH = { excellent: KP.t('výborná'), good: KP.t('dobrá'), intermediate: KP.t('střední'), bad: KP.t('špatná'), very_bad: KP.t('velmi špatná'), horrible: KP.t('téměř nesjízdná'), very_horrible: KP.t('nesjízdná'), impassable: KP.t('neprůjezdná'), neuvedeno: 'neuvedeno' };
  const SURF_FIX = { stone: 'kámen', 'asphalt;paving_stones': 'asfalt a dlažba', tiles: 'dlaždice' };
  const HARD = new Set(['asfalt', 'beton', 'dlažba', 'dlaždice', 'asfalt a dlažba', 'zpevněný (nespecifikováno)', 'dřevo', 'dlažba (kostky)', 'kov', 'tartan', 'pryž']);
  const SEMI = new Set(['zhutněný štěrk (mlat)', 'jemný štěrk']);
  const COBBLE = 'dlažba (kostky)';

  const isGeneric = (t) => !t.nazev || /^Cesta s wheelchair=/.test(t.nazev);
  function name(t) { return isGeneric(t) ? KP.t('Úsek cesty označený pro vozík') : String(t.nazev).replace(/^\[[^\]]*\]\s*/, ''); }
  function km(x) { if (x == null) return ''; return x < 1 ? Math.round(x * 1000) + ' m' : fmt((Math.round(x * 10) / 10).toFixed(1)) + ' km'; }
  function meters(m) { return m < 1000 ? Math.round(m) + ' m' : fmt((m / 1000).toFixed(m < 10000 ? 2 : 1)) + ' km'; }
  function pct(x) { return fmt(Math.round(x * 10) / 10) + (K.LANG === 'en' ? '%' : ' %'); }
  const krajT = (k) => (k && K.LANG !== 'cs' ? K.krajName(k) : (k || ''));
  function detailUrl(t) { return 'stezky.html?id=' + encodeURIComponent(t.id); }
  function wh(t) { return WH[t.wheelchair || 'null'] || WH.null; }

  function surfaces(t) {
    const out = {};
    Object.entries(t.povrchy || {}).forEach(([k, v]) => { const n = SURF_FIX[k] || k; out[n] = Math.round(((out[n] || 0) + v) * 10) / 10; });
    return out;
  }
  function surfStats(t) {
    const s = surfaces(t), o = { hard: 0, semi: 0, loose: 0, unk: 0, cobble: 0 };
    Object.entries(s).forEach(([k, v]) => {
      if (k === 'neuvedeno') o.unk += v; else if (HARD.has(k)) o.hard += v; else if (SEMI.has(k)) o.semi += v; else o.loose += v;
      if (k === COBBLE) o.cobble += v;
    });
    return o;
  }
  function mainSurface(t) {
    const s = Object.entries(surfaces(t)).filter(([k]) => k !== 'neuvedeno').sort((a, b) => b[1] - a[1])[0];
    return s ? K.t(s[0]) + ' ' + fmt(Math.round(s[1])) + ' %' : K.t('neuvedeno');
  }
  function paved(t) { const s = surfStats(t); return s.hard >= 90 ? 'paved' : s.hard >= 50 ? 'partly' : 'other'; }
  const wcList = (t) => t.wc_u_startu || [];
  const parkList = (t) => t.parkovani_ztp_u_startu || [];
  const wcAccessible = (t) => wcList(t).filter(w => w.wheelchair === 'yes' || w.toilets_wheelchair === 'yes');

  // ---------- Výškový profil a sklon ----------
  // Úseky mezi body profilu (min. 20 m, jako ve skriptu), sklon v % ve směru trasy
  function segments(t) {
    const p = t.profil || [], out = [];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], dd = b[0] - a[0];
      if (dd < 20 || a[1] == null || b[1] == null) continue;
      out.push({ a: a[0], b: b[0], ha: a[1], hb: b[1], g: (b[1] - a[1]) / dd * 100 });
    }
    return out;
  }
  // Souvislé úseky se sklonem nad limit (v absolutní hodnotě: prudké klesání je pro vozík stejně těžké)
  function runsOver(segs, lim) {
    const out = []; let cur = null;
    segs.forEach(s => {
      if (Math.abs(s.g) > lim) {
        if (cur && Math.abs(cur.b - s.a) < 1) { cur.b = s.b; if (Math.abs(s.g) > cur.max) { cur.max = Math.abs(s.g); cur.up = s.g > 0; } }
        else { cur = { a: s.a, b: s.b, max: Math.abs(s.g), up: s.g > 0 }; out.push(cur); }
      } else cur = null;
    });
    return out;
  }
  const runsLen = (r) => r.reduce((s, x) => s + (x.b - x.a), 0);
  // Souvislé úseky podle třídy sklonu: '6' = 6–8 %, '8' = nad 8 % (pro mapu)
  function classRuns(segs) {
    const out = []; let cur = null;
    segs.forEach(s => {
      const g = Math.abs(s.g), k = g > 8 ? '8' : g > 6 ? '6' : null;
      if (!k) { cur = null; return; }
      if (cur && cur.k === k && Math.abs(cur.b - s.a) < 1) cur.b = s.b;
      else { cur = { a: s.a, b: s.b, k }; out.push(cur); }
    });
    return out;
  }

  // Krátký verdikt jen podle sklonu z profilu potřeb (karta v katalogu)
  function slopeFit(t, n) {
    if (!n || !n.active || n.slopeMax === null) return null;
    const segs = segments(t);
    if (!segs.length) return { st: 'unk', text: KP.t('Sklon u této trasy neznáme') };
    const r = runsOver(segs, n.slopeMax);
    if (!r.length) return { st: 'ok', text: K.t('Sklon nikde nad {n} %', { n: fmt(n.slopeMax) }) };
    return { st: 'no', text: K.t('{c}× sklon nad {n} %, celkem {len}', { c: r.length, n: fmt(n.slopeMax), len: meters(runsLen(r)) }) };
  }

  // Shoda trasy s profilem potřeb, stejný tvar jako KP.matchScore u míst
  function match(t, needsIn) {
    const n = needsIn || K.getNeeds(), items = [];
    const add = (key, label, state, o) => items.push(Object.assign({ key, label, state, critical: false, hard: false }, o || {}));
    const w = t.wheelchair || 'null';
    add('osm', w === 'yes' ? KP.t('V OpenStreetMap označená jako sjízdná na vozíku') : w === 'limited' ? KP.t('V OpenStreetMap jen částečně sjízdná') : w === 'no' ? KP.t('V OpenStreetMap označená jako nesjízdná') : KP.t('Sjízdnost v OpenStreetMap neuvedena'),
      w === 'yes' ? 'met' : w === 'limited' ? (n.acceptLimited ? 'met' : 'part') : w === 'no' ? 'unmet' : 'unknown', { hard: true, critical: w === 'no' });
    add('steps', t.schody > 0 ? K.t('Na trase jsou schody ({n}× v OpenStreetMap)', { n: t.schody }) : K.t('Trasa nevede po schodech (OpenStreetMap)'), t.schody > 0 ? 'unmet' : 'met', { critical: true });
    if (n.slopeMax !== null) {
      const segs = segments(t);
      if (!segs.length) add('slope', KP.t('Sklon neznáme'), 'unknown', { critical: true });
      else {
        const r = runsOver(segs, n.slopeMax);
        add('slope', r.length ? K.t('{c}× sklon nad {n} %, celkem {len}', { c: r.length, n: fmt(n.slopeMax), len: meters(runsLen(r)) }) + ' ' + K.t('(odhad z výškového modelu)') : K.t('Sklon nikde nad {n} %', { n: fmt(n.slopeMax) }) + ' ' + K.t('(odhad z výškového modelu)'), r.length ? 'unmet' : 'met', { critical: true });
      }
    }
    if (n.needWc) {
      const acc = wcAccessible(t);
      if (acc.length) add('wc', K.t('Bezbariérové WC {n} m od startu', { n: acc[0].vzdalenost_m }), 'met', { hard: true });
      else if (wcList(t).length) add('wc', KP.t('WC u startu bez údaje o bezbariérovosti'), 'unknown', { hard: true });
      else add('wc', KP.t('WC do 300 m od startu v OpenStreetMap není'), 'unknown', { hard: true });
    }
    if (n.needParking) {
      const pk = parkList(t);
      if (pk.length) add('park', K.t('Parkování ZTP {n} m od startu', { n: pk[0].vzdalenost_m }), 'met', { hard: true });
      else add('park', KP.t('Parkování ZTP do 300 m od startu v OpenStreetMap není'), 'unknown', { hard: true });
    }
    const by = (s) => items.filter(i => i.state === s);
    const met = by('met'), part = by('part'), unmet = by('unmet'), unknown = by('unknown');
    const known = met.length + part.length + unmet.length;
    let status;
    if (unmet.some(i => i.critical) || unmet.length + part.length > 1) status = 'no';
    else if (unmet.length || part.length) status = 'part';
    else if (unknown.some(i => i.hard)) status = 'unk';
    else status = known ? 'ok' : 'unk';
    return {
      pct: known ? Math.round((met.length + part.length * 0.5) / known * 100) : null, status,
      met: met.map(i => i.label), unmet: unmet.concat(part).map(i => i.label), partial: part.map(i => i.label), unknown: unknown.map(i => i.label),
      known, total: items.length, knownPct: items.length ? Math.round(known / items.length * 100) : 0, items,
    };
  }

  // ---------- Obec poblíž startu (z našeho seznamu obcí; jen orientačně) ----------
  function nearTown(t, towns) {
    if (!towns || !t.start) return '';
    const [la, lo] = t.start; let best = null, bd = 3; // km
    towns.forEach(x => {
      const cla = Math.max(x[3], Math.min(x[5], la)), clo = Math.max(x[4], Math.min(x[6], lo));
      const d = K.distanceKm({ la, lo }, { la: cla, lo: clo });
      // uvnitř více obcí (obalové obdélníky se překrývají) vyhraje ta s víc místy, obvykle samotné město
      if (d < bd || (d === 0 && bd === 0 && best && x[2] > best[2])) { bd = d; best = x; }
    });
    return best ? best[0] : '';
  }

  // ---------- Kreslení do mapy (Leaflet i Google) ----------
  function drawPath(map, coords, o) {
    if (map.engine === 'leaflet') return L.polyline(coords, { color: o.color, weight: o.weight, opacity: o.opacity || 1, dashArray: o.dash || null, lineCap: o.cap || 'round', interactive: false }).addTo(map.map);
    const icons = o.dash ? [{ icon: { path: 'M 0,0 0,' + o.dash.split(' ')[0], strokeOpacity: 1, strokeColor: o.color, strokeWeight: o.weight, scale: 1 }, offset: '0', repeat: o.dash.split(' ').reduce((s, x) => s + Number(x), 0) + 'px' }] : null;
    return new google.maps.Polyline({ map: map.map, path: coords.map(c => ({ lat: c[0], lng: c[1] })), strokeColor: o.color, strokeWeight: o.weight, strokeOpacity: icons ? 0 : (o.opacity || 1), icons, clickable: false });
  }
  function drawPin(map, ll, svg, size, title) {
    if (map.engine === 'leaflet') return L.marker(ll, { icon: L.divIcon({ className: 'st-mk', html: svg, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), keyboard: false, title: title || '' }).addTo(map.map);
    return new google.maps.Marker({ map: map.map, position: { lat: ll[0], lng: ll[1] }, title: title || '', icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size / 2, size / 2) } });
  }
  function pinSvg(letter, kind) {
    const fill = kind === 'end' ? '#FFD400' : '#101010', ink = kind === 'end' ? '#101010' : '#FFFFFF';
    const shape = kind === 'end' ? '<rect x="2" y="2" width="24" height="24" fill="' + fill + '" stroke="#101010" stroke-width="2"/>' : '<circle cx="14" cy="14" r="12" fill="' + fill + '" stroke="#FFFFFF" stroke-width="2"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' + shape + '<text x="14" y="19" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="' + ink + '">' + letter + '</text></svg>';
  }
  const DOT = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="#FFD400" stroke="#101010" stroke-width="3"/></svg>';

  // Poloha na geometrii podle vzdálenosti z profilu (profil a zjednodušená geometrie mají trochu jinou délku, proto poměrem)
  function geoIndex(t) {
    const pts = []; let cum = 0;
    (t.geometrie || []).forEach((part, pi) => part.forEach((c, j) => {
      if (j) cum += K.distanceKm({ la: part[j - 1][0], lo: part[j - 1][1] }, { la: c[0], lo: c[1] }) * 1000;
      pts.push({ c, d: cum, p: pi });
    }));
    const prof = t.profil || [];
    return { pts, total: cum, dMax: prof.length ? prof[prof.length - 1][0] : cum };
  }
  function posAt(gi, d) {
    const pts = gi.pts; if (!pts.length) return null;
    const x = gi.dMax ? d / gi.dMax * gi.total : 0;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].d <= x) lo = mid; else hi = mid; }
    const A = pts[lo], B = pts[hi];
    if (A.p !== B.p || B.d === A.d) return A.c;
    const k = Math.max(0, Math.min(1, (x - A.d) / (B.d - A.d)));
    return [A.c[0] + (B.c[0] - A.c[0]) * k, A.c[1] + (B.c[1] - A.c[1]) * k];
  }
  function sliceGeo(gi, a, b) {
    const A = gi.dMax ? a / gi.dMax * gi.total : 0, B = gi.dMax ? b / gi.dMax * gi.total : 0, out = [];
    let cur = null, lastP = -1;
    const pa = posAt(gi, a), pb = posAt(gi, b);
    gi.pts.forEach(pt => {
      if (pt.d < A || pt.d > B) return;
      if (pt.p !== lastP) { cur = []; out.push(cur); lastP = pt.p; }
      cur.push(pt.c);
    });
    if (!out.length) { if (pa && pb) out.push([pa, pb]); return out; }
    if (pa) out[0].unshift(pa);
    if (pb) out[out.length - 1].push(pb);
    return out.filter(x => x.length > 1);
  }

  // ---------- Lokální komunitní data (prototyp) ----------
  const local = {
    saved: () => K.store.get('trailSaved', []),
    isSaved: (id) => local.saved().includes(id),
    toggleSaved(id) { const s = local.saved(); const i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); return K.store.set('trailSaved', s) ? i < 0 : null; },
    confirmed: (id) => K.store.get('trailConfirm', {})[id] || null,
    confirm(id, on) { const c = K.store.get('trailConfirm', {}); if (on) c[id] = new Date().toISOString().slice(0, 10); else delete c[id]; return K.store.set('trailConfirm', c); },
    reports: (id) => (K.store.get('trailReports', {})[id] || []),
    addReport(id, r) { const all = K.store.get('trailReports', {}); (all[id] = all[id] || []).push(r); if (all[id].length > 30) all[id].shift(); return K.store.set('trailReports', all); },
    delReport(id, rid) { const all = K.store.get('trailReports', {}); all[id] = (all[id] || []).filter(x => x.id !== rid); if (!all[id].length) delete all[id]; return K.store.set('trailReports', all); },
    exps: (id) => (K.store.get('trailExp', {})[id] || []),
    addExp(id, e) { const all = K.store.get('trailExp', {}); (all[id] = all[id] || []).push(e); if (all[id].length > 30) all[id].shift(); return K.store.set('trailExp', all); },
    delExp(id, eid) { const all = K.store.get('trailExp', {}); all[id] = (all[id] || []).filter(x => x.id !== eid); if (!all[id].length) delete all[id]; return K.store.set('trailExp', all); },
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  window.KPTrails = { load, byId, name, km, meters, pct, TYP, ZEME, WH, wh, surfaces, surfStats, mainSurface, paved, segments, runsOver, slopeFit, match, nearTown, detailUrl, drawPath, drawPin, pinSvg, geoIndex, posAt, sliceGeo, local };

  if (!document.body || !document.body.classList.contains('page-stezky')) return;

  // =====================================================================
  // Stránka stezky.html
  // =====================================================================
  const $ = (s, r) => (r || document).querySelector(s);
  const mobile = () => matchMedia('(max-width: 899px)').matches;
  const PAGE = 20;
  let ALL = [], TOWNS = null, shown = PAGE, map = null, here = null;

  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s)<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }

  // ---------- Katalog ----------
  const F = ['zeme', 'kraj', 'delka', 'sklon', 'povrch', 'typ', 'sort'];
  const C = ['lav', 'wc', 'park'];
  function readFilters() {
    const o = {}; F.forEach(k => { o[k] = $('#f-' + k).value; }); C.forEach(k => { o[k] = $('#f-' + k).checked; }); return o;
  }
  function saveFilters() { const o = readFilters(); if (o.sort === 'blizko') o.sort = 'delka'; K.store.set('stezkyFilters', o); }
  function restoreFilters() {
    const o = K.store.get('stezkyFilters', null); if (!o) return;
    F.forEach(k => { const el = $('#f-' + k); if (o[k] !== undefined && [...el.options].some(x => x.value === o[k])) el.value = o[k]; });
    C.forEach(k => { $('#f-' + k).checked = !!o[k]; });
  }
  function fillKraje() {
    const z = $('#f-zeme').value, cur = $('#f-kraj').value;
    const kraje = [...new Set(ALL.filter(t => !z || t.zeme === z).map(t => t.kraj).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
    $('#f-kraj').innerHTML = ('<option value="">' + KP.t('Všechny') + '</option>') + kraje.map(k => '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(krajT(k)) + '</option>').join('');
  }
  function slopeLimit(f) {
    if (f.sklon === 'me') { const n = K.getNeeds(); return n.active && n.slopeMax !== null ? n.slopeMax : null; }
    return f.sklon ? Number(f.sklon) : null;
  }
  function filtered() {
    const f = readFilters(), lim = slopeLimit(f);
    let list = ALL.filter(t => {
      if (f.zeme && t.zeme !== f.zeme) return false;
      if (f.kraj && t.kraj !== f.kraj) return false;
      if (f.delka) { const [a, b] = f.delka.split('-').map(Number); if (t.delka_km < a || t.delka_km >= b) return false; }
      if (lim !== null && !(t.max_sklon <= lim)) return false;
      if (f.povrch === 'paved' && paved(t) !== 'paved') return false;
      if (f.povrch === 'partly' && paved(t) === 'other') return false;
      if (f.typ && t.typ !== f.typ) return false;
      if (f.lav && !(t.lavicky > 0)) return false;
      if (f.wc && !wcList(t).length) return false;
      if (f.park && !parkList(t).length) return false;
      return true;
    });
    const by = {
      delka: (a, b) => a.delka_km - b.delka_km, 'delka-d': (a, b) => b.delka_km - a.delka_km,
      sklon: (a, b) => a.max_sklon - b.max_sklon, lavicky: (a, b) => (b.lavicky || 0) - (a.lavicky || 0) || a.delka_km - b.delka_km,
      nazev: (a, b) => name(a).localeCompare(name(b), 'cs'),
      blizko: here ? (a, b) => K.distanceKm(here, { la: a.start[0], lo: a.start[1] }) - K.distanceKm(here, { la: b.start[0], lo: b.start[1] }) : (a, b) => a.delka_km - b.delka_km,
    };
    list = list.slice().sort(by[f.sort] || by.delka);
    const nf = F.filter(k => k !== 'sort' && f[k]).length + C.filter(k => f[k]).length;
    $('#st-nf').hidden = !nf; $('#st-nf').textContent = nf;
    $('#f-reset').hidden = !nf;
    return list;
  }

  function fitBar() {
    const n = K.getNeeds(), box = $('#st-fitbar');
    if (n.active && n.slopeMax !== null) {
      box.innerHTML = '<p>' + K.t('U každé trasy ukazujeme, jestli sedí k vašemu limitu sklonu <b class="num">{n} %</b> ({aid}).', { n: fmt(n.slopeMax), aid: esc(K.aidLabel(n)) }) + ('</p><button class="btn btn-ghost btn-sm" type="button" data-open-needs-here>' + KP.t('Upravit profil') + '</button>');
    } else if (n.active) {
      box.innerHTML = ('<p>' + KP.t('V profilu potřeb nemáte nastavený největší sklon, který zvládnete. Doplňte ho a u každé trasy uvidíte, jestli vám vyhovuje.') + '</p><button class="btn btn-primary btn-sm" type="button" data-open-needs-here>' + KP.t('Doplnit sklon') + '</button>');
    } else {
      box.innerHTML = ('<p>' + KP.t('Vyhovuje vám trasa? Nastavte si v profilu potřeb největší sklon, který zvládnete, a u každé trasy to uvidíte.') + '</p><button class="btn btn-primary btn-sm" type="button" data-open-needs-here>' + KP.t('Nastavit profil potřeb') + '</button>');
    }
  }

  function row(t, n) {
    const w = wh(t), fit = slopeFit(t, n), town = TOWNS ? nearTown(t, TOWNS) : '';
    const s = surfStats(t);
    const extras = [];
    if (wcList(t).length) extras.push(K.icon('wc') + (wcAccessible(t).length ? KP.t('Bezbariérové WC u startu') : KP.t('WC u startu')));
    if (parkList(t).length) extras.push(K.icon('parking') + KP.t('Parkování ZTP u startu'));
    if (s.cobble >= 5) extras.push(K.icon('warn') + K.t('Kostky {n} %', { n: fmt(Math.round(s.cobble)) }));
    if (t.schody > 0) extras.push(K.icon('stairs') + K.t('Schody {n}×', { n: t.schody }));
    const dist = here && t.start ? K.distanceKm(here, { la: t.start[0], lo: t.start[1] }) : null;
    return '<li class="st-row" id="row-' + esc(t.id) + '" data-id="' + esc(t.id) + '">' +
      '<p class="st-row-k">' + esc(TYP[t.typ] || t.typ) + ' · ' + esc(ZEME[t.zeme] || t.zeme) + ' · ' + esc(krajT(t.kraj)) + (dist !== null ? ' · <span class="num">' + fmt(dist.toFixed(dist < 10 ? 1 : 0)) + ' ' + K.t('km od vás') + '</span>' : '') + '</p>' +
      '<h3><a href="' + detailUrl(t) + '">' + esc(name(t)) + '</a></h3>' +
      (town || isGeneric(t) ? '<p class="st-row-sub">' + (town ? K.t('Poblíž obce') + ' ' + esc(town) : K.t('Úsek bez vlastního názvu')) + '</p>' : '') +
      '<dl class="st-facts">' +
      ('<div><dt>' + KP.t('Délka') + '</dt><dd class="num">') + km(t.delka_km) + '</dd></div>' +
      ('<div><dt>' + KP.t('Největší sklon') + '</dt><dd class="num">') + pct(t.max_sklon) + '</dd></div>' +
      ('<div><dt>' + KP.t('Stoupání') + '</dt><dd class="num">') + Math.round(t.prevyseni_nahoru || 0) + ' m</dd></div>' +
      ('<div><dt>' + KP.t('Povrch') + '</dt><dd>') + esc(mainSurface(t)) + '</dd></div>' +
      ('<div><dt>' + KP.t('Lavičky') + '</dt><dd class="num">') + (t.lavicky || 0) + '</dd></div>' +
      '</dl>' +
      '<p class="st-row-st">' + K.statusHtml(w[0], w[1]) + '</p>' +
      (extras.length ? '<p class="st-row-x">' + extras.map(x => '<span>' + x + '</span>').join('') + '</p>' : '') +
      (fit ? ('<p class="st-fit"><span class="st-fit-q">' + KP.t('Vyhovuje vašemu profilu?') + '</span> ') + K.statusHtml(fit.st, fit.text) + '</p>' : '') +
      '</li>';
  }

  let lastList = [];
  function render(keepShown) {
    if (!keepShown) shown = PAGE;
    const list = filtered(), n = K.getNeeds();
    lastList = list;
    const cnt = list.length;
    const f = readFilters();
    const noLimit = f.sklon === 'me' && slopeLimit(f) === null ? (' <span class="small">' + KP.t('V profilu nemáte limit sklonu, filtr sklonu se nepoužil.') + '</span>') : '';
    $('#st-count').innerHTML = (cnt ? '<b class="num">' + cnt + '</b> ' + K.plural(cnt, 'trasa', 'trasy', 'tras') + ' ' + K.t('z {n}', { n: ALL.length }) : K.t('Žádná trasa neodpovídá filtrům.')) + noLimit;
    $('#st-list').innerHTML = cnt ? list.slice(0, shown).map(t => row(t, n)).join('')
      : ('<li class="st-empty"><p>' + KP.t('Zkuste povolit delší trasy nebo větší sklon. Tras s údaji o sjízdnosti je zatím málo, protože je do OpenStreetMap zadává málo lidí.') + '</p><button class="btn btn-ghost" type="button" id="st-empty-reset">' + KP.t('Zrušit filtry') + '</button></li>');
    $('#st-more').hidden = cnt <= shown;
    $('#st-more').textContent = K.t('Zobrazit další trasy ({n})', { n: cnt - shown });
    drawCatalogMap(list);
    saveFilters();
  }

  function drawCatalogMap(list) {
    if (!map) return;
    const n = K.getNeeds();
    const pts = list.filter(t => t.start).map(t => { const f = slopeFit(t, n); return { i: t.id, la: t.start[0], lo: t.start[1], n: name(t), st: f ? f.st : wh(t)[0] }; });
    map.setPlaces(pts, {
      colorOf: p => p.st,
      onClick: p => {
        const idx = lastList.findIndex(t => t.id === p.i);
        if (idx >= shown) { shown = idx + 1; render(true); }
        const el = document.getElementById('row-' + p.i); if (!el) return;
        document.querySelectorAll('.st-row.is-active').forEach(x => x.classList.remove('is-active'));
        el.classList.add('is-active'); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const a = el.querySelector('h3 a'); if (a) a.focus({ preventScroll: true });
      },
    });
    if (pts.length) map.fitTo(pts);
  }
  async function ensureMap() {
    if (map) return;
    try { map = await KPMap.create($('#st-map'), { lat: 49.4, lng: 13.2, zoom: 6 }); drawCatalogMap(lastList); }
    catch (e) { $('#st-mapbox').innerHTML = ('<p class="muted small st-map-err">' + KP.t('Mapu se nepodařilo načíst. Seznam tras funguje dál.') + '</p>'); }
  }

  async function initList() {
    $('#st-list-view').hidden = false;
    restoreFilters(); fitBar();
    if (mobile()) $('#st-filters').open = false;
    try { ALL = await load(); } catch (e) { $('#st-count').textContent = KP.t('Data tras se nepodařilo načíst. Zkuste stránku obnovit.'); return; }
    $('#st-lede').textContent = K.t('{n} tras v Česku a v Bavorsku, které jsou v OpenStreetMap označené jako sjízdné na vozíku nebo mají „bezbariérová“ v názvu. U každé ukazujeme délku, sklon z výškového modelu, povrch a zázemí u startu.', { n: ALL.length });
    if (ALL.partial) K.toast(KP.t('Část tras se nepodařilo načíst.'));
    fillKraje();
    const k = (K.store.get('stezkyFilters', {}) || {}).kraj; if (k && [...$('#f-kraj').options].some(o => o.value === k)) $('#f-kraj').value = k;
    if ($('#f-sort').value === 'blizko') $('#f-sort').value = 'delka';
    render();
    if (!mobile()) ensureMap();
    K.loadTowns().then(t => { TOWNS = t; render(true); }).catch(() => {});

    $('#st-form').addEventListener('change', e => { if (e.target.id === 'f-zeme') fillKraje(); render(); });
    $('#st-form').addEventListener('reset', () => setTimeout(() => { fillKraje(); render(); }, 0));
    $('#f-sort').addEventListener('change', () => {
      if ($('#f-sort').value === 'blizko' && !here) {
        if (!navigator.geolocation) { K.toast(KP.t('Prohlížeč neumí zjistit polohu.')); $('#f-sort').value = 'delka'; return; }
        $('#st-count').textContent = KP.t('Zjišťuji vaši polohu…');
        navigator.geolocation.getCurrentPosition(p => { here = { la: p.coords.latitude, lo: p.coords.longitude }; render(); },
          () => { K.toast(KP.t('Polohu se nepodařilo zjistit. Povolte ji v prohlížeči.')); $('#f-sort').value = 'delka'; render(); }, { timeout: 10000 });
        return;
      }
      render();
    });
    $('#st-more').addEventListener('click', () => { shown += PAGE; render(true); });
    $('#st-list').addEventListener('click', e => { if (e.target.id === 'st-empty-reset') { $('#st-form').reset(); } });
    $('#st-maptoggle').addEventListener('click', () => {
      const box = $('#st-mapbox'), open = !box.classList.contains('open');
      box.classList.toggle('open', open); $('#st-maptoggle').setAttribute('aria-expanded', open);
      $('#st-maptoggle').textContent = open ? KP.t('Skrýt mapu') : KP.t('Mapa');
      if (open) ensureMap().then(() => { if (map && map.engine === 'leaflet') { map.map.invalidateSize(); drawCatalogMap(lastList); } });
    });
    $('#st-fitbar').addEventListener('click', e => { if (e.target.closest('[data-open-needs-here]')) K.needsDrawer(); });
    document.addEventListener('kp:needs', () => { fitBar(); render(true); });
  }

  // ---------- Detail trasy ----------
  const RPT_TYPES = [KP.t('Uzavírka nebo stavba'), KP.t('Nový schod nebo obrubník'), KP.t('Rozbitý nebo rozbahněný povrch'), KP.t('Spadlý strom nebo jiná překážka'), KP.t('Údaj v datech nesedí'), KP.t('Jiná změna')];

  function tile(k, v, note) { return '<div class="tile"><span class="k">' + k + '</span><span class="v num">' + v + '</span>' + (note ? '<span class="st-tile-n small">' + note + '</span>' : '') + '</div>'; }

  function matchBlock(t) {
    const n = K.getNeeds();
    if (!n.active) return ('<div class="st-match st-match-off"><p class="st-match-q">' + KP.t('Vyhovuje vám tato trasa?') + '</p><p>' + KP.t('Nastavte si profil potřeb (pomůcka, největší sklon, WC, parkování) a porovnáme ho s údaji o trase.') + '</p><button class="btn btn-primary btn-sm" type="button" data-open-needs-here>' + KP.t('Nastavit profil potřeb') + '</button></div>');
    const r = match(t, n);
    const head = r.pct === null ? K.t('Chybí údaje pro porovnání') : K.t('{pct} % shoda s vašimi potřebami', { pct: r.pct });
    return '<div class="st-match st-' + r.status + ('"><p class="st-match-q">' + KP.t('Podle vašeho profilu (')) + esc(K.aidLabel(n)) + ')</p>' +
      '<p class="st-match-h">' + K.statusHtml(r.status, esc(K.STATUS_LABEL[r.status])) + '</p>' +
      '<p class="st-match-n"><b class="num">' + esc(head) + '</b>, ' + K.t('známe {k} z {n} údajů', { k: r.known, n: r.total }) + '</p>' +
      '<ul class="st-match-list">' + r.items.map(i => '<li>' + K.statusHtml(i.state === 'met' ? 'ok' : i.state === 'part' ? 'part' : i.state === 'unmet' ? 'no' : 'unk', esc(i.label)) + '</li>').join('') + '</ul>' +
      (n.slopeMax === null ? ('<p class="small muted">' + KP.t('Sklon jsme nehodnotili, v profilu nemáte nastavený limit.') + '</p>') : '') +
      ('<button class="btn btn-quiet btn-sm" type="button" data-open-needs-here>' + KP.t('Upravit profil') + '</button></div>');
  }

  function surfaceBlock(t) {
    const s = Object.entries(surfaces(t)).sort((a, b) => b[1] - a[1]);
    if (!s.length) return ('<p class="muted">' + KP.t('Povrch v OpenStreetMap neuveden.') + '</p>');
    const cls = (k) => k === 'neuvedeno' ? 'u' : k === COBBLE ? 'c' : HARD.has(k) ? 'h' : SEMI.has(k) ? 's' : 'l';
    const lbl = { h: KP.t('zpevněný'), c: KP.t('zpevněný, ale hrbolatý'), s: KP.t('mlat nebo jemný štěrk'), l: KP.t('nezpevněný'), u: KP.t('bez údaje') };
    const sm = Object.entries(t.hladkost || {}).sort((a, b) => b[1] - a[1]);
    return ('<div class="st-sbar" role="img" aria-label="' + KP.t('Podíl povrchů z délky trasy: ')) + esc(s.map(([k, v]) => K.t(k) + ' ' + fmt(v) + ' %').join(', ')) + '">' +
      s.map(([k, v]) => '<span class="st-s-' + cls(k) + '" style="flex-basis:' + Math.max(v, 0.5) + '%" title="' + esc(K.t(k)) + ' ' + fmt(v) + ' %"></span>').join('') + '</div>' +
      '<ul class="st-rows">' + s.map(([k, v]) => '<li><span class="st-sw st-s-' + cls(k) + '" aria-hidden="true"></span><span>' + esc(K.t(k)) + ' <span class="muted small">(' + lbl[cls(k)] + ')</span></span><span class="num">' + fmt(v) + ' %</span></li>').join('') + '</ul>' +
      (sm.length ? ('<p class="small st-mt"><b>' + KP.t('Sjízdnost povrchu (smoothness)') + ':</b> ') + sm.map(([k, v]) => esc(SMOOTH[k] || k) + ' ' + fmt(v) + ' %').join(', ') + '</p>' : '') +
      (t.sirka_m ? '<p class="small"><b>' + K.t('Šířka') + ':</b> ' + K.t('<span class="num">{w} m</span> nejméně, uvedena u <span class="num">{pct} %</span> délky.', { w: fmt(t.sirka_min_m), pct: fmt(t.sirka_pokryti_pct) }) + '</p>' : ('<p class="small">' + KP.t('Šířka cesty v OpenStreetMap neuvedena.') + '</p>')) +
      ('<p class="small muted">' + KP.t('Podíly jsou z celkové délky. Kde přesně se povrch mění, zatím v datech nemáme.') + '</p>');
  }

  function startBlock(t) {
    const osm = (id) => 'https://www.openstreetmap.org/' + ({ n: 'node', w: 'way', r: 'relation' }[id[0]] || 'node') + '/' + id.slice(1);
    const whL = { yes: ['ok', KP.t('přístupné na vozíku')], limited: ['part', KP.t('částečně přístupné')], no: ['no', KP.t('nepřístupné na vozíku')] };
    const wc = wcList(t), pk = parkList(t);
    const kerbs = t.obrubniky ? Object.entries(t.obrubniky) : [];
    const kerbL = { lowered: KP.t('snížené'), flush: KP.t('v úrovni'), raised: KP.t('vysoké'), rolled: KP.t('šikmé'), no: KP.t('bez obrubníku') };
    return '<ul class="st-rows st-pois">' +
      '<li><span class="st-poi-k">' + K.icon('star') + (KP.t('Lavičky') + '</span><span>') + (t.lavicky ? '<b class="num">' + t.lavicky + '</b> ' + K.t('do 30 m od trasy') : K.t('Žádná v OpenStreetMap')) + '</span></li>' +
      '<li><span class="st-poi-k">' + K.icon('wc') + (KP.t('WC do 300 m') + '</span><span>') + (wc.length ? wc.map(w => {
        const st = w.toilets_wheelchair === 'yes' ? ['ok', KP.t('bezbariérová kabina')] : whL[w.wheelchair] || ['unk', KP.t('přístupnost neuvedena')];
        return '<a href="' + osm(w.osm) + '" target="_blank" rel="noopener" class="num">' + w.vzdalenost_m + ' m</a> ' + K.statusHtml(st[0], st[1]);
      }).join('<br>') : KP.t('Žádné v OpenStreetMap')) + '</span></li>' +
      '<li><span class="st-poi-k">' + K.icon('parking') + (KP.t('Parkování ZTP do 300 m') + '</span><span>') + (pk.length ? pk.map(p =>
        '<a href="' + osm(p.osm) + '" target="_blank" rel="noopener" class="num">' + p.vzdalenost_m + ' m</a> ' + (p.typ === 'parking_space' ? KP.t('vyhrazené stání') : KP.t('parkoviště')) +
        (p.capacity_disabled && /^\d+$/.test(p.capacity_disabled) ? ', <span class="num">' + p.capacity_disabled + '</span> ' + K.t('míst ZTP') : '')).join('<br>') : KP.t('Žádné v OpenStreetMap')) + '</span></li>' +
      (kerbs.length ? '<li><span class="st-poi-k">' + K.icon('ruler') + (KP.t('Obrubníky na trase') + '</span><span>') + kerbs.map(([k, v]) => esc(kerbL[k] || k) + ' <span class="num">' + v + '×</span>').join(', ') + '</span></li>' : '') +
      ('</ul><p class="small muted">' + KP.t('Polohu WC a parkovišť vidíte po kliknutí na vzdálenost (otevře OpenStreetMap). Že tu něco v datech chybí, neznamená, že to na místě není.') + '</p>');
  }

  function communityBlock(t) {
    const id = t.id, c = local.confirmed(id), reps = local.reports(id).slice().reverse(), exps = local.exps(id).slice().reverse(), n = K.getNeeds();
    return '<p class="callout small st-proto">' + esc(K.PROTOTYPE_NOTE) + (' ' + KP.t('Ostatní návštěvníci vaše záznamy zatím neuvidí.') + '</p>') +
      '<div class="st-comm">' +
      ('<div class="st-comm-col"><h3>' + KP.t('Je trasa pořád taková?') + '</h3>') +
      '<p>' + (c ? K.statusHtml('ok', K.t('Potvrdili jste, že trasa odpovídá ({d})', { d: K.fmtDate(c) })) : KP.t('Projeli jste ji nedávno? Potvrďte, že údaje sedí, nebo nahlaste změnu.')) + '</p>' +
      '<div class="row"><button class="btn ' + (c ? 'btn-ghost' : 'btn-primary') + '" type="button" data-confirm>' + K.icon('check') + (c ? KP.t('Zrušit potvrzení') : KP.t('Potvrdit aktuálnost')) + '</button></div>' +
      ('<form class="stack st-report" id="st-report"><h4>' + KP.t('Nahlásit změnu') + '</h4>') +
      ('<div class="field"><label for="rp-type">' + KP.t('Co se změnilo') + '</label><select id="rp-type">') + RPT_TYPES.map(x => '<option value="' + esc(x) + '">' + esc(K.t(x)) + '</option>').join('') + '</select></div>' +
      ('<div class="field"><label for="rp-text">' + KP.t('Kde a co přesně') + '</label><textarea id="rp-text" maxlength="1000" required placeholder="' + KP.t('Například: u mostu je od září stavba, objížďka vede po štěrku') + '"></textarea></div>') +
      ('<button class="btn btn-ghost" type="submit">' + KP.t('Uložit hlášení') + '</button></form>') +
      (reps.length ? '<ul class="st-rows st-mine">' + reps.map(r => '<li><span><b>' + esc(K.t(r.type)) + '</b> <span class="muted small">' + K.fmtDate(r.date) + '</span><br>' + esc(r.text) + '</span><button class="btn btn-quiet btn-sm" type="button" data-del-report="' + esc(r.id) + ('">' + KP.t('Smazat') + '</button></li>')).join('') + '</ul>' : '') +
      '</div>' +
      ('<div class="st-comm-col"><h3 id="zkusenosti">' + KP.t('Zkušenosti') + '</h3>') +
      (exps.length ? '<ul class="st-rows st-mine">' + exps.map(e => '<li><span><b>' + esc(e.aid ? K.t(e.aid) : K.t('Bez uvedené pomůcky')) + '</b> <span class="muted small">' + K.fmtDate(e.date) + '</span><br>' + esc(e.text) +
        (e.photos && e.photos.length ? '<span class="st-thumbs">' + e.photos.map(src => '<img src="' + esc(src) + ('" alt="' + KP.t('Fotka ze zkušenosti') + '" loading="lazy">')).join('') + '</span>' : '') +
        '</span><button class="btn btn-quiet btn-sm" type="button" data-del-exp="' + esc(e.id) + ('">' + KP.t('Smazat') + '</button></li>')).join('') + '</ul>'
        : ('<p class="muted">' + KP.t('Zatím tu žádná zkušenost není. Napište první: kudy jste jeli, co šlo snadno a kde jste potřebovali pomoc.') + '</p>')) +
      ('<form class="stack" id="st-exp"><div class="field"><label for="ex-aid">' + KP.t('Čím jste jeli') + '</label><select id="ex-aid">') + K.AIDS.map(a => '<option value="' + esc(a) + '"' + (a === n.aid ? ' selected' : '') + '>' + esc(K.t(a)) + '</option>').join('') + '</select></div>' +
      ('<div class="field"><label for="ex-text">' + KP.t('Vaše zkušenost') + '</label><textarea id="ex-text" maxlength="3000" required></textarea></div>') +
      ('<div class="field"><label for="ex-photos">' + KP.t('Fotky') + ' <span class="hint">' + KP.t('(nejvýš 3, zmenšíme je)') + '</span></label><input id="ex-photos" type="file" accept="image/*" multiple></div>') +
      ('<button class="btn btn-primary" type="submit">' + KP.t('Uložit zkušenost') + '</button></form></div>') +
      '</div>';
  }

  function sourcesBlock(t) {
    return '<ul class="st-src">' + (t.zdroje || []).map(s => '<li>' + linkify(s) + '</li>').join('') + '</ul>' +
      ('<p class="small"><b>' + KP.t('Jak jsme trasu vybrali') + ':</b> ') + esc(KP.tx(t.vyber || '')) + (t.souvisla === false ? '. ' + K.t('Trasa se skládá z <span class="num">{n}</span> částí, mezi nimiž v datech chybí spojení.', { n: t.casti }) : '.') + '</p>' +
      (t.sklon_poznamka ? ('<p class="callout small"><b>' + KP.t('Pozor na sklon') + ':</b> ') + esc(KP.tx(t.sklon_poznamka)) + '.</p>' : '') +
      '<p class="small muted">' + K.t('Přesnost výšek: model EU-DEM má rozlišení 25 m a body profilu jsou po {n} m. Krátkou strmou rampu nebo schod model nezachytí. Pod mostem nebo u cesty ve svahu může ukázat sklon terénu vedle cesty. Údaje o sklonu proto berte jako odhad a před cestou je ověřte.', { n: t.profil_krok_m || 50 }) + '</p>';
  }

  // ---------- Výškový profil (SVG) ----------
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  const PAT = (id) => '<defs>' +
    '<pattern id="h6' + id + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" style="fill:var(--part-soft)"/><rect width="2.6" height="7" style="fill:var(--part)"/></pattern>' +
    '<pattern id="h8' + id + '" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" style="fill:var(--no)"/><path d="M0 0 6 6M6 0 0 6" style="stroke:var(--surface)" stroke-width="1.2"/></pattern></defs>';
  function legendSw(kind) { return '<svg width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">' + PAT('L' + kind) + '<rect x="0.5" y="0.5" width="27" height="13" fill="url(#h' + kind + 'L' + kind + ')" style="stroke:var(--ink)"/></svg>'; }

  function chartSvg(t, W, cursorD) {
    const prof = (t.profil || []).filter(p => p[1] != null);
    const H = W < 520 ? 210 : 250, m = { l: 50, r: 14, t: 26, b: 52 };
    const dMax = prof[prof.length - 1][0] || 1;
    const hs = prof.map(p => p[1]); let hMin = Math.min(...hs), hMax = Math.max(...hs);
    const span = Math.max(20, hMax - hMin), st = niceStep(span / 4);
    const y0 = Math.floor((hMin - span * 0.06) / st) * st, y1 = Math.ceil((hMax + span * 0.12) / st) * st;
    const X = d => m.l + d / dMax * (W - m.l - m.r), Y = h => m.t + (y1 - h) / (y1 - y0) * (H - m.t - m.b);
    const base = Y(y0), line = prof.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
    const area = line + 'L' + X(prof[prof.length - 1][0]).toFixed(1) + ' ' + base + 'L' + X(prof[0][0]).toFixed(1) + ' ' + base + 'Z';
    const segs = segments(t);
    let bands = '', strip = '';
    segs.forEach(s => {
      const g = Math.abs(s.g); if (g <= 6) return;
      const k = g > 8 ? '8' : '6';
      bands += '<path d="M' + X(s.a).toFixed(1) + ' ' + Y(s.ha).toFixed(1) + 'L' + X(s.b).toFixed(1) + ' ' + Y(s.hb).toFixed(1) + 'L' + X(s.b).toFixed(1) + ' ' + base + 'L' + X(s.a).toFixed(1) + ' ' + base + 'Z" fill="url(#h' + k + 'C)"/>';
      strip += '<rect x="' + X(s.a).toFixed(1) + '" y="' + (base + 6) + '" width="' + Math.max(1.5, X(s.b) - X(s.a)).toFixed(1) + '" height="10" fill="url(#h' + k + 'C)"/>';
    });
    // osy
    let grid = '';
    for (let h = y0; h <= y1 + 0.001; h += st) grid += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(h).toFixed(1) + '" y2="' + Y(h).toFixed(1) + '" style="stroke:var(--line)"/><text x="' + (m.l - 6) + '" y="' + (Y(h) + 4).toFixed(1) + '" text-anchor="end" class="st-ax">' + Math.round(h) + '</text>';
    const kmMax = dMax / 1000, xs = niceStep(kmMax / (W < 520 ? 4 : 7));
    let xt = '';
    for (let k = 0; k <= kmMax + 0.0001; k += xs) xt += '<line x1="' + X(k * 1000).toFixed(1) + '" x2="' + X(k * 1000).toFixed(1) + '" y1="' + base + '" y2="' + (base + 20) + '" style="stroke:var(--ink-3)"/><text x="' + X(k * 1000).toFixed(1) + '" y="' + (base + 34) + '" text-anchor="middle" class="st-ax">' + fmt(+k.toFixed(2)) + '</text>';
    // popisky sklonu u nejstrmějších úseků (bez překryvu)
    const runs = runsOver(segs, 6).sort((a, b) => b.max - a.max), placed = []; let labels = '';
    runs.forEach(r => {
      if (placed.length >= 6) return;
      const x = X((r.a + r.b) / 2); if (placed.some(px => Math.abs(px - x) < 46)) return;
      const hTop = Math.max(...prof.filter(p => p[0] >= r.a && p[0] <= r.b).map(p => p[1]).concat([-1e9]));
      if (hTop < -1e8) return;
      placed.push(x);
      const y = Math.max(m.t - 8, Y(hTop) - 8);
      labels += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" class="st-lbl">' + fmt(Math.round(r.max * 10) / 10) + ' %</text>';
    });
    const iMin = hs.indexOf(hMin), iMax = hs.indexOf(hMax);
    const ext = '<circle cx="' + X(prof[iMax][0]).toFixed(1) + '" cy="' + Y(hMax).toFixed(1) + '" r="3.5" style="fill:var(--ink)"/>' +
      '<circle cx="' + X(prof[iMin][0]).toFixed(1) + '" cy="' + Y(hMin).toFixed(1) + '" r="3.5" style="fill:var(--surface);stroke:var(--ink)" stroke-width="2"/>';
    const cur = '<g data-cur' + (cursorD == null ? ' style="display:none"' : '') + '><line data-cl y1="' + m.t + '" y2="' + base + '" style="stroke:var(--ink)" stroke-width="1.5" stroke-dasharray="3 3"/><circle data-cc r="6" style="fill:var(--signal);stroke:var(--ink)" stroke-width="2.5"/></g>';
    const runs8 = runsOver(segs, 8), runs6 = runsOver(segs, 6);
    const desc = K.t('Výškový profil: od {a} do {b} m n. m. na délce {len}. Úseky se sklonem nad 6 %: {r6}, z toho nad 8 %: {r8}.', { a: Math.round(hMin), b: Math.round(hMax), len: meters(dMax), r6: runs6.length, r8: runs8.length });
    return { W, H, m, dMax, X, Y, svg: '<svg class="st-chart-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(desc) + '">' + PAT('C') +
      grid + '<path d="' + area + '" style="fill:var(--surface-3)"/>' + bands +
      '<path d="' + line + '" fill="none" style="stroke:var(--ink)" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + base + '" y2="' + base + '" style="stroke:var(--ink)" stroke-width="1.5"/>' + strip + xt + ext + labels + cur +
      '<text x="' + m.l + '" y="13" class="st-ax st-ax-t">' + K.t('m n. m.') + '</text><text x="' + (W - m.r) + '" y="' + (H - 4) + '" text-anchor="end" class="st-ax st-ax-t">' + K.t('km od startu') + '</text>' +
      '<rect x="' + m.l + '" y="' + m.t + '" width="' + (W - m.l - m.r) + '" height="' + (base - m.t + 18) + '" fill="transparent" data-hit/></svg>' };
  }
  function nearestProf(prof, d) { let best = prof[0]; prof.forEach(p => { if (Math.abs(p[0] - d) < Math.abs(best[0] - d)) best = p; }); return best; }
  function gradeAt(segs, d) { const s = segs.find(x => d >= x.a && d <= x.b); return s ? s.g : null; }

  function setupChart(t, onPos) {
    const box = $('#st-chart'), rng = $('#st-pos'), out = $('#st-readout');
    const prof = (t.profil || []).filter(p => p[1] != null);
    if (prof.length < 2) { box.innerHTML = ('<p class="muted">' + KP.t('Výškový profil pro tuto trasu nemáme.') + '</p>'); rng.closest('.field').hidden = true; return; }
    const segs = segments(t);
    let cursor = null, geom = null;
    const moveCursor = () => {
      const g = box.querySelector('[data-cur]'); if (!g || cursor === null) return;
      const p = nearestProf(prof, cursor), x = geom.X(p[0]).toFixed(1);
      g.style.display = '';
      const l = g.querySelector('[data-cl]'), c = g.querySelector('[data-cc]');
      l.setAttribute('x1', x); l.setAttribute('x2', x); c.setAttribute('cx', x); c.setAttribute('cy', geom.Y(p[1]).toFixed(1));
    };
    const draw = () => {
      geom = chartSvg(t, Math.max(300, Math.floor(box.clientWidth || 600)), cursor);
      box.innerHTML = geom.svg; moveCursor();
      const hit = box.querySelector('[data-hit]');
      const fromEvt = (e) => { const r = box.querySelector('svg').getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * geom.W; return Math.max(0, Math.min(geom.dMax, (x - geom.m.l) / (geom.W - geom.m.l - geom.m.r) * geom.dMax)); };
      hit.addEventListener('pointermove', e => setPos(fromEvt(e)));
      hit.addEventListener('pointerdown', e => setPos(fromEvt(e)));
    };
    const setPos = (d) => {
      const p = nearestProf(prof, d);
      if (p[0] === cursor) return;
      cursor = p[0]; rng.value = p[0];
      const g = gradeAt(segs, p[0]);
      out.textContent = fmt((p[0] / 1000).toFixed(2)) + ' ' + K.t('km od startu') + ' · ' + Math.round(p[1]) + ' ' + K.t('m n. m.') + (g !== null ? ' · ' + K.t('sklon {n} %', { n: fmt(Math.abs(Math.round(g * 10) / 10)) }) + ' ' + (g >= 0 ? K.t('nahoru') : K.t('dolů')) : '');
      moveCursor(); onPos(p[0]);
    };
    rng.max = prof[prof.length - 1][0]; rng.step = 'any'; rng.value = 0;
    rng.addEventListener('input', () => setPos(Number(rng.value)));
    draw();
    let tm = 0; window.addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(draw, 150); });
  }

  function steepList(t) {
    const segs = segments(t), runs = runsOver(segs, 6);
    if (!segs.length) return '';
    if (!runs.length) return '<p>' + K.statusHtml('ok', KP.t('Podle výškového modelu nikde sklon nad 6 %')) + '</p>';
    const li = runs.map(r => '<li><span class="num">' + fmt((r.a / 1000).toFixed(2)) + '–' + fmt((r.b / 1000).toFixed(2)) + (' ' + KP.t('km') + '</span><span class="num">') + Math.round(r.b - r.a) + ' m</span><span>' +
      K.statusHtml(r.max > 8 ? 'no' : 'part', K.t('až {n} %', { n: fmt(Math.round(r.max * 10) / 10) }) + ' ' + (r.up ? K.t('nahoru') : K.t('dolů'))) + '</span></li>').join('');
    const body = '<ol class="st-steep">' + li + '</ol>';
    return runs.length > 6 ? '<details class="st-det"><summary>' + K.t('Seznam úseků nad 6 % ({n})', { n: runs.length }) + '</summary>' + body + '</details>' : ('<h4 class="st-h4">' + KP.t('Úseky nad 6 %') + '</h4>') + body;
  }

  function gpx(t) {
    const x = (s) => esc(s);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="kudyprojedu.cz" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>' + x(name(t)) + ('</name><desc>' + KP.t('Geometrie z OpenStreetMap (ODbL 1.0, © přispěvatelé OpenStreetMap)') + '</desc><link href="https://www.openstreetmap.org/copyright"><text>' + KP.t('© přispěvatelé OpenStreetMap') + '</text></link></metadata>\n<trk><name>') + x(name(t)) + '</name>\n' +
      (t.geometrie || []).map(part => '<trkseg>' + part.map(c => '<trkpt lat="' + c[0] + '" lon="' + c[1] + '"/>').join('') + '</trkseg>').join('\n') + '\n</trk>\n</gpx>\n';
  }

  async function share(url, title) {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); K.toast(KP.t('Odkaz je zkopírovaný.')); } catch (e) { window.prompt((KP.t('Zkopírujte odkaz') + ':'), url); }
  }

  async function initDetail(id) {
    $('#st-list-view').hidden = true;
    $('#st-detail-view').hidden = false;
    const box = $('#st-detail');
    let t = null;
    try { await load(); t = byId(id); } catch (e) { box.innerHTML = ('<p>' + KP.t('Data tras se nepodařilo načíst. Zkuste stránku obnovit.') + '</p><p><a href="stezky.html">' + KP.t('Zpět na všechny trasy') + '</a></p>'); return; }
    if (!t) { box.innerHTML = ('<nav class="crumbs st-crumbs"><a href="stezky.html">' + KP.t('Bezbariérové trasy') + '</a></nav><h1>' + KP.t('Trasu jsme nenašli') + '</h1><p>' + KP.t('Odkaz je možná starý.') + ' <a href="stezky.html">' + KP.t('Zobrazit všechny trasy') + '</a></p>'); return; }
    document.title = name(t) + ' · ' + K.t('Bezbariérové trasy') + ' · kudyprojedu.cz';
    const w = wh(t), s = t.start, segs = segments(t);
    const navUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + s[0] + '%2C' + s[1];
    box.innerHTML =
      ('<nav class="crumbs st-crumbs" aria-label="' + KP.t('Drobečková navigace') + '"><a href="stezky.html">' + KP.t('Bezbariérové trasy') + '</a><span aria-hidden="true">/</span><span>') + esc(krajT(t.kraj)) + '</span></nav>' +
      '<header class="st-dhead"><p class="kicker">' + esc(TYP[t.typ] || t.typ) + ' · ' + esc(ZEME[t.zeme] || t.zeme) + '</p>' +
      '<h1>' + esc(name(t)) + '</h1>' +
      '<p class="st-dsub" id="st-town">' + esc(krajT(t.kraj)) + (t.nazev_de && t.nazev_de !== t.nazev ? ' · ' + K.t('německy') + ' ' + esc(t.nazev_de) : '') + '</p>' +
      '<p class="st-dst">' + K.statusHtml(w[0], w[1]) + (t.wheelchair_description ? ' <span class="small">(' + esc(t.wheelchair_description) + ')</span>' : '') + '</p>' +
      '<div class="st-actions">' +
      '<a class="btn btn-primary" href="' + navUrl + '" target="_blank" rel="noopener">' + K.icon('nav') + (KP.t('Navigovat na start') + '</a>') +
      '<button class="btn btn-ghost" type="button" data-save aria-pressed="' + local.isSaved(t.id) + '">' + K.icon('bookmark') + '<span>' + (local.isSaved(t.id) ? KP.t('Uloženo') : KP.t('Uložit')) + '</span></button>' +
      '<button class="btn btn-ghost" type="button" data-share>' + K.icon('share') + (KP.t('Sdílet') + '</button>') +
      '<a class="btn btn-ghost" href="itinerar.html?trasa=' + encodeURIComponent(t.id) + '">' + K.icon('plus') + (KP.t('Přidat do itineráře') + '</a>') +
      ('<button class="btn btn-quiet" type="button" data-gpx>' + KP.t('Stáhnout GPX') + '</button>') +
      '</div></header>' +

      '<div class="st-dgrid">' +
      '<div class="st-dmain">' +
      ('<section class="st-tiles" aria-label="' + KP.t('Klíčové údaje') + '">') +
      tile(KP.t('Délka'), km(t.delka_km)) +
      tile(KP.t('Stoupání / klesání'), '↑ ' + Math.round(t.prevyseni_nahoru || 0) + ' m · ↓ ' + Math.round(t.prevyseni_dolu || 0) + ' m') +
      tile(K.t('Největší sklon'), pct(t.max_sklon), K.t('průměrný') + ' ' + (t.prum_sklon != null ? pct(t.prum_sklon) : K.t('neznámý'))) +
      tile(KP.t('Úseky nad 6 %'), (t.useky_nad_6 || 0) + '×', K.t('{len} celkem', { len: meters(t.useky_nad_6_m || 0) })) +
      tile(KP.t('Úseky nad 8 %'), (t.useky_nad_8 || 0) + '×', K.t('{len} celkem', { len: meters(t.useky_nad_8_m || 0) })) +
      tile(KP.t('Výška'), Math.round(t.vyska_min) + '–' + Math.round(t.vyska_max) + ' m', KP.t('n. m.')) +
      '</section>' +
      ('<section class="st-sec" aria-labelledby="h-map"><h2 id="h-map" class="st-h2">' + KP.t('Mapa trasy') + '</h2>') +
      '<div class="st-dmap"><div id="st-dmap" class="map-canvas" role="application" aria-label="' + K.t('Mapa trasy') + ' ' + esc(name(t)) + '"></div></div>' +
      ('<ul class="st-mlegend small"><li><span class="st-ml st-ml-route" aria-hidden="true"></span>' + KP.t('Trasa') + '</li><li><span class="st-ml st-ml-6" aria-hidden="true"></span>' + KP.t('Sklon 6 až 8 % (čárkovaně)') + '</li><li><span class="st-ml st-ml-8" aria-hidden="true"></span>' + KP.t('Sklon nad 8 % (plná čára)') + '</li><li><span class="st-ml-pin" aria-hidden="true">') + pinSvg('S', 'start') + ('</span>' + KP.t('Start') + '</li>') + (t.typ === 'A→B' ? '<li><span class="st-ml-pin" aria-hidden="true">' + pinSvg('C', 'end') + ('</span>' + KP.t('Cíl') + '</li>') : '') + '</ul>' +
      (t.souvisla === false ? '<p class="small muted">' + K.t('Trasa má v datech {n} oddělené části. Mezi nimi spojení neznáme.', { n: t.casti }) + '</p>' : '') + '</section>' +

      ('<section class="st-sec" aria-labelledby="h-prof"><h2 id="h-prof" class="st-h2">' + KP.t('Výškový profil') + '</h2>') +
      '<div class="st-chart" id="st-chart"></div>' +
      '<ul class="st-clegend small"><li>' + legendSw('6') + (KP.t('Sklon 6 až 8 % (šikmé šrafování)') + '</li><li>') + legendSw('8') + (KP.t('Sklon nad 8 % (mřížka)') + '</li><li><span class="st-dotk" aria-hidden="true"></span>' + KP.t('Nejvyšší bod') + '</li><li><span class="st-dotk st-dotk-o" aria-hidden="true"></span>' + KP.t('Nejnižší bod') + '</li></ul>') +
      ('<div class="field st-posf"><label for="st-pos">' + KP.t('Poloha na trase') + '</label><input type="range" id="st-pos" min="0" value="0" aria-describedby="st-readout"><p class="st-readout num" id="st-readout">' + KP.t('Posuňte jezdec nebo přejeďte grafem.') + '</p></div>') +
      steepList(t) +
      (t.sklon_poznamka ? ('<p class="callout small"><b>' + KP.t('Pozor') + ':</b> ') + esc(KP.tx(t.sklon_poznamka)) + '.</p>' : '') +
      '<p class="small muted">' + K.t('Sklon je odhad z výškového modelu EU-DEM 25 m po {n} m. Krátké rampy a schody nezachytí.', { n: t.profil_krok_m || 50 }) + '</p></section>' +

      ('<section class="st-sec" aria-labelledby="h-surf"><h2 id="h-surf" class="st-h2">' + KP.t('Povrch') + '</h2>') + surfaceBlock(t) + '</section>' +
      ('<section class="st-sec" aria-labelledby="h-start"><h2 id="h-start" class="st-h2">' + KP.t('Zázemí u trasy a u startu') + '</h2>') + startBlock(t) +
      ('<div id="st-near"><button class="btn btn-ghost btn-sm" type="button" data-near>' + KP.t('Načíst místa z naší databáze do 400 m od startu') + '</button></div></section>') +
      ((t.popis || t.web || t.operator) ? ('<section class="st-sec" aria-labelledby="h-osm"><h2 id="h-osm" class="st-h2">' + KP.t('Z OpenStreetMap') + '</h2>') +
        (t.popis ? ('<p><b>' + KP.t('Popis') + ':</b> ') + esc(t.popis) + (t.zeme === 'DE' ? (' <span class="muted small">' + KP.t('(původní text)') + '</span>') : '') + '</p>' : '') +
        (t.operator ? ('<p><b>' + KP.t('Správce') + ':</b> ') + esc(t.operator) + '</p>' : '') +
        (t.web ? ('<p><b>' + KP.t('Web') + ':</b> <a href="') + esc(t.web) + '" target="_blank" rel="noopener">' + esc(t.web) + '</a></p>' : '') + '</section>' : '') +
      ('<section class="st-sec" aria-labelledby="h-comm"><h2 id="h-comm" class="st-h2">' + KP.t('Aktuálnost a zkušenosti') + '</h2>') + communityBlock(t) + '</section>' +
      ('<section class="st-sec" aria-labelledby="h-src"><h2 id="h-src" class="st-h2">' + KP.t('Zdroje') + '</h2>') + sourcesBlock(t) + '</section>' +
      '</div>' +
      '<aside class="st-daside" id="st-match">' + matchBlock(t) + '</aside>' +
      '</div>';

    K.loadTowns().then(tw => { const town = nearTown(t, tw); if (town) $('#st-town').textContent = krajT(t.kraj) + ' · ' + K.t('poblíž obce') + ' ' + town + (t.nazev_de && t.nazev_de !== t.nazev ? ' · ' + K.t('německy') + ' ' + t.nazev_de : ''); }).catch(() => {});

    // mapa
    const gi = geoIndex(t);
    let dm = null, cursorObj = null;
    try {
      dm = await KPMap.create($('#st-dmap'), { lat: s[0], lng: s[1], zoom: 15 });
      (t.geometrie || []).forEach(part => { drawPath(dm, part, { color: '#101010', weight: 8 }); drawPath(dm, part, { color: '#FFD400', weight: 4 }); });
      classRuns(segs).forEach(r => sliceGeo(gi, r.a, r.b).forEach(c =>
        drawPath(dm, c, r.k === '8' ? { color: '#B3261E', weight: 6 } : { color: '#985A00', weight: 6, dash: '8 8', cap: 'butt' })));
      drawPin(dm, s, pinSvg('S', 'start'), 28, KP.t('Start'));
      if (t.typ === 'A→B' && t.cil) drawPin(dm, t.cil, pinSvg('C', 'end'), 28, KP.t('Cíl'));
      const all = [].concat(...(t.geometrie || [])).map(c => ({ la: c[0], lo: c[1] }));
      if (all.length) dm.fitTo(all);
    } catch (e) { $('#st-dmap').innerHTML = ('<p class="muted small st-map-err">' + KP.t('Mapu se nepodařilo načíst.') + '</p>'); }

    setupChart(t, d => {
      if (!dm) return;
      const p = posAt(gi, d); if (!p) return;
      if (cursorObj) dm.clearLayer([cursorObj]);
      cursorObj = drawPin(dm, p, DOT, 22, KP.t('Poloha z grafu'));
    });

    // akce
    box.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-save')) {
        const on = local.toggleSaved(t.id);
        if (on === null) { K.toast(KP.t('Úložiště prohlížeče je plné.')); return; }
        b.setAttribute('aria-pressed', on); b.querySelector('span').textContent = on ? KP.t('Uloženo') : KP.t('Uložit');
        K.toast(on ? KP.t('Trasa uložena v tomto prohlížeči.') : KP.t('Trasa odebrána z uložených.'));
      } else if (b.hasAttribute('data-share')) share(location.href.replace(/[?#].*$/, '') + '?id=' + encodeURIComponent(t.id), name(t));
      else if (b.hasAttribute('data-gpx')) {
        const blob = new Blob([gpx(t)], { type: 'application/gpx+xml' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'trasa-' + t.id + '.gpx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } else if (b.hasAttribute('data-open-needs-here')) K.needsDrawer();
      else if (b.hasAttribute('data-confirm')) { if (!local.confirm(t.id, !local.confirmed(t.id))) K.toast(KP.t('Úložiště prohlížeče je plné.')); refreshComm(t); }
      else if (b.dataset.delReport) { local.delReport(t.id, b.dataset.delReport); refreshComm(t); }
      else if (b.dataset.delExp) { local.delExp(t.id, b.dataset.delExp); refreshComm(t); }
      else if (b.hasAttribute('data-near')) nearPlaces(t, $('#st-near'));
    });
    box.addEventListener('submit', async e => {
      e.preventDefault();
      if (e.target.id === 'st-report') {
        const text = $('#rp-text').value.trim(); if (!text) return;
        if (!local.addReport(t.id, { id: uid('tr'), type: $('#rp-type').value, text: text.slice(0, 1000), date: today() })) { K.toast(KP.t('Úložiště prohlížeče je plné.')); return; }
        K.toast(KP.t('Hlášení uloženo v tomto prohlížeči.')); refreshComm(t);
      } else if (e.target.id === 'st-exp') {
        const text = $('#ex-text').value.trim(); if (!text) return;
        const files = [...($('#ex-photos').files || [])].slice(0, 3);
        const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
        let photos = [];
        try { photos = await Promise.all(files.map(f => K.resizePhoto(f, 1200, 0.8))); } catch (err) { K.toast(KP.t('Fotku se nepodařilo zpracovat.')); btn.disabled = false; return; }
        const ok = local.addExp(t.id, { id: uid('te'), text: text.slice(0, 3000), aid: $('#ex-aid').value, photos, date: today() });
        btn.disabled = false;
        if (!ok) { K.toast(KP.t('Úložiště prohlížeče je plné. Zkuste méně nebo menší fotky.')); return; }
        K.toast(KP.t('Zkušenost uložena v tomto prohlížeči.')); refreshComm(t);
      }
    });
    document.addEventListener('kp:needs', () => { $('#st-match').innerHTML = matchBlock(t); });
  }
  function refreshComm(t) {
    const sec = $('#h-comm').parentElement;
    sec.innerHTML = ('<h2 id="h-comm" class="st-h2">' + KP.t('Aktuálnost a zkušenosti') + '</h2>') + communityBlock(t);
  }

  async function nearPlaces(t, box) {
    box.innerHTML = ('<p class="muted small">' + KP.t('Načítám místa z databáze…') + '</p>');
    const [la, lo] = t.start, d = 0.006;
    try {
      const list = await K.loadPlacesInBounds({ s: la - d, n: la + d, w: lo - d * 1.5, e: lo + d * 1.5 }, { zeme: t.zeme === 'DE' ? 'de' : 'cz' });
      const near = list.map(p => ({ p, d: K.distanceKm({ la, lo }, p) * 1000 })).filter(x => x.d <= 400).sort((a, b) => a.d - b.d).slice(0, 10);
      if (!near.length) { box.innerHTML = ('<p class="muted small">' + KP.t('Do 400 m od startu v naší databázi žádné místo není.') + '</p>'); return; }
      box.innerHTML = ('<h3 class="st-h3">' + KP.t('Místa do 400 m od startu') + '</h3><ul class="st-rows st-near">') + near.map(({ p, d: dist }) => {
        const st = K.W[p.w || 'null'];
        return '<li><span><a href="' + K.placeUrl(p) + '"><b>' + esc(p.n) + '</b></a><br><span class="small muted">' + esc((K.CATS[p.c] || {}).label || '') + '</span> ' + K.statusHtml(st.st, st.short) + '</span>' +
          '<span class="num small">' + Math.round(dist) + ' m</span>' +
          '<a class="btn btn-quiet btn-sm" href="itinerar.html?add=' + encodeURIComponent(p.i) + (p._r ? '&r=' + encodeURIComponent(p._r) : '') + ('">' + KP.t('Do itineráře') + '</a></li>');
      }).join('') + '</ul>';
    } catch (e) { box.innerHTML = ('<p class="muted small">' + KP.t('Databázi míst se nepodařilo načíst.') + '</p>'); }
  }

  function init() {
    const id = new URLSearchParams(location.search).get('id');
    if (id) initDetail(id); else initList();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
