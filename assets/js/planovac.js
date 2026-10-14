/* Plánovač: sdílené jádro plánů (window.KPPlan) a stránka planovac.html (jednodenní výlet, členství PLUS).
   PROTOTYP bez serveru a bez AI: návrh skládají pravidla nad skutečnými daty (data/regions, data/trasy).
   Nic se nevymýšlí: časy a přesuny jsou odhad, chybějící údaje se ukazují jako nejistota.

   Jednotný formát itineráře (localStorage kp.itineraries, používá ho itinerar.js, planovac.js i dovolena.js):
     { id, name, note, date, v: 2, kind: 'manual' | 'day' | 'trip',
       meta: { area, date, days, mode, start },
       stops: [{ i, r, n, note, t: 'HH:MM' nebo '', dur: minuty, day: 0, 1, … }] }
   Zastávka-trasa má id „t:<id trasy>“. Sdílení bez serveru: itinerar.html#it=<base64 JSON>.
   FREE uloží FREE_IT_LIMIT itinerářů, PLUS bez omezení (KP.hasTier('unlimitedSaves')).
   Stránkové UI běží jen na body.page-planovac. */
(function () {
  'use strict';
  const K = window.KP, T = window.KPTrails, esc = K.esc, fmt = K.fmt;
  const t = (k, p) => K.t(k, p);

  // =====================================================================
  // Formát itineráře, ukládání a sdílení
  // =====================================================================
  const MAX_STOPS = 60, FREE_IT_LIMIT = 1;
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (min) => pad(Math.floor(min / 60) % 24) + ':' + pad(Math.round(min % 60));
  const toMin = (s) => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
  const isoDay = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseIso = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  const MODE_KEYS = ['walk', 'transit', 'car'];

  function normStop(s) {
    return {
      i: String(s.i || '').slice(0, 80), r: String(s.r || '').slice(0, 60), n: String(s.n || '').slice(0, 160), note: String(s.note || '').slice(0, 200),
      t: toMin(s.t) !== null ? s.t : '', dur: Math.max(0, Math.min(1440, Math.round(+s.dur || 0))), day: Math.max(0, Math.min(30, Math.round(+s.day || 0))),
    };
  }
  function normMeta(m) {
    const o = {}, x = m && typeof m === 'object' ? m : {};
    if (x.area) o.area = String(x.area).slice(0, 80);
    if (parseIso(x.date)) o.date = x.date;
    if (+x.days >= 1 && +x.days <= 14) o.days = Math.round(+x.days);
    if (MODE_KEYS.includes(x.mode)) o.mode = x.mode;
    if (toMin(x.start) !== null) o.start = x.start;
    return o;
  }
  function norm(it) {
    const o = Object.assign({ id: null, name: '', note: '', kind: 'manual', meta: {}, stops: [] }, it || {});
    o.v = 2;
    o.kind = ['manual', 'day', 'trip'].includes(o.kind) ? o.kind : 'manual';
    o.meta = normMeta(o.meta);
    o.stops = (Array.isArray(o.stops) ? o.stops : []).filter(s => s && s.i).slice(0, MAX_STOPS).map(normStop);
    o.name = String(o.name || '').slice(0, 80);
    return o;
  }
  const all = () => { const l = K.store.get('itineraries', []); return Array.isArray(l) ? l : []; };
  const uid = () => 'it' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function limit() { return K.hasTier('unlimitedSaves') ? Infinity : FREE_IT_LIMIT; }
  function exists(id) { return !!id && all().some(x => x.id === id); }
  function canSave(it) { return exists(it && it.id) || all().length < limit(); }
  // Uloží bez kontroly limitu (úprava už uloženého itineráře). Vrací uložený itinerář, nebo null (plné úložiště).
  function save(it) {
    const l = all(), item = norm(it);
    item.id = item.id || uid();
    item.date = isoDay(new Date());
    item.name = item.name || t('Můj itinerář');
    const i = l.findIndex(x => x.id === item.id);
    if (i >= 0) l[i] = item; else l.push(item);
    return K.store.set('itineraries', l) ? item : null;
  }
  // Nový itinerář: ve FREE nejvýš FREE_IT_LIMIT, jinak panel PLUS (prototyp, nic se neplatí)
  function saveGuarded(it, done) {
    const go = () => { const s = save(it); if (!s) { K.toast(t('Úložiště prohlížeče je plné.')); return; } if (done) done(s); };
    if (canSave(it)) { go(); return true; }
    K.toast(t('Ve FREE si uložíte {n} itinerář. PLUS ukládá bez omezení.', { n: FREE_IT_LIMIT }));
    return K.requireTier('unlimitedSaves', go);
  }
  function remove(id) { return K.store.set('itineraries', all().filter(x => x.id !== id)); }
  function openInItinerary(id) { K.store.set('itCurrent', id); location.href = 'itinerar.html'; }

  function encode(it) {
    const o = { n: it.name || '', s: (it.stops || []).map(s => { const a = [s.i, s.r || '', s.note || '']; if (s.t || s.day || s.dur) a.push(s.t || '', s.day || 0, s.dur || 0); return a; }) };
    if (it.kind && it.kind !== 'manual') o.k = it.kind;
    const m = normMeta(it.meta); if (Object.keys(m).length) o.m = m;
    return btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  }
  function decode(h) {
    try {
      const mm = String(h || '').match(/(?:^|[#&])it=([^&]+)/); if (!mm) return null;
      const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(mm[1])))));
      const stops = (Array.isArray(o.s) ? o.s : []).filter(x => Array.isArray(x) && typeof x[0] === 'string' && x[0].length < 80)
        .map(x => ({ i: x[0], r: x[1], note: x[2], t: x[3], day: x[4], dur: x[5] }));
      return norm({ id: null, name: String(o.n || t('Sdílený itinerář')), kind: o.k, meta: o.m, stops });
    } catch (e) { return null; }
  }
  const baseUrl = () => location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  function shareUrl(it) { return baseUrl() + 'itinerar.html#it=' + encodeURIComponent(encode(it)); }
  function kindLabel(it) {
    if (it.kind === 'day') return t('Jednodenní výlet');
    if (it.kind === 'trip') return t('Dovolená') + (it.meta && it.meta.days ? ', ' + it.meta.days + ' ' + K.plural(it.meta.days, 'den', 'dny', 'dní') : '');
    return t('Vlastní itinerář');
  }
  function download(name, text, type) {
    const b = new Blob([text], { type: type || 'text/plain' }), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }
  async function copyText(txt, input) {
    try { await navigator.clipboard.writeText(txt); K.toast(t('Odkaz je zkopírovaný.')); }
    catch (e) { if (input) { input.focus(); input.select(); } }
  }

  // =====================================================================
  // Pravidla plánování
  // =====================================================================
  const INTERESTS = [
    { k: 'pamatky', label: t('Památky a hrady'), dur: 75, test: p => p.c === 'pamatky' && !/Muzeum|Galerie|Zoo|Zábavní park/.test(p.s || '') },
    { k: 'muzea', label: t('Muzea a galerie'), dur: 90, test: p => p.c === 'pamatky' && /Muzeum|Galerie/.test(p.s || '') },
    { k: 'priroda', label: t('Příroda a vyhlídky'), dur: 60, test: p => p.c === 'priroda' || !!p._trail },
    { k: 'kultura', label: t('Divadlo, kino, kultura'), dur: 90, test: p => p.c === 'kultura' && !/Komunitní centrum|Knihovna/.test(p.s || '') },
    { k: 'zabava', label: t('Zoo a zábavní parky'), dur: 150, test: p => p.c === 'pamatky' && /Zoo|Zábavní park/.test(p.s || '') },
    { k: 'sport', label: t('Bazény a sport'), dur: 90, test: p => p.c === 'sport' },
    { k: 'kavarny', label: t('Kavárny a cukrárny'), dur: 45, test: p => p.c === 'restaurace' && /Kavárna|Zmrzlina/.test(p.s || '') },
  ];
  const INT = {}; INTERESTS.forEach(x => { INT[x.k] = x; });
  const interestOf = (p) => { const x = INTERESTS.find(i => i.test(p)); return x ? x.k : null; };
  const LUNCH = /^(Restaurace|Hospoda|Pivní zahrádka|Rychlé občerstvení)$/;
  // Rychlost a dosah podle dopravy (odhad pro plánování, ne jízdní řád)
  const MODES = {
    walk: { label: t('Pěšky nebo na vozíku'), short: t('pěšky nebo na vozíku'), radius: 2.5, lunchR: 0.8, speed: 3, detour: 1.3, overhead: 0, gm: 'walking' },
    transit: { label: t('MHD a vlak'), short: t('MHD a vlakem'), radius: 12, lunchR: 3, speed: 20, detour: 1.3, overhead: 15, gm: 'transit' },
    car: { label: t('Autem'), short: t('autem'), radius: 30, lunchR: 8, speed: 45, detour: 1.35, overhead: 10, gm: 'driving' },
  };
  const PACE = {
    calm: { label: t('Klidné'), hint: t('3 zastávky, delší pauzy'), max: 3, buffer: 20, end: 16 * 60 + 30 },
    normal: { label: t('Střední'), hint: t('4 zastávky'), max: 4, buffer: 10, end: 17 * 60 + 30 },
    full: { label: t('Nabité'), hint: t('až 6 zastávek'), max: 6, buffer: 5, end: 18 * 60 + 30 },
  };
  const BUDGET = {
    any: { label: t('Nehraje roli') },
    low: { label: t('Spíš levně') },
    free: { label: t('Co nejlevněji') },
  };
  const ceil5 = (m) => Math.ceil(m / 5) * 5;
  function travelMin(dKm, mode) {
    if (dKm < 0.05) return 0;
    const M = MODES[mode] || MODES.walk;
    if (dKm * M.detour <= 1) return ceil5(dKm * MODES.walk.detour / MODES.walk.speed * 60); // krátký kus vždy pěšky
    return ceil5(M.overhead + dKm * M.detour / M.speed * 60);
  }
  function distTxt(km) { return km < 1 ? Math.round(km * 100) * 10 + ' m' : fmt((Math.round(km * 10) / 10).toFixed(1)) + ' km'; }

  // ---------- Otevírací doba (jednoduché čtení zápisu z OpenStreetMap) ----------
  // Vrací { known, open, ranges }. known = false, když zápis neumíme spolehlivě přečíst: pak nic nevyřazujeme.
  const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function parseDays(s) {
    const out = new Set();
    for (const part of s.split(',')) {
      const x = part.trim().split(/\s*-\s*/);
      const a = DAYS.indexOf(x[0]), b = x[1] ? DAYS.indexOf(x[1]) : a;
      if (a < 0 || b < 0 || x.length > 2) return null;
      for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
    }
    return out;
  }
  function hoursOn(oh, date) {
    if (!oh || !date) return { known: false };
    const s = String(oh).trim();
    if (s === '24/7') return { known: true, open: true, ranges: [[0, 1440]] };
    const wd = (date.getDay() + 6) % 7, mon = date.getMonth();
    let ranges = null, matched = false;
    for (let rule of s.split(';')) {
      rule = rule.trim(); if (!rule) continue;
      if (/^PH\b/.test(rule)) continue; // svátky neřešíme
      const mr = rule.match(/^([A-Za-z]{3,9})\s*-\s*([A-Za-z]{3,9})\s+(.*)$/);
      if (mr) {
        const a = MONTHS.indexOf(mr[1].slice(0, 3).toLowerCase()), b = MONTHS.indexOf(mr[2].slice(0, 3).toLowerCase());
        if (a >= 0 && b >= 0) { const inR = a <= b ? (mon >= a && mon <= b) : (mon >= a || mon <= b); if (!inR) continue; rule = mr[3].trim(); }
      }
      let days, times;
      const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/);
      if (m) { days = parseDays(m[1].replace(/\s+/g, '')); times = m[2].trim(); }
      else if (/^\d{1,2}:\d{2}/.test(rule)) { days = new Set([0, 1, 2, 3, 4, 5, 6]); times = rule; }
      else return { known: false };
      if (!days) return { known: false };
      if (!days.has(wd)) continue;
      matched = true;
      if (/^(off|closed)$/i.test(times)) { ranges = []; continue; }
      const rs = [];
      for (const part of times.split(',')) {
        const x = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/);
        if (!x) return { known: false };
        rs.push([+x[1] * 60 + +x[2], +x[3] * 60 + +x[4] || 1440]);
      }
      ranges = rs;
    }
    if (!matched) return { known: true, open: false, ranges: [] };
    return { known: true, open: ranges.length > 0, ranges };
  }
  // true = návštěva se do otevírací doby vejde, false = nevejde, null = nevíme
  function fitsHours(h, arr, dur) {
    if (!h || !h.known) return null;
    const need = Math.min(dur, 45);
    return h.ranges.some(([a, b]) => arr >= a - 15 && arr + need <= b);
  }

  // ---------- Hodnocení kandidáta ----------
  function access(p, needs) {
    if (p._trail) {
      if (needs.active) { const r = T.match(p._trail, needs); return { st: r.status, pct: r.pct, r }; }
      return { st: T.wh(p._trail)[0], pct: null, r: null };
    }
    if (needs.active) { const r = K.matchScore(p, needs); return { st: r.status, pct: r.pct, r }; }
    return { st: K.generalStatus(p), pct: null, r: null };
  }
  const ST_PTS = { ok: 3, unk: 1.2, part: 0.8 };
  // null = místo nebereme (nevyhovuje, nebo se podle zvoleného rozpočtu platí)
  function baseScore(p, ctx) {
    const a = access(p, ctx.needs);
    if (a.st === 'no') return null;
    if (ctx.budget === 'free' && p.fee === 'yes') return null;
    let s = ST_PTS[a.st] || 1;
    if (a.pct !== null && a.pct !== undefined) s += a.pct / 100;
    if (p._trail) s += 0.5;
    else {
      a.fs = K.facilitiesScore(p);
      s += (a.fs.total || 0) / 50 + a.fs.coverage / 200;
      if (p.r && p.r.length) s += 0.6;
      if (p.x && p.x.length) s += 0.4;
      if (p.cd) s += 0.2;
      if (p.img) s += 0.3;
    }
    if (ctx.budget === 'low') { if (p.fee === 'no') s += 0.8; else if (p.fee === 'yes') s -= 0.8; }
    if (ctx.budget === 'free' && p.fee === 'no') s += 1;
    return { s, a };
  }
  function trailPlaces(trails, center, radius) {
    return (trails || []).filter(tr => tr.start && K.distanceKm(center, { la: tr.start[0], lo: tr.start[1] }) <= radius)
      .map(tr => ({ _trail: tr, i: 't:' + tr.id, n: T.name(tr), c: 'trasa', la: tr.start[0], lo: tr.start[1], s: t('Trasa') }));
  }
  function durOf(p, ik) {
    if (p._trail) return Math.min(180, Math.max(30, ceil5((p._trail.delka_km || 1) / 3 * 60) + 15));
    return (INT[ik] || {}).dur || 60;
  }

  // Načte místa v okruhu (celé regiony z cache, pak přesný filtr na vzdálenost) a trasy z katalogu
  async function loadArea(center, radiusKm) {
    const dLa = radiusKm / 111, dLo = radiusKm / (111 * Math.cos(center.la * Math.PI / 180));
    const b = { s: center.la - dLa, n: center.la + dLa, w: center.lo - dLo, e: center.lo + dLo };
    const [places, trails] = await Promise.all([K.loadPlacesInBounds(b), T ? T.load().catch(() => []) : Promise.resolve([])]);
    return places.filter(p => K.distanceKm(center, p) <= radiusKm).concat(trailPlaces(trails, center, radiusKm));
  }

  // ---------- Kandidáti pro jeden den ----------
  function candidates(ctx) {
    const out = [], lunch = [];
    let closed = 0, unfit = 0;
    ctx.pool.forEach(p => {
      if (ctx.exclude && ctx.exclude.has(p.i)) return;
      const isLunch = p.c === 'restaurace' && LUNCH.test(p.s || '');
      const ik = interestOf(p);
      if (!isLunch && (!ik || !ctx.interests.includes(ik))) return;
      const h = p._trail ? { known: false } : hoursOn(p.oh, ctx.date);
      if (h.known && !h.open) { if (!isLunch) closed++; return; }
      const b = baseScore(p, ctx);
      if (!b) { if (!isLunch) unfit++; return; }
      const c = { p, ik: isLunch ? 'obed' : ik, s: b.s, a: b.a, h };
      (isLunch ? lunch : out).push(c);
      if (isLunch && ik && ctx.interests.includes(ik)) out.push(Object.assign({}, c, { ik }));
    });
    return { list: out, lunch, closed, unfit };
  }

  // ---------- Sestavení dne ----------
  // ctx: { pool, interests, mode, pace, budget, date, start (min), end (min), lunch, needs, exclude:Set, from:{la,lo,n?}, maxStops }
  function planDay(ctx) {
    const M = MODES[ctx.mode] || MODES.car, P = PACE[ctx.pace] || PACE.normal;
    const C = candidates(ctx);
    const end = ctx.end || P.end, maxN = ctx.maxStops || P.max;
    const used = new Map(), taken = new Set(), stops = [];
    let cur = ctx.from, time = ctx.start, lunchDone = !ctx.lunch, lunchMissing = false, guard = 0;
    const fromNamed = !!(ctx.from && ctx.from.n);
    // Výlet má zůstat u zvolené obce: penalizujeme i vzdálenost od výchozího bodu, ne jen od předchozí zastávky.
    // Stejné místo zapsané v datech dvakrát (např. „Stein-Welten“ a „Granitmuseum Steinwelten“) nebereme podruhé.
    const home = ctx.from;
    const nameKey = (x) => String(x.n || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
    const isDup = (x) => { const b = nameKey(x); return b.length >= 5 && stops.some(st => { const a = nameKey(st.p); return a.length >= 5 && (a.includes(b) || b.includes(a)) && K.distanceKm(st.p, x) < 0.5; }); };
    while (stops.filter(x => !x.lunch).length < maxN && guard++ < 30) {
      if (!lunchDone && time >= 11 * 60 + 30) {
        lunchDone = true;
        let best = null, bv = -Infinity;
        C.lunch.forEach(c => {
          if (taken.has(c.p.i)) return;
          const d = K.distanceKm(cur, c.p); if (d > M.lunchR) return;
          const tr = travelMin(d, ctx.mode), fit = fitsHours(c.h, time + tr, 60);
          const v = c.s - d / M.lunchR * 2 - (fit === false ? 3 : 0);
          if (v > bv) { bv = v; best = { c, d, tr, fit }; }
        });
        if (best) { stops.push(mkStop(best.c, best.d, best.tr, time + best.tr, 60, best.fit, true)); taken.add(best.c.p.i); time = time + best.tr + 60 + P.buffer; cur = best.c.p; }
        else lunchMissing = true;
        continue;
      }
      let best = null, bv = -Infinity;
      C.list.forEach(c => {
        if (taken.has(c.p.i) || isDup(c.p)) return;
        const d = K.distanceKm(cur, c.p);
        const tr = !stops.length && !fromNamed ? 0 : travelMin(d, ctx.mode);
        const arr = time + tr, dur = durOf(c.p, c.ik);
        if (arr + dur > end) return;
        const fit = fitsHours(c.h, arr, dur);
        const v = c.s - d / M.radius * 2.5 - (home && M.radius > 5 ? K.distanceKm(home, c.p) / M.radius * 2 : 0) - (used.get(c.ik) || 0) * 1.2 - (fit === false ? 2.5 : 0);
        if (v > bv) { bv = v; best = { c, d, tr, arr, dur, fit }; }
      });
      if (!best) break;
      stops.push(mkStop(best.c, best.d, best.tr, best.arr, best.dur, best.fit, false));
      taken.add(best.c.p.i); used.set(best.c.ik, (used.get(best.c.ik) || 0) + 1);
      time = best.arr + best.dur + P.buffer; cur = best.c.p;
    }
    // Oběd, když program skončil před polednem, nepřidáváme. Když nebyl nalezen, řekneme to.
    return { stops, cands: C, lunchMissing, considered: C.list.length, closed: C.closed, unfit: C.unfit };
  }
  function mkStop(c, d, tr, arr, dur, fit, lunch) {
    return { p: c.p, ik: c.ik, a: c.a, s: c.s, h: c.h, dist: d, travel: tr, arr, dur, fit, lunch: !!lunch };
  }
  // Přepočítá časy dne po změně (alternativa)
  function retime(day, ctx) {
    const P = PACE[ctx.pace] || PACE.normal;
    let cur = day.from, time = day.start;
    const fromNamed = !!(day.from && day.from.n);
    day.stops.forEach((s, i) => {
      s.dist = K.distanceKm(cur, s.p);
      s.travel = !i && !fromNamed ? 0 : travelMin(s.dist, ctx.mode);
      s.arr = time + s.travel;
      s.fit = fitsHours(s.h, s.arr, s.dur);
      time = s.arr + s.dur + P.buffer; cur = s.p;
    });
  }

  // ---------- Doplňky zastávky: WC, parkování ZTP, nádraží ----------
  function nearest(pool, p, test, r) {
    let best = null;
    pool.forEach(x => { if (x === p || x.i === p.i || !test(x)) return; const d = K.distanceKm(p, x); if (d <= r && (!best || d < best.d)) best = { x, d }; });
    return best;
  }
  function extras(stop, pool, mode) {
    const p = stop.p, ex = {};
    if (!p._trail) {
      const f = K.facts(p).f.wcBb;
      if (f && f.v === true) ex.wcHere = f;
    }
    if (!ex.wcHere) ex.wc = nearest(pool, p, x => x.c === 'wc' && x.w === 'yes', 0.6);
    ex.park = nearest(pool, p, x => x.c === 'parkovani', mode === 'car' ? 0.5 : 0.3);
    if (mode === 'transit') ex.station = nearest(pool, p, x => x.c === 'doprava', 1.5);
    stop.ex = ex;
    return ex;
  }

  // ---------- Důvody výběru a nejistoty ----------
  const KEY_UNK = ['bezSchodu', 'dvere80', 'prah2', 'wcBb', 'parkZTP'];
  function reasons(stop) {
    const p = stop.p, a = stop.a || {}, out = [];
    if (p._trail) {
      const tr = p._trail;
      out.push(T.wh(tr)[1]);
      out.push(t('Délka {km}, největší sklon {s}', { km: T.km(tr.delka_km), s: T.pct(tr.max_sklon) }));
      return out;
    }
    if (a.r) out.push(a.pct === null ? t('Shoda s profilem: chybí údaje') : t('Shoda s vaším profilem {pct} %', { pct: a.pct }));
    else out.push(K.W[p.w || 'null'].label + ' ' + t('(OpenStreetMap)'));
    const kn = (a.fs ? a.fs.known : []).filter(k => k.v === true && k.key !== 'bezSchodu').slice(0, 3).map(k => k.label);
    if (kn.length) out.push(kn.join(', '));
    if (p.r && p.r.length) out.push(t('Údaje z webu provozovatele ({d})', { d: K.fmtDate(p.r[0].date) }));
    if (p.x && p.x.length) out.push(t('Naměřené údaje z otevřených dat'));
    if (p.cd) out.push(t('Kontrola na místě {d}', { d: K.fmtDate(p.cd) }));
    return out;
  }
  function unknowns(stop) {
    const p = stop.p, a = stop.a || {}, u = [];
    if (p._trail) { u.push(t('Sklon je odhad z výškového modelu, ne měření na místě')); return u; }
    if (a.r) a.r.unknown.slice(0, 3).forEach(x => u.push(x));
    else if (a.fs) a.fs.missing.filter(m => KEY_UNK.includes(m.key)).slice(0, 3).forEach(m => u.push(m.label));
    if (!p.oh && p.c !== 'priroda') u.push(t('Otevírací doba'));
    else if (p.oh && stop.h && !stop.h.known) u.push(t('Otevírací dobu jsme nepřečetli, ověřte ji'));
    return u;
  }
  function feeTxt(p) {
    if (p._trail || p.c === 'priroda') return '';
    if (p.fee === 'no') return t('Vstup zdarma (OpenStreetMap)');
    if (p.fee === 'yes') return t('Vstupné se platí, cenu neznáme');
    return p.c === 'restaurace' ? '' : t('Vstupné v datech neuvedeno');
  }

  // ---------- Výběr oblasti ----------
  // Výchozí oblast „Jižní Čechy a Bavorsko“: z obcí v jižních Čechách, Dolním Bavorsku a Horní Falci vybereme
  // tu, kde je pro zvolené zájmy nejvíc vhodných míst s údaji.
  const AUTO_REGIONS = ['cz-jihocesky', 'de-dolni-bavorsko', 'de-horni-falc'];
  const AUTO_LABEL = t('Jižní Čechy a Bavorsko');
  const SUGGEST = ['České Budějovice', 'Český Krumlov', 'Třeboň', 'Tábor', 'Passau', 'Regensburg', 'Straubing'];
  let TOWNS = null;
  async function towns() { if (!TOWNS) TOWNS = await K.loadTowns(); return TOWNS; }
  const isAuto = (v) => !String(v || '').trim() || String(v).trim().toLowerCase() === AUTO_LABEL.toLowerCase() || String(v).trim().toLowerCase() === 'jižní čechy a bavorsko';
  function townCenter(x) { return { la: (x[3] + x[5]) / 2, lo: (x[4] + x[6]) / 2 }; }
  async function findTown(name) {
    const list = await towns(), q = String(name || '').trim().toLowerCase();
    if (!q) return null;
    const exact = list.filter(x => x[0].toLowerCase() === q).sort((a, b) => b[2] - a[2]);
    return exact[0] || list.filter(x => x[0].toLowerCase().startsWith(q)).sort((a, b) => b[2] - a[2])[0] || null;
  }
  // Seřazené obce z výchozí oblasti podle toho, kolik vhodných míst mají v okruhu
  async function autoTowns(ctx, extraTest) {
    const list = (await towns()).filter(x => AUTO_REGIONS.includes(x[1]) && x[2] >= 40);
    const places = [].concat(...await Promise.all(AUTO_REGIONS.map(id => K.loadRegion(id).catch(() => []))));
    const radius = Math.min((MODES[ctx.mode] || MODES.car).radius, 15);
    const scored = [];
    places.forEach(p => {
      const ik = interestOf(p); if (!ik || !ctx.interests.includes(ik)) return;
      const b = baseScore(p, ctx); if (b) scored.push({ p, s: b.s, ik });
    });
    const extra = extraTest ? places.filter(extraTest) : [];
    return list.map(x => {
      const c = townCenter(x);
      const near = scored.filter(o => K.distanceKm(c, o.p) <= radius).sort((a, b) => b.s - a.s);
      const kinds = new Set(near.slice(0, 12).map(o => o.ik)).size;
      const ex = extra.filter(p => K.distanceKm(c, p) <= radius).length;
      const v = near.slice(0, 6).reduce((s, o) => s + o.s, 0) + kinds * 1.5 + Math.min(ex, 5) * (extraTest ? 1.5 : 0) - (extraTest && !ex ? 50 : 0);
      return { x, c, v, n: near.length };
    }).filter(o => o.n >= 2).sort((a, b) => b.v - a.v);
  }

  // ---------- Výstup: HTML zastávek ----------
  const krajT = (k) => (k && K.LANG !== 'cs' ? K.krajName(k) : (k || ''));
  function placeLink(p) { return p._trail ? T.detailUrl(p._trail) : K.placeUrl(p); }
  function catLabel(p, ik) {
    if (p._trail) return t('Bezbariérová trasa');
    if (ik === 'obed') return t('Oběd');
    return (K.CATS[p.c] || {}).label || t('Místo');
  }
  function statusOf(stop) {
    const p = stop.p, a = stop.a || {};
    if (a.r) return K.statusHtml(a.st, a.pct === null ? t('Chybí údaje') : t('{pct} % shoda', { pct: a.pct }));
    if (p._trail) { const w = T.wh(p._trail); return K.statusHtml(w[0], w[1]); }
    const w = K.W[p.w || 'null'];
    return K.statusHtml(w.st, w.label);
  }
  const gmDir = (a, b, mode) => 'https://www.google.com/maps/dir/?api=1' + (a ? '&origin=' + a.la + '%2C' + a.lo : '') + '&destination=' + b.la + '%2C' + b.lo + '&travelmode=' + mode;
  function legHtml(prev, stop, mode, fromLabel) {
    const M = MODES[mode] || MODES.walk;
    const short = stop.dist * M.detour <= 1;
    const how = short ? MODES.walk.short : M.short;
    return '<li class="it-leg pl-leg"><span class="it-leg-line" aria-hidden="true"></span><div class="it-leg-b">' +
      '<p class="small"><b>' + (fromLabel ? esc(fromLabel) : t('Přesun')) + '</b> · ' + t('asi {m} min {how}', { m: stop.travel, how }) +
      ' · ' + t('vzdušnou čarou') + ' <span class="num">' + distTxt(stop.dist) + '</span> <span class="muted">(' + t('odhad') + ')</span></p>' +
      '<div class="it-leg-links"><a class="btn btn-ghost btn-sm" href="' + gmDir(prev, stop.p, short ? 'walking' : M.gm) + '" target="_blank" rel="noopener">' + K.icon('nav') + t('Navigace v Google Maps') + '</a></div></div></li>';
  }
  function stopHtml(stop, idx, o) {
    const p = stop.p, ex = stop.ex || {};
    const why = reasons(stop), unk = unknowns(stop), fee = feeTxt(p);
    const svc = [];
    if (ex.wcHere) svc.push(t('Bezbariérové WC přímo na místě'));
    else if (ex.wc) svc.push(t('Bezbariérové WC {d} odsud', { d: distTxt(ex.wc.d) }) + ': <a href="' + K.placeUrl(ex.wc.x) + '">' + esc(ex.wc.x.n) + '</a>');
    else if (!p._trail) svc.push(t('Bezbariérové WC poblíž v datech nemáme'));
    if (ex.park) svc.push(t('Parkování ZTP {d} odsud', { d: distTxt(ex.park.d) }) + (ex.park.x.pk ? ' (' + t('počet stání: {n}', { n: ex.park.x.pk }) + ')' : '') + ': <a href="' + K.placeUrl(ex.park.x) + '">' + esc(ex.park.x.n || t('Parkování ZTP')) + '</a>');
    else if (o.mode === 'car') svc.push(t('Vyhrazené stání ZTP do 500 m v datech nemáme'));
    if (ex.station) svc.push(t('Nádraží {d} odsud', { d: distTxt(ex.station.d) }) + ': <a href="' + K.placeUrl(ex.station.x) + '">' + esc(ex.station.x.n) + '</a> ' + K.statusHtml(K.W[ex.station.x.w || 'null'].st, K.W[ex.station.x.w || 'null'].short));
    let hours = '';
    if (p.oh) hours = '<p class="small pl-oh">' + t('Otevírací doba podle OpenStreetMap') + ': <span class="num">' + esc(p.oh) + '</span>' +
      (stop.fit === false ? ' <b class="pl-warn">' + K.icon('warn') + t('V plánovaný čas může být zavřeno.') + '</b>' : '') + '</p>';
    const head = [catLabel(p, stop.ik), p._trail ? krajT(p._trail.kraj) : p.o, stop.ik !== 'obed' && INT[stop.ik] && !p._trail ? INT[stop.ik].label : ''].filter(Boolean).map(esc).join(' · ');
    return '<li class="it-stop pl-stop" data-stop="' + idx + '"><span class="pl-time num"><b>' + hm(stop.arr) + '</b><span>' + stop.dur + ' min</span></span>' +
      '<div class="it-stop-b"><p class="it-stop-k">' + head + '</p>' +
      '<h3><a href="' + placeLink(p) + '">' + esc(p.n) + '</a></h3>' +
      '<p class="it-stop-st">' + statusOf(stop) + (fee ? ' <span class="small muted">' + esc(fee) + '</span>' : '') + '</p>' +
      '<p class="pl-k">' + t('Proč tady') + '</p><ul class="pl-why">' + why.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      (unk.length ? '<p class="pl-unk"><b>' + t('Nevíme') + ':</b> ' + unk.map(esc).join(' · ') + '</p>' : '') +
      hours +
      (svc.length ? '<ul class="pl-svc">' + svc.map(x => '<li>' + x + '</li>').join('') + '</ul>' : '') +
      '<div class="pl-links"><a class="btn btn-ghost btn-sm" href="' + placeLink(p) + '">' + t('Detail místa') + '</a>' +
      '<a class="btn btn-quiet btn-sm" href="' + gmDir(null, p, (MODES[o.mode] || MODES.walk).gm) + '" target="_blank" rel="noopener">' + t('Navigovat sem') + '</a>' +
      (o.alt ? '<button class="btn btn-quiet btn-sm" type="button" data-alt="' + idx + '">' + t('Navrhnout alternativu') + ' ' + K.tierBadge('alternatives', { onlyLocked: true }) + '</button>' : '') +
      '</div>' + (stop.altOf ? '<p class="small muted">' + t('Náhrada za: {n}', { n: esc(stop.altOf) }) + '</p>' : '') + '</div></li>';
  }
  // Celý den: zastávky a přesuny mezi nimi. o = { mode, alt, prefix (pro data-stop), from (bod startu s názvem) }
  function dayHtml(day, o) {
    let prev = day.from && day.from.n ? day.from : null;
    return day.stops.map((s, i) => {
      const leg = prev ? legHtml(prev, s, o.mode, !i && day.from && day.from.n ? t('Z místa {n}', { n: day.from.n }) : '') : '';
      prev = s.p;
      return leg + stopHtml(s, (o.prefix || '') + i, o);
    }).join('');
  }
  function toStops(day, dayIdx) {
    return day.stops.map(s => ({ i: s.p.i, r: s.p._r || '', n: s.p.n, note: '', t: hm(s.arr), dur: s.dur, day: dayIdx || 0 }));
  }

  // ---------- Mapa plánu ----------
  async function drawMap(el, state, groups) {
    if (!el || !window.KPMap) return;
    try {
      if (!state.map) state.map = await KPMap.create(el, { lat: 49.0, lng: 13.6, zoom: 7 });
      const map = state.map;
      map.clearLayer(state.layers || []); state.layers = [];
      const pts = []; let n = 0;
      groups.forEach(g => {
        let prev = g.from && g.from.n ? g.from : null;
        if (prev) { state.layers.push(T.drawPin(map, [prev.la, prev.lo], T.pinSvg('H', 'end'), 28, prev.n)); pts.push(prev); }
        g.stops.forEach(s => {
          n++;
          if (prev) state.layers.push(T.drawPath(map, [[prev.la, prev.lo], [s.p.la, s.p.lo]], { color: '#101010', weight: 3, dash: '6 8', cap: 'butt' }));
          state.layers.push(T.drawPin(map, [s.p.la, s.p.lo], T.pinSvg(String(n), 'start'), 28, n + '. ' + s.p.n));
          pts.push(s.p); prev = s.p;
        });
      });
      if (pts.length) map.fitTo(pts);
    } catch (e) { el.innerHTML = '<p class="muted small pl-maperr">' + t('Mapu se nepodařilo načíst. Plán funguje dál.') + '</p>'; }
  }

  // ---------- Profil potřeb (mobilita) ----------
  function mobilityHtml() {
    const n = K.getNeeds();
    if (!K.hasTier('needsProfile')) return '<p class="small">' + t('Bez PLUS plán vybírá podle obecného údaje o vstupu z OpenStreetMap.') + ' ' + K.tierBadge('needsProfile') + '</p>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-needs>' + t('Nastavit profil potřeb') + '</button>';
    if (!n.active) return '<p class="small">' + t('Profil potřeb nemáte zapnutý. Plán zatím vybírá podle obecného údaje o vstupu.') + '</p>' +
      '<button class="btn btn-primary btn-sm" type="button" data-needs>' + t('Nastavit profil potřeb') + '</button>';
    return '<p class="small"><b>' + t('Plán vybírá podle vašeho profilu') + ':</b> ' + esc(K.needsSummary(n).join(', ')) + '</p>' +
      '<button class="btn btn-quiet btn-sm" type="button" data-needs>' + t('Upravit profil') + '</button>';
  }

  // ---------- Formulář (společné pole pro oba plánovače) ----------
  function chipsHtml(name, items, selected, multi) {
    return items.map(([k, label]) => '<button type="button" class="chip" data-' + name + '="' + k + '" aria-pressed="' + (multi ? selected.includes(k) : selected === k) + '">' + esc(label) + '</button>').join('');
  }
  function bindChips(root, name, multi, onChange) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-' + name + ']'); if (!b) return;
      if (multi) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
      else root.querySelectorAll('[data-' + name + ']').forEach(x => x.setAttribute('aria-pressed', x === b));
      if (onChange) onChange();
    });
  }
  const chipVals = (root, name) => [...root.querySelectorAll('[data-' + name + '][aria-pressed="true"]')].map(b => b.getAttribute('data-' + name));
  async function fillTownList(dl) {
    try {
      const list = await towns();
      dl.innerHTML = '<option value="' + esc(AUTO_LABEL) + '">' + [...new Set(list.slice(0, 1500).map(x => x[0]))].map(n => '<option value="' + esc(n) + '">').join('');
    } catch (e) { /* bez nabídky obcí */ }
  }
  function weekday(d) { try { return d.toLocaleDateString(KP.i18n ? KP.i18n.locale() : 'cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' }); } catch (e) { return isoDay(d); } }

  window.KPPlan = {
    MAX_STOPS, FREE_IT_LIMIT, hm, toMin, isoDay, parseIso, normStop, norm, all, limit, canSave, save, saveGuarded, remove, exists, openInItinerary,
    encode, decode, shareUrl, kindLabel, download, copyText, baseUrl,
    INTERESTS, INT, MODES, PACE, BUDGET, LUNCH, AUTO_LABEL, AUTO_REGIONS, SUGGEST, interestOf, travelMin, distTxt, hoursOn, fitsHours, access, baseScore,
    loadArea, candidates, planDay, retime, durOf, mkStop, extras, nearest, reasons, unknowns, feeTxt, towns, isAuto, findTown, townCenter, autoTowns,
    statusOf, catLabel, placeLink, dayHtml, stopHtml, legHtml, toStops, drawMap, mobilityHtml, chipsHtml, bindChips, chipVals, fillTownList, weekday, gmDir, krajT,
  };

  if (!document.body || !document.body.classList.contains('page-planovac')) return;

  // =====================================================================
  // Stránka planovac.html: jednodenní výlet
  // =====================================================================
  const $ = (s, r) => (r || document).querySelector(s);
  const FORM_KEY = 'planForm';
  const S = { plan: null, map: null, layers: [], asked: false, seq: 0 };

  function readForm() {
    const f = $('#pl-form');
    return {
      area: $('#pl-area').value.trim(), date: $('#pl-date').value, start: $('#pl-start').value || '09:30',
      interests: chipVals(f, 'int'), mode: chipVals(f, 'mode')[0] || 'car', pace: chipVals(f, 'pace')[0] || 'normal',
      budget: $('#pl-budget').value || 'any', lunch: $('#pl-lunch').checked,
    };
  }
  function fillForm() {
    const saved = K.store.get(FORM_KEY, {}) || {};
    const sp = new URLSearchParams(location.search);
    const tm = new Date(); tm.setDate(tm.getDate() + 1);
    const v = {
      area: sp.get('obec') || saved.area || AUTO_LABEL, date: parseIso(sp.get('datum')) ? sp.get('datum') : (saved.date && parseIso(saved.date) && parseIso(saved.date) >= parseIso(isoDay(new Date())) ? saved.date : isoDay(tm)),
      start: toMin(saved.start) !== null ? saved.start : '09:30',
      interests: Array.isArray(saved.interests) && saved.interests.length ? saved.interests.filter(k => INT[k]) : ['pamatky', 'muzea', 'priroda'],
      mode: MODES[saved.mode] ? saved.mode : 'car', pace: PACE[saved.pace] ? saved.pace : 'normal', budget: BUDGET[saved.budget] ? saved.budget : 'any', lunch: saved.lunch !== false,
    };
    $('#pl-area').value = isAuto(v.area) ? AUTO_LABEL : v.area;
    $('#pl-date').value = v.date; $('#pl-start').value = v.start;
    $('#pl-int').innerHTML = chipsHtml('int', INTERESTS.map(x => [x.k, x.label]), v.interests, true);
    $('#pl-mode').innerHTML = chipsHtml('mode', MODE_KEYS.map(k => [k, MODES[k].label]), v.mode, false);
    $('#pl-pace').innerHTML = chipsHtml('pace', Object.keys(PACE).map(k => [k, PACE[k].label + ': ' + PACE[k].hint]), v.pace, false);
    $('#pl-budget').innerHTML = Object.keys(BUDGET).map(k => '<option value="' + k + '"' + (k === v.budget ? ' selected' : '') + '>' + esc(BUDGET[k].label) + '</option>').join('');
    $('#pl-lunch').checked = v.lunch;
    $('#pl-sug').innerHTML = [AUTO_LABEL].concat(SUGGEST).map(n => '<button type="button" class="chip" data-town="' + esc(n) + '">' + esc(n) + '</button>').join('');
    return sp.get('obec') ? true : false;
  }

  function setStatus(html) { $('#pl-out').innerHTML = '<div class="pl-status" role="status">' + html + '</div>'; }

  async function run(fromSubmit) {
    const seq = ++S.seq;
    const f = readForm();
    if (!f.interests.length) { K.toast(t('Vyberte aspoň jeden zájem.')); return; }
    const date = parseIso(f.date);
    if (!date) { K.toast(t('Zadejte datum výletu.')); $('#pl-date').focus(); return; }
    K.store.set(FORM_KEY, f);
    setStatus('<p>' + t('Načítám data a skládám plán…') + '</p>');
    const needs = K.getNeeds();
    const ctx = { interests: f.interests, mode: f.mode, pace: f.pace, budget: f.budget, date, start: toMin(f.start), lunch: f.lunch, needs, exclude: new Set() };
    let area;
    try {
      if (isAuto(f.area)) {
        const list = await autoTowns(ctx);
        if (!list.length) { setStatus('<p>' + t('Pro zvolené zájmy jsme v jižních Čechách a Bavorsku nenašli vhodné místo. Zkuste přidat další zájmy.') + '</p>'); return; }
        area = { label: list[0].x[0], center: list[0].c, auto: true, alts: list.slice(1, 6).map(o => o.x[0]) };
      } else {
        const x = await findTown(f.area);
        if (!x) { setStatus('<p>' + t('Obec „{q}“ v našich datech nemáme. Zkuste jiný název, nebo nechte oblast Jižní Čechy a Bavorsko.', { q: esc(f.area) }) + '</p>'); return; }
        area = { label: x[0], center: townCenter(x), auto: false, region: x[1] };
      }
      const M = MODES[f.mode];
      ctx.pool = await loadArea(area.center, M.radius);
    } catch (e) { setStatus('<p>' + t('Data se nepodařilo načíst. Zkuste to znovu.') + '</p>'); return; }
    if (seq !== S.seq) return;
    ctx.from = area.center;
    const res = planDay(ctx);
    res.stops.forEach(s => extras(s, ctx.pool, f.mode));
    const day = { from: area.center, start: ctx.start, stops: res.stops };
    S.plan = { f, ctx, area, res, day, date };
    render();
    if (fromSubmit) {
      const out = $('#pl-out'); if (out && matchMedia('(max-width: 899px)').matches) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!K.hasTier('dayPlanner') && res.stops.length) K.requireTier('dayPlanner', render);
    }
  }

  function toItinerary() {
    const P = S.plan;
    return norm({
      name: t('Výlet: {a}', { a: P.area.label }) + ', ' + K.fmtDate(P.f.date), kind: 'day',
      meta: { area: P.area.label, date: P.f.date, mode: P.f.mode, start: P.f.start }, stops: toStops(P.day, 0),
    });
  }

  function summaryHtml(full) {
    const P = S.plan, st = P.day.stops, M = MODES[P.f.mode];
    const endT = st.length ? hm(st[st.length - 1].arr + st[st.length - 1].dur) : '';
    const feeKnown = st.filter(s => !s.p._trail && (s.p.fee === 'no' || s.p.fee === 'yes'));
    return '<div class="pl-sum"><p class="kicker">' + t('Návrh výletu') + ' ' + K.tierTag(K.hasTier('dayPlanner') ? K.tier() : 'plus') + '</p>' +
      '<h2>' + esc(P.area.label) + '</h2>' +
      '<p class="pl-sum-l">' + esc(weekday(P.date)) + (st.length ? ' · <span class="num">' + hm(st[0].arr) + '–' + endT + '</span> · ' + st.length + ' ' + K.plural(st.length, 'zastávka', 'zastávky', 'zastávek') + ' · ' + esc(M.short) : '') + '</p>' +
      (P.area.auto ? '<p class="small">' + t('Oblast Jižní Čechy a Bavorsko je velká, proto jsme vybrali obec, kde je pro vaše zájmy nejvíc vhodných míst s údaji.') + (P.area.alts.length ? ' ' + t('Jiné možnosti:') + '</p><div class="chip-row pl-alts">' + P.area.alts.map(n => '<button type="button" class="chip" data-town="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>' : '</p>') : '') +
      '<p class="small muted">' + t('Návrh sestavený podle pravidel nad skutečnými daty; v ostré verzi s AI. Časy a přesuny jsou odhad, ne jízdní řád.') + '</p>' +
      (full ? '<p class="small muted">' + t('Prošli jsme {n} míst podle vašich zájmů v okruhu {r} km.', { n: P.res.considered, r: fmt(M.radius) }) +
        (P.res.closed ? ' ' + t('{n} jsme vynechali, protože mají podle otevírací doby v tento den zavřeno.', { n: P.res.closed }) : '') +
        (P.res.unfit ? ' ' + t('{n} nevyhovuje podle údajů o přístupnosti nebo podle rozpočtu.', { n: P.res.unfit }) : '') + '</p>' +
        '<p class="small pl-budget"><b>' + t('Rozpočet') + ':</b> ' + t('ceny vstupů většinou neznáme, proto rozpočet jen řadí místa: přednost mají ta, u kterých OpenStreetMap uvádí vstup zdarma.') + ' ' +
        t('Údaj o vstupném máme u {k} z {n} zastávek.', { k: feeKnown.length, n: st.length }) + '</p>' +
        (P.res.lunchMissing ? '<p class="small pl-warn">' + K.icon('warn') + t('Přístupnou restauraci na oběd jsme v okolí nenašli.') + '</p>' : '') : '') +
      '</div>';
  }

  function render() {
    const P = S.plan; if (!P) return;
    const out = $('#pl-out'), full = K.hasTier('dayPlanner');
    if (!P.day.stops.length) {
      out.innerHTML = summaryHtml(false) + '<div class="pl-status"><p><b>' + t('Do plánu se nevešlo žádné místo.') + '</b> ' + t('Zkuste jiné zájmy, jinou dopravu s větším dosahem nebo jinou obec.') + '</p></div>';
      return;
    }
    if (!full) {
      const first = P.day.stops[0];
      out.innerHTML = summaryHtml(false) +
        '<ol class="it-stops pl-stops">' + stopHtml(first, 0, { mode: P.f.mode }) + '</ol>' +
        '<div class="pl-lock"><p class="kicker">' + t('Náhled') + '</p><p><b>' + t('Plán má {n} zastávek.', { n: P.day.stops.length }) + '</b> ' +
        t('Celý program s časy, přesuny, WC, parkováním ZTP a důvody výběru je součást PLUS.') + '</p>' +
        '<p class="small">' + esc(K.TIER_PROTO_NOTE) + '</p>' +
        '<div class="row"><button class="btn btn-primary" type="button" data-unlock>' + t('Zobrazit celý plán') + ' ' + K.tierTag('plus') + '</button><a class="btn btn-ghost" href="clenstvi.html">' + t('Co obsahuje PLUS') + '</a></div></div>';
      return;
    }
    out.innerHTML = summaryHtml(true) +
      '<ol class="it-stops pl-stops" aria-label="' + esc(t('Program výletu')) + '">' + dayHtml(P.day, { mode: P.f.mode }) + '</ol>' +
      '<div class="pl-actions">' +
      '<button class="btn btn-primary" type="button" data-save>' + t('Uložit do itineráře') + '</button>' +
      '<button class="btn btn-ghost" type="button" data-share>' + K.icon('share') + t('Sdílet odkazem') + '</button>' +
      '<button class="btn btn-ghost" type="button" data-pdf>' + t('Export do PDF') + ' ' + K.tierBadge('pdfExport', { onlyLocked: true }) + '</button>' +
      '<button class="btn btn-quiet" type="button" data-rerun>' + t('Sestavit znovu') + '</button>' +
      '</div><div id="pl-sharebox"></div>' +
      '<div class="pl-mapbox"><div id="pl-map" class="map-canvas" role="application" aria-label="' + esc(t('Mapa zastávek výletu')) + '"></div></div>' +
      '<p class="small muted pl-print-hide">' + t('Čárkované čáry jsou přímé spojnice, ne skutečná cesta. Zdroje údajů: OpenStreetMap, otevřená data a weby provozovatelů, u každého místa v detailu.') + '</p>';
    S.map = null; S.layers = [];
    drawMap($('#pl-map'), S, [P.day]);
  }

  function share() {
    const url = shareUrl(toItinerary());
    $('#pl-sharebox').innerHTML = '<div class="field pl-share"><label for="pl-link">' + t('Odkaz na plán') + '</label><div class="it-sharebox"><input id="pl-link" type="text" readonly value="' + esc(url) + '"><button class="btn btn-ghost btn-sm" type="button" id="pl-copy">' + t('Kopírovat') + '</button></div>' +
      '<span class="hint">' + t('Odkaz nese celý program. Kdo ho otevře, uvidí ho v itineráři a může si ho uložit.') + '</span></div>';
    $('#pl-copy').addEventListener('click', () => copyText(url, $('#pl-link')));
  }

  function bind() {
    const f = $('#pl-form');
    bindChips($('#pl-int'), 'int', true);
    bindChips($('#pl-mode'), 'mode', false);
    bindChips($('#pl-pace'), 'pace', false);
    f.addEventListener('submit', e => { e.preventDefault(); run(true); });
    document.addEventListener('click', e => {
      const tw = e.target.closest('[data-town]');
      if (tw) { $('#pl-area').value = tw.dataset.town; if (tw.closest('#pl-out')) run(false); return; }
      if (e.target.closest('[data-needs]')) { K.needsDrawer(); return; }
      if (e.target.closest('[data-unlock]')) { K.requireTier('dayPlanner', render); return; }
      if (e.target.closest('[data-save]')) {
        saveGuarded(toItinerary(), s => {
          K.toast(t('Itinerář uložen v tomto prohlížeči.'));
          $('#pl-sharebox').innerHTML = '<p class="callout small">' + t('Uloženo jako „{n}“.', { n: esc(s.name) }) + ' <a href="#" data-open="' + esc(s.id) + '">' + t('Otevřít v itineráři') + '</a></p>';
        });
        return;
      }
      const op = e.target.closest('[data-open]'); if (op) { e.preventDefault(); openInItinerary(op.dataset.open); return; }
      if (e.target.closest('[data-share]')) { share(); return; }
      if (e.target.closest('[data-pdf]')) { K.requireTier('pdfExport', () => setTimeout(() => window.print(), 50)); return; }
      if (e.target.closest('[data-rerun]')) { run(false); }
    });
    $('#pl-area').addEventListener('focus', e => { if (isAuto(e.target.value)) e.target.select(); });
    document.addEventListener('kp:tier', () => { $('#pl-mob').innerHTML = mobilityHtml(); if (S.plan) run(false); });
    document.addEventListener('kp:needs', () => { $('#pl-mob').innerHTML = mobilityHtml(); if (S.plan) run(false); });
  }

  function init() {
    $('#pl-proto').textContent = t('Prototyp: návrh sestavený podle pravidel nad skutečnými daty; v ostré verzi s AI.') + ' ' + K.TIER_PROTO_NOTE;
    $('#pl-tier').innerHTML = K.tierBadge('dayPlanner');
    const auto = fillForm();
    $('#pl-mob').innerHTML = mobilityHtml();
    fillTownList($('#pl-towns'));
    bind();
    if (auto) run(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
