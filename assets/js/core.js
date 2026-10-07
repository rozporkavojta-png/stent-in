/* kudyprojedu.cz – sdílené jádro: hlavička, patička, ikony, profil potřeb, hodnocení míst. */
(function () {
  'use strict';

  // ---------- Úložiště (bezpečně, funguje i bez localStorage) ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('kp.' + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem('kp.' + key, JSON.stringify(val)); } catch (e) { /* bez úložiště */ } },
  };

  // ---------- Ikony (inline SVG, stroke = currentColor) ----------
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    building: '<path d="M4 21V5l8-2v18M12 7l8 3v11M2 21h20M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2"/>',
    ruler: '<path d="M3 17 17 3l4 4L7 21Z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
    nav: '<path d="m3 11 18-8-8 18-2-8-8-2Z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
    wheel: '<circle cx="11" cy="4.5" r="1.8"/><path d="M11 7.5v6h5l2.5 5"/><path d="M11 10.5h4.5"/><path d="M8.5 11.2a5.5 5.5 0 1 0 7 6.3"/>',
    door: '<path d="M5 21V3h11v18M3 21h18"/><circle cx="13" cy="12" r=".8"/>',
    stairs: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
    ramp: '<path d="M3 19h18L21 9Z"/>',
    lift: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="m9 9 3-3 3 3M9 15l3 3 3-3"/>',
    wc: '<path d="M4 4h16v6a8 8 0 0 1-16 0Z"/><path d="M8 20h8"/><path d="M12 18v2"/>',
    parking: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    bed: '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.5"/>',
    shower: '<path d="M5 21V6a3 3 0 0 1 6 0"/><path d="M8 9h6"/><path d="M10 13v1M13 13v1M16 13v1M10 17v1M13 17v1M16 17v1"/>',
    tree: '<path d="M12 21v-6"/><path d="M12 3 6 11h3l-3 4h12l-3-4h3Z"/>',
    food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7h3"/>',
    museum: '<path d="m3 9 9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18M4 18h16"/>',
    theater: '<path d="M4 4h10v6a5 5 0 0 1-10 0Z"/><path d="M10 10h10v5a5 5 0 0 1-10 0"/><path d="M7 8h.01M11 8h.01M14 13h.01M17 13h.01"/>',
    pharmacy: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    warn: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    message: '<path d="M4 5h16v11H9l-5 4Z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || 'i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }

  // ---------- Kategorie ----------
  const CATS = {
    ubytovani: { label: 'Ubytování', icon: 'bed' },
    restaurace: { label: 'Restaurace a kavárny', icon: 'food' },
    wc: { label: 'Veřejné WC', icon: 'wc' },
    pamatky: { label: 'Památky a muzea', icon: 'museum' },
    kultura: { label: 'Kultura', icon: 'theater' },
    priroda: { label: 'Příroda a vyhlídky', icon: 'tree' },
    sport: { label: 'Sport a bazény', icon: 'star' },
    zdravi: { label: 'Zdravotnictví a lékárny', icon: 'pharmacy' },
    urady: { label: 'Úřady, pošty, info', icon: 'building' },
    doprava: { label: 'Nádraží', icon: 'route' },
    obchody: { label: 'Obchody', icon: 'bookmark' },
    parkovani: { label: 'Parkování ZTP', icon: 'parking' },
  };
  // Zdroje dat – u každého údaje je vidět, odkud pochází
  const SOURCES = {
    overeno: { label: 'Ověřeno nezávisle', short: 'Ověřeno', cls: 'badge-verified', icon: 'shield', desc: 'Naměřil proškolený mapovač podle metodiky kategorizace přístupnosti.' },
    komunita: { label: 'Zadala komunita (OpenStreetMap)', short: 'OpenStreetMap', cls: 'badge-community', icon: 'users', desc: 'Údaj zadali dobrovolníci do OpenStreetMap. Stejná data používá Wheelmap.org.' },
    firma: { label: 'Uvedl provozovatel', short: 'Provozovatel', cls: 'badge-business', icon: 'building', desc: 'Údaj vyplnil provozovatel přes profil podniku.' },
  };
  const W = { // OSM tag wheelchair=*
    yes: { st: 'ok', label: 'Přístupné na vozíku', short: 'Přístupné', help: 'Vstup bez schodů a hlavní prostory jsou dostupné na vozíku.' },
    limited: { st: 'part', label: 'Částečně přístupné', short: 'Částečně', help: 'Nejvýš jeden nízký schod (do 7 cm) nebo jen část prostor bez bariér.' },
    no: { st: 'no', label: 'Nepřístupné na vozíku', short: 'Nepřístupné', help: 'Vstup se schody nebo hlavní prostory nejsou dostupné na vozíku.' },
    null: { st: 'unk', label: 'Přístupnost vstupu neuvedena', short: 'Neuvedeno', help: 'Pro vstup zatím nikdo údaj nezadal.' },
  };
  const T = { yes: { st: 'ok', label: 'Bezbariérové WC' }, limited: { st: 'part', label: 'WC částečně přístupné' }, no: { st: 'no', label: 'WC není bezbariérové' }, null: { st: 'unk', label: 'WC neuvedeno' } };

  // ---------- Profil potřeb ----------
  const DEFAULT_NEEDS = { active: false, aid: 'mechanický vozík', acceptLimited: false, needWc: false, needParking: false, onlyChecked: false };
  function getNeeds() { return Object.assign({}, DEFAULT_NEEDS, store.get('needs', {})); }
  function setNeeds(n) { store.set('needs', n); document.dispatchEvent(new CustomEvent('kp:needs', { detail: n })); }

  // ---------- Hodnocení místa (jen z údajů, které opravdu máme) ----------
  // Úplnost profilu: kolik údajů důležitých pro rozhodnutí je vyplněno. Neříká nic o tom, zda je místo přístupné.
  const FIELDS = [
    ['w', 'Přístupnost vstupu'], ['t', 'Toaleta'], ['d', 'Slovní popis přístupnosti'], ['sc', 'Počet schodů u vstupu'],
    ['dw', 'Šířka dveří'], ['rp', 'Rampa'], ['pk', 'Parkování ZTP'], ['img', 'Fotografie'], ['oh', 'Otevírací doba'],
    ['web', 'Web nebo telefon'], ['cd', 'Datum kontroly na místě'],
  ];
  function relevantFields(p) {
    return FIELDS.filter(([k]) => !(p.c === 'parkovani' && ['t', 'sc', 'dw', 'rp', 'oh'].includes(k)) && !(p.c === 'wc' && ['pk', 'web'].includes(k)) && !(p.c === 'priroda' && ['dw', 'oh'].includes(k)));
  }
  // Pole x = naměřené údaje z otevřených dat (Mapy bez bariér, Brno, IPR Praha); počítají se jako vyplněné rozměry.
  function hasField(p, k) {
    if (k === 'web') return !!(p.web || p.ph);
    if (k === 'dw' && p.x && p.x.length) return true;
    return p[k] !== undefined && p[k] !== null;
  }
  function completeness(p) {
    const f = relevantFields(p);
    const have = f.filter(([k]) => hasField(p, k)).length;
    return Math.round(have / f.length * 100);
  }
  function missingFields(p) { return relevantFields(p).filter(([k]) => !hasField(p, k)).map(x => x[1]); }

  // Shoda s osobními potřebami: { status: ok|part|no|unk, reasons[], fails[], unknown[] }
  function match(p, needs) {
    const reasons = [], fails = [], unknown = [];
    if (p.c !== 'parkovani') {
      if (p.w === 'yes') reasons.push('Vstup přístupný na vozíku');
      else if (p.w === 'limited') (needs.acceptLimited ? reasons : fails).push('Vstup jen částečně přístupný');
      else if (p.w === 'no') fails.push('Vstup není přístupný na vozíku');
      else unknown.push('Přístupnost vstupu neuvedena');
    }
    if (needs.needWc && !['parkovani', 'priroda'].includes(p.c)) {
      if (p.t === 'yes') reasons.push('Bezbariérové WC');
      else if (p.t === 'no') fails.push('Bez bezbariérového WC');
      else if (p.t === 'limited') fails.push('WC jen částečně přístupné');
      else unknown.push('Toaleta neuvedena');
    }
    if (needs.needParking) {
      if (p.pk) reasons.push(p.pk + '× parkování ZTP');
      else if (p.pw === 'yes') reasons.push('Parkování pro vozíčkáře');
      else unknown.push('Parkování ZTP neuvedeno');
    }
    if (needs.onlyChecked && !p.cd) unknown.push('Bez data kontroly na místě');
    let status = fails.length ? (fails.some(f => /není přístupný/.test(f)) || fails.length > 1 ? 'no' : 'part') : unknown.length ? (reasons.length ? 'unk' : 'unk') : 'ok';
    if (!fails.length && unknown.length && p.w === 'yes' && !needs.needWc && !needs.needParking) status = 'ok';
    return { status, reasons, fails, unknown };
  }
  const STATUS_LABEL = { ok: 'Vyhovuje vašim potřebám', part: 'Vyhovuje částečně', no: 'Nevyhovuje', unk: 'Chybí údaje' };
  const STATUS_SHORT = { ok: 'Vyhovuje', part: 'Částečně', no: 'Nevyhovuje', unk: 'Chybí údaje' };
  function generalStatus(p) { return p.c === 'parkovani' ? 'ok' : W[p.w || 'null'].st; }

  function fmt(n) { return String(n).replace('.', ','); }
  function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d ? Number(d) + '. ' + Number(m) + '. ' + y : m ? Number(m) + '/' + y : y; }
  function ageLabel(iso) {
    if (!iso) return '';
    const days = Math.round((Date.now() - new Date(iso)) / 864e5);
    if (days < 31) return 'před ' + Math.max(days, 0) + ' dny';
    const months = Math.round(days / 30.4);
    if (months < 12) return 'před ' + months + (months === 1 ? ' měsícem' : ' měsíci');
    const y = Math.floor(months / 12);
    return 'před ' + (y === 1 ? 'rokem' : y + ' lety');
  }
  function sourceBadge(level, extra) {
    const s = SOURCES[level];
    return '<span class="badge ' + s.cls + '" title="' + s.desc + '">' + icon(s.icon) + s.short + (extra ? ' · ' + extra : '') + '</span>';
  }
  function statusHtml(st, text) { return '<span class="status ' + st + '"><i></i>' + (text === undefined ? STATUS_SHORT[st] : text) + '</span>'; }
  // Místa z otevřených dat (id mbb…, brno…, pz…) nemají objekt v OSM: odkaz vede na mapu v daném bodě.
  function isOsm(p) { return /^[nwr]\d+$/.test(p.i); }
  function osmUrl(p) { if (!isOsm(p)) return 'https://www.openstreetmap.org/#map=19/' + p.la + '/' + p.lo; const t = { n: 'node', w: 'way', r: 'relation' }[p.i[0]]; return 'https://www.openstreetmap.org/' + t + '/' + p.i.slice(1); }
  function osmEditUrl(p) { if (!isOsm(p)) return 'https://www.openstreetmap.org/edit#map=19/' + p.la + '/' + p.lo; const t = { n: 'node', w: 'way', r: 'relation' }[p.i[0]]; return 'https://www.openstreetmap.org/edit?' + t + '=' + p.i.slice(1); }
  function commonsImg(file, width) { return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file.replace(/^(File:)+/i, '')) + '?width=' + (width || 640); }
  function commonsPage(file) { return 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(file.replace(/^(File:)+/i, 'File:').replace(/ /g, '_')); }

  // ---------- Google Maps (odkazy fungují bez API klíče) ----------
  const gmaps = {
    place: (p) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.n + (p.o ? ', ' + p.o : '')),
    point: (p) => 'https://www.google.com/maps/search/?api=1&query=' + p.la + '%2C' + p.lo,
    directions: (p, mode) => 'https://www.google.com/maps/dir/?api=1&destination=' + p.la + '%2C' + p.lo + '&travelmode=' + (mode || 'walking'),
    streetView: (p) => 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + p.la + '%2C' + p.lo,
    embed: (p) => {
      const key = (window.KP_CONFIG || {}).googleMapsApiKey;
      return key ? 'https://www.google.com/maps/embed/v1/place?key=' + key + '&q=' + encodeURIComponent(p.n + ', ' + p.o) + '&center=' + p.la + ',' + p.lo + '&zoom=17&language=cs'
                 : 'https://maps.google.com/maps?q=' + p.la + ',' + p.lo + '&z=17&hl=cs&output=embed';
    },
    route: (a, b) => 'https://www.google.com/maps/dir/?api=1&origin=' + a.la + '%2C' + a.lo + '&destination=' + b.la + '%2C' + b.lo + '&travelmode=walking',
  };

  // ---------- Data ----------
  // Data jsou rozdělená po regionech (14 krajů ČR + 7 vládních obvodů Bavorska): data/regions/index.json
  // + data/regions/<zeme>-<slug>.json. Načítá se jen to, co stránka potřebuje; načtené regiony se drží v cache.
  const ZEME = { cz: 'Česko', de: 'Bavorsko' };
  const ZEME_LONG = { cz: 'Česká republika', de: 'Bavorsko (Německo)' };
  const OSM_DATE = { cz: '2026-10-05', de: '2026-10-07' }; // kdy jsme stáhli OpenStreetMap
  const ok = (r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  let IDX = null, IDXP = null, DATA = null, DATAP = null, TOWNSP = null, IDSP = null;
  const REG = {};            // id regionu → Promise<pole míst>
  const BYID = new Map();    // id místa → místo (z načtených regionů)

  function loadRegionsIndex() {
    if (!IDXP) {
      const pr = fetch('data/regions/index.json').then(ok).then(d => (IDX = d));
      IDXP = pr;
      pr.catch(() => { if (IDXP === pr) IDXP = null; });
    }
    return IDXP;
  }
  function regionMeta(id) { return (IDX || []).find(r => r.id === id) || null; }
  function regionByName(k) { return (IDX || []).find(r => r.nazev === k) || null; }
  function fetchRegionFiles(r) { return Promise.all((r.soubory || [r.soubor]).map(f => fetch(f).then(ok))).then(parts => [].concat(...parts)); }
  function loadRegion(id) {
    if (REG[id]) return REG[id];
    const pr = loadRegionsIndex().then(idx => {
      const r = idx.find(x => x.id === id);
      if (!r) throw new Error('Neznámý region ' + id);
      return fetchRegionFiles(r).then(list => {
        list.forEach(p => { p._r = id; if (!p.z) p.z = r.zeme; BYID.set(p.i, p); });
        return list;
      });
    });
    REG[id] = pr;
    pr.catch(() => { if (REG[id] === pr) delete REG[id]; });
    return pr;
  }
  function isRegionLoaded(id) { return !!REG[id]; }
  // bounds = { s, w, n, e }; bbox regionu = [západ, jih, východ, sever]
  function regionsInBounds(idx, b, zeme) {
    return idx.filter(r => (!zeme || r.zeme === zeme) && !(r.bbox[0] > b.e || r.bbox[2] < b.w || r.bbox[1] > b.n || r.bbox[3] < b.s)).map(r => r.id);
  }
  // Všechna místa z regionů, které zasahují do výřezu (celé regiony; přesný filtr na výřez si dělá stránka).
  // opts.zeme = 'cz' | 'de' omezí načítání na jednu zemi.
  function loadPlacesInBounds(b, opts) {
    const o = opts || {};
    return loadRegionsIndex().then(idx => {
      const ids = b ? regionsInBounds(idx, b, o.zeme) : idx.filter(r => !o.zeme || r.zeme === o.zeme).map(r => r.id);
      return Promise.all(ids.map(loadRegion)).then(parts => [].concat(...parts));
    });
  }
  // Projde všechny regiony (nejvýš 3 najednou) a vrátí jen místa, která projdou filtrem.
  // Regiony, které ještě nejsou v cache, si v paměti nenechává – vhodné pro výpisy jako Ubytování.
  function loadAll(filter, opts) {
    const o = opts || {};
    return loadRegionsIndex().then(idx => {
      const list = idx.filter(r => !o.zeme || r.zeme === o.zeme);
      const out = new Array(list.length);
      let next = 0, done = 0, failed = false;
      return new Promise((resolve, reject) => {
        if (!list.length) { resolve([]); return; }
        const run = () => {
          if (failed || next >= list.length) return;
          const k = next++, r = list[k];
          (REG[r.id] || fetchRegionFiles(r)).then(arr => {
            out[k] = (filter ? arr.filter(filter) : arr).map(p => { p._r = r.id; if (!p.z) p.z = r.zeme; return p; });
            done++;
            if (o.onProgress) o.onProgress(done, list.length);
            if (done === list.length) resolve([].concat(...out)); else run();
          }).catch(e => { failed = true; reject(e); });
        };
        for (let i = 0; i < 3; i++) run();
      });
    });
  }
  // Kompatibilní: všechna místa (Česko i Bavorsko, asi 84 tisíc). Bez indexu regionů spadne na starý data/places.json (jen ČR).
  function loadPlaces() {
    if (DATA) return Promise.resolve(DATA);
    if (!DATAP) {
      const pr = loadPlacesInBounds(null)
        .catch(() => fetch('data/places.json').then(ok).then(d => { d.forEach(p => BYID.set(p.i, p)); return d; }))
        .then(d => (DATA = d));
      DATAP = pr;
      pr.catch(() => { if (DATAP === pr) DATAP = null; });
    }
    return DATAP;
  }
  function loadStats() { return fetch('data/stats.json').then(ok); }
  // Obce: [[název, region, počet míst, jih, západ, sever, východ], …] – hledání obce bez načtení všech regionů
  function loadTowns() {
    if (!TOWNSP) { const pr = fetch('data/regions/obce.json').then(ok); TOWNSP = pr; pr.catch(() => { if (TOWNSP === pr) TOWNSP = null; }); }
    return TOWNSP;
  }
  // Ve kterém regionu místo je (pro staré odkazy bez ?r=); data/regions/ids.json se stahuje jen v takovém případě
  function lookupRegion(id) {
    if (BYID.has(id) && BYID.get(id)._r) return Promise.resolve(BYID.get(id)._r);
    const hint = store.get('placeRegion', {})[id];
    if (hint && regionMeta(hint)) return Promise.resolve(hint);
    if (!IDSP) { const pr = fetch('data/regions/ids.json').then(ok); IDSP = pr; pr.catch(() => { if (IDSP === pr) IDSP = null; }); }
    return IDSP.then(m => { const needle = ',' + id + ','; return Object.keys(m).find(r => (',' + m[r] + ',').includes(needle)) || null; });
  }
  function rememberRegion(p) {
    if (!p || !p._r) return;
    const m = store.get('placeRegion', {});
    if (m[p.i] !== p._r) { m[p.i] = p._r; store.set('placeRegion', m); }
  }
  // Najde místo podle id (a regionu, pokud ho odkaz nese). Vrací null, když místo neexistuje.
  async function findPlace(id, r) {
    if (!id) return null;
    if (BYID.has(id)) return BYID.get(id);
    await loadRegionsIndex().catch(() => null);
    if (!IDX) { const all = await loadPlaces(); return all.find(x => x.i === id) || null; }
    if (r && regionMeta(r)) {
      const p = (await loadRegion(r)).find(x => x.i === id);
      if (p) return p;
    }
    const rr = await lookupRegion(id);
    if (!rr || rr === r || !regionMeta(rr)) return null;
    return (await loadRegion(rr)).find(x => x.i === id) || null;
  }
  async function findPlaces(ids) {
    const out = [];
    for (const id of ids) { const p = await findPlace(id).catch(() => null); if (p) out.push(p); }
    return out;
  }
  function placeUrl(p) { return 'misto.html?id=' + encodeURIComponent(p.i) + (p._r ? '&r=' + encodeURIComponent(p._r) : ''); }
  // Celý název: „Jihočeský kraj“, „Kraj Vysočina“, „Hlavní město Praha“; bavorské vládní obvody beze změny („Horní Bavorsko“)
  function krajName(k, z) {
    if (!k) return '';
    const zz = z || (regionByName(k) || {}).zeme || (/(Bavorsko|Franky|Falc|Švábsko)$/.test(k) ? 'de' : 'cz');
    if (zz === 'de') return k;
    return k === 'Hlavní město Praha' ? k : k === 'Vysočina' ? 'Kraj Vysočina' : k + ' kraj';
  }
  function zemeOf(p) { return p.z || (p._r ? p._r.slice(0, 2) : 'cz'); }

  // ---------- Logo ----------
  const LOGO = '<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="var(--tape)"/><path d="M9 15v10M31 15v10M9 20h22" stroke="var(--tape-ink)" stroke-width="2.6" stroke-linecap="round"/><path d="M15 20v-3M20 20v-5M25 20v-3" stroke="var(--tape-ink)" stroke-width="2" stroke-linecap="round"/></svg>';

  // ---------- Navigace ----------
  // Hlavní položky (desktop hlavička) – ostatní stránky jsou v menu „Více“.
  const NAV = [
    ['mapa.html', 'Mapa'],
    ['ubytovani.html', 'Ubytování'],
    ['trasy.html', 'Trasy'],
    ['kraj.html', 'Kraje'],
    ['pro-firmy.html', 'Pro podniky'],
  ];
  const MORE = [
    ['komunita.html', 'Komunita', 'users'],
    ['metodika.html', 'Jak měříme', 'ruler'],
    ['zdroje.html', 'Zdroje a trh', 'chart'],
    ['o-projektu.html', 'O projektu', 'info'],
    ['pridat.html', 'Přidat nebo upravit místo', 'plus'],
  ];
  // Spodní lišta na mobilu
  const TABS = [
    ['index.html', 'Domů', 'home'],
    ['mapa.html', 'Mapa', 'map'],
    ['ubytovani.html', 'Ubytování', 'bed'],
    ['profil.html', 'Uložené', 'bookmark'],
  ];
  function here() { return location.pathname.split('/').pop() || 'index.html'; }

  function header() {
    const h = here();
    return '<a class="skip-link" href="#main">Přeskočit na obsah</a>' +
      '<div class="demo-bar">Studentský prototyp STENT-IN 2026<span class="hide-md"> · skutečná místa z otevřených dat, Česko a Bavorsko, stav k 7. 10. 2026</span> · <a href="metodika.html#zdroje">Odkud data jsou</a></div>' +
      '<header class="site-header"><div class="inner">' +
      '<a class="brand" href="index.html" aria-label="kudyprojedu.cz – úvod">' + LOGO + '<span>kudyprojedu<span class="dom">.cz</span></span></a>' +
      '<nav class="main-nav" aria-label="Hlavní navigace">' + NAV.map(([href, label]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') +
      '<div class="more"><button class="more-btn" type="button" aria-expanded="false" aria-haspopup="true" data-more>Více ' + icon('chevron') + '</button>' +
      '<div class="more-menu" hidden>' + MORE.map(([href, label, ic]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + icon(ic) + label + '</a>').join('') + '</div></div></nav>' +
      '<div class="header-tools">' +
      '<button class="btn btn-soft btn-sm needs-btn" type="button" data-open-needs aria-label="Moje potřeby">' + icon('sliders') + '<span class="lbl">Moje potřeby</span><span class="dot" data-needs-flag hidden></span></button>' +
      '<a class="btn btn-primary btn-sm hide-md" href="pridat.html">' + icon('plus') + 'Přidat místo</a>' +
      '<a class="icon-btn hide-md" href="profil.html" aria-label="Můj profil a uložená místa">' + icon('user') + '</a>' +
      '</div></div></header>';
  }

  function tabbar() {
    const h = here();
    return '<nav class="tabbar" aria-label="Spodní navigace">' +
      TABS.map(([href, label, ic]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + icon(ic) + label + '</a>').join('') +
      '<button type="button" data-open-more aria-label="Další stránky a nastavení">' + icon('menu') + 'Více</button></nav>';
  }

  function moreSheet() {
    const h = here();
    const theme = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const wrap = document.createElement('div');
    const links = NAV.concat(MORE.map(x => [x[0], x[1], x[2]]));
    const icons = { 'mapa.html': 'map', 'ubytovani.html': 'bed', 'trasy.html': 'route', 'kraj.html': 'globe', 'pro-firmy.html': 'building' };
    wrap.innerHTML = '<div class="sheet-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="more-title"><div class="grip"></div>' +
      '<header><h2 id="more-title">Všechny stránky</h2><button class="icon-btn" type="button" data-close aria-label="Zavřít">' + icon('close') + '</button></header>' +
      '<div class="body"><div class="menu-list">' +
      links.map(([href, label, ic]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + icon(ic || icons[href] || 'arrow') + label + '</a>').join('') +
      '<a href="profil.html">' + icon('user') + 'Můj profil a uložená místa</a>' +
      '<div class="menu-sep"></div>' +
      '<button type="button" data-open-needs>' + icon('sliders') + 'Moje potřeby</button>' +
      '<button type="button" data-theme-toggle>' + icon(theme === 'dark' ? 'sun' : 'moon') + (theme === 'dark' ? 'Světlý režim' : 'Tmavý režim') + '</button>' +
      '</div></div></div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    wrap.querySelector('[data-open-needs]').addEventListener('click', () => { close(); needsDrawer(); });
    wrap.querySelector('[data-theme-toggle]').addEventListener('click', () => { toggleTheme(); close(); });
    wrap.querySelector('a').focus();
  }

  function footer() {
    return '<footer class="site-footer"><div class="wrap"><div class="cols">' +
      '<div><a class="brand" href="index.html">' + LOGO + '<span>kudyprojedu<span class="dom">.cz</span></span></a><p class="small muted" style="margin-top:12px;max-width:34ch">Přístupnost v centimetrech, ne v nálepkách. Mapa míst pro lidi na vozíku a s omezenou pohyblivostí v Česku a v Bavorsku.</p>' +
      '<div class="footer-tools"><button class="btn btn-ghost btn-sm" type="button" data-theme-toggle>' + icon('moon') + 'Světlý / tmavý režim</button></div></div>' +
      '<div><h4>Hledat</h4><ul><li><a href="mapa.html">Mapa míst</a></li><li><a href="ubytovani.html">Ubytování</a></li><li><a href="mapa.html#wc">Veřejné WC</a></li><li><a href="trasy.html">Bariéry v ulicích</a></li><li><a href="kraj.html">Kraje</a></li></ul></div>' +
      '<div><h4>Přispět</h4><ul><li><a href="pridat.html">Přidat nebo upravit místo</a></li><li><a href="metodika.html#mereni">Jak měřit dveře a schody</a></li><li><a href="komunita.html">Komunita</a></li><li><a href="profil.html">Můj profil</a></li></ul></div>' +
      '<div><h4>Pro organizace</h4><ul><li><a href="pro-firmy.html">Pro podniky</a></li><li><a href="pro-firmy.html#obce">Pro obce a kraje</a></li><li><a href="pro-firmy.html#cenik">Ceník</a></li><li><a href="zdroje.html">Zdroje a trh</a></li></ul></div>' +
      '<div><h4>Projekt</h4><ul><li><a href="o-projektu.html">O projektu</a></li><li><a href="o-projektu.html#plan">Plán rozvoje</a></li><li><a href="metodika.html">Jak měříme</a></li><li><a href="metodika.html#soukromi">Soukromí a GDPR</a></li></ul><div class="partner-logos"><span>VŠTE ČB</span><span>OTH Regensburg</span><span>Interreg BY–CZ</span></div></div>' +
      '</div><div class="legal"><span>© 2026 kudyprojedu.cz – studentský projekt STENT-IN</span><span>Data © přispěvatelé OpenStreetMap (ODbL), Mapy bez bariér, Brno a IPR Praha (CC BY), Statutární město Ostrava (CC BY-SA 4.0) · Bavorsko: DB InfraGO OpenStation (CC0), Landeshauptstadt München a Stadt Würzburg (dl-de/by-2-0), Stadt Haar (CC BY 4.0), BayernCloud Tourismus (CC BY 4.0 a CC0) · fotky Wikimedia Commons · mapy Google · <a href="zdroje.html#bavorsko">Všechny zdroje a licence</a></span></div></div></footer>';
  }

  // ---------- Panel „Moje potřeby“ ----------
  function needsDrawer() {
    const n = getNeeds();
    const aids = ['mechanický vozík', 'elektrický vozík', 'vozík s přídavným pohonem', 'chodítko', 'berle', 'kočárek'];
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div class="drawer-backdrop" data-close></div>' +
      '<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="needs-title"><header><h2 id="needs-title">Moje potřeby</h2><button class="icon-btn" type="button" data-close aria-label="Zavřít">' + icon('close') + '</button></header>' +
      '<div class="body">' +
      '<p class="muted small" style="margin:0">Podle toho u každého místa uvidíte, jestli vám vyhovuje. Nastavení zůstává jen ve vašem prohlížeči – na server nic neposíláme, protože jde o údaj o zdraví.</p>' +
      '<div class="field"><label for="n-aid">Čím se pohybuji</label><select id="n-aid">' + aids.map(a => '<option' + (a === n.aid ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></div>' +
      '<fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:600;margin-bottom:6px">Co potřebuji</legend>' +
      '<label class="check"><input type="checkbox" id="n-lim"' + (n.acceptLimited ? ' checked' : '') + '> Zvládnu i „částečně přístupné“ místo (jeden schod do 7 cm, s doprovodem)</label>' +
      '<label class="check"><input type="checkbox" id="n-wc"' + (n.needWc ? ' checked' : '') + '> Potřebuji bezbariérovou toaletu</label>' +
      '<label class="check"><input type="checkbox" id="n-park"' + (n.needParking ? ' checked' : '') + '> Potřebuji parkovací místo pro ZTP</label>' +
      '<label class="check"><input type="checkbox" id="n-chk"' + (n.onlyChecked ? ' checked' : '') + '> Věřím jen údajům ověřeným na místě (s datem kontroly)</label></fieldset>' +
      '<p class="callout small" style="margin:0">Šířky dveří a výšky schodů v centimetrech zatím u většiny míst chybí – v otevřených datech je zadalo jen málo lidí. Jakmile je doplníme měřením, přidáme sem i limity v cm.</p>' +
      '</div><footer><button class="btn btn-ghost" type="button" data-reset>Vypnout</button><button class="btn btn-primary" type="button" data-save style="flex:1">Uložit a použít</button></footer></aside>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    wrap.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
    wrap.querySelector('[data-save]').addEventListener('click', () => {
      setNeeds({
        active: true, aid: wrap.querySelector('#n-aid').value,
        acceptLimited: wrap.querySelector('#n-lim').checked, needWc: wrap.querySelector('#n-wc').checked,
        needParking: wrap.querySelector('#n-park').checked, onlyChecked: wrap.querySelector('#n-chk').checked,
      });
      close(); toast('Potřeby uloženy – místa teď hodnotíme podle vás.');
    });
    wrap.querySelector('[data-reset]').addEventListener('click', () => { setNeeds(Object.assign(getNeeds(), { active: false })); close(); toast('Hodnocení podle potřeb je vypnuté.'); });
    wrap.querySelector('#n-aid').focus();
  }

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }

  // ---------- Uložená místa ----------
  const saved = {
    all: () => store.get('saved', []),
    has: (id) => saved.all().includes(id),
    toggle: (id, p) => { const s = saved.all(); const i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else { s.push(id); rememberRegion(p || BYID.get(id)); } store.set('saved', s); return i < 0; },
  };

  // ---------- Téma ----------
  function applyTheme(t) { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme(store.get('theme', null));

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); store.set('theme', next);
  }
  function mount() {
    const h = document.getElementById('site-header'); if (h) h.outerHTML = header();
    const f = document.getElementById('site-footer'); if (f) f.outerHTML = footer();
    if (!document.querySelector('.tabbar') && !document.body.hasAttribute('data-no-tabbar')) document.body.insertAdjacentHTML('beforeend', tabbar());
    document.querySelectorAll('.site-footer [data-theme-toggle]').forEach(b => b.addEventListener('click', toggleTheme));
    const mb = document.querySelector('[data-more]');
    if (mb) {
      const menu = mb.nextElementSibling;
      const set = (open) => { menu.hidden = !open; mb.setAttribute('aria-expanded', open); };
      mb.addEventListener('click', (e) => { e.stopPropagation(); set(menu.hidden); });
      document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) set(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    }
    document.querySelectorAll('[data-open-more]').forEach(b => b.addEventListener('click', moreSheet));
    document.querySelectorAll('[data-open-needs]').forEach(b => b.addEventListener('click', needsDrawer));
    const flag = () => { document.querySelectorAll('[data-needs-flag]').forEach(f => { f.hidden = !getNeeds().active; }); };
    flag(); document.addEventListener('kp:needs', flag);
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon) + el.innerHTML; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function placeById(id) { return BYID.get(id) || (DATA || []).find(p => p.i === id); }
  function distanceKm(a, b) {
    const R = 6371, dLat = (b.la - a.la) * Math.PI / 180, dLng = (b.lo - a.lo) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.la * Math.PI / 180) * Math.cos(b.la * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  window.KP = { store, icon, CATS, SOURCES, W, T, FIELDS, getNeeds, setNeeds, completeness, missingFields, match, generalStatus, STATUS_LABEL, STATUS_SHORT,
    fmt, fmtDate, ageLabel, sourceBadge, statusHtml, isOsm, osmUrl, osmEditUrl, commonsImg, commonsPage, gmaps, loadPlaces, loadStats, loadRegionsIndex, loadRegion, loadPlacesInBounds, loadAll, loadTowns, findPlace, findPlaces, placeUrl, rememberRegion, regionMeta, regionByName, isRegionLoaded, krajName, zemeOf, ZEME, ZEME_LONG, OSM_DATE, toast, saved, needsDrawer, esc, placeById, distanceKm, LOGO, moreSheet, toggleTheme };
})();
