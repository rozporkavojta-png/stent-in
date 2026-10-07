/* kudyprojedu.cz – sdílené jádro: hlavička, patička, ikony, profil potřeb, hodnocení míst. */
(function () {
  'use strict';
  // Překlady (assets/js/i18n.js). Bez něj zůstane čeština.
  const KPI = window.KP || {};
  const t = KPI.t || function (k, p) { return String(k).replace(/\{(\w+)\}/g, (m, x) => (p && p[x] != null ? p[x] : m)); };
  const LANG = KPI.lang ? KPI.lang() : 'cs';
  if (KPI.i18n) KPI.i18n.apply(document);

  // ---------- Úložiště (bezpečně, funguje i bez localStorage) ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('kp.' + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    // Vrací true, když se zápis povedl (false = úložiště chybí nebo je plné)
    set(key, val) { try { localStorage.setItem('kp.' + key, JSON.stringify(val)); return true; } catch (e) { return false; } },
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
    ubytovani: { label: t('Ubytování'), icon: 'bed' },
    restaurace: { label: t('Restaurace a kavárny'), icon: 'food' },
    wc: { label: t('Veřejné WC'), icon: 'wc' },
    pamatky: { label: t('Památky a muzea'), icon: 'museum' },
    kultura: { label: t('Kultura'), icon: 'theater' },
    priroda: { label: t('Příroda a vyhlídky'), icon: 'tree' },
    sport: { label: t('Sport a bazény'), icon: 'star' },
    zdravi: { label: t('Zdravotnictví a lékárny'), icon: 'pharmacy' },
    urady: { label: t('Úřady, pošty, info'), icon: 'building' },
    doprava: { label: t('Nádraží'), icon: 'route' },
    obchody: { label: t('Obchody'), icon: 'bookmark' },
    parkovani: { label: t('Parkování ZTP'), icon: 'parking' },
  };
  // Zdroje dat – u každého údaje je vidět, odkud pochází
  const SOURCES = {
    overeno: { label: t('Ověřeno nezávisle'), short: t('Ověřeno'), cls: 'badge-verified', icon: 'shield', desc: t('Naměřil proškolený mapovač podle metodiky kategorizace přístupnosti.') },
    komunita: { label: t('Zadala komunita (OpenStreetMap)'), short: 'OpenStreetMap', cls: 'badge-community', icon: 'users', desc: t('Údaj zadali dobrovolníci do OpenStreetMap. Stejná data používá Wheelmap.org.') },
    firma: { label: t('Uvedl provozovatel'), short: t('Provozovatel'), cls: 'badge-business', icon: 'building', desc: t('Údaj vyplnil provozovatel přes profil podniku.') },
  };
  const W = { // OSM tag wheelchair=*
    yes: { st: 'ok', label: t('Přístupné na vozíku'), short: t('Přístupné'), help: t('Vstup bez schodů a hlavní prostory jsou dostupné na vozíku.') },
    limited: { st: 'part', label: t('Částečně přístupné'), short: t('Částečně'), help: t('Nejvýš jeden nízký schod (do 7 cm) nebo jen část prostor bez bariér.') },
    no: { st: 'no', label: t('Nepřístupné na vozíku'), short: t('Nepřístupné'), help: t('Vstup se schody nebo hlavní prostory nejsou dostupné na vozíku.') },
    null: { st: 'unk', label: t('Přístupnost vstupu neuvedena'), short: t('Neuvedeno'), help: t('Pro vstup zatím nikdo údaj nezadal.') },
  };
  const T = { yes: { st: 'ok', label: t('Bezbariérové WC') }, limited: { st: 'part', label: t('WC částečně přístupné') }, no: { st: 'no', label: t('WC není bezbariérové') }, null: { st: 'unk', label: t('WC neuvedeno') } };

  // ---------- Profil potřeb ----------
  // Uloženo v localStorage pod kp.needs. Starší uložené profily (jen active, aid, acceptLimited, needWc, needParking,
  // onlyChecked) se doplní výchozími hodnotami, nic se neztratí.
  const AIDS = ['mechanický vozík', 'elektrický vozík', 'vozík s přídavným pohonem', 'chodítko', 'berle', 'kočárek', 'jiné'];
  const DEFAULT_NEEDS = {
    v: 2, active: false, aid: 'mechanický vozík', aidOther: '',
    doorMin: null, stepMax: null, slopeMax: null,            // cm, cm, % (null = bez limitu)
    needLift: false, needWc: false, needParking: false,
    needShower: false, needGrabBars: false, needShowerSeat: false,
    acceptLimited: false, onlyChecked: false,
  };
  const NEED_FLAGS = ['active', 'needLift', 'needWc', 'needParking', 'needShower', 'needGrabBars', 'needShowerSeat', 'acceptLimited', 'onlyChecked'];
  function numOrNull(x) {
    if (x === '' || x === null || x === undefined || x === false) return null;
    const n = Number(String(x).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  }
  function normNeeds(raw) {
    const n = Object.assign({}, DEFAULT_NEEDS, raw && typeof raw === 'object' ? raw : {});
    ['doorMin', 'stepMax', 'slopeMax'].forEach(k => { n[k] = numOrNull(n[k]); });
    NEED_FLAGS.forEach(k => { n[k] = !!n[k]; });
    if (!AIDS.includes(n.aid)) { if (!n.aidOther && n.aid) n.aidOther = String(n.aid); n.aid = 'jiné'; }
    n.aidOther = String(n.aidOther || '').slice(0, 60);
    n.v = 2;
    return n;
  }
  // Potřeby se čtou z localStorage jen jednou (mapa se ptá u každé značky); změna v jiné záložce cache zneplatní
  let needsCache = null;
  try { window.addEventListener('storage', e => { if (!e.key || e.key === 'kp.needs') needsCache = null; }); } catch (e) {}
  function getNeeds() { if (!needsCache) needsCache = normNeeds(store.get('needs', {})); return Object.assign({}, needsCache); }
  function setNeeds(n) { const v = normNeeds(n); store.set('needs', v); needsCache = v; document.dispatchEvent(new CustomEvent('kp:needs', { detail: v })); return v; }
  function aidLabel(n) { return n.aid === 'jiné' ? (n.aidOther || t('jiná pomůcka')) : t(n.aid); }

  // ---------- Hodnocení místa (jen z údajů, které opravdu máme) ----------
  // Úplnost profilu: kolik údajů důležitých pro rozhodnutí je vyplněno. Neříká nic o tom, zda je místo přístupné.
  const FIELDS = [
    ['w', t('Přístupnost vstupu')], ['t', t('Toaleta')], ['d', t('Slovní popis přístupnosti')], ['sc', t('Počet schodů u vstupu')],
    ['dw', t('Šířka dveří')], ['rp', t('Rampa')], ['pk', t('Parkování ZTP')], ['img', t('Fotografie')], ['oh', t('Otevírací doba')],
    ['web', t('Web nebo telefon')], ['cd', t('Datum kontroly na místě')],
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

  // ---------- Sjednocené údaje o přístupnosti („fakta“) ----------
  // Z různých polí jednoho místa (OSM značky w, t, sc, rp, dw, pk, pw; naměřené řádky x z otevřených dat; rešerše webů
  // provozovatelů r.items / r.measurements; profil podniku vyplněný v tomto prohlížeči) skládá jednotný přehled.
  // Každý údaj nese hodnotu a zdroj: overeno (otevřená data s měřením), komunita (OpenStreetMap), firma (provozovatel).
  // Hodnota prvku: true = místo prvek prokazatelně má, 'part' = jen částečně, false = prokazatelně nemá,
  // 'na' = netýká se (např. výtah u místa s jediným podlažím), null = nevíme.
  // Když se zdroje liší, má přednost ověřený zdroj, potom OpenStreetMap, potom provozovatel.
  const AREAS = { vstup: t('Vstup'), wc: 'WC', interier: t('Pohyb uvnitř'), parkovani: t('Parkování'), pokoj: t('Pokoj a koupelna') };
  const FEATURES = [
    { k: 'bezSchodu', a: 'vstup', label: t('Vstup bez schodů nebo s rampou') },
    { k: 'dvere80', a: 'vstup', label: t('Vstupní dveře alespoň 80 cm') },
    { k: 'prah2', a: 'vstup', label: t('Práh u vstupu nejvýš 2 cm') },
    { k: 'wcBb', a: 'wc', label: t('Bezbariérové WC') },
    { k: 'wcDvere80', a: 'wc', label: t('Dveře WC alespoň 80 cm') },
    { k: 'wcMadla', a: 'wc', label: t('Madla u WC') },
    { k: 'wcOtoceni', a: 'wc', label: t('Plocha 150 × 150 cm na WC') },
    { k: 'prostory', a: 'interier', label: t('Hlavní prostory přístupné') },
    { k: 'vytah', a: 'interier', label: t('Výtah nebo plošina') },
    { k: 'pruchody80', a: 'interier', label: t('Dveře a průchody uvnitř alespoň 80 cm') },
    { k: 'otoceni', a: 'interier', label: t('Prostor pro otočení vozíku') },
    { k: 'parkZTP', a: 'parkovani', label: t('Vyhrazené stání pro ZTP') },
    { k: 'parkSirka', a: 'parkovani', label: t('Stání široké alespoň 3,5 m') },
    { k: 'pokojBb', a: 'pokoj', label: t('Bezbariérový pokoj') },
    { k: 'pokojDvere80', a: 'pokoj', label: t('Dveře pokoje alespoň 80 cm') },
    { k: 'sprcha', a: 'pokoj', label: t('Sprcha v úrovni podlahy') },
    { k: 'sedatko', a: 'pokoj', label: t('Sedátko ve sprše') },
    { k: 'koupelnaMadla', a: 'pokoj', label: t('Madla v koupelně') },
  ];
  const FEATURE = {}; FEATURES.forEach(f => { FEATURE[f.k] = f; });
  // Naměřené hodnoty (m): klíč → [popis, jednotka, jak sloučit více údajů z jednoho zdroje]
  const MEASURES = {
    dvereCm: [t('Šířka vstupních dveří'), 'cm', 'min'], pruchodyCm: [t('Nejužší dveře a průchody'), 'cm', 'min'],
    prahCm: [t('Práh nebo schod u vstupu'), 'cm', 'max'], schody: [t('Počet schodů u vstupu'), t('schodů'), 'max'],
    sklonPct: [t('Největší sklon cesty nebo rampy'), '%', 'max'], wcDvereCm: [t('Šířka dveří WC'), 'cm', 'max'],
    parkMist: [t('Vyhrazená stání ZTP'), t('míst'), 'max'], parkSirkaCm: [t('Šířka stání'), 'cm', 'max'],
    vytahKabina: [t('Kabina výtahu (š × hl)'), 'cm', 'first'], pokojDvereCm: [t('Šířka dveří pokoje'), 'cm', 'min'],
    pokojuBb: [t('Bezbariérové pokoje'), t('ks'), 'max'], postelVyskaCm: [t('Výška postele'), 'cm', 'first'],
    postelProstorCm: [t('Volný prostor vedle postele'), 'cm', 'max'], sprchaSirkaCm: [t('Šířka sprchového koutu'), 'cm', 'max'],
  };
  const SRC_PRIO = { overeno: 0, komunita: 1, firma: 2 };
  const VAL_RANK = { true: 3, part: 2, na: 1, false: 0 };

  const numIn = (s) => { const m = String(s).replace(/(\d)\s+(\d{3})/g, '$1$2').match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };
  const numsIn = (s) => (String(s).match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
  // „110 × 140 cm“ → [110, 140]; „5 × 3,5 m“ → [500, 350]
  function dimsCm(s) { const n = numsIn(s); if (n.length < 2) return null; const k = /\bm\b/.test(s) && !/cm/.test(s) ? 100 : 1; return [n[0] * k, n[1] * k]; }
  function ynv(s) {
    const t = String(s).trim().toLowerCase();
    if (/^(ne|no|nein|chybí|není)(?=[\s,.;:(]|$)/.test(t)) return false;
    if (/částečn|s asistencí|teilweise/.test(t)) return 'part';
    if (/^(ano|yes|ja|bezbariérov|přístupn)/.test(t)) return true;
    return null;
  }
  // Klasifikace krátkého textu z rešerše webu provozovatele (česká parafráze). Hrubé, proto zdroj vždy „provozovatel“.
  function textClaim(s) {
    if (!s) return null;
    const t = String(s).toLowerCase().replace(/bez schod\w*|bez bariér\w*|bezprahov\w*|nem(á|ají) žádn\w* bariér\w*/g, 'bezbariérový');
    if (/bez zmínky|neuvádí|neuvedeno|nespecifik|nejasn/.test(t)) return null;
    if (/(pouze|jen|výhradně) po schodech|bez výtahu|nepřístupn/.test(t)) return false;
    if (/částečn|zčásti|ne zcela|není zcela|nejsou zcela|ne všechn|s asistencí|s pomocí|s doprovodem|po domluvě|po dohodě|schod|omezen[ěá] přístup/.test(t)) return 'part';
    // zápor jen tehdy, když se týká přístupnosti (ne „další toalety nejsou“ v jiné části věty)
    // (\b v JS nefunguje u písmen s diakritikou, proto hranice slova přes mezery a interpunkci)
    if (/(^|\s)(není|nejsou|nemá|nemají|chybí)(?=[\s.,;:)]|$)[^.;,]{0,25}(bezbariér|přístupn|vozík|výtah)|(bezbariér|přístupn)[^\s.;,]*[^.;,]{0,40}\s(není|nejsou|chybí)(?=[\s.,;:)]|$)(?! třeba| potřeba)|(^|\s)(?<!další )(wc|toalet[^\s.,;]*) (v objektu |zde |tu )?(není|nejsou|chybí)(?=[\s.,;:)]|$)/.test(t)) return false;
    if (/bezbariér|přístupn|vozík|vozíčk|rampa|plošin|výtah|pro osoby s|pro hosty s|ztp|invalid|upraven|přizpůsoben|handicap/.test(t)) return true;
    return null;
  }
  function liftClaim(s) {
    const t = String(s || '').toLowerCase();
    if (!t) return null;
    if (/jednopodlažn|výtah (není|je) (třeba|potřeba)|netřeba|vše v přízemí|jen přízemí/.test(t)) return 'na';
    if (/bez výtahu|nemá výtah|není výtah|výtah (chybí|není)|žádný výtah|nevede výtah/.test(t)) return false;
    if (/výtah|plošin/.test(t)) return true;
    return null;
  }
  function parkingClaim(s) {
    const t = String(s || '').toLowerCase();
    if (!t || /bez zmínky|neuvádí|nespecifik/.test(t)) return null;
    if (/(nemá|není|chybí|žádn\w*) [^.;,(]{0,30}(ztp|vyhrazen|invalid)/.test(t)) return false;
    if (/ztp|vyhrazen|invalid|vozíčk|pro (osoby|hosty|držitele|návštěvníky) s|behinderten|označen/.test(t)) return true;
    return null;
  }
  const showerText = (t) => /sprch/.test(t) && /(bezbariér|v úrovni|bez vaničky|bez okraje|bez obrubník|sjízdn|bezprah|walk-in|bez schod|bez bariér|bez vany)/.test(t);

  function srcBase(p) { return (p.nw || /^rh[0-9a-f]+$/.test(p.i)) ? 'firma' : isOsm(p) ? 'komunita' : (p.x && p.x.length ? 'overeno' : 'komunita'); }

  // Sběr kandidátů: C[klíč] = [{v, src, note, url, local}]
  function collectFacts(p) {
    const F = {}, M = {}, hotel = [];
    const f = (k, v, src, note, extra) => { if (v === null || v === undefined) return; (F[k] = F[k] || []).push(Object.assign({ v, src, note: note || '' }, extra || {})); };
    const m = (k, v, src, note, extra) => { if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return; (M[k] = M[k] || []).push(Object.assign({ v, src, note: note || '' }, extra || {})); };

    // 1) Naměřené řádky z otevřených dat (Mapy bez bariér, IPR Praha, Brno, Ostrava, DB, Mnichov, Würzburg…)
    (Array.isArray(p.x) ? p.x : []).forEach(x => {
      const S = 'overeno', ex = { url: x.url || '', date: x.date || '', label: x.label || '' };
      const rows = x.rows || [];
      const parallel = rows.some(r => r[0] === 'Typ stání' && /podéln/i.test(r[1]));
      const cabins = []; // rozměry kabin WC: plochu 150 × 150 vylučují, jen když jsou všechny kabiny užší
      rows.forEach(([L, V]) => {
        const v = String(V == null ? '' : V), l = String(L);
        let y;
        if (/^Kategorie přístupnosti$/.test(l)) {
          y = /nepřístup|obtížně/i.test(v) ? false : /částečn|asistenc/i.test(v) ? 'part' : /přístupn/i.test(v) ? true : null;
          f('bezSchodu', y, S, l + ': ' + v, ex); f('prostory', y, S, l + ': ' + v, ex);
        } else if (/StepFreeAccess|Přístup pro vozík \(celá stanice\)|Bezbariérovost volební místnosti/.test(l)) {
          y = ynv(v); f('bezSchodu', y, S, l + ': ' + v, ex); if (!/StepFree/.test(l)) f('prostory', y, S, l + ': ' + v, ex);
        } else if (/^Označení bezbariérovosti/.test(l)) {
          y = /teilweise|eingeschränkt|bedingt/i.test(v) ? 'part' : /barrierefrei|rollstuhl/i.test(v) ? true : null;
          f('bezSchodu', y, S, l + ': ' + v, ex); f('prostory', y, S, l + ': ' + v, ex);
        } else if (/^Bezbariérovost \(údaj IPR\)$/.test(l)) f('wcBb', ynv(v), S, (t('Bezbariérovost WC (IPR Praha)') + ': ') + v, ex);
        else if (/^WC( \d+)?: kategorie$/.test(l)) f('wcBb', /nepřístup/i.test(v) ? false : /částečn/i.test(v) ? 'part' : /přístupn/i.test(v) ? true : null, S, l + ': ' + v, ex);
        else if (l === 'WC') f('wcBb', ynv(v), S, (t('Bezbariérové WC') + ': ') + v, ex);
        else if (/^WC pro vozíčkáře$/.test(l)) f('wcBb', numIn(v) > 0 ? true : null, S, l, ex);
        else if (/^Kabiny podle zdroje$/.test(l)) f('wcBb', /bezbariér/i.test(v) ? true : null, S, (t('Kabiny') + ': ') + v, ex);
        else if (/^WC( \d+)?: dveře$|^Šířka dveří do WC$|dveře kabiny WC – šířka$|kabina( \d+)?: vstupní dveře – šířka$/.test(l)) m('wcDvereCm', numIn(v), S, l, ex);
        else if (/^WC( \d+)?: kabina \(š × hl\)$|^Místnost WC/.test(l)) { const d = dimsCm(v); if (d) cabins.push([Math.min(d[0], d[1]), l + ': ' + v]); }
        else if (/Manipulační plocha|otáčecí prostor/.test(l)) {
          const d = dimsCm(v) || (numIn(v) != null ? [numIn(v), numIn(v)] : null);
          if (d) f('wcOtoceni', Math.min(d[0], d[1]) >= 150, S, l + ': ' + v, ex);
        } else if (/Madla u mísy|sklopná madla/.test(l)) f('wcMadla', /^\s*ne\b/i.test(v) ? false : true, S, l + ': ' + v, ex);
        else if (/^Šířka hlavního křídla dveří \(vstup\)$|^Druhé dveře vstupu, hlavní křídlo$/.test(l)) m('dvereCm', numIn(v), S, l, ex);
        else if (/^Práh u dveří vstupu$/.test(l)) m('prahCm', numIn(v), S, l, ex);
        else if (/^Podélný sklon u vstupu|Podélný sklon \(údaj TSK\)|Příčný sklon \(údaj TSK\)|sklon rampy \(údaj zdroje\)|^Rampa u vstupu – sklon/.test(l)) { const n = numsIn(v); if (n.length) m('sklonPct', Math.max(...n), S, l + ': ' + v, ex); }
        else if (/^Rampa, rameno/.test(l)) { const s = v.match(/sklon ([\d,.]+)/); if (s) m('sklonPct', parseFloat(s[1].replace(',', '.')), S, l + ': ' + v, ex); }
        else if (/^Výtah: kabina|^Výtah – kabina|výtah – kabina/.test(l)) { f('vytah', true, S, l + ': ' + v, ex); m('vytahKabina', v, S, l, ex); }
        else if (/^Výtahy \(počet\)$/.test(l)) f('vytah', numIn(v) > 0 ? true : null, S, l + ': ' + v, ex);
        else if (/^Výtah: dveře$|Bezbariérová kabina: výtah$|schodišťová plošina$/.test(l)) f('vytah', /^\s*ne\b/i.test(v) ? null : true, S, l + ': ' + v, ex);
        else if (/^Vyhrazené parkování u vstupu$/.test(l)) { y = ynv(v); f('parkZTP', y, S, l + ': ' + v, ex); if (y) m('parkMist', numIn(v), S, l, ex); }
        else if (/^Vyhrazená stání pro OZP v okolí$|^Vyhrazená stání pro osoby s postižením$/.test(l)) { const n = numIn(v); f('parkZTP', n > 0 ? true : n === 0 ? false : null, S, l + ': ' + v, ex); m('parkMist', n, S, l, ex); }
        else if (/^Rozměr stání \(délka × šířka\)$/.test(l) && !parallel) { const d = dimsCm(v); if (d) m('parkSirkaCm', d[1], S, l + ': ' + v, ex); }
      });
      if (cabins.length && cabins.every(c => c[0] < 150)) f('wcOtoceni', false, S, cabins.map(c => c[1]).join('; '), ex);
    });

    // 2) Značky OpenStreetMap a pole převzatá při sestavení dat
    const B = srcBase(p);
    if (p.c !== 'parkovani') {
      const wv = p.w === 'yes' ? true : p.w === 'limited' ? 'part' : p.w === 'no' ? false : null;
      f('bezSchodu', wv, B, W[p.w || 'null'].label); f('prostory', wv, B, W[p.w || 'null'].label);
      if (p.c === 'wc' && !p.t) f('wcBb', wv, B, W[p.w || 'null'].label);
    }
    if (p.t) f('wcBb', p.t === 'yes' ? true : p.t === 'limited' ? 'part' : false, B, T[p.t].label);
    if (typeof p.sc === 'number') { m('schody', p.sc, B, t('Počet schodů u vstupu')); if (p.sc === 0) f('bezSchodu', true, B, t('Žádný schod u vstupu')); }
    if (p.rp === 'yes') f('bezSchodu', true, B, t('Rampa u vstupu'));
    if (p.dw) m('dvereCm', p.dw, B, t('Šířka dveří'));
    if (p.c === 'parkovani') f('parkZTP', true, B, t('Vyhrazené stání pro ZTP'));
    if (p.pk > 0) { f('parkZTP', true, B, p.pk + (' ' + t('vyhrazených stání ZTP'))); m('parkMist', p.pk, B, t('Vyhrazená stání ZTP')); }
    if (p.pw === 'yes' || p.pw === 'no') f('parkZTP', p.pw === 'yes', B, (t('Parkování pro vozíčkáře') + ': ') + (p.pw === 'yes' ? t('ano') : t('ne')));

    // 3) Rešerše webů provozovatelů (pole r): texty po oblastech a čísla s jednotkou
    (Array.isArray(p.r) ? p.r : []).forEach(r => {
      const S = 'firma', ex = { url: r.url || '', date: r.date || '', label: r.source_type || 'web provozovatele' };
      const it = r.items || {};
      if (it.vstup) f('bezSchodu', textClaim(it.vstup), S, it.vstup, ex);
      else if (r.claim && r.claim !== 'unknown') f('bezSchodu', r.claim === 'yes' ? true : r.claim === 'limited' ? 'part' : false, S, r.quote || '', ex);
      if (r.claim && r.claim !== 'unknown') f('prostory', r.claim === 'yes' ? true : r.claim === 'limited' ? 'part' : false, S, r.quote || '', ex);
      if (it.vytah) f('vytah', liftClaim(it.vytah), S, it.vytah, ex);
      if (it.wc) { f('wcBb', textClaim(it.wc), S, it.wc, ex); if (/madl/i.test(it.wc) && !/bez madel|madla chyb/i.test(it.wc)) f('wcMadla', true, S, it.wc, ex); }
      if (it.parkovani) f('parkZTP', parkingClaim(it.parkovani), S, it.parkovani, ex);
      if (it.pokoj) f('pokojBb', textClaim(it.pokoj), S, it.pokoj, ex);
      const bath = ((it.koupelna || '') + ' ' + (it.pokoj || '')).toLowerCase();
      if (bath.trim()) {
        if (showerText(bath)) f('sprcha', true, S, it.koupelna || it.pokoj, ex);
        if (/sprch/.test(bath) && /(sedát|sedačk|sedadl|stoličk)/.test(bath)) f('sedatko', true, S, it.koupelna || it.pokoj, ex);
        if (/madl/.test(bath) && !/bez madel/.test(bath)) f('koupelnaMadla', true, S, it.koupelna || it.pokoj, ex);
      }
      if (it.pokoj || it.koupelna) hotel.push(Object.assign({ pokoj: it.pokoj || '', koupelna: it.koupelna || '' }, ex));
      (Array.isArray(r.measurements) ? r.measurements : []).forEach(q => {
        const co = String(q.co || '').toLowerCase(), u = q.jednotka, v = Number(q.hodnota);
        if (!isFinite(v)) return;
        if (u === 'cm' && /šířka/.test(co) && /(vstup|dveří pro vozík|křídla vstupních)/.test(co)) m('dvereCm', v, S, q.co, ex);
        else if (u === 'cm' && /šířka dveří a průchodů/.test(co)) m('pruchodyCm', v, S, q.co, ex);
        else if (u === 'cm' && /šířka dveří/.test(co) && /(wc|toalet|kabin)/.test(co)) m('wcDvereCm', v, S, q.co, ex);
        else if (u === 'cm' && /šířka dveří/.test(co) && /pokoj/.test(co)) m('pokojDvereCm', v, S, q.co, ex);
        else if (u === 'cm' && /(výška prahu|práh|výška schodu)/.test(co)) m('prahCm', v, S, q.co, ex);
        else if (u === '%' && /sklon/.test(co)) m('sklonPct', v, S, q.co, ex);
        else if (/výtah/.test(co)) f('vytah', true, S, q.co + ' ' + v + ' ' + u, ex);
        else if (u === 'ks' && /(parkovac|stání|parkovišt)/.test(co)) { m('parkMist', v, S, q.co, ex); f('parkZTP', v > 0 ? true : false, S, q.co + ': ' + v, ex); }
        else if (u === 'ks' && /bezbariérové pokoj/.test(co)) { m('pokojuBb', v, S, q.co, ex); f('pokojBb', v > 0, S, q.co + ': ' + v, ex); }
        else if (u === 'cm' && /(postel|lůžk)/.test(co) && /výška/.test(co)) m('postelVyskaCm', v, S, q.co, ex);
        else if (u === 'cm' && /(postel|lůžk)/.test(co)) m('postelProstorCm', v, S, q.co, ex);
        else if (u === 'cm' && /sprch/.test(co) && /šířka/.test(co)) m('sprchaSirkaCm', v, S, q.co, ex);
        else if (u === 'cm' && /(otáč|manipulační)/.test(co)) f('otoceni', v >= 150, S, q.co + ': ' + v + ' cm', ex);
      });
    });
    return { F, M, hotel };
  }

  // Výběr jednoho údaje z kandidátů: nejlepší zdroj, v rámci zdroje sloučení (pro prvky nejlepší hodnota)
  function pickFeature(list) {
    if (!list || !list.length) return null;
    const best = Math.min(...list.map(c => SRC_PRIO[c.src]));
    const same = list.filter(c => SRC_PRIO[c.src] === best);
    return same.reduce((a, c) => (VAL_RANK[String(c.v)] > VAL_RANK[String(a.v)] ? c : a));
  }
  function pickMeasure(key, list) {
    if (!list || !list.length) return null;
    const best = Math.min(...list.map(c => SRC_PRIO[c.src]));
    const same = list.filter(c => SRC_PRIO[c.src] === best);
    const how = (MEASURES[key] || [])[2];
    if (how === 'min') return same.reduce((a, c) => (c.v < a.v ? c : a));
    if (how === 'max') return same.reduce((a, c) => (c.v > a.v ? c : a));
    return same[0];
  }

  // Profil podniku vyplněný v tomto prohlížeči (KP.business.saveProfile) → kandidáti se zdrojem „firma“, local: true
  function addBusinessFacts(C, id) {
    const bp = (store.get('bizprofiles', {})[id] || {}).values;
    if (!bp) return;
    const ex = { local: true, label: t('Profil podniku (jen v tomto prohlížeči)'), date: (store.get('bizprofiles', {})[id] || {}).updated || '' };
    const F = C.F, M = C.M;
    const f = (k, v, note) => { if (v === null || v === undefined || v === '') return; (F[k] = F[k] || []).push(Object.assign({ v, src: 'firma', note: note || '' }, ex)); };
    const m = (k, v, note) => { const n = numOrNull(v); if (n === null) return; (M[k] = M[k] || []).push(Object.assign({ v: n, src: 'firma', note: note || '' }, ex)); };
    const tri = (v) => v === 'yes' ? true : v === 'part' ? 'part' : v === 'no' ? false : v === 'na' ? 'na' : null;
    f('bezSchodu', tri(bp.vstupBezSchodu), t('Vstup bez schodů')); m('dvereCm', bp.vstupDvereCm, t('Šířka vstupních dveří')); m('prahCm', bp.prahCm, t('Práh u vstupu'));
    m('schody', bp.schodyPocet, t('Počet schodů')); m('sklonPct', bp.rampaSklonPct, t('Sklon rampy'));
    f('vytah', tri(bp.vytah), t('Výtah')); m('pruchodyCm', bp.pruchodyCm, t('Nejužší průchod')); f('otoceni', tri(bp.otoceni150), t('Otočení vozíku 150 cm'));
    f('prostory', tri(bp.prostory), t('Hlavní prostory'));
    f('wcBb', tri(bp.wc), t('Bezbariérové WC')); m('wcDvereCm', bp.wcDvereCm, t('Šířka dveří WC')); f('wcMadla', tri(bp.wcMadla), t('Madla u WC')); f('wcOtoceni', tri(bp.wcOtoceni150), t('Plocha 150 × 150 cm na WC'));
    if (numOrNull(bp.parkMist) !== null) { f('parkZTP', numOrNull(bp.parkMist) > 0, (t('Vyhrazená stání ZTP') + ': ') + bp.parkMist); m('parkMist', bp.parkMist, t('Vyhrazená stání ZTP')); }
    m('parkSirkaCm', bp.parkSirkaCm, t('Šířka stání'));
    if (numOrNull(bp.pokojuBb) !== null) { f('pokojBb', numOrNull(bp.pokojuBb) > 0, (t('Bezbariérové pokoje') + ': ') + bp.pokojuBb); m('pokojuBb', bp.pokojuBb, t('Bezbariérové pokoje')); }
    m('pokojDvereCm', bp.pokojDvereCm, t('Šířka dveří pokoje')); m('postelVyskaCm', bp.postelVyskaCm, t('Výška postele')); m('postelProstorCm', bp.postelProstorCm, t('Prostor vedle postele'));
    f('sprcha', tri(bp.sprchaUroven), t('Sprcha v úrovni podlahy')); f('sedatko', tri(bp.sprchaSedatko), t('Sedátko ve sprše')); f('koupelnaMadla', tri(bp.koupelnaMadla), t('Madla v koupelně'));
    if (bp.koupelnaPopis) C.hotel.push(Object.assign({ pokoj: '', koupelna: String(bp.koupelnaPopis) }, ex));
  }

  // facts(p) → { f: {prvek: {v, src, note, url?, date?, local?}}, m: {míra: {v, unit, label, src, note…}}, hotel: [{pokoj, koupelna, url, date}] }
  // Které místo má profil podniku: drženo v paměti, aby mapa s desítkami tisíc míst nečetla úložiště u každého místa
  let BIZ_REV = 0, BIZ_IDS = null;
  function bizHas(id) { if (!BIZ_IDS) BIZ_IDS = new Set(Object.keys(store.get('bizprofiles', {}))); return BIZ_IDS.has(id); }
  if (typeof addEventListener === 'function') addEventListener('storage', (e) => { if (!e.key || e.key === 'kp.bizprofiles') { BIZ_IDS = null; BIZ_REV++; } });
  function facts(p) {
    if (!p) return { f: {}, m: {}, hotel: [] };
    const hasBiz = bizHas(p.i);
    if (p._fx && p._fx.rev === BIZ_REV && p._fx.biz === hasBiz) return p._fx.out;
    const C = collectFacts(p);
    if (hasBiz) addBusinessFacts(C, p.i);
    const mm = {};
    Object.keys(C.M).forEach(k => { const c = pickMeasure(k, C.M[k]); if (c) mm[k] = Object.assign({ unit: (MEASURES[k] || [])[1] || '', label: (MEASURES[k] || [])[0] || k }, c); });
    // Prvky odvozené z měření (měření má přednost před obecným tvrzením ze stejného nebo horšího zdroje)
    const fromM = (fk, mk, test) => { const x = mm[mk]; if (x) (C.F[fk] = C.F[fk] || []).push({ v: test(x.v), src: x.src, note: x.label + ': ' + fmt(x.v) + ' ' + x.unit, url: x.url, date: x.date, local: x.local }); };
    fromM('dvere80', 'dvereCm', v => v >= 80);
    if (!mm.dvereCm && mm.pruchodyCm && mm.pruchodyCm.v >= 80) fromM('dvere80', 'pruchodyCm', () => true); // nejužší ze všech dveří ≥ 80 → i vstupní
    fromM('prah2', 'prahCm', v => v <= 2);
    fromM('pruchody80', 'pruchodyCm', v => v >= 80);
    fromM('wcDvere80', 'wcDvereCm', v => v >= 80);
    fromM('pokojDvere80', 'pokojDvereCm', v => v >= 80);
    fromM('parkSirka', 'parkSirkaCm', v => v >= 350);
    const ff = {};
    FEATURES.forEach(({ k }) => { const c = pickFeature(C.F[k]); if (c) ff[k] = c; });
    const out = { f: ff, m: mm, hotel: C.hotel };
    try { Object.defineProperty(p, '_fx', { value: { rev: BIZ_REV, biz: hasBiz, out }, configurable: true, writable: true, enumerable: false }); } catch (e) { /* zmrazený objekt */ }
    return out;
  }

  // ---------- Accessibility Facilities Score ----------
  // Metoda: pro každou oblast (vstup, WC, pohyb uvnitř, parkování, pokoj) sledujeme pevný seznam prvků (FEATURES).
  // Skóre oblasti = podíl sledovaných prvků, které místo PROKAZATELNĚ nabízí (true = 1, 'part' = 0,5, false i neznámé = 0),
  // vůči všem sledovaným prvkům oblasti (prvky 'na' = netýká se se nepočítají). Když o oblasti nevíme vůbec nic, je null
  // („neznámé“), ne 0. Celkové skóre = totéž přes všechny prvky oblastí, které se k typu místa hodí; null, když nevíme nic.
  // Neznámé prvky tedy skóre nesnižují na „špatné“, ale ani ho nezvyšují; podíl známých vrací pole coverage.
  // Oblasti podle typu místa: pokoj jen u ubytování, parkoviště ZTP jen parkování, veřejné WC jen vstup a WC,
  // příroda bez interiéru.
  function areasFor(p) {
    if (p.c === 'parkovani') return ['parkovani'];
    if (p.c === 'wc') return ['vstup', 'wc'];
    if (p.c === 'priroda') return ['vstup', 'wc', 'parkovani'];
    if (p.c === 'ubytovani') return ['vstup', 'wc', 'interier', 'parkovani', 'pokoj'];
    return ['vstup', 'wc', 'interier', 'parkovani'];
  }
  function facilitiesScore(p) {
    const fx = facts(p), rel = areasFor(p);
    const areas = { vstup: null, wc: null, interier: null, parkovani: null, pokoj: null };
    const detail = {};
    const known = [], missing = [];
    let sumHave = 0, sumTracked = 0, anyKnown = false;
    rel.forEach(a => {
      let have = 0, tracked = 0, kn = 0;
      FEATURES.filter(x => x.a === a).forEach(x => {
        const c = fx.f[x.k];
        if (c && c.v === 'na') { known.push({ key: x.k, area: a, label: x.label, v: 'na', src: c.src, note: c.note, local: !!c.local }); return; }
        tracked++;
        if (c) { kn++; have += c.v === true ? 1 : c.v === 'part' ? 0.5 : 0; known.push({ key: x.k, area: a, label: x.label, v: c.v, src: c.src, note: c.note, local: !!c.local }); }
        else missing.push({ key: x.k, area: a, label: x.label });
      });
      detail[a] = { pct: kn && tracked ? Math.round(have / tracked * 100) : null, offered: have, known: kn, tracked };
      areas[a] = detail[a].pct;
      if (kn) anyKnown = true;
      sumHave += have; sumTracked += tracked;
    });
    const knownCount = known.filter(k => k.v !== 'na').length;
    return {
      total: anyKnown && sumTracked ? Math.round(sumHave / sumTracked * 100) : null,
      areas, detail, relevant: rel, known, missing,
      offered: sumHave, tracked: sumTracked, coverage: sumTracked ? Math.round(knownCount / sumTracked * 100) : 0,
    };
  }

  // ---------- Personal Match Score ----------
  // Každá potřeba z profilu = jedno kritérium. Stav kritéria: met (splněno), part (částečně), unmet (nesplněno),
  // unknown (údaj chybí). pct = (splněná + 0,5 × částečná) / ZNÁMÁ kritéria × 100: neznámé údaje shodu nesnižují,
  // snižují jen jistotu (knownPct = podíl známých kritérií). Stav:
  //   no  = nesplněno zásadní kritérium (vstup, dveře, práh, sklon, výtah) nebo víc než jedno nesplněné,
  //   part = jedno nesplněné nebo částečně splněné kritérium,
  //   unk = vše známé je splněno, ale chybí údaj o vstupu, WC nebo parkování, které výslovně potřebujete,
  //   ok  = vše známé splněno a zásadní údaje známe.
  // „Věřím jen ověřeným údajům“: údaje bez ověření (OpenStreetMap bez data kontroly, provozovatel) se berou jako neznámé.
  function matchScore(p, needsIn) {
    const n = normNeeds(needsIn || getNeeds());
    const fx = facts(p), items = [];
    const get = (k) => fx.f[k] || null, getM = (k) => fx.m[k] || null;
    const add = (key, label, state, o) => items.push(Object.assign({ key, label, state, hard: false, critical: false, src: null }, o || {}));
    const cat = p.c;
    const hasInside = !['parkovani', 'priroda', 'wc'].includes(cat);
    const hasWc = !['parkovani', 'priroda'].includes(cat);

    if (cat === 'parkovani') add('parkZTP', t('Vyhrazené stání pro ZTP'), 'met', { src: srcBase(p) });
    else {
      const c = get('bezSchodu');
      const o = { hard: true, critical: true, src: c && c.src };
      if (!c) add('bezSchodu', t('Přístupnost vstupu neuvedena'), 'unknown', o);
      else if (c.v === true) add('bezSchodu', t('Vstup bez schodů'), 'met', o);
      else if (c.v === 'part') {
        const ok = n.acceptLimited || (n.stepMax !== null && n.stepMax >= 7);
        add('bezSchodu', ok ? t('Vstup částečně přístupný, podle profilu zvládnete') : t('Vstup jen částečně přístupný'), ok ? 'met' : 'part', o);
      } else add('bezSchodu', t('Vstup není přístupný na vozíku'), 'unmet', o);
    }
    if (n.doorMin !== null && cat !== 'parkovani' && cat !== 'priroda') {
      const d = getM('dvereCm') || getM('pruchodyCm');
      if (!d) add('doorMin', t('Šířka dveří neuvedena'), 'unknown', { critical: true });
      else add('doorMin', (t('Dveře') + ' ') + fmt(d.v) + ' cm' + (d.v >= n.doorMin ? '' : (', ' + t('potřebujete') + ' ') + fmt(n.doorMin) + ' cm'), d.v >= n.doorMin ? 'met' : 'unmet', { critical: true, src: d.src });
    }
    if (n.stepMax !== null && cat !== 'parkovani') {
      const d = getM('prahCm');
      if (!d) add('stepMax', t('Výška prahu neuvedena'), 'unknown', { critical: true });
      else add('stepMax', (t('Práh') + ' ') + fmt(d.v) + ' cm' + (d.v <= n.stepMax ? '' : (', ' + t('zvládnete') + ' ') + fmt(n.stepMax) + ' cm'), d.v <= n.stepMax ? 'met' : 'unmet', { critical: true, src: d.src });
    }
    if (n.slopeMax !== null) {
      const d = getM('sklonPct');
      if (!d) add('slopeMax', t('Sklon neuveden'), 'unknown', { critical: true });
      else add('slopeMax', (t('Sklon') + ' ') + fmt(d.v) + ' %' + (d.v <= n.slopeMax ? '' : (', ' + t('zvládnete') + ' ') + fmt(n.slopeMax) + ' %'), d.v <= n.slopeMax ? 'met' : 'unmet', { critical: true, src: d.src });
    }
    if (n.needLift && hasInside) {
      const c = get('vytah');
      if (!c) add('needLift', t('Výtah neuveden'), 'unknown', { critical: true });
      else if (c.v === true) add('needLift', t('Výtah nebo plošina'), 'met', { critical: true, src: c.src });
      else if (c.v === 'na') add('needLift', t('Jen jedno podlaží, výtah netřeba'), 'met', { critical: true, src: c.src });
      else add('needLift', t('Bez výtahu'), c.v === 'part' ? 'part' : 'unmet', { critical: true, src: c.src });
    }
    if (n.needWc && hasWc) {
      const c = get('wcBb');
      if (!c) add('needWc', t('Toaleta neuvedena'), 'unknown', { hard: true });
      else if (c.v === true) add('needWc', t('Bezbariérové WC'), 'met', { hard: true, src: c.src });
      else if (c.v === 'part') add('needWc', t('WC jen částečně přístupné'), 'part', { hard: true, src: c.src });
      else add('needWc', t('Bez bezbariérového WC'), 'unmet', { hard: true, src: c.src });
    }
    if (n.needGrabBars && hasWc) {
      const c = get('wcMadla') || (cat === 'ubytovani' ? get('koupelnaMadla') : null);
      if (!c) add('needGrabBars', t('Madla u WC neuvedena'), 'unknown');
      else add('needGrabBars', c.v === true ? t('Madla u WC') : t('Bez madel u WC'), c.v === true ? 'met' : c.v === 'part' ? 'part' : 'unmet', { src: c.src });
    }
    if (n.needParking) {
      const c = get('parkZTP'), pm = getM('parkMist');
      if (!c) add('needParking', t('Parkování ZTP neuvedeno'), 'unknown', { hard: true });
      else if (c.v === true) add('needParking', pm ? fmt(pm.v) + t('× parkování ZTP') : t('Parkování ZTP'), 'met', { hard: true, src: c.src });
      else add('needParking', t('Bez vyhrazeného stání ZTP'), 'unmet', { hard: true, src: c.src });
    }
    if (cat === 'ubytovani') {
      [['needShower', 'sprcha', t('Sprcha v úrovni podlahy'), t('Sprcha v úrovni podlahy neuvedena'), t('Sprcha není v úrovni podlahy')],
       ['needShowerSeat', 'sedatko', t('Sedátko ve sprše'), t('Sedátko ve sprše neuvedeno'), t('Bez sedátka ve sprše')]].forEach(([nk, fk, yes, unk, no]) => {
        if (!n[nk]) return;
        const c = get(fk);
        if (!c) add(nk, unk, 'unknown');
        else add(nk, c.v === true ? yes : no, c.v === true ? 'met' : c.v === 'part' ? 'part' : 'unmet', { src: c.src });
      });
    }
    // Jen ověřené údaje: kladný údaj bez ověření se bere jako neznámý; záporný údaj platí dál (je to varování)
    if (n.onlyChecked) items.forEach(i => {
      if ((i.state === 'met' || i.state === 'part') && i.src && !(i.src === 'overeno' || (i.src === 'komunita' && !!p.cd))) { i.state = 'unknown'; i.label += (' ' + t('(neověřeno)')); }
    });

    const by = (s) => items.filter(i => i.state === s);
    const met = by('met'), part = by('part'), unmet = by('unmet'), unknown = by('unknown');
    const knownN = met.length + part.length + unmet.length;
    let status;
    if (unmet.some(i => i.critical) || unmet.length + part.length > 1) status = 'no';
    else if (unmet.length || part.length) status = 'part';
    else if (unknown.some(i => i.hard)) status = 'unk';
    else status = knownN ? 'ok' : 'unk';
    return {
      pct: knownN ? Math.round((met.length + part.length * 0.5) / knownN * 100) : null,
      status,
      met: met.map(i => i.label), unmet: unmet.concat(part).map(i => i.label), partial: part.map(i => i.label), unknown: unknown.map(i => i.label),
      known: knownN, total: items.length, knownPct: items.length ? Math.round(knownN / items.length * 100) : 0,
      items,
    };
  }
  // Kompatibilní tvar pro mapu, kraje a detail: { status, reasons[], fails[], unknown[] } (+ pct, knownPct)
  function match(p, needs) {
    const r = matchScore(p, needs);
    return { status: r.status, reasons: r.met, fails: r.unmet, unknown: r.unknown, pct: r.pct, knownPct: r.knownPct };
  }
  const STATUS_LABEL = { ok: t('Vyhovuje vašim potřebám'), part: t('Vyhovuje částečně'), no: t('Nevyhovuje'), unk: t('Chybí údaje') };
  const STATUS_SHORT = { ok: t('Vyhovuje'), part: t('Částečně'), no: t('Nevyhovuje'), unk: t('Chybí údaje') };
  function generalStatus(p) { return p.c === 'parkovani' ? 'ok' : W[p.w || 'null'].st; }

  // Desetinná čárka (čeština, němčina) nebo tečka (angličtina); data podle jazyka (KP.i18n.date)
  function fmt(n) { return LANG === 'en' ? String(n) : String(n).replace('.', ','); }
  // Malé písmeno uprostřed věty (němčina podstatná jména nemění); celé číslo s oddělením tisíců podle jazyka
  function lc(x) { return LANG === 'de' ? String(x) : String(x).toLowerCase(); }
  function nf(n) { return Number(n).toLocaleString(LANG === 'cs' ? 'cs-CZ' : LANG === 'de' ? 'de-DE' : 'en-GB'); }
  function fmtDate(iso) {
    if (!iso) return '';
    if (KPI.i18n) return KPI.i18n.date(iso);
    const [y, m, d] = iso.split('-'); return d ? Number(d) + '. ' + Number(m) + '. ' + y : m ? Number(m) + '/' + y : y;
  }
  function ageLabel(iso) {
    if (!iso) return '';
    const days = Math.round((Date.now() - new Date(iso)) / 864e5);
    if (days < 31) return t('před {n} dny', { n: Math.max(days, 0) });
    const months = Math.round(days / 30.4);
    if (months < 12) return months === 1 ? t('před měsícem') : t('před {n} měsíci', { n: months });
    const y = Math.floor(months / 12);
    return y === 1 ? t('před rokem') : t('před {n} lety', { n: y });
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
      return key ? 'https://www.google.com/maps/embed/v1/place?key=' + key + '&q=' + encodeURIComponent(p.n + ', ' + p.o) + '&center=' + p.la + ',' + p.lo + '&zoom=17&language=' + LANG
                 : 'https://maps.google.com/maps?q=' + p.la + ',' + p.lo + '&z=17&hl=' + LANG + '&output=embed';
    },
    route: (a, b) => 'https://www.google.com/maps/dir/?api=1&origin=' + a.la + '%2C' + a.lo + '&destination=' + b.la + '%2C' + b.lo + '&travelmode=walking',
  };

  // ---------- Data ----------
  // Data jsou rozdělená po regionech (14 krajů ČR + 7 vládních obvodů Bavorska): data/regions/index.json
  // + data/regions/<zeme>-<slug>.json. Načítá se jen to, co stránka potřebuje; načtené regiony se drží v cache.
  const ZEME = { cz: t('Česko'), de: t('Bavorsko') };
  const ZEME_LONG = { cz: t('Česká republika'), de: t('Bavorsko (Německo)') };
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
  // Názvy krajů a vládních obvodů v němčině a angličtině (data mají české názvy, ty zůstávají klíčem)
  const KRAJE = {
    'Hlavní město Praha': ['Hauptstadt Prag', 'Prague'], 'Jihočeský': ['Südböhmische Region', 'South Bohemian Region'],
    'Jihomoravský': ['Südmährische Region', 'South Moravian Region'], 'Karlovarský': ['Karlsbader Region', 'Karlovy Vary Region'],
    'Královéhradecký': ['Königgrätzer Region', 'Hradec Králové Region'], 'Liberecký': ['Reichenberger Region', 'Liberec Region'],
    'Moravskoslezský': ['Mährisch-Schlesische Region', 'Moravian-Silesian Region'], 'Olomoucký': ['Olmützer Region', 'Olomouc Region'],
    'Pardubický': ['Pardubitzer Region', 'Pardubice Region'], 'Plzeňský': ['Pilsner Region', 'Plzeň Region'],
    'Středočeský': ['Mittelböhmische Region', 'Central Bohemian Region'], 'Ústecký': ['Aussiger Region', 'Ústí nad Labem Region'],
    'Vysočina': ['Region Vysočina', 'Vysočina Region'], 'Zlínský': ['Zliner Region', 'Zlín Region'],
    'Horní Bavorsko': ['Oberbayern', 'Upper Bavaria'], 'Dolní Bavorsko': ['Niederbayern', 'Lower Bavaria'],
    'Horní Falc': ['Oberpfalz', 'Upper Palatinate'], 'Horní Franky': ['Oberfranken', 'Upper Franconia'],
    'Střední Franky': ['Mittelfranken', 'Middle Franconia'], 'Dolní Franky': ['Unterfranken', 'Lower Franconia'], 'Švábsko': ['Schwaben', 'Swabia'],
  };
  function krajName(k, z) {
    if (!k) return '';
    if (LANG !== 'cs') { const tr = KRAJE[k] || KRAJE[String(k).replace(/ kraj$|^Kraj /, '')]; if (tr) return tr[LANG === 'de' ? 0 : 1]; }
    const zz = z || (regionByName(k) || {}).zeme || (/(Bavorsko|Franky|Falc|Švábsko)$/.test(k) ? 'de' : 'cz');
    if (zz === 'de') return k;
    if (/ kraj$|^Kraj /.test(k)) return k;
    return k === 'Hlavní město Praha' ? k : k === 'Vysočina' ? 'Kraj Vysočina' : k + ' kraj';
  }
  function zemeOf(p) { return p.z || (p._r ? p._r.slice(0, 2) : 'cz'); }

  // ---------- Logo ----------
  const LOGO = '<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="var(--tape)"/><path d="M9 15v10M31 15v10M9 20h22" stroke="var(--tape-ink)" stroke-width="2.6" stroke-linecap="round"/><path d="M15 20v-3M20 20v-5M25 20v-3" stroke="var(--tape-ink)" stroke-width="2" stroke-linecap="round"/></svg>';

  // ---------- Navigace ----------
  // Hlavní položky (desktop hlavička) – ostatní stránky jsou v menu „Více“.
  const NAV = [
    ['mapa.html', t('Mapa')],
    ['ubytovani.html', t('Ubytování')],
    ['trasy.html', t('Trasy')],
    ['kraj.html', t('Kraje')],
    ['pro-firmy.html', t('Pro podniky')],
  ];
  const MORE = [
    ['komunita.html', t('Komunita'), 'users'],
    ['metodika.html', t('Jak měříme'), 'ruler'],
    ['zdroje.html', t('Zdroje a trh'), 'chart'],
    ['o-projektu.html', t('O projektu'), 'info'],
    ['pridat.html', t('Přidat nebo upravit místo'), 'plus'],
  ];
  // Spodní lišta na mobilu
  const TABS = [
    ['index.html', t('Domů'), 'home'],
    ['mapa.html', t('Mapa'), 'map'],
    ['ubytovani.html', t('Ubytování'), 'bed'],
    ['profil.html', t('Uložené'), 'bookmark'],
  ];
  function here() { return location.pathname.split('/').pop() || 'index.html'; }

  function header() {
    const h = here();
    return ('<a class="skip-link" href="#main">' + t('Přeskočit na obsah') + '</a>') +
      ('<div class="demo-bar">' + t('Studentský prototyp STENT-IN 2026') + '<span class="hide-md"> · ' + t('skutečná místa z otevřených dat, Česko a Bavorsko, stav k 7. 10. 2026') + '</span> · <a href="metodika.html#zdroje">' + t('Odkud data jsou') + '</a></div>') +
      '<header class="site-header"><div class="inner">' +
      ('<a class="brand" href="index.html" aria-label="' + t('kudyprojedu.cz – úvod') + '">') + LOGO + '<span>kudyprojedu<span class="dom">.cz</span></span></a>' +
      ('<nav class="main-nav" aria-label="' + t('Hlavní navigace') + '">') + NAV.map(([href, label]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') +
      ('<div class="more"><button class="more-btn" type="button" aria-expanded="false" aria-haspopup="true" data-more>' + t('Více') + ' ') + icon('chevron') + '</button>' +
      '<div class="more-menu" hidden>' + MORE.map(([href, label, ic]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + icon(ic) + label + '</a>').join('') + (KPI.i18n ? '<div class="more-lang">' + icon('globe') + '<span>' + t('Jazyk') + '</span>' + langSwitch() + '</div>' : '') + '</div></div></nav>' +
      '<div class="header-tools">' + langSwitch('hide-md') +
      ('<button class="btn btn-soft btn-sm needs-btn" type="button" data-open-needs aria-label="' + t('Moje potřeby') + '">') + icon('sliders') + ('<span class="lbl">' + t('Moje potřeby') + '</span><span class="dot" data-needs-flag hidden></span></button>') +
      '<a class="btn btn-primary btn-sm hide-md add-btn" href="pridat.html" aria-label="' + t('Přidat místo') + '">' + icon('plus') + '<span class="lbl">' + t('Přidat místo') + '</span></a>' +
      ('<a class="icon-btn hide-md" href="profil.html" aria-label="' + t('Můj profil a uložená místa') + '">') + icon('user') + '</a>' +
      '</div></div></header>';
  }

  // Přepínač CZ / DE / EN (i18n.js); na mobilu je v menu Více
  function langSwitch(cls) { return KPI.i18n ? KPI.i18n.switcher(cls) : ''; }
  function tabbar() {
    const h = here();
    return ('<nav class="tabbar" aria-label="' + t('Spodní navigace') + '">') +
      TABS.map(([href, label, ic]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + icon(ic) + label + '</a>').join('') +
      ('<button type="button" data-open-more aria-label="' + t('Další stránky a nastavení') + '">') + icon('menu') + (t('Více') + '</button></nav>');
  }

  function moreSheet() {
    const h = here();
    const theme = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const wrap = document.createElement('div');
    const links = NAV.concat(MORE.map(x => [x[0], x[1], x[2]]));
    const icons = { 'mapa.html': 'map', 'ubytovani.html': 'bed', 'trasy.html': 'route', 'kraj.html': 'globe', 'pro-firmy.html': 'building' };
    wrap.innerHTML = '<div class="sheet-backdrop" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="more-title"><div class="grip"></div>' +
      ('<header><h2 id="more-title">' + t('Všechny stránky') + '</h2><button class="icon-btn" type="button" data-close aria-label="' + t('Zavřít') + '">') + icon('close') + '</button></header>' +
      '<div class="body"><div class="menu-list">' +
      links.map(([href, label, ic]) => '<a href="' + href + '"' + (h === href ? ' aria-current="page"' : '') + '>' + icon(ic || icons[href] || 'arrow') + label + '</a>').join('') +
      '<a href="profil.html">' + icon('user') + (t('Můj profil a uložená místa') + '</a>') +
      '<div class="menu-sep"></div>' +
      '<button type="button" data-open-needs>' + icon('sliders') + (t('Moje potřeby') + '</button>') +
      '<button type="button" data-theme-toggle>' + icon(theme === 'dark' ? 'sun' : 'moon') + (theme === 'dark' ? t('Světlý režim') : t('Tmavý režim')) + '</button>' +
      (KPI.i18n ? '<div class="menu-lang">' + icon('globe') + '<span class="lbl">' + t('Jazyk') + '</span>' + langSwitch() + '</div>' : '') +
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
      '<div><a class="brand" href="index.html">' + LOGO + ('<span>kudyprojedu<span class="dom">.cz</span></span></a><p class="small muted" style="margin-top:12px;max-width:34ch">' + t('Přístupnost v centimetrech, ne v nálepkách. Mapa míst pro lidi na vozíku a s omezenou pohyblivostí v Česku a v Bavorsku.') + '</p>') +
      '<div class="footer-tools"><button class="btn btn-ghost btn-sm" type="button" data-theme-toggle>' + icon('moon') + (t('Světlý / tmavý režim') + '</button>') + langSwitch() + '</div></div>' +
      ('<div><h4>' + t('Hledat') + '</h4><ul><li><a href="mapa.html">' + t('Mapa míst') + '</a></li><li><a href="ubytovani.html">' + t('Ubytování') + '</a></li><li><a href="mapa.html#wc">' + t('Veřejné WC') + '</a></li><li><a href="trasy.html">' + t('Bariéry v ulicích') + '</a></li><li><a href="kraj.html">' + t('Kraje') + '</a></li></ul></div>') +
      ('<div><h4>' + t('Přispět') + '</h4><ul><li><a href="pridat.html">' + t('Přidat nebo upravit místo') + '</a></li><li><a href="metodika.html#mereni">' + t('Jak měřit dveře a schody') + '</a></li><li><a href="komunita.html">' + t('Komunita') + '</a></li><li><a href="profil.html">' + t('Můj profil') + '</a></li></ul></div>') +
      ('<div><h4>' + t('Pro organizace') + '</h4><ul><li><a href="pro-firmy.html">' + t('Pro podniky') + '</a></li><li><a href="pro-firmy.html#obce">' + t('Pro obce a kraje') + '</a></li><li><a href="pro-firmy.html#cenik">' + t('Ceník') + '</a></li><li><a href="zdroje.html">' + t('Zdroje a trh') + '</a></li></ul></div>') +
      ('<div><h4>' + t('Projekt') + '</h4><ul><li><a href="o-projektu.html">' + t('O projektu') + '</a></li><li><a href="o-projektu.html#plan">' + t('Plán rozvoje') + '</a></li><li><a href="metodika.html">' + t('Jak měříme') + '</a></li><li><a href="metodika.html#soukromi">' + t('Soukromí a GDPR') + '</a></li></ul><div class="partner-logos"><span>VŠTE ČB</span><span>OTH Regensburg</span><span>Interreg BY–CZ</span></div></div>') +
      ('</div><div class="legal"><span>' + t('© 2026 kudyprojedu.cz – studentský projekt STENT-IN') + '</span><span>' + t('Data © přispěvatelé OpenStreetMap (ODbL), Mapy bez bariér, Brno a IPR Praha (CC BY), Statutární město Ostrava (CC BY-SA 4.0) · Bavorsko: DB InfraGO OpenStation (CC0), Landeshauptstadt München a Stadt Würzburg (dl-de/by-2-0), Stadt Haar (CC BY 4.0), BayernCloud Tourismus (CC BY 4.0 a CC0) · fotky Wikimedia Commons · mapy Google') + ' · <a href="zdroje.html#bavorsko">' + t('Všechny zdroje a licence') + '</a></span></div></div></footer>');
  }

  // ---------- Formulář potřeb (panel „Moje potřeby“ i stránka profil.html) ----------
  // needsForm.html(n, prefix) vrátí pole formuláře, needsForm.read(root, prefix) z nich složí objekt potřeb.
  const NEED_CHECKS = [
    ['needLift', t('Potřebuji výtah nebo plošinu, když je místo ve víc podlažích')],
    ['needWc', t('Potřebuji bezbariérovou toaletu')],
    ['needGrabBars', t('Potřebuji madla u WC')],
    ['needParking', t('Potřebuji parkovací místo pro ZTP')],
    ['needShower', t('V ubytování potřebuji sprchu v úrovni podlahy')],
    ['needShowerSeat', t('V ubytování potřebuji sedátko ve sprše')],
  ];
  const needsForm = {
    html(n, prefix) {
      const x = prefix || 'n';
      const num = (k, label, unit, hint, max) => '<div class="field nf-num"><label for="' + x + '-' + k + '">' + label + ' <span class="hint">(' + unit + ', ' + t('nepovinné') + ')</span></label>' +
        '<div class="nf-unit" style="display:flex;align-items:center;gap:8px;max-width:12em"><input type="number" inputmode="decimal" min="0" max="' + max + '" step="any" id="' + x + '-' + k + '" value="' + (n[k] === null ? '' : n[k]) + '" aria-describedby="' + x + '-' + k + '-h"><span aria-hidden="true">' + unit + '</span></div>' +
        '<span class="hint" id="' + x + '-' + k + '-h">' + hint + '</span></div>';
      // Inline styl kvůli panelu na stránkách, které nenačítají pages-b.css
      const FS = '<fieldset class="nf-group" style="border:0;padding:0;margin:0;min-width:0;display:flex;flex-direction:column;gap:8px">', LG = ' style="font-weight:700;padding:0;margin-bottom:4px"';
      const chk = (k, label) => '<label class="check"><input type="checkbox" id="' + x + '-' + k + '"' + (n[k] ? ' checked' : '') + '> ' + label + '</label>';
      return FS + '<legend' + LG + ('>' + t('Pomůcka') + '</legend>') +
        '<div class="field"><label for="' + x + ('-aid">' + t('Čím se pohybuji') + '</label><select id="') + x + '-aid">' + AIDS.map(a => '<option value="' + a + '"' + (a === n.aid ? ' selected' : '') + '>' + t(a) + '</option>').join('') + '</select></div>' +
        '<div class="field" data-aid-other' + (n.aid === 'jiné' ? '' : ' hidden') + '><label for="' + x + ('-aidOther">' + t('Jaká pomůcka') + '</label><input type="text" id="') + x + '-aidOther" maxlength="60" value="' + esc(n.aidOther) + '"></div></fieldset>' +
        FS + '<legend' + LG + ('>' + t('Co zvládnu') + '</legend>') +
        num('doorMin', t('Nejužší dveře, kterými projedu'), 'cm', t('Šířka vozíku plus asi 10 cm na ruce. Norma pro dveře je 80 cm.'), 300) +
        num('stepMax', t('Nejvyšší schod nebo práh, který zvládnu'), 'cm', t('0 = žádný. Bezbariérový práh má nejvýš 2 cm.'), 100) +
        num('slopeMax', t('Největší sklon, který zvládnu'), '%', t('Norma pro rampy je 8 %, krátké rampy do 12,5 %.'), 100) +
        '</fieldset>' +
        FS + '<legend' + LG + ('>' + t('Co potřebuji') + '</legend>') + NEED_CHECKS.map(([k, l]) => chk(k, l)).join('') + '</fieldset>' +
        FS + '<legend' + LG + ('>' + t('Jak hodnotit') + '</legend>') +
        chk('acceptLimited', t('Zvládnu i „částečně přístupné“ místo (jeden schod do 7 cm, s doprovodem)')) +
        chk('onlyChecked', t('Věřím jen ověřeným údajům (měření nebo kontrola na místě s datem)')) + '</fieldset>';
    },
    read(root, prefix) {
      const x = prefix || 'n', q = (k) => root.querySelector('#' + x + '-' + k);
      const o = { active: true, aid: q('aid').value, aidOther: q('aidOther') ? q('aidOther').value.trim() : '' };
      ['doorMin', 'stepMax', 'slopeMax'].forEach(k => { o[k] = numOrNull(q(k).value); });
      NEED_CHECKS.forEach(([k]) => { o[k] = q(k).checked; });
      o.acceptLimited = q('acceptLimited').checked; o.onlyChecked = q('onlyChecked').checked;
      return o;
    },
    // Zobrazí pole „Jaká pomůcka“ jen u volby „jiné“
    bind(root, prefix) {
      const x = prefix || 'n', sel = root.querySelector('#' + x + '-aid'), other = root.querySelector('[data-aid-other]');
      if (sel && other) sel.addEventListener('change', () => { other.hidden = sel.value !== 'jiné'; });
    },
  };
  // Krátký souhrn potřeb pro výpis: ['mechanický vozík', 'dveře od 80 cm', …]
  function needsSummary(n) {
    const out = [aidLabel(n)];
    if (n.doorMin !== null) out.push((t('dveře od') + ' ') + fmt(n.doorMin) + ' cm');
    if (n.stepMax !== null) out.push((t('schod nejvýš') + ' ') + fmt(n.stepMax) + ' cm');
    if (n.slopeMax !== null) out.push((t('sklon nejvýš') + ' ') + fmt(n.slopeMax) + ' %');
    const lab = { needLift: t('výtah'), needWc: t('bezbariérové WC'), needGrabBars: 'madla u WC', needParking: t('parkování ZTP'), needShower: t('sprcha v úrovni podlahy'), needShowerSeat: t('sedátko ve sprše') };
    Object.keys(lab).forEach(k => { if (n[k]) out.push(lab[k]); });
    if (n.acceptLimited) out.push(t('i částečně přístupná místa'));
    if (n.onlyChecked) out.push(t('jen ověřené údaje'));
    return out;
  }

  // ---------- Panel „Moje potřeby“ ----------
  function needsDrawer() {
    const n = getNeeds();
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div class="drawer-backdrop" data-close></div>' +
      ('<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="needs-title"><header><h2 id="needs-title">' + t('Moje potřeby') + '</h2><button class="icon-btn" type="button" data-close aria-label="' + t('Zavřít') + '">') + icon('close') + '</button></header>' +
      '<div class="body nf">' +
      ('<p class="muted small" style="margin:0">' + t('Podle toho u každého místa uvidíte, jestli vám vyhovuje. Nastavení zůstává jen ve vašem prohlížeči. Na server nic neposíláme, protože jde o údaj o zdraví.') + '</p>') +
      needsForm.html(n, 'nd') +
      ('<p class="callout small" style="margin:0">' + t('Rozměry v centimetrech zatím u většiny míst chybí. Kde údaj chybí, shodu to nesnižuje, jen ukážeme, že si nejsme jistí.') + '</p>') +
      ('</div><footer><button class="btn btn-ghost" type="button" data-reset>' + t('Vypnout') + '</button><button class="btn btn-primary" type="button" data-save style="flex:1">' + t('Uložit a použít') + '</button></footer></aside>');
    document.body.appendChild(wrap);
    needsForm.bind(wrap, 'nd');
    const close = () => wrap.remove();
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    wrap.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
    wrap.querySelector('[data-save]').addEventListener('click', () => {
      setNeeds(needsForm.read(wrap, 'nd'));
      close(); toast(t('Potřeby uloženy. Místa teď hodnotíme podle vás.'));
    });
    wrap.querySelector('[data-reset]').addEventListener('click', () => { setNeeds(Object.assign(getNeeds(), { active: false })); close(); toast(t('Hodnocení podle potřeb je vypnuté.')); });
    wrap.querySelector('#nd-aid').focus();
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

  // ---------- Komunita a podniky: FUNKČNÍ PROTOTYP bez serveru ----------
  // Vše se ukládá jen do localStorage tohoto prohlížeče (klíče kp.reviews, kp.confirm, kp.reports, kp.requests,
  // kp.routes, kp.itineraries, kp.collections, kp.claims, kp.bizprofiles, kp.events). Nic se neodesílá a nic se
  // nedopočítává: počty jsou jen to, co zadal uživatel v tomto prohlížeči. Stránky to musí říct textem PROTOTYPE_NOTE.
  const PROTOTYPE_NOTE = t('Prototyp: uloženo jen ve vašem prohlížeči, v ostré verzi se to odešle na server.');
  const today = () => new Date().toISOString().slice(0, 10);
  const nowIso = () => new Date().toISOString();
  const uid = (pfx) => (pfx || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const RATING_AREAS = ['vstup', 'wc', 'parkovani', 'interier', 'pokoj'];
  const QUOTA_MSG = t('Úložiště prohlížeče je plné. Zkuste méně nebo menší fotky, případně smažte starší příspěvky.');
  // Krátký popis místa pro výpisy bez načítání regionu
  function placeRef(id) { const p = BYID.get(id); if (p) rememberRegion(p); return p ? { n: p.n, o: p.o || '', r: p._r || '', c: p.c } : { n: '', o: '', r: (store.get('placeRegion', {})[id] || ''), c: '' }; }
  const byPlace = (key, id) => (store.get(key, {})[id] || []);
  function pushByPlace(key, id, item, max) {
    const all = store.get(key, {});
    const list = (all[id] = all[id] || []);
    list.push(item); if (max && list.length > max) list.splice(0, list.length - max);
    return store.set(key, all);
  }

  // Zmenšení fotky: max 1200 px na delší straně, JPEG kvalita 0,8 → dataURL. Přijímá File/Blob nebo dataURL.
  function resizePhoto(input, max, quality) {
    const M = max || 1200, Q = quality || 0.8;
    return new Promise((resolve, reject) => {
      const img = new Image();
      let url = null;
      img.onload = () => {
        try {
          const k = Math.min(1, M / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', Q));
        } catch (e) { reject(e); } finally { if (url) URL.revokeObjectURL(url); }
      };
      img.onerror = () => { if (url) URL.revokeObjectURL(url); reject(new Error(t('Soubor se nepodařilo načíst jako obrázek.'))); };
      if (typeof input === 'string') img.src = input;
      else if (input instanceof Blob) { url = URL.createObjectURL(input); img.src = url; }
      else reject(new Error(t('Neznámý typ fotky.')));
    });
  }
  function resizeAll(list) { return Promise.all((list || []).slice(0, 6).map(x => (typeof x === 'string' && /^data:image\/jpeg/.test(x) && x.length < 600000) ? x : resizePhoto(x))); }

  // Hodnocení a zkušenosti. Recenze: {id, placeId, place:{n,o,r,c}, text, aid, ratings:{vstup,wc,parkovani,interier,pokoj: 1–5|null}, photos:[dataURL], date, local:true}
  // Starší zkušenosti z detailu místa (kp.exp) se vracejí také, s legacy:true.
  function normRatings(r) { const o = {}; RATING_AREAS.forEach(a => { const v = Number((r || {})[a]); o[a] = v >= 1 && v <= 5 ? Math.round(v) : null; }); return o; }
  function legacyExp(id) { return (store.get('exp', {})[id] || []).map((e, i) => ({ id: 'exp' + i, placeId: id, place: placeRef(id), text: e.text, aid: e.aid || '', ratings: normRatings({}), photos: [], date: e.date, local: true, legacy: true })); }
  const community = {
    note: PROTOTYPE_NOTE,
    RATING_AREAS,
    reviews(id) { return legacyExp(id).concat(byPlace('reviews', id)).sort((a, b) => String(b.date).localeCompare(String(a.date))); },
    myReviews() {
      const all = store.get('reviews', {}), exp = store.get('exp', {}), out = [];
      Object.keys(all).forEach(id => all[id].forEach(r => out.push(r)));
      Object.keys(exp).forEach(id => legacyExp(id).forEach(r => out.push(r)));
      return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    },
    // → Promise<{ok:true, review} | {ok:false, error}>
    addReview(id, data) {
      const d = data || {};
      const text = String(d.text || '').trim().slice(0, 4000);
      const ratings = normRatings(d.ratings);
      if (!id) return Promise.resolve({ ok: false, error: t('Chybí místo.') });
      if (!text && !RATING_AREAS.some(a => ratings[a]) && !(d.photos || []).length) return Promise.resolve({ ok: false, error: t('Napište zkušenost, přidejte hodnocení nebo fotku.') });
      return resizeAll(d.photos).then(photos => {
        const review = { id: uid('rv'), placeId: id, place: placeRef(id), text, aid: String(d.aid || ''), ratings, photos, photoAreas: (d.photoAreas || []).slice(0, photos.length), date: today(), created: nowIso(), local: true };
        return pushByPlace('reviews', id, review, 50) ? { ok: true, review } : { ok: false, error: QUOTA_MSG };
      }).catch(e => ({ ok: false, error: e.message || t('Fotku se nepodařilo zpracovat.') }));
    },
    deleteReview(id, reviewId) {
      if (/^exp\d+$/.test(reviewId)) { const e = store.get('exp', {}); (e[id] || []).splice(+reviewId.slice(3), 1); if (e[id] && !e[id].length) delete e[id]; return store.set('exp', e); }
      const all = store.get('reviews', {}); all[id] = (all[id] || []).filter(r => r.id !== reviewId); if (!all[id].length) delete all[id]; return store.set('reviews', all);
    },
    // Průměr hodnocení po oblastech jen z recenzí v tomto prohlížeči: {vstup:{avg, n}, …}; bez hodnocení avg = null
    ratingSummary(id) {
      const list = community.reviews(id), out = {};
      RATING_AREAS.forEach(a => { const v = list.map(r => r.ratings && r.ratings[a]).filter(Boolean); out[a] = { avg: v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null, n: v.length }; });
      return out;
    },
    // Fotky místa z recenzí a z profilu podniku: [{src, area, from:'review'|'business', date}]
    photos(id) {
      const out = [];
      community.reviews(id).forEach(r => (r.photos || []).forEach((src, i) => out.push({ src, area: (r.photoAreas || [])[i] || '', from: 'review', date: r.date })));
      const bp = store.get('bizprofiles', {})[id];
      if (bp && bp.photos) Object.keys(bp.photos).forEach(a => (bp.photos[a] || []).forEach(src => out.push({ src, area: a, from: 'business', date: bp.updated })));
      return out;
    },
    // Potvrzení údaje návštěvníkem: field = klíč prvku (FEATURES) nebo libovolný údaj, yes = true (platí) / false (neplatí)
    // Jeden hlas na údaj v tomto prohlížeči; opakované volání hlas přepíše. → záznam {v:'yes'|'no', date}
    confirm(id, field, yes) {
      const all = store.get('confirm', {}); const c = (all[id] = all[id] || {});
      c[field] = { v: yes ? 'yes' : 'no', date: today() }; const ref = placeRef(id); if (ref.n) c[field].place = ref;
      store.set('confirm', all); rememberRegion(BYID.get(id)); return c[field];
    },
    unconfirm(id, field) { const all = store.get('confirm', {}); if (all[id]) { delete all[id][field]; if (!Object.keys(all[id]).length) delete all[id]; } return store.set('confirm', all); },
    // → {pole: {yes: 0|1, no: 0|1, mine: 'yes'|'no'|null, date}} – jen hlasy z tohoto prohlížeče
    confirmations(id) {
      const c = store.get('confirm', {})[id] || {}, out = {};
      Object.keys(c).forEach(k => { out[k] = { yes: c[k].v === 'yes' ? 1 : 0, no: c[k].v === 'no' ? 1 : 0, mine: c[k].v, date: c[k].date }; });
      return out;
    },
    // Nahlášení změny nebo neaktuálního údaje → záznam
    report(id, text, field) { const r = { id: uid('rp'), placeId: id, place: placeRef(id), field: field || '', text: String(text || '').trim().slice(0, 2000), date: today() }; return pushByPlace('reports', id, r, 30) ? r : null; },
    reports(id) { return byPlace('reports', id).slice().reverse(); },
    // „Požádat o informace o přístupnosti“: podnik by dostal informaci o zájmu (v prototypu jen záznam zde)
    requestInfo(id, opts) {
      const o = opts || {};
      if (community.hasRequested(id)) return byPlace('requests', id).slice(-1)[0];
      const r = { id: uid('rq'), placeId: id, place: placeRef(id), areas: (o.areas || []).slice(0, 10), note: String(o.note || '').slice(0, 500), date: today() };
      return pushByPlace('requests', id, r, 5) ? r : null;
    },
    requests(id) { return byPlace('requests', id); },
    hasRequested(id) { return byPlace('requests', id).length > 0; },
    // Všechny moje záznamy daného typu napříč místy: kind = 'reports' | 'requests'
    mine(kind) { const all = store.get(kind, {}), out = []; Object.keys(all).forEach(id => (all[id] || []).forEach(x => out.push(x))); return out.sort((a, b) => String(b.date).localeCompare(String(a.date))); },
    myConfirmations() { const all = store.get('confirm', {}), out = []; Object.keys(all).forEach(id => Object.keys(all[id]).forEach(f => out.push({ placeId: id, place: all[id][f].place || placeRef(id), field: f, v: all[id][f].v, date: all[id][f].date }))); return out; },

    // Trasy: kompatibilní s kp.routes z trasy.js ({name, note, date, from, to}); nové položky mají navíc
    // {id, stops:[{i, r, n}], barriers:[{type, note, la, lo}], photos:[dataURL], comments:[{text, date}], confirmed:'RRRR-MM-DD'|null, reports:[{text, date}], kind:'route'}
    routes() { return store.get('routes', []).map((r, i) => Object.assign({ id: r.id || 'idx' + i, kind: 'route', stops: [], barriers: [], photos: [], comments: [], reports: [], confirmed: null }, r)); },
    saveRoute(r) {
      const list = store.get('routes', []);
      const item = Object.assign({ name: t('Trasa'), note: '', from: '', to: '', stops: [], barriers: [], photos: [], comments: [], reports: [], confirmed: null, kind: 'route' }, r || {});
      item.id = item.id && !/^idx\d+$/.test(item.id) ? item.id : uid('rt'); item.date = item.date || today();
      const i = list.findIndex(x => x.id === item.id);
      if (i >= 0) list[i] = item; else list.push(item);
      return store.set('routes', list) ? item : null;
    },
    deleteRoute(routeId) { const list = store.get('routes', []); const out = list.filter((r, i) => (r.id || 'idx' + i) !== routeId); return store.set('routes', out); },
    updateRoute(routeId, patch) {
      const list = store.get('routes', []);
      const i = list.findIndex((r, k) => (r.id || 'idx' + k) === routeId);
      if (i < 0) return null;
      list[i] = Object.assign({}, list[i], patch || {}); if (!list[i].id) list[i].id = uid('rt');
      return store.set('routes', list) ? community.routes()[i] : null;
    },
    commentRoute(routeId, text) { const r = community.routes().find(x => x.id === routeId); if (!r || !String(text || '').trim()) return null; r.comments = (r.comments || []).concat({ text: String(text).trim().slice(0, 1000), date: today() }); return community.updateRoute(routeId, { comments: r.comments }); },
    confirmRoute(routeId) { return community.updateRoute(routeId, { confirmed: today() }); },
    reportRoute(routeId, text) { const r = community.routes().find(x => x.id === routeId); if (!r) return null; return community.updateRoute(routeId, { reports: (r.reports || []).concat({ text: String(text || '').trim().slice(0, 1000), date: today() }) }); },
    // Sdílení trasy bez serveru: odkaz s trasou v URL (trasy.html#route=…); přijímací stranu řeší trasy.js
    routeShareUrl(r) { try { const o = { n: r.name, s: (r.stops || []).map(s => [s.i, s.r || '']), b: r.barriers || [], t: r.note || '' }; return location.origin + location.pathname.replace(/[^/]*$/, '') + 'trasy.html#route=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(o))))); } catch (e) { return ''; } },
    parseRouteShare(hash) { try { const m = String(hash || '').match(/route=([^&]+)/); if (!m) return null; const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); return { name: o.n || t('Sdílená trasa'), stops: (o.s || []).map(([i, r]) => ({ i, r })), barriers: o.b || [], note: o.t || '' }; } catch (e) { return null; } },

    // Itineráře: řetěz míst (hotel → restaurace → muzeum → park). {id, name, stops:[{i, r, n, note}], note, date}
    itineraries() { return store.get('itineraries', []); },
    saveItinerary(it) {
      const list = store.get('itineraries', []);
      const item = Object.assign({ name: t('Itinerář'), note: '', stops: [] }, it || {});
      item.id = item.id || uid('it'); item.date = item.date || today();
      item.stops = (item.stops || []).map(s => ({ i: s.i, r: s.r || (BYID.get(s.i) || {})._r || '', n: s.n || (BYID.get(s.i) || {}).n || '', note: s.note || '' }));
      const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item);
      return store.set('itineraries', list) ? item : null;
    },
    deleteItinerary(itId) { return store.set('itineraries', store.get('itineraries', []).filter(x => x.id !== itId)); },

    // Kolekce míst (základ budoucí sociální sítě): {id, name, ids:[], date}
    collections() { return store.get('collections', []); },
    saveCollection(c) {
      const list = store.get('collections', []);
      const item = Object.assign({ name: t('Kolekce'), ids: [] }, c || {}); item.id = item.id || uid('co'); item.date = item.date || today();
      const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item);
      return store.set('collections', list) ? item : null;
    },
    addToCollection(collId, placeId) { const c = community.collections().find(x => x.id === collId); if (!c) return null; if (!c.ids.includes(placeId)) c.ids.push(placeId); rememberRegion(BYID.get(placeId)); return community.saveCollection(c); },
    removeFromCollection(collId, placeId) { const c = community.collections().find(x => x.id === collId); if (!c) return null; c.ids = c.ids.filter(x => x !== placeId); return community.saveCollection(c); },
    deleteCollection(collId) { return store.set('collections', store.get('collections', []).filter(x => x.id !== collId)); },
    // Přezdívka pro budoucí veřejný profil (zatím jen lokálně)
    me() { return Object.assign({ nick: '' }, store.get('me', {})); },
    setMe(o) { return store.set('me', Object.assign(community.me(), { nick: String((o || {}).nick || '').slice(0, 40) })); },
  };

  // ---------- Standardizovaný checklist pro podniky ----------
  // type: tri = ano / částečně / ne, yn = ano / ne, yna = ano / ne / netýká se, cm / pct / count = číslo, text = popis.
  // area = oblast skóre; hotel = jen u ubytování; how = co a jak změřit nebo vyfotit (metodika na metodika.html).
  const CHECKLIST = [
    { key: 'vstupBezSchodu', area: 'vstup', type: 'tri', label: t('Vstup bez schodů nebo s rampou'), how: t('Dojděte od chodníku ke dveřím. Je cestou schod, nebo jen rampa či rovina?') },
    { key: 'schodyPocet', area: 'vstup', type: 'count', label: t('Počet schodů u vstupu'), how: t('Spočítejte všechny schody mezi chodníkem a vstupem. Žádný schod = 0.') },
    { key: 'prahCm', area: 'vstup', type: 'cm', label: t('Výška prahu'), how: t('Svinovací metr postavte svisle vedle prahu a změřte nejvyšší hranu. Bezbariérový práh má nejvýš 2 cm.') },
    { key: 'vstupDvereCm', area: 'vstup', type: 'cm', label: t('Šířka vstupních dveří'), how: t('Otevřete hlavní křídlo naplno a změřte nejužší místo mezi zárubní a křídlem. Požadavek je 80 cm.') },
    { key: 'rampaSklonPct', area: 'vstup', type: 'pct', label: t('Sklon rampy'), how: t('Převýšení děleno délkou rampy krát 100. Například 24 cm na 300 cm = 8 %.') },
    { key: 'prostory', area: 'interier', type: 'tri', label: t('Hlavní prostory přístupné'), how: t('Dostane se člověk na vozíku do všech hlavních prostor (prodejna, sál, jídelna)?') },
    { key: 'vytah', area: 'interier', type: 'yna', label: t('Výtah nebo plošina'), how: t('Má budova víc podlaží s provozem? Pokud jen jedno, zvolte Netýká se.') },
    { key: 'pruchodyCm', area: 'interier', type: 'cm', label: t('Nejužší dveře nebo průchod uvnitř'), how: t('Projděte trasu návštěvníka a změřte nejužší dveře nebo průchod.') },
    { key: 'otoceni150', area: 'interier', type: 'yn', label: t('Prostor 150 × 150 cm pro otočení vozíku'), how: t('Najděte volný čtverec 150 × 150 cm v hlavních prostorách, bez nábytku.') },
    { key: 'wc', area: 'wc', type: 'tri', label: t('Bezbariérové WC'), how: t('WC pro vozíčkáře s madly a dostatkem místa vedle mísy.') },
    { key: 'wcDvereCm', area: 'wc', type: 'cm', label: t('Šířka dveří WC'), how: t('Změřte otevřené dveře kabiny. Požadavek je 80 cm.') },
    { key: 'wcMadla', area: 'wc', type: 'yn', label: t('Madla u mísy'), how: t('Jsou u mísy madla, alespoň jedno sklopné?') },
    { key: 'wcOtoceni150', area: 'wc', type: 'yn', label: t('Plocha 150 × 150 cm v kabině WC'), how: t('Volná plocha uvnitř kabiny, aby se vozík otočil.') },
    { key: 'parkMist', area: 'parkovani', type: 'count', label: t('Vyhrazená stání ZTP'), how: t('Kolik stání se značkou pro ZTP je u vstupu? Žádné = 0.') },
    { key: 'parkSirkaCm', area: 'parkovani', type: 'cm', label: t('Šířka stání ZTP'), how: t('Změřte šířku vyhrazeného stání. Požadavek pro kolmé stání je 350 cm.') },
    { key: 'pokojuBb', area: 'pokoj', type: 'count', hotel: true, label: t('Počet bezbariérových pokojů'), how: t('Kolik pokojů je upravených pro vozíčkáře?') },
    { key: 'pokojDvereCm', area: 'pokoj', type: 'cm', hotel: true, label: t('Šířka dveří pokoje a koupelny'), how: t('Změřte užší z obou dveří.') },
    { key: 'postelVyskaCm', area: 'pokoj', type: 'cm', hotel: true, label: t('Výška postele'), how: t('Od podlahy po horní hranu matrace.') },
    { key: 'postelProstorCm', area: 'pokoj', type: 'cm', hotel: true, label: t('Volný prostor vedle postele'), how: t('Nejmenší volná šířka podél postele, kam zajede vozík.') },
    { key: 'sprchaUroven', area: 'pokoj', type: 'yn', hotel: true, label: t('Sprcha v úrovni podlahy'), how: t('Sprcha bez vaničky a bez obrubníku.') },
    { key: 'sprchaSedatko', area: 'pokoj', type: 'yn', hotel: true, label: t('Sedátko ve sprše'), how: t('Sklopné nebo pevné sedátko na stěně.') },
    { key: 'koupelnaMadla', area: 'pokoj', type: 'yn', hotel: true, label: t('Madla v koupelně'), how: t('Madla u sprchy a u WC v pokoji.') },
    { key: 'koupelnaPopis', area: 'pokoj', type: 'text', hotel: true, label: t('Uspořádání koupelny'), how: t('Krátce: kde je sprcha, WC a umyvadlo, na kterou stranu se přesedá.') },
  ];
  // Fotky, které má profil podniku obsahovat
  const PHOTO_AREAS = [
    { key: 'vstup', label: t('Vstup'), how: t('Celý vstup z chodníku, aby byly vidět schody, rampa a dveře.') },
    { key: 'wc', label: 'WC', how: t('Z prahu dveří do kabiny, s mísou a madly.') },
    { key: 'koupelna', label: t('Koupelna'), how: t('Sprcha a prostor kolem ní.'), hotel: true },
    { key: 'pokoj', label: t('Pokoj'), how: t('Postel a volný prostor kolem ní.'), hotel: true },
    { key: 'vytah', label: t('Výtah'), how: t('Otevřené dveře a ovládací panel.') },
    { key: 'parkovani', label: t('Parkování'), how: t('Vyhrazené stání se značkou a cesta ke vstupu.') },
  ];
  function checklistFor(cat) { return CHECKLIST.filter(c => (cat === 'ubytovani' || !c.hotel) && (cat !== 'parkovani' || c.area === 'parkovani') && !(cat === 'wc' && ['interier', 'parkovani'].includes(c.area))); }

  // Lokální události pro statistiky podniku: kp.events = {id: {v: zobrazení detailu, i: výskyt ve výsledcích, first, last}}
  const IMPR_SEEN = new Set();
  let EV = null, EV_T = 0;
  function events() { if (!EV) EV = store.get('events', {}); return EV; }
  function flushEvents() {
    EV_T = 0; const e = events(), ids = Object.keys(e);
    if (ids.length > 3000) ids.sort((a, b) => String(e[a].last).localeCompare(String(e[b].last))).slice(0, ids.length - 3000).forEach(k => delete e[k]);
    store.set('events', e);
  }
  function bump(id, k) { const e = events(); const x = (e[id] = e[id] || { v: 0, i: 0, first: today() }); x[k] = (x[k] || 0) + 1; x.last = today(); if (!EV_T) EV_T = setTimeout(flushEvents, 400); }
  if (typeof addEventListener === 'function') addEventListener('pagehide', () => { if (EV_T) { clearTimeout(EV_T); flushEvents(); } });

  const business = {
    note: PROTOTYPE_NOTE,
    CHECKLIST, PHOTO_AREAS, checklistFor,
    // Převzetí profilu: data = {name, role, email, phone, note}. → záznam převzetí
    claim(id, data) {
      const d = data || {}, all = store.get('claims', {});
      const c = { placeId: id, place: placeRef(id), name: String(d.name || '').slice(0, 120), role: String(d.role || '').slice(0, 120), email: String(d.email || '').slice(0, 160), phone: String(d.phone || '').slice(0, 40), note: String(d.note || '').slice(0, 1000), date: today(), status: 'local' };
      all[id] = c; return store.set('claims', all) ? c : null;
    },
    claims() { const all = store.get('claims', {}); return Object.keys(all).map(k => all[k]).sort((a, b) => String(b.date).localeCompare(String(a.date))); },
    claimed(id) { return store.get('claims', {})[id] || null; },
    unclaim(id) { const all = store.get('claims', {}); delete all[id]; return store.set('claims', all); },
    // Profil podniku: {values:{klíč z CHECKLIST: hodnota}, photos:{oblast z PHOTO_AREAS: [dataURL]}, description, updated}
    profile(id) { return store.get('bizprofiles', {})[id] || null; },
    // data.values se slučují s uloženými; data.photos[oblast] = pole File/Blob/dataURL (nahradí fotky dané oblasti).
    // → Promise<{ok:true, profile} | {ok:false, error}>
    saveProfile(id, data) {
      const d = data || {}, all = store.get('bizprofiles', {});
      const cur = all[id] || { values: {}, photos: {}, description: '' };
      const values = Object.assign({}, cur.values);
      Object.keys(d.values || {}).forEach(k => { const v = d.values[k]; if (v === '' || v === null || v === undefined) delete values[k]; else values[k] = v; });
      const areas = Object.keys(d.photos || {});
      return Promise.all(areas.map(a => resizeAll(d.photos[a]))).then(res => {
        const photos = Object.assign({}, cur.photos); areas.forEach((a, i) => { photos[a] = res[i]; });
        const prof = { values, photos, description: d.description !== undefined ? String(d.description).slice(0, 3000) : cur.description, updated: today(), place: placeRef(id) };
        all[id] = prof;
        if (!store.set('bizprofiles', all)) return { ok: false, error: QUOTA_MSG };
        BIZ_REV++; BIZ_IDS = null;
        return { ok: true, profile: prof };
      }).catch(e => ({ ok: false, error: e.message || t('Fotku se nepodařilo zpracovat.') }));
    },
    // Postup checklistu: {done, total, pct, missing:[{key,label}], photosDone, photosTotal, complete}
    progress(id, cat) {
      const prof = business.profile(id) || { values: {}, photos: {} };
      const list = checklistFor(cat), ph = PHOTO_AREAS.filter(a => cat === 'ubytovani' || !a.hotel);
      const done = list.filter(c => prof.values[c.key] !== undefined && prof.values[c.key] !== '');
      const photosDone = ph.filter(a => (prof.photos[a.key] || []).length).length;
      const total = list.length + ph.length, have = done.length + photosDone;
      return { done: done.length, total: list.length, photosDone, photosTotal: ph.length, pct: total ? Math.round(have / total * 100) : 0, complete: have === total,
        missing: list.filter(c => !done.includes(c)).map(c => ({ key: c.key, label: c.label })).concat(ph.filter(a => !(prof.photos[a.key] || []).length).map(a => ({ key: 'foto:' + a.key, label: (t('Fotka') + ': ') + a.label }))) };
    },
    // Statistiky jen z tohoto prohlížeče: {views, impressions, requests, reports, reviews, photos, confirmations, first, last, local:true}
    stats(id) {
      const e = events()[id] || {};
      return { views: e.v || 0, impressions: e.i || 0, requests: community.requests(id).length, reports: community.reports(id).length,
        reviews: community.reviews(id).length, photos: community.photos(id).filter(x => x.from === 'review').length,
        confirmations: Object.keys(store.get('confirm', {})[id] || {}).length, first: e.first || null, last: e.last || null, local: true };
    },
    trackView(id) { if (id) bump(id, 'v'); },
    // Výskyt ve výsledcích: jednou za načtení stránky pro každé místo
    trackImpressions(ids) { (ids || []).forEach(id => { if (id && !IMPR_SEEN.has(id)) { IMPR_SEEN.add(id); bump(id, 'i'); } }); },
    // Co zlepšit: prvky, které chybí nebo je místo nemá → [{key, area, label, state:'missing'|'no'|'part', checklist}]
    improvements(p) {
      const s = facilitiesScore(p), out = [];
      s.missing.forEach(m => out.push({ key: m.key, area: m.area, label: m.label, state: 'missing' }));
      s.known.filter(k => k.v === false || k.v === 'part').forEach(k => out.push({ key: k.key, area: k.area, label: k.label, state: k.v === false ? 'no' : 'part' }));
      return out;
    },
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
    // Zobrazení detailu místa se počítá jen lokálně (statistiky podniku v prototypu)
    if (here() === 'misto.html') { const id = new URLSearchParams(location.search).get('id'); if (id) business.trackView(id); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function placeById(id) { return BYID.get(id) || (DATA || []).find(p => p.i === id); }
  function distanceKm(a, b) {
    const R = 6371, dLat = (b.la - a.la) * Math.PI / 180, dLng = (b.lo - a.lo) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.la * Math.PI / 180) * Math.cos(b.la * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  window.KP = Object.assign(window.KP || {}, { store, LANG, lc, nf, icon, CATS, SOURCES, W, T, FIELDS, getNeeds, setNeeds, completeness, missingFields, match, generalStatus, STATUS_LABEL, STATUS_SHORT,
    AIDS, DEFAULT_NEEDS, aidLabel, needsSummary, needsForm, AREAS, FEATURES, MEASURES, facts, facilitiesScore, matchScore, community, business, resizePhoto, PROTOTYPE_NOTE,
    fmt, fmtDate, ageLabel, sourceBadge, statusHtml, isOsm, osmUrl, osmEditUrl, commonsImg, commonsPage, gmaps, loadPlaces, loadStats, loadRegionsIndex, loadRegion, loadPlacesInBounds, loadAll, loadTowns, findPlace, findPlaces, placeUrl, rememberRegion, regionMeta, regionByName, isRegionLoaded, krajName, zemeOf, ZEME, ZEME_LONG, OSM_DATE, toast, saved, needsDrawer, esc, placeById, distanceKm, LOGO, moreSheet, toggleTheme });
  if (!window.KP.t) window.KP.t = t;
  if (!window.KP.tx) window.KP.tx = (x) => x;
  if (!window.KP.plural) window.KP.plural = (n, one, few, many) => { const a = Math.abs(n); return t(a === 1 ? one : a >= 2 && a <= 4 ? few : many); };
})();
