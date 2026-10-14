/* Stránka dovolena.html: vícedenní dovolená (členství Traveller = klíč premium). PROTOTYP bez serveru, bez AI a bez plateb.
   Návrh skládají pravidla nad skutečnými daty (KPPlan z planovac.js): ubytování podle shody, program na každý den,
   doprava (Google Maps, nádraží s údaji o bezbariérovosti, parkování ZTP), alternativy, offline soubor přes Blob,
   sdílení odkazem, Travel Concierge a kredit na kontrolu ubytování jen jako ukázka toku. Nic se neodesílá. */
(function () {
  'use strict';
  const K = window.KP, P = window.KPPlan, esc = K.esc;
  if (!P || !document.body.classList.contains('page-dovolena')) return;
  const t = (k, p) => K.t(k, p);
  const $ = (s, r) => (r || document).querySelector(s);
  const FORM_KEY = 'tripForm', CREDIT_KEY = 'accessCredit';
  const DAY_OPTS = [2, 3, 4, 5, 6, 7];
  const HOTEL_R = { walk: 2, transit: 5, car: 12 };
  const ARRIVE = 14 * 60, DEPART_END = 15 * 60, DAY_START = 9 * 60 + 30;
  const S = { trip: null, map: null, layers: [], seq: 0 };
  const ITEM_LABEL = { vstup: t('Vstup'), wc: t('WC'), pokoj: t('Pokoj'), koupelna: t('Koupelna'), parkovani: t('Parkování'), vytah: t('Výtah'), jine: t('Jiné') };

  // ---------- Formulář ----------
  function readForm() {
    const f = $('#dv-form');
    return {
      area: $('#dv-area').value.trim(), date: $('#dv-date').value, days: Math.max(2, Math.min(7, +$('#dv-days').value || 3)),
      interests: P.chipVals(f, 'int'), mode: P.chipVals(f, 'mode')[0] || 'car', pace: P.chipVals(f, 'pace')[0] || 'normal',
      budget: $('#dv-budget').value || 'any', lunch: $('#dv-lunch').checked,
    };
  }
  function fillForm() {
    const saved = K.store.get(FORM_KEY, {}) || {};
    const sp = new URLSearchParams(location.search);
    const d0 = new Date(); d0.setDate(d0.getDate() + 7);
    const okDate = saved.date && P.parseIso(saved.date) && P.parseIso(saved.date) >= P.parseIso(P.isoDay(new Date()));
    const v = {
      area: sp.get('obec') || saved.area || P.AUTO_LABEL, date: okDate ? saved.date : P.isoDay(d0),
      days: DAY_OPTS.includes(+saved.days) ? +saved.days : 3,
      interests: Array.isArray(saved.interests) && saved.interests.length ? saved.interests.filter(k => P.INT[k]) : ['pamatky', 'muzea', 'priroda'],
      mode: P.MODES[saved.mode] ? saved.mode : 'car', pace: P.PACE[saved.pace] ? saved.pace : 'calm', budget: P.BUDGET[saved.budget] ? saved.budget : 'any', lunch: saved.lunch !== false,
    };
    $('#dv-area').value = P.isAuto(v.area) ? P.AUTO_LABEL : v.area;
    $('#dv-date').value = v.date;
    $('#dv-days').innerHTML = DAY_OPTS.map(n => '<option value="' + n + '"' + (n === v.days ? ' selected' : '') + '>' + n + ' ' + K.plural(n, 'den', 'dny', 'dní') + '</option>').join('');
    $('#dv-int').innerHTML = P.chipsHtml('int', P.INTERESTS.map(x => [x.k, x.label, x.ic]), v.interests, true);
    $('#dv-mode').innerHTML = P.chipsHtml('mode', ['car', 'transit', 'walk'].map(k => [k, P.MODES[k].label, P.MODES[k].ic]), v.mode, false);
    $('#dv-pace').innerHTML = P.chipsHtml('pace', Object.keys(P.PACE).map(k => [k, P.PACE[k].label + ': ' + P.PACE[k].hint]), v.pace, false);
    $('#dv-budget').innerHTML = Object.keys(P.BUDGET).map(k => '<option value="' + k + '"' + (k === v.budget ? ' selected' : '') + '>' + esc(P.BUDGET[k].label) + '</option>').join('');
    $('#dv-lunch').checked = v.lunch;
    $('#dv-sug').innerHTML = [P.AUTO_LABEL].concat(P.SUGGEST).map(n => '<button type="button" class="chip" data-town="' + esc(n) + '">' + esc(n) + '</button>').join('');
    return !!sp.get('obec');
  }
  function setStatus(html) { $('#dv-out').innerHTML = '<div class="pl-status" role="status">' + html + '</div>'; }
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  // ---------- Ubytování ----------
  const reportsOf = (p) => Array.isArray(p.r) ? p.r.filter(r => r && typeof r === 'object') : [];
  function hotelScore(p, ctx, center, radius) {
    const a = P.access(p, ctx.needs);
    if (a.st === 'no') return null;
    a.fs = K.facilitiesScore(p);
    let s = ({ ok: 3, unk: 1.2, part: 0.8 })[a.st] || 1;
    if (a.pct !== null && a.pct !== undefined) s += a.pct / 100;
    s += (a.fs.total || 0) / 50 + a.fs.coverage / 200;
    if (reportsOf(p).length) s += 1.5;
    if (p.t === 'yes') s += 0.5;
    if (p.web || p.ph) s += 0.2;
    if (p.img) s += 0.2;
    const d = K.distanceKm(center, p);
    s -= d / radius * 1.5;
    return { p, a, s, d };
  }
  function pickHotels(pool, ctx, center, mode) {
    const r = HOTEL_R[mode] || 5;
    return pool.filter(p => p.c === 'ubytovani' && K.distanceKm(center, p) <= r)
      .map(p => hotelScore(p, ctx, center, r)).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 5);
  }
  const hasHotel = (p) => p.c === 'ubytovani' && p.w !== 'no';

  // ---------- Sestavení dovolené ----------
  async function run(fromSubmit) {
    const seq = ++S.seq;
    const f = readForm();
    if (!f.interests.length) { K.toast(t('Vyberte aspoň jeden zájem.')); return; }
    const date = P.parseIso(f.date);
    if (!date) { K.toast(t('Zadejte datum příjezdu.')); $('#dv-date').focus(); return; }
    K.store.set(FORM_KEY, f);
    setStatus('<p>' + t('Načítám data a skládám plán…') + '</p>');
    const ctx = { interests: f.interests, mode: f.mode, pace: f.pace, budget: f.budget, needs: K.getNeeds() };
    S.needsSig = JSON.stringify(ctx.needs);
    let area, hotels;
    try {
      if (P.isAuto(f.area)) {
        const list = await P.autoTowns(ctx, hasHotel);
        if (!list.length) { setStatus('<p>' + t('Pro zvolené zájmy jsme v jižních Čechách a Bavorsku nenašli obec s vhodným ubytováním. Zkuste přidat další zájmy.') + '</p>'); return; }
        area = { label: list[0].x[0], center: list[0].c, auto: true, alts: list.slice(1, 6).map(o => o.x[0]) };
      } else {
        const x = await P.findTown(f.area);
        if (!x) { setStatus('<p>' + t('Obec „{q}“ v našich datech nemáme. Zkuste jiný název, nebo nechte oblast Jižní Čechy a Bavorsko.', { q: esc(f.area) }) + '</p>'); return; }
        area = { label: x[0], center: P.townCenter(x), auto: false };
      }
      const hpool = await P.loadArea(area.center, Math.max(HOTEL_R[f.mode] || 5, 3));
      hotels = pickHotels(hpool, ctx, area.center, f.mode);
    } catch (e) { setStatus('<p>' + t('Data se nepodařilo načíst. Zkuste to znovu.') + '</p>'); return; }
    if (seq !== S.seq) return;
    if (!hotels.length) {
      setStatus('<p><b>' + t('V okolí obce {a} jsme nenašli ubytování, které by podle údajů vyhovovalo.', { a: esc(area.label) }) + '</b> ' + t('Zkuste jinou obec nebo dopravu s větším dosahem.') + '</p>');
      return;
    }
    S.trip = { f, ctx, area, date, hotels, hotel: hotels[0], days: [], pool: [], rejected: new Set() };
    await buildDays();
    if (seq !== S.seq) return;
    render();
    if (fromSubmit) {
      const out = $('#dv-out'); if (out && matchMedia('(max-width: 899px)').matches) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!K.hasTier('multiDay')) K.requireTier('multiDay', render);
    }
  }

  async function buildDays() {
    const T = S.trip, f = T.f, h = T.hotel.p, M = P.MODES[f.mode];
    T.pool = await P.loadArea({ la: h.la, lo: h.lo }, M.radius);
    const from = { la: h.la, lo: h.lo, n: h.n };
    const exclude = new Set([h.i]);
    T.days = [];
    for (let d = 0; d < f.days; d++) {
      const first = d === 0, last = d === f.days - 1;
      const dctx = Object.assign({}, T.ctx, {
        pool: T.pool, date: addDays(T.date, d), from, exclude,
        start: first ? ARRIVE : DAY_START, end: last ? DEPART_END : undefined,
        lunch: f.lunch && !first, maxStops: first || last ? 2 : undefined,
      });
      const res = P.planDay(dctx);
      res.stops.forEach(s => { exclude.add(s.p.i); P.extras(s, T.pool, f.mode); });
      T.days.push({ from, start: dctx.start, date: dctx.date, stops: res.stops, cands: res.cands, lunchMissing: res.lunchMissing, ctx: dctx });
    }
    T.station = stationsNear(h, T.pool);
    T.parking = T.pool.filter(x => x.c === 'parkovani' && K.distanceKm(h, x) <= 0.5).map(x => ({ x, d: K.distanceKm(h, x) })).sort((a, b) => a.d - b.d).slice(0, 2);
  }
  function stationsNear(h, pool) {
    return pool.filter(x => x.c === 'doprava' && K.distanceKm(h, x) <= 6).map(x => ({ x, d: K.distanceKm(h, x) })).sort((a, b) => a.d - b.d).slice(0, 2);
  }

  // ---------- Alternativa k zastávce ----------
  function alternative(di, si) {
    const T = S.trip, day = T.days[di], stop = day && day.stops[si];
    if (!stop) return;
    T.rejected.add(stop.p.i);
    const taken = new Set([T.hotel.p.i]); T.days.forEach(d => d.stops.forEach(s => taken.add(s.p.i)));
    const prev = si ? day.stops[si - 1].p : day.from, M = P.MODES[T.f.mode];
    const list = stop.lunch ? day.cands.lunch : day.cands.list;
    let best = null, bv = -Infinity;
    list.forEach(c => {
      if (taken.has(c.p.i) || T.rejected.has(c.p.i)) return;
      const d = K.distanceKm(prev, c.p);
      if (d > (stop.lunch ? M.lunchR : M.radius)) return;
      const v = c.s - d / M.radius * 2.5 - K.distanceKm(day.from, c.p) / M.radius * 2 + (c.ik === stop.ik ? 1 : 0);
      if (v > bv) { bv = v; best = c; }
    });
    if (!best) { K.toast(t('Další vhodné místo v dosahu jsme v datech nenašli.')); return; }
    const dur = stop.lunch ? 60 : P.durOf(best.p, best.ik);
    const ns = P.mkStop(best, 0, 0, 0, dur, null, stop.lunch);
    ns.altOf = stop.altOf || stop.p.n;
    day.stops[si] = ns;
    P.retime(day, T.ctx);
    P.extras(ns, T.pool, T.f.mode);
    render();
    K.toast(t('Náhrada: {n}', { n: best.p.n }));
    const el = document.querySelector('[data-stop="' + di + '-' + si + '"] h3 a'); if (el) el.focus();
  }

  // ---------- Itinerář (jednotný formát KPPlan) ----------
  function toItinerary() {
    const T = S.trip, h = T.hotel.p;
    const stops = [{ i: h.i, r: h._r || '', n: h.n, note: t('Ubytování'), t: P.hm(ARRIVE), dur: 0, day: 0 }];
    T.days.forEach((d, i) => P.toStops(d, i).forEach(s => stops.push(s)));
    return P.norm({
      name: t('Dovolená: {a}', { a: T.area.label }) + ', ' + K.fmtDate(T.f.date), kind: 'trip',
      meta: { area: T.area.label, date: T.f.date, days: T.f.days, mode: T.f.mode, start: P.hm(DAY_START) }, stops,
    });
  }

  // ---------- Vykreslení ----------
  const dayName = (i, d) => t('Den {n}', { n: i + 1 }) + ' · ' + P.weekday(d.date);
  function dayNote(i, n) {
    if (i === 0) return t('Příjezd a ubytování, program od {t}', { t: P.hm(ARRIVE) });
    if (i === n - 1) return t('Den odjezdu, program do {t}', { t: P.hm(DEPART_END) });
    return '';
  }
  function hotelHtml(h, on, full) {
    const p = h.p, st = { p, a: h.a };
    const rs = reportsOf(p), r = rs[0];
    const why = P.reasons(st), unk = P.unknowns(st).filter(x => x !== t('Otevírací doba'));
    let web = '';
    if (r) {
      const items = Object.keys(r.items || {}).filter(k => r.items[k]).map(k => '<li><b>' + esc(ITEM_LABEL[k] || k) + ':</b> ' + esc(K.tx(r.items[k])) + '</li>');
      const ms = (Array.isArray(r.measurements) ? r.measurements : []).slice(0, 4).map(m => '<li><b>' + esc(K.tx(m.co || '')) + ':</b> <span class="num">' + esc(String(m.hodnota || '')) + ' ' + esc(m.jednotka || '') + '</span></li>');
      web = '<p class="pl-k">' + t('Z webu provozovatele') + '</p>' +
        (r.quote ? '<blockquote lang="' + (p.z === 'de' ? 'de' : 'cs') + '">„' + esc(r.quote) + '“</blockquote>' : '') +
        (items.length || ms.length ? '<ul class="dv-items">' + items.concat(ms).join('') + '</ul>' : '') +
        '<p class="small muted">' + t('Zdroj') + ': <a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(String(r.url).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 60)) + '</a>, ' + t('staženo {d}', { d: K.fmtDate(r.date) }) + '. ' + t('Údaj provozovatele, ne naše měření.') + '</p>';
    }
    const contact = [p.web ? '<a href="' + esc(p.web) + '" target="_blank" rel="noopener">' + t('Web ubytování') + '</a>' : '', p.ph ? '<a href="tel:' + esc(String(p.ph).replace(/\s+/g, '')) + '">' + esc(p.ph) + '</a>' : ''].filter(Boolean).join(' · ');
    return '<li class="dv-hotel' + (on ? ' is-on' : '') + '"><div>' +
      '<p class="it-stop-k">' + esc([K.tx(p.s || t('Ubytování')), p.o, P.distTxt(h.d) + ' ' + t('od středu obce')].filter(Boolean).join(' · ')) + '</p>' +
      '<h3><a href="' + K.placeUrl(p) + '">' + esc(p.n) + '</a></h3>' +
      '<p class="it-stop-st">' + P.statusOf(st) + (p.t === 'yes' ? ' <span class="small">' + t('Bezbariérové WC podle OpenStreetMap') + '</span>' : '') + '</p>' +
      (full ? '<p class="pl-k">' + t('Proč tady') + '</p><ul class="pl-why">' + why.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
        (unk.length ? '<p class="pl-unk"><b>' + t('Nevíme') + ':</b> ' + unk.map(esc).join(' · ') + '</p>' : '') + web +
        (contact ? '<p class="small">' + contact + '</p>' : '') : '') +
      '</div>' + (full ? (on ? '<span class="badge">' + t('Vybráno') + '</span>' : '<button class="btn btn-ghost btn-sm dv-pick" type="button" data-pick="' + esc(p.i) + '">' + t('Vybrat toto ubytování') + '</button>') : '') + '</li>';
  }
  function dbRows(x) {
    const src = (Array.isArray(x.x) ? x.x : []).find(s => s && Array.isArray(s.rows) && s.rows.length);
    if (!src) return '';
    return '<ul class="dv-rows">' + src.rows.slice(0, 5).map(r => '<li><span>' + esc(K.tx(r[0])) + '</span><span class="num">' + esc(K.tx(String(r[1]))) + '</span></li>').join('') + '</ul>' +
      '<p class="small muted">' + t('Zdroj') + ': ' + (src.url ? '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.attribution || src.label || src.url) + '</a>' : esc(src.attribution || src.label || '')) + (src.date ? ', ' + K.fmtDate(src.date) : '') + '</p>';
  }
  function transportHtml() {
    const T = S.trip, h = T.hotel.p;
    const dest = { la: h.la, lo: h.lo };
    const st = T.station.map(o => {
      const w = K.W[o.x.w || 'null'];
      return '<li><p><b><a href="' + K.placeUrl(o.x) + '">' + esc(o.x.n) + '</a></b> · ' + t('{d} od ubytování', { d: P.distTxt(o.d) }) + ' ' + K.statusHtml(w.st, w.short) + '</p>' + dbRows(o.x) +
        '<p class="small"><a href="' + P.gmDir(o.x, dest, T.f.mode === 'car' ? 'driving' : 'transit') + '" target="_blank" rel="noopener">' + t('Z nádraží k ubytování v Google Maps') + '</a></p></li>';
    }).join('');
    const pk = T.parking.map(o => '<li><p><b><a href="' + K.placeUrl(o.x) + '">' + esc(o.x.n || t('Parkování ZTP')) + '</a></b> · ' + t('{d} od ubytování', { d: P.distTxt(o.d) }) + (o.x.pk ? ' · ' + t('počet stání: {n}', { n: o.x.pk }) : '') + '</p></li>').join('');
    return '<section class="dv-sec" aria-labelledby="dv-tr-h"><h2 id="dv-tr-h">' + t('Doprava') + '</h2>' +
      '<p>' + t('Cestu k ubytování si naplánujte v Google Maps. Odkaz otevře trasu z místa, kde právě jste.') + '</p>' +
      '<div class="pl-links"><a class="btn btn-ghost btn-sm" href="' + P.gmDir(null, dest, 'transit') + '" target="_blank" rel="noopener">' + K.icon('nav') + t('Vlakem a autobusem') + '</a>' +
      '<a class="btn btn-ghost btn-sm" href="' + P.gmDir(null, dest, 'driving') + '" target="_blank" rel="noopener">' + K.icon('nav') + t('Autem') + '</a></div>' +
      '<h3>' + t('Nejbližší nádraží') + '</h3>' +
      (st ? '<ul class="dv-trans">' + st + '</ul>' : '<p class="small">' + t('Do 6 km od ubytování nádraží v datech nemáme.') + '</p>') +
      '<h3>' + t('Parkování ZTP u ubytování') + '</h3>' +
      (pk ? '<ul class="dv-trans">' + pk + '</ul>' : '<p class="small">' + t('Vyhrazené stání ZTP do 500 m od ubytování v datech nemáme. Zeptejte se ubytování.') + '</p>') +
      '<p class="small muted">' + t('Jízdní řády ani nízkopodlažní spoje neověřujeme. Spoj a asistenci ověřte u dopravce.') + '</p></section>';
  }
  function summaryHtml() {
    const T = S.trip, n = T.days.reduce((s, d) => s + d.stops.length, 0);
    return '<div class="pl-sum"><p class="kicker">' + t('Návrh dovolené') + ' ' + K.tierTag(K.hasTier('multiDay') ? K.tier() : 'premium') + '</p>' +
      '<h2>' + esc(T.area.label) + '</h2>' +
      '<p class="pl-sum-l">' + esc(P.weekday(T.date)) + ' · ' + T.f.days + ' ' + K.plural(T.f.days, 'den', 'dny', 'dní') + ' · ' + n + ' ' + K.plural(n, 'zastávka', 'zastávky', 'zastávek') + ' · ' + esc(P.MODES[T.f.mode].short) + '</p>' +
      (T.area.auto ? '<p class="small">' + t('Oblast Jižní Čechy a Bavorsko je velká, proto jsme vybrali obec s přístupným ubytováním a nejvíc vhodnými místy pro vaše zájmy.') + (T.area.alts.length ? ' ' + t('Jiné možnosti:') + '</p><div class="chip-row pl-alts">' + T.area.alts.map(x => '<button type="button" class="chip" data-town="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' : '</p>') : '') +
      '<p class="small muted">' + t('Návrh sestavený podle pravidel nad skutečnými daty; v ostré verzi s AI. Časy a přesuny jsou odhad, ne jízdní řád.') + '</p></div>';
  }
  function daysHtml(limitDays) {
    const T = S.trip, n = T.days.length;
    return '<div class="dv-days">' + T.days.slice(0, limitDays || n).map((d, i) => {
      const note = dayNote(i, n);
      return '<section aria-labelledby="dv-day-' + i + '"><div class="dv-day"><h3 id="dv-day-' + i + '">' + esc(dayName(i, d)) + '</h3>' + (note ? '<span>' + esc(note) + '</span>' : '') + '</div>' +
        (d.stops.length ? '<ol class="it-stops pl-stops">' + P.dayHtml(d, { mode: T.f.mode, alt: true, prefix: i + '-' }) + '</ol>' : '<p class="small">' + t('Na tento den jsme v dosahu nenašli další vhodné místo. Den volna, nebo zkuste jiné zájmy.') + '</p>') +
        (d.lunchMissing ? '<p class="small pl-warn">' + K.icon('warn') + t('Přístupnou restauraci na oběd jsme v okolí nenašli.') + '</p>' : '') + '</section>';
    }).join('') + '</div>';
  }
  function conciergeHtml() {
    const T = S.trip;
    const what = [t('Šířka dveří pokoje a koupelny'), t('Sprcha v úrovni podlahy'), t('Výška postele a místo vedle ní'), t('Parkování ZTP u ubytování'), t('Výtah a jeho rozměry'), t('Bezbariérový vstup do restaurace')];
    const head = '<section class="dv-sec" aria-labelledby="dv-cc-h"><h2 id="dv-cc-h">Travel Concierge ' + K.tierBadge('concierge', { onlyLocked: true }) + '</h2>' +
      '<p>' + t('V ostré verzi člověk z týmu připraví cestu s vámi: ověří ubytování podle vašeho profilu, napíše hotelu česky nebo německy, vyžádá si rozměry a fotky a výsledek doplní do itineráře.') + '</p>';
    if (!K.hasTier('concierge')) return head + '<div class="row"><button class="btn btn-ghost" type="button" data-cc-unlock>' + t('Zobrazit žádost pro concierge') + '</button></div></section>';
    return head + '<form class="dv-form" id="dv-cc" novalidate>' +
      '<div class="field"><label for="dv-cc-h1">' + t('Ubytování') + '</label><select id="dv-cc-h1">' + T.hotels.map(h => '<option value="' + esc(h.p.i) + '"' + (h === T.hotel ? ' selected' : '') + '>' + esc(h.p.n) + '</option>').join('') + '</select></div>' +
      '<fieldset class="pl-fs"><legend>' + t('Co ověřit') + '</legend>' + what.map((w, i) => '<label class="check"><input type="checkbox" name="cc" value="' + i + '"' + (i < 2 ? ' checked' : '') + '> <span>' + esc(w) + '</span></label>').join('') + '</fieldset>' +
      '<div class="field"><label for="dv-cc-note">' + t('Co dalšího potřebujete') + ' <span class="hint">(' + t('nepovinné, nepište osobní údaje') + ')</span></label><textarea id="dv-cc-note" maxlength="600"></textarea></div>' +
      '<p class="small muted">' + esc(K.TIER_NOTE) + '</p>' +
      '<div class="row"><button class="btn btn-primary" type="submit">' + t('Připravit žádost') + '</button></div></form><div id="dv-cc-out"></div></section>';
  }
  function conciergeDone(hotelName, items) {
    $('#dv-cc-out').innerHTML = '<div class="dv-done" role="status"><p><b>' + t('Prototyp: žádost se nikam neodeslala a nic jsme neuložili.') + '</b></p>' +
      '<p>' + t('Žádost pro {h}', { h: esc(hotelName) }) + (items.length ? ': ' + items.map(esc).join(', ') : '') + '.</p>' +
      '<p>' + t('V ostré verzi by concierge:') + '</p><ol class="dv-steps">' +
      ['Porovnal žádost s vaším profilem potřeb.', 'Napsal ubytování v jeho jazyce a položil konkrétní otázky.', 'Vyžádal si rozměry a fotky pokoje, koupelny a vstupu.', 'Odpověď doplnil do itineráře i k místu, s datem a zdrojem.', 'Když ubytování nevyhoví, navrhl jiné.']
        .map(x => '<li>' + t(x) + '</li>').join('') + '</ol>' +
      '<p class="small muted">' + t('Služba vyžaduje lidi v týmu. Lhůty odpovědí zatím neslibujeme.') + '</p></div>';
  }
  function creditHtml() {
    const T = S.trip, year = new Date().getFullYear();
    const c = K.store.get(CREDIT_KEY, null), used = c && c.year === year;
    const head = '<section class="dv-sec" aria-labelledby="dv-cr-h"><h2 id="dv-cr-h">' + t('Kontrola dostupnosti ubytování') + ' ' + K.tierBadge('accessCheckCredit', { onlyLocked: true }) + '</h2>' +
      '<p>' + t('Traveller obsahuje jeden kredit ročně na individuální kontrolu vybraného ubytování. Tady je jen ukázka, jak by to probíhalo.') + '</p>';
    if (!K.hasTier('accessCheckCredit')) return head + '<div class="row"><button class="btn btn-ghost" type="button" data-cr-unlock>' + t('Ukázat tok kontroly') + '</button></div></section>';
    return head + '<div class="dv-credit"><div class="stat"><span class="n num">' + (used ? 0 : 1) + '</span></div><p>' + t('Zbývající kredit v roce {y}', { y: year }) + (used ? '. ' + t('Ukázkově použit pro {h}, {d}.', { h: esc(c.n), d: K.fmtDate(c.date) }) : '') + '</p></div>' +
      (used ? '<div class="dv-done"><p><b>' + t('Co by se stalo dál') + '</b></p><ol class="dv-steps">' +
        ['Domluvili bychom termín kontroly s ubytováním.', 'Proškolený mapovač by změřil vstup, pokoj, koupelnu a parkování podle naší metodiky.', 'Výsledek s fotkami a datem by se objevil v detailu místa pro všechny, zdarma.', 'Vy byste dostali shrnutí podle svého profilu potřeb.']
          .map(x => '<li>' + t(x) + '</li>').join('') + '</ol><p class="small muted">' + t('Prototyp: nic se neodeslalo a nic se neplatí.') + '</p>' +
        '<button class="btn btn-quiet btn-sm" type="button" data-cr-reset>' + t('Vrátit ukázku') + '</button></div>'
        : '<div class="row"><button class="btn btn-primary" type="button" data-cr-use>' + t('Použít kredit na {h}', { h: esc(T.hotel.p.n) }) + '</button></div><p class="small muted">' + t('Prototyp: nic se neodešle, kredit se jen označí v tomto prohlížeči.') + '</p>') + '</section>';
  }

  function render() {
    const T = S.trip; if (!T) return;
    const out = $('#dv-out'), full = K.hasTier('multiDay');
    const hotels = '<section class="dv-sec" aria-labelledby="dv-h-h"><h2 id="dv-h-h">' + t('Ubytování') + '</h2>' +
      (full ? '<p>' + t('Seřazeno podle shody s vaším profilem, údajů z webu provozovatele a známého vybavení. Ceny ani volné pokoje neznáme.') + '</p>' : '') +
      '<ul class="dv-hotels">' + (full ? T.hotels : T.hotels.slice(0, 1)).map(h => hotelHtml(h, h === T.hotel, full)).join('') + '</ul></section>';
    if (!full) {
      out.innerHTML = summaryHtml() + hotels +
        '<section class="dv-sec"><h2>' + t('Program') + '</h2>' + daysHtml(1) + '</section>' +
        '<div class="pl-lock"><p class="kicker">' + t('Náhled') + '</p><p><b>' + t('Plán má {n} dní.', { n: T.days.length }) + '</b> ' +
        t('Výběr z více ubytování, program na každý den, doprava, alternativy, offline itinerář a concierge jsou součást úrovně Traveller.') + '</p>' +
        '<p class="small">' + esc(K.TIER_PROTO_NOTE) + '</p>' +
        '<div class="row"><button class="btn btn-primary" type="button" data-unlock>' + t('Zobrazit celý plán') + ' ' + K.tierTag('premium') + '</button><a class="btn btn-ghost" href="clenstvi.html">' + t('Co obsahuje Traveller') + '</a></div></div>';
      return;
    }
    out.innerHTML = summaryHtml() + hotels +
      '<section class="dv-sec" aria-labelledby="dv-p-h"><h2 id="dv-p-h">' + t('Program') + '</h2>' +
      '<p class="small">' + t('U každé zastávky můžete nechat navrhnout alternativu, třeba když je zavřeno nebo se změní počasí.') + '</p>' + daysHtml() + '</section>' +
      '<div class="pl-mapbox"><div id="dv-map" class="map-canvas" role="application" aria-label="' + esc(t('Mapa zastávek dovolené')) + '"></div></div>' +
      '<p class="small muted pl-print-hide">' + t('Čárkované čáry jsou přímé spojnice, ne skutečná cesta. H je ubytování.') + '</p>' +
      transportHtml() +
      '<section class="dv-sec dv-noprint" aria-labelledby="dv-a-h"><h2 id="dv-a-h">' + t('Uložit a sdílet') + '</h2>' +
      '<div class="pl-actions">' +
      '<button class="btn btn-primary" type="button" data-save>' + t('Uložit do itineráře') + '</button>' +
      '<button class="btn btn-ghost" type="button" data-offline>' + t('Stáhnout pro offline (HTML)') + ' ' + K.tierBadge('offline', { onlyLocked: true }) + '</button>' +
      '<button class="btn btn-ghost" type="button" data-json>' + t('Stáhnout data (JSON)') + '</button>' +
      '<button class="btn btn-ghost" type="button" data-partner>' + K.icon('share') + t('Sdílet s partnerem') + ' ' + K.tierBadge('partnerShare', { onlyLocked: true }) + '</button>' +
      '<button class="btn btn-ghost" type="button" data-pdf>' + t('Export do PDF') + '</button>' +
      '</div><div id="dv-sharebox"></div></section>' +
      '<div class="dv-noprint">' + conciergeHtml() + creditHtml() + '</div>';
    S.map = null; S.layers = [];
    P.drawMap($('#dv-map'), S, T.days);
  }

  // ---------- Offline soubor ----------
  function offlineHtml() {
    const T = S.trip, h = T.hotel.p, base = P.baseUrl(), lang = K.LANG || 'cs';
    const abs = (u) => /^https?:/.test(u) ? u : base + u;
    const row = (s) => {
      const p = s.p, unk = P.unknowns(s), ex = s.ex || {};
      const svc = [ex.wcHere ? t('Bezbariérové WC přímo na místě') : ex.wc ? t('Bezbariérové WC {d} odsud', { d: P.distTxt(ex.wc.d) }) + ': ' + esc(ex.wc.x.n) : '',
        ex.park ? t('Parkování ZTP {d} odsud', { d: P.distTxt(ex.park.d) }) : ''].filter(Boolean);
      return '<li><b class="tm">' + P.hm(s.arr) + '</b> <b>' + esc(p.n) + '</b> <span class="mu">(' + esc(P.catLabel(p, s.ik)) + (p.a ? ', ' + esc(p.a) : '') + (p.o ? ', ' + esc(p.o) : '') + ')</span>' +
        '<br>' + esc(P.statusOf(s).replace(/<[^>]+>/g, '')) + (p.oh ? ' · ' + t('Otevírací doba podle OpenStreetMap') + ': ' + esc(p.oh) : '') +
        (svc.length ? '<br>' + svc.join(' · ') : '') + (unk.length ? '<br><i>' + t('Nevíme') + ': ' + unk.map(esc).join(', ') + '</i>' : '') +
        '<br><a href="' + abs(P.placeLink(p)) + '">' + t('Detail místa') + '</a> · <a href="' + P.gmDir(null, p, 'driving') + '">Google Maps</a> · <span class="mu">' + p.la.toFixed(5) + ', ' + p.lo.toFixed(5) + '</span></li>';
    };
    const css = 'body{font:16px/1.5 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#1F261C;background:#F7F7F5}h1{font-size:28px;margin:0 0 4px;color:#3A4A34}h2{color:#3A4A34;border-top:1px solid #D9DED3;padding-top:12px;margin:24px 0 8px}ol{padding-left:0;list-style:none}li{background:#fff;border:1px solid #E3E7DF;border-radius:14px;padding:10px 14px;margin:8px 0}.tm{background:#3A4A34;color:#fff;border-radius:6px;padding:0 6px}.mu{color:#55604F}.note{background:#EBEEE7;border-radius:14px;padding:10px 14px}a{color:#3A4A34}';
    return '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(toItinerary().name) + '</title><style>' + css + '</style></head><body>' +
      '<h1>' + esc(toItinerary().name) + '</h1><p class="mu">Wherethru · ' + t('staženo {d}', { d: K.fmtDate(P.isoDay(new Date())) }) + '</p>' +
      '<p class="note">' + t('Návrh sestavený podle pravidel nad skutečnými daty; v ostré verzi s AI. Časy a přesuny jsou odhad, ne jízdní řád.') + ' ' + t('Údaje se mohou změnit, před cestou je ověřte.') + '</p>' +
      '<h2>' + t('Ubytování') + '</h2><p><b>' + esc(h.n) + '</b>' + (h.a ? ', ' + esc(h.a) : '') + (h.o ? ', ' + esc(h.o) : '') + '<br>' + esc(P.statusOf({ p: h, a: T.hotel.a }).replace(/<[^>]+>/g, '')) +
      (h.web ? '<br><a href="' + esc(h.web) + '">' + esc(h.web) + '</a>' : '') + (h.ph ? '<br>' + esc(h.ph) : '') + '</p>' +
      T.days.map((d, i) => '<h2>' + esc(dayName(i, d)) + '</h2>' + (dayNote(i, T.days.length) ? '<p class="mu">' + esc(dayNote(i, T.days.length)) + '</p>' : '') + '<ol>' + d.stops.map(row).join('') + '</ol>').join('') +
      (T.station.length ? '<h2>' + t('Nejbližší nádraží') + '</h2><ul>' + T.station.map(o => '<li>' + esc(o.x.n) + ' · ' + P.distTxt(o.d) + ' · ' + esc(K.W[o.x.w || 'null'].short) + '</li>').join('') + '</ul>' : '') +
      '<p class="mu">' + t('Zdroje údajů: OpenStreetMap, otevřená data a weby provozovatelů, u každého místa v detailu.') + '</p></body></html>';
  }

  // ---------- Události ----------
  function bind() {
    P.bindChips($('#dv-int'), 'int', true);
    P.bindChips($('#dv-mode'), 'mode', false);
    P.bindChips($('#dv-pace'), 'pace', false);
    $('#dv-form').addEventListener('submit', e => { e.preventDefault(); run(true); });
    document.addEventListener('submit', e => {
      if (e.target.id !== 'dv-cc') return;
      e.preventDefault();
      const sel = $('#dv-cc-h1'), what = [...e.target.querySelectorAll('input[name="cc"]:checked')].map(x => x.nextElementSibling.textContent);
      conciergeDone(sel.options[sel.selectedIndex].text, what);
    });
    document.addEventListener('click', async e => {
      const tw = e.target.closest('[data-town]');
      if (tw) { $('#dv-area').value = tw.dataset.town; if (tw.closest('#dv-out')) run(false); return; }
      if (e.target.closest('[data-needs]')) { K.needsDrawer(); return; }
      if (!S.trip) return;
      if (e.target.closest('[data-unlock]')) { K.requireTier('multiDay', render); return; }
      const pk = e.target.closest('[data-pick]');
      if (pk) {
        const h = S.trip.hotels.find(x => x.p.i === pk.dataset.pick); if (!h) return;
        S.trip.hotel = h; S.trip.rejected = new Set();
        try { await buildDays(); } catch (err) { K.toast(t('Data se nepodařilo načíst. Zkuste to znovu.')); return; }
        render(); K.toast(t('Program přepočítán pro {h}.', { h: h.p.n }));
        const f = document.querySelector('.dv-hotel.is-on h3 a'); if (f) f.focus();
        return;
      }
      const al = e.target.closest('[data-alt]');
      if (al) { const [d, i] = al.dataset.alt.split('-').map(Number); K.requireTier('alternatives', () => alternative(d, i)); return; }
      if (e.target.closest('[data-save]')) {
        P.saveGuarded(toItinerary(), s => {
          K.toast(t('Itinerář uložen v tomto prohlížeči.'));
          $('#dv-sharebox').innerHTML = '<p class="callout small">' + t('Uloženo jako „{n}“.', { n: esc(s.name) }) + ' <a href="#" data-open="' + esc(s.id) + '">' + t('Otevřít v itineráři') + '</a></p>';
        });
        return;
      }
      const op = e.target.closest('[data-open]'); if (op) { e.preventDefault(); P.openInItinerary(op.dataset.open); return; }
      if (e.target.closest('[data-offline]')) {
        K.requireTier('offline', () => { P.download('dovolena-' + S.trip.f.date + '.html', offlineHtml(), 'text/html;charset=utf-8'); K.toast(t('Soubor se stahuje. Otevřete ho i bez internetu.')); });
        return;
      }
      if (e.target.closest('[data-json]')) { P.download('dovolena-' + S.trip.f.date + '.json', JSON.stringify(toItinerary(), null, 2), 'application/json'); return; }
      if (e.target.closest('[data-partner]')) {
        K.requireTier('partnerShare', () => {
          const url = P.shareUrl(toItinerary());
          $('#dv-sharebox').innerHTML = '<div class="field pl-share"><label for="dv-link">' + t('Odkaz pro cestovního partnera') + '</label><div class="it-sharebox"><input id="dv-link" type="text" readonly value="' + esc(url) + '"><button class="btn btn-ghost btn-sm" type="button" id="dv-copy">' + t('Kopírovat') + '</button></div>' +
            '<span class="hint">' + t('Prototyp: partner dostane odkaz na celý plán. V ostré verzi by se k prémiovým funkcím přihlásil vlastním účtem; účty zatím neexistují.') + '</span></div>';
          $('#dv-copy').addEventListener('click', () => P.copyText(url, $('#dv-link')));
        });
        return;
      }
      if (e.target.closest('[data-pdf]')) { K.requireTier('pdfExport', () => setTimeout(() => window.print(), 50)); return; }
      if (e.target.closest('[data-cc-unlock]')) { K.requireTier('concierge', render); return; }
      if (e.target.closest('[data-cr-unlock]')) { K.requireTier('accessCheckCredit', render); return; }
      if (e.target.closest('[data-cr-use]')) {
        K.store.set(CREDIT_KEY, { year: new Date().getFullYear(), id: S.trip.hotel.p.i, n: S.trip.hotel.p.n, date: P.isoDay(new Date()) });
        render(); K.toast(t('Ukázka: kredit označen jako použitý.'));
        const s = $('#dv-cr-h'); if (s) s.scrollIntoView({ block: 'start' });
        return;
      }
      if (e.target.closest('[data-cr-reset]')) { K.store.set(CREDIT_KEY, null); render(); }
    });
    $('#dv-area').addEventListener('focus', e => { if (P.isAuto(e.target.value)) e.target.select(); });
    document.addEventListener('kp:tier', () => { $('#dv-mob').innerHTML = P.mobilityHtml(); $('#dv-tier').innerHTML = K.tierBadge('multiDay'); if (S.trip) render(); });
    // Plán přepočítáme jen tehdy, když se profil opravdu změnil (přechod PLUS → PREMIUM ho nemění a nesmí smazat alternativy)
    document.addEventListener('kp:needs', () => {
      $('#dv-mob').innerHTML = P.mobilityHtml();
      const sig = JSON.stringify(K.getNeeds());
      if (S.trip && sig !== S.needsSig) { S.needsSig = sig; run(false); }
    });
  }

  function init() {
    $('#dv-proto').textContent = t('Prototyp: návrh sestavený podle pravidel nad skutečnými daty; v ostré verzi s AI.') + ' ' + K.TIER_PROTO_NOTE;
    $('#dv-tier').innerHTML = K.tierBadge('multiDay');
    const auto = fillForm();
    $('#dv-mob').innerHTML = P.mobilityHtml();
    P.fillTownList($('#dv-towns'));
    bind();
    if (auto) run(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
