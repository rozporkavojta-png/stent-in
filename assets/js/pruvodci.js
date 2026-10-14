/* Hotoví průvodci (pruvodci.html, detail pruvodci.html?id=…). Data: data/pruvodci.json ze skriptu tools/build_pruvodci.py,
   jen skutečná místa a trasy z dat webu. PROTOTYP: nic se neprodává, ceny jsou návrh. Celý průvodce a stažení
   pro offline (HTML) nebo tisk do PDF jsou ukázka členství Traveller (klíč premium) (KP.requireTier('offline')); bez něj je vidět náhled.
   Údaje o přístupnosti každého místa jsou vždy zdarma v detailu místa, průvodce na ně jen odkazuje. */
(function () {
  'use strict';
  const K = window.KP, t = (k, p) => K.t(k, p), esc = K.esc, $ = (s, r) => (r || document).querySelector(s);
  const L = K.lang ? K.lang() : 'cs';
  const PREVIEW = 2; // kolik zastávek je v náhledu vidět celých
  let DATA = null, FILTER = 'all';

  const pick = (o) => (o && (o[L] || o.cs)) || '';
  const price = (x) => L === 'en' ? '€' + x.toFixed(2) : x.toFixed(2).replace('.', ',') + ' €';
  const kmTxt = (x) => K.i18n ? K.i18n.num(x) : String(x);
  const AREA = { vstup: t('Vstup'), wc: 'WC', parkovani: t('Parkování ZTP'), vytah: t('Výtah a patra'), pokoj: t('Pokoj'), koupelna: t('Koupelna'), jine: t('Další'), rozmery: t('Rozměry podle zdroje'), data: t('Otevřená data') };
  const AREA_UNK = { vstup: t('vstup'), wc: t('WC'), parkovani: t('parkování ZTP'), vytah: t('výtah a patra') };
  const daysTxt = (n) => n + ' ' + K.plural(n, 'den', 'dny', 'dní');
  const stopsTxt = (n) => n + ' ' + K.plural(n, 'zastávka', 'zastávky', 'zastávek');
  const ext = (url, label) => url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a>' : esc(label);
  const placeHref = (s) => K.placeUrl({ i: s.id, _r: s.r });
  const fullAccess = () => K.hasTier('offline');

  function stLabel(st) { return { ok: t('Přístupné'), part: t('Částečně'), no: t('Nepřístupné'), unk: t('Neuvedeno') }[st] || t('Neuvedeno'); }
  function status(st, txt) { return K.statusHtml(st, txt === undefined ? stLabel(st) : txt); }
  function osmEntry(v) { return ((K.W && K.W[v || 'null']) || {}).label || stLabel('unk'); }
  function osmWc(v) { return ((K.T && K.T[v || 'null']) || {}).label || t('WC neuvedeno'); }

  // ---------- Načtení ----------
  async function load() {
    if (DATA) return DATA;
    const r = await fetch('data/pruvodci.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    DATA = await r.json();
    return DATA;
  }

  // ---------- Katalog ----------
  function photoFig(img, alt, w) {
    return '<figure class="photo pv-photo"><img src="' + esc(K.commonsImg(img, w || 480)) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async">' +
      '<figcaption>' + t('Foto') + ': ' + ext(K.commonsPage(img), 'Wikimedia Commons') + ', ' + t('autor a licence u fotky') + '</figcaption></figure>';
  }
  function statesLine(s) {
    return ['ok', 'part', 'no', 'unk'].filter(k => s[k]).map(k => status(k, s[k] + ' × ' + stLabel(k).toLowerCase())).join('');
  }
  // Typ průvodce počítáme ze skutečných zastávek, nic se neoznačuje ručně:
  // Příroda = zastávky ve třech a více obcích nebo aspoň dvě v kategorii příroda; jinak Města. Víkend = 2 až 3 dny.
  function kindOf(g) {
    const st = [].concat(...g.days);
    const towns = new Set(st.map(s => s.o).filter(Boolean)).size, nat = st.filter(s => s.c === 'priroda').length;
    return { nature: towns >= 3 || nat >= 2, weekend: g.days_n >= 2 && g.days_n <= 3 };
  }
  function passes(g, f) {
    if (f === 'all') return true;
    if (f === 'cz' || f === 'de') return g.country === f;
    const k = kindOf(g);
    if (f === 'vikend') return k.weekend;
    if (f === 'priroda') return k.nature;
    if (f === 'mesta') return !k.nature;
    return true;
  }
  function cardHtml(g) {
    const ph = g.photos[0], k = kindOf(g), href = 'pruvodci.html?id=' + encodeURIComponent(g.id), title = pick(g.title);
    const tags = [k.nature ? t('Příroda') : t('Město'), k.weekend ? t('Víkend') : (g.days_n === 1 ? t('Jeden den') : '')].filter(Boolean);
    const media = ph
      ? '<div class="place-tile-media"><img src="' + esc(K.commonsImg(ph.img, 640)) + '" alt="" loading="lazy" decoding="async" width="640" height="480"></div>'
      : '<div class="place-tile-media no-photo" aria-hidden="true">' + K.icon(k.nature ? 'mountain' : 'castle') + '</div>';
    return '<li class="place-tile pv-card">' + media +
      '<span class="pv-tags">' + tags.map(x => '<span class="badge badge-brand">' + esc(x) + '</span>').join('') + '</span>' +
      '<div class="place-tile-body">' +
      '<p class="meta">' + esc(pick(g.area)) + ' · ' + esc(K.ZEME[g.country] || '') + '</p>' +
      '<h3><a href="' + href + '">' + esc(title) + '</a></h3>' +
      '<p class="pv-meta">' + K.icon('calendar') + '<span class="num">' + esc(daysTxt(g.days_n)) + '</span>' + K.icon('pin') + '<span class="num">' + esc(stopsTxt(g.stops_n)) + '</span></p>' +
      '<p class="pv-states">' + statesLine(g.states) + '</p>' +
      '<div class="pv-card-foot"><span><span class="pv-price num">' + esc(price(g.price_eur)) + '</span><small>' + t('návrh ceny, jednorázově') + '</small></span>' +
      '<span class="pv-go" aria-hidden="true">' + K.icon('arrow') + '</span></div>' +
      (ph ? '<p class="credit">' + t('Foto') + ': <a href="' + esc(K.commonsPage(ph.img)) + '" target="_blank" rel="noopener">Wikimedia Commons</a>, ' + t('autor a licence u fotky') + '</p>' : '') +
      '</div></li>';
  }
  function renderCatalog() {
    const list = DATA.pruvodci.filter(g => passes(g, FILTER));
    $('#pv-count').textContent = t('Zobrazeno: {n}', { n: list.length + ' ' + K.plural(list.length, 'průvodce', 'průvodci', 'průvodců') });
    $('#pv-list').innerHTML = list.map(cardHtml).join('') ||
      '<li class="pv-empty empty-state">' + K.icon('book') + '<h3>' + t('Pro tento filtr zatím žádný průvodce není.') + '</h3><button class="btn btn-ghost" type="button" data-f-reset>' + t('Zobrazit vše') + '</button></li>';
  }
  function setFilter(f) {
    FILTER = f;
    document.querySelectorAll('.pv-filters [data-f]').forEach(x => x.setAttribute('aria-pressed', x.dataset.f === f));
    renderCatalog();
  }
  function bindFilters() {
    document.querySelectorAll('.pv-filters [data-f]').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.f)));
    $('#pv-list').addEventListener('click', e => { if (e.target.closest('[data-f-reset]')) setFilter('all'); });
  }

  // ---------- Detail: co víme o zastávce ----------
  function srcBadge(k) {
    if (k.src === 'data') return '<span class="badge badge-verified">' + t('Otevřená data') + '</span>';
    if (k.src === 'osm') return '<span class="badge badge-community">OpenStreetMap</span>';
    return '<span class="badge badge-business">' + t('Web zdroje') + '</span>';
  }
  function knownRow(k) {
    let body = '';
    if (k.src === 'data') {
      body = '<p>' + esc(K.tx(k.label || '')) + '</p>' + (k.rows && k.rows.length ? '<dl class="pv-rows">' + k.rows.map(r => '<div><dt>' + esc(K.tx(r[0])) + '</dt><dd>' + esc(K.tx(String(r[1] == null ? '' : r[1]))) + '</dd></div>').join('') + '</dl>' : '');
    } else if (k.src === 'osm') {
      body = '<p>' + esc(k.a === 'wc' ? osmWc(k.osm) : k.a === 'parkovani' ? t('{n} vyhrazených stání ZTP', { n: k.n }) : osmEntry(k.osm)) + '</p>';
    } else if (k.rows) {
      body = '<dl class="pv-rows">' + k.rows.map(r => '<div><dt>' + esc(r[0]) + '</dt><dd class="num">' + esc(K.i18n ? K.i18n.num(r[1]) : r[1]) + ' ' + esc(r[2] || '') + '</dd></div>').join('') + '</dl>';
    } else body = '<p>' + esc(k.txt || '') + '</p>';
    const meta = [k.st ? K.tx(k.st) : '', k.date ? t('zjištěno {date}', { date: K.fmtDate(k.date) }) : ''].filter(Boolean).join(' · ');
    return '<li class="pv-k"><div class="pv-k-h"><b>' + esc(k.src === 'data' ? AREA.data : (AREA[k.a] || k.a)) + '</b>' + srcBadge(k) + '</div>' + body +
      ((meta || k.url) ? '<p class="pv-k-src small">' + esc(meta) + (k.url ? (meta ? ' · ' : '') + ext(k.url, t('zdroj')) : '') + '</p>' : '') + '</li>';
  }
  function stopFull(s, n) {
    const cat = (K.CATS[s.c] || {}).label || s.s;
    const osmDiff = s.w && s.known.some(k => k.src !== 'osm') && ({ yes: 'ok', limited: 'part', no: 'no' }[s.w] !== s.st);
    return '<li class="pv-stop" id="z-' + esc(s.id) + '"><span class="pv-n num" aria-hidden="true">' + String(n).padStart(2, '0') + '</span><div class="pv-stop-b">' +
      '<h3><a href="' + placeHref(s) + '">' + esc(s.n) + '</a></h3>' +
      '<p class="pv-stop-m">' + esc([cat, s.o].filter(Boolean).join(' · ')) + (s.km_prev != null ? ' · <span class="num">' + t('{km} km vzdušnou čarou od předchozí zastávky', { km: kmTxt(s.km_prev) }) + '</span>' : '') + '</p>' +
      '<p class="pv-stop-st">' + status(s.st, s.st === 'unk' ? t('Přístupnost neuvedena') : t('Vstup: {s}', { s: stLabel(s.st).toLowerCase() })) +
      (osmDiff ? '<small>' + t('OpenStreetMap uvádí jinak: {s}', { s: osmEntry(s.w) }) + '</small>' : '') + '</p>' +
      (s.img ? photoFig(s.img, s.n, 640) : '') +
      (s.known.length ? '<h4 class="pv-sub">' + t('Co víme a odkud') + '</h4><ul class="pv-known">' + s.known.map(knownRow).join('') + '</ul>' : '<p class="muted">' + t('O přístupnosti tohoto místa zatím nemáme žádný údaj.') + '</p>') +
      (s.unknown.length ? '<p class="pv-unk"><span class="badge badge-unk">' + t('Nevíme') + '</span> ' + esc(s.unknown.map(a => AREA_UNK[a] || a).join(', ')) + '. ' + t('Před cestou si to ověřte u provozovatele.') + '</p>' : '') +
      '<p class="pv-stop-a"><a class="btn btn-quiet" href="' + placeHref(s) + '">' + t('Detail místa a hodnocení') + '</a></p>' +
      '</div></li>';
  }
  function stopShort(s, n) {
    const cat = (K.CATS[s.c] || {}).label || s.s;
    return '<li class="pv-stop pv-stop-s"><span class="pv-n num" aria-hidden="true">' + String(n).padStart(2, '0') + '</span><div class="pv-stop-b">' +
      '<h3><a href="' + placeHref(s) + '">' + esc(s.n) + '</a></h3>' +
      '<p class="pv-stop-m">' + esc([cat, s.o].filter(Boolean).join(' · ')) + '</p>' +
      '<p class="pv-stop-st">' + status(s.st, s.st === 'unk' ? t('Přístupnost neuvedena') : t('Vstup: {s}', { s: stLabel(s.st).toLowerCase() })) + '</p></div></li>';
  }

  // ---------- Detail: okolí ----------
  function shortRow(p, extra) {
    const cat = (K.CATS[p.c] || {}).label || '';
    return '<li class="rule-row pv-mini"><div><a href="' + placeHref(p) + '"><b>' + esc(K.tx(p.n)) + '</b></a><small>' + esc([cat, p.o].filter(Boolean).join(' · ')) + '</small>' + (extra || '') + '</div></li>';
  }
  function wcRow(p) {
    return shortRow(p, '<span class="pv-mini-st">' + status(p.t === 'yes' ? 'ok' : p.t === 'limited' ? 'part' : p.t === 'no' ? 'no' : 'unk', osmWc(p.t)) +
      (p.km != null ? '<small class="num">' + t('{km} km od středu výletu', { km: kmTxt(p.km) }) + '</small>' : '') + '</span>' +
      (p.data ? p.data.map(d => '<small>' + t('Otevřená data') + ': ' + ext(d.url, K.tx(d.label || '')) + '</small>').join('') : ''));
  }
  function parkRow(p) {
    const bits = [t('{m} m od zastávky {name}', { m: p.near_m, name: p.near })];
    if (p.pk) bits.push(t('{n} vyhrazených stání ZTP', { n: p.pk }));
    if (p.fee === 'no') bits.push(t('bez poplatku podle OSM')); else if (p.fee === 'yes') bits.push(t('placené podle OSM'));
    return shortRow(p, '<small class="num">' + esc(bits.join(' · ')) + '</small>');
  }
  function stationRow(p) {
    const d = (p.data || [])[0];
    return shortRow(p, '<span class="pv-mini-st">' + status(p.st, osmEntry(p.w)) + '</span>' +
      (d ? '<details class="pv-det"><summary>' + t('Měřené údaje o stanici') + '</summary><dl class="pv-rows">' + d.rows.map(r => '<div><dt>' + esc(K.tx(r[0])) + '</dt><dd>' + esc(K.tx(String(r[1]))) + '</dd></div>').join('') + '</dl><p class="small">' + ext(d.url, K.tx(d.label || '')) + (d.date ? ' · ' + K.fmtDate(d.date) : '') + '</p></details>' : ''));
  }
  function stayRow(p) {
    const w = p.web, items = w ? Object.keys(w.items) : [];
    return shortRow(p, '<span class="pv-mini-st">' + status(p.st, osmEntry(p.w)) + '</span>' +
      (items.length ? '<details class="pv-det"><summary>' + t('Co uvádí zdroj') + '</summary><ul class="pv-known">' + items.map(a => knownRow({ a, src: 'web', txt: w.items[a], url: w.url, date: w.date })).join('') + '</ul></details>' : ''));
  }
  function routeRow(r) {
    const surf = Object.entries(r.povrchy || {}).slice(0, 3).map(([k, v]) => K.tx(k) + ' ' + Math.round(v) + ' %').join(', ');
    return '<li class="rule-row pv-mini"><div><a href="stezky.html?id=' + encodeURIComponent(r.id) + '"><b>' + esc(r.nazev) + '</b></a>' +
      '<small class="num">' + esc([kmTxt(r.delka_km) + ' km', K.tx(r.typ), r.max_sklon != null ? t('max. sklon {p} %', { p: kmTxt(r.max_sklon) }) : '', r.schody === 0 ? t('bez schodů podle OSM') : ''].filter(Boolean).join(' · ')) + '</small>' +
      (surf ? '<small>' + t('Povrch') + ': ' + esc(surf) + '</small>' : '') + '<small class="num">' + t('{km} km od středu výletu', { km: kmTxt(r.km) }) + '</small></div></li>';
  }

  function section(id, kicker, title, intro, body) {
    return '<section class="section pv-sec" id="' + id + '" aria-labelledby="' + id + '-h"><div class="wrap split-grid"><div class="split-h">' +
      (kicker ? '<p class="kicker">' + kicker + '</p>' : '') + '<h2 id="' + id + '-h">' + title + '</h2>' + (intro ? '<p class="muted">' + intro + '</p>' : '') +
      '</div><div class="split-b">' + body + '</div></div></section>';
  }

  function renderDetail(g) {
    const full = fullAccess();
    document.title = pick(g.title) + ' · ' + t('Průvodci') + ' · Wherethru';
    let n = 0;
    const program = g.days.map((d, i) => {
      const items = d.map(s => { n++; return (full || n <= PREVIEW) ? stopFull(s, n) : stopShort(s, n); }).join('');
      return '<div class="pv-day"><h3 class="pv-day-h">' + (g.days_n > 1 ? t('Den {n}', { n: i + 1 }) : t('Program')) + '</h3><ol class="pv-stops">' + items + '</ol></div>';
    }).join('');
    const lock = full ? '' : '<div class="pv-lock" role="note"><p class="kicker">' + t('Náhled') + ' ' + K.tierBadge('offline') + '</p>' +
      '<p>' + t('V náhledu vidíte celé první {n} zastávky. U ostatních je název a stav vstupu. Údaje o přístupnosti každého místa najdete zdarma v jeho detailu.', { n: PREVIEW }) + '</p>' +
      '<p class="small muted">' + t('Celý průvodce se souhrnem u všech zastávek a verzí ke stažení bude v ostré verzi k zakoupení jednotlivě nebo v členství Traveller.') + '</p>' +
      '<button class="btn btn-primary" type="button" data-unlock>' + t('Zobrazit celý průvodce') + '</button></div>';

    const counts = '<ul class="rule-list pv-sum">' +
      '<li class="rule-row"><span>' + t('Zastávky s údaji z webu provozovatele nebo turistického portálu') + '</span><b class="num">' + g.with_web + ' / ' + g.stops_n + '</b></li>' +
      '<li class="rule-row"><span>' + t('Zastávky s měřenými otevřenými daty') + '</span><b class="num">' + g.with_data + ' / ' + g.stops_n + '</b></li>' +
      '<li class="rule-row"><span>' + t('Zastávky jen s údajem z OpenStreetMap') + '</span><b class="num">' + g.only_osm + ' / ' + g.stops_n + '</b></li>' +
      '<li class="rule-row"><span>' + t('Stav vstupu podle zdrojů') + '</span><span class="pv-states">' + statesLine(g.states) + '</span></li></ul>';

    const srcList = '<ul class="pv-src">' + g.sources.map(s => '<li>' + ext(s.url, s.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]) + ' <small>' + esc(K.tx(s.label || '')) + (s.date ? ' · ' + K.fmtDate(s.date) : '') + (s.license ? ' · ' + esc(s.license) : '') + '</small></li>').join('') +
      '<li>' + ext('https://www.openstreetmap.org/copyright', 'OpenStreetMap') + ' <small>' + t('přispěvatelé OpenStreetMap, ODbL') + '</small></li>' +
      (g.photos.length ? '<li>' + ext('https://commons.wikimedia.org/', 'Wikimedia Commons') + ' <small>' + t('fotky, autor a licence u každé fotky') + '</small></li>' : '') + '</ul>' +
      '<p class="small muted">' + t('Sestaveno {date} skriptem tools/build_pruvodci.py z dat webu.', { date: K.fmtDate(DATA.vytvoreno) }) + '</p>';

    const html =
      '<section class="page-head pv-dhead"><div class="wrap' + (g.photos[0] ? ' pv-dhead-in' : '') + '"><div>' +
      '<nav class="crumbs" aria-label="' + esc(t('Drobečková navigace')) + '"><a href="pruvodci.html">' + t('Průvodci') + '</a><span aria-hidden="true">/</span><span>' + esc(pick(g.title)) + '</span></nav>' +
      '<p class="kicker">' + esc(pick(g.area)) + ' · ' + esc(K.ZEME[g.country] || '') + '</p>' +
      '<h1>' + esc(pick(g.title)) + '</h1>' +
      '<p class="lede">' + esc(pick(g.intro)) + '</p>' +
      '<div class="pv-tiles">' +
      '<div class="tile"><span class="k">' + t('Délka') + '</span><span class="v num">' + esc(daysTxt(g.days_n)) + '</span></div>' +
      '<div class="tile"><span class="k">' + t('Zastávky') + '</span><span class="v num">' + g.stops_n + '</span></div>' +
      '<div class="tile"><span class="k">' + t('Návrh ceny') + '</span><span class="v num">' + esc(price(g.price_eur)) + '</span><small>' + t('jednorázově, zatím se neprodává') + '</small></div>' +
      '<div class="tile"><span class="k">' + t('Pro koho') + '</span><span class="pv-who">' + esc(pick(g.who)) + '</span></div>' +
      '</div>' +
      '<div class="row pv-acts">' +
      '<button class="btn btn-primary" type="button" data-dl>' + t('Stáhnout pro offline') + ' ' + K.tierBadge('offline', { onlyLocked: true }) + '</button>' +
      '<button class="btn btn-ghost" type="button" data-print>' + t('Vytisknout nebo uložit PDF') + ' ' + K.tierBadge('offline', { onlyLocked: true }) + '</button>' +
      '</div>' +
      '<p class="small muted pv-proto">' + esc(K.TIER_PROTO_NOTE) + '</p>' +
      '</div>' + (g.photos[0] ? '<figure class="pv-dphoto"><div class="wave-photo-left"><img src="' + esc(K.commonsImg(g.photos[0].img, 960)) + '" alt="' + esc(g.photos[0].n) + '" decoding="async"></div>' +
        '<figcaption>' + esc(g.photos[0].n) + ' · ' + t('Foto') + ': ' + ext(K.commonsPage(g.photos[0].img), 'Wikimedia Commons') + ', ' + t('autor a licence u fotky') + '</figcaption></figure>' : '') +
      '</div></section>' +
      section('pv-co', t('Odkud jsou údaje'), t('Co o zastávkách víme'), t('Údaje od provozovatele, z otevřených dat a od komunity od sebe odlišujeme. Nic z toho jsme neměřili sami.'), counts) +
      section('pv-program', t('Program'), t('Zastávky po řadě'), t('Pořadí je návrh. Vzdálenosti jsou vzdušnou čarou, skutečná cesta bývá delší.'), program + lock) +
      section('pv-wc', 'WC', t('Bezbariérová WC'), t('Veřejná WC označená v OpenStreetMap jako bezbariérová, v okolí zastávek.'),
        g.wc.length ? '<ul class="rule-list">' + g.wc.map(wcRow).join('') + '</ul>' : '<p class="muted">' + t('V okolí zastávek zatím nemáme žádné veřejné WC označené jako bezbariérové. Využijte WC v muzeích a hotelech, pokud ho zdroj uvádí.') + '</p>') +
      section('pv-park', t('Parkování'), t('Vyhrazená stání ZTP'), t('Stání z OpenStreetMap do 500 m od zastávek. Počet míst a poplatek uvádíme, jen když jsou v datech.'),
        g.parking.length ? '<ul class="rule-list">' + g.parking.map(parkRow).join('') + '</ul>' : '<p class="muted">' + t('Do 500 m od zastávek zatím v datech žádné vyhrazené stání ZTP není. Některé zastávky uvádějí parkování ve svém popisu výše.') + '</p>') +
      section('pv-doprava', t('Doprava'), t('Nádraží a zastávky'), t('Stav vstupu podle OpenStreetMap, u německých nádraží i měřené údaje z otevřených dat DB.'),
        (g.stations.length ? '<ul class="rule-list">' + g.stations.map(stationRow).join('') + '</ul>' : '<p class="muted">' + t('Nádraží v okolí zatím v průvodci nemáme. Dopravu si naplánujte u dopravce.') + '</p>') +
        '<p class="small pv-tip">' + t('Asistenci při cestě vlakem si objednejte u dopravce předem. Jízdní řády a spoje v průvodci nejsou.') + '</p>') +
      (g.stay.length ? section('pv-stay', t('Ubytování'), t('Kde přespat'), t('Ubytování z naší databáze v okolí. Nic nedoporučujeme za úplatu, pořadí není reklama.'), '<ul class="rule-list">' + g.stay.map(stayRow).join('') + '</ul>') : '') +
      (g.routes.length ? section('pv-trasy', t('Trasy'), t('Bezbariérové trasy v okolí'), t('Trasy z OpenStreetMap se sklonem z výškového modelu.'), '<ul class="rule-list">' + g.routes.map(routeRow).join('') + '</ul>') : '') +
      section('pv-zdroje', t('Zdroje'), t('Odkud průvodce čerpá'), '', srcList) +
      section('pv-cena', t('Návrh nabídky'), t('Kolik by průvodce stál'), '',
        '<p class="pv-big num">' + esc(price(g.price_eur)) + ' <small>' + t('návrh ceny, jednorázově') + '</small></p>' +
        '<p>' + t('V ostré verzi se hotoví průvodci budou prodávat jednotlivě. V členství Traveller budou ke stažení pro offline použití. Zatím se nic neprodává a nic neplatíte.') + '</p>' +
        '<p class="callout small">' + esc(K.TIER_NOTE) + '</p>' +
        '<p><a class="btn btn-ghost" href="clenstvi.html">' + t('Porovnat členství') + '</a></p>');

    const box = $('#pv-detail');
    box.innerHTML = html;
    box.hidden = false; $('#pv-catalog').hidden = true;
    box.querySelectorAll('[data-unlock]').forEach(b => b.addEventListener('click', () => K.requireTier('offline', () => { renderDetail(g); const f = $('#pv-program-h'); if (f) { f.setAttribute('tabindex', '-1'); f.focus(); } })));
    $('[data-dl]', box).addEventListener('click', () => K.requireTier('offline', () => download(g)));
    $('[data-print]', box).addEventListener('click', () => K.requireTier('offline', () => { if (!fullAccess()) return; renderDetail(g); setTimeout(() => window.print(), 50); }));
    if (K.i18n) K.i18n.apply(box);
  }

  // ---------- Stažení pro offline: jeden soubor HTML bez externích zdrojů ----------
  function download(g) {
    const S = (s) => esc(s == null ? '' : s);
    let n = 0;
    const stops = g.days.map((d, i) => '<h2>' + (g.days_n > 1 ? S(t('Den {n}', { n: i + 1 })) : S(t('Program'))) + '</h2><ol start="' + (n + 1) + '">' + d.map(s => {
      n++;
      const known = s.known.map(k => '<li><b>' + S(k.src === 'data' ? AREA.data : (AREA[k.a] || k.a)) + '</b> (' + S(k.src === 'data' ? t('otevřená data') : k.src === 'osm' ? 'OpenStreetMap' : t('web zdroje')) + '): ' +
        S(k.src === 'osm' ? (k.a === 'wc' ? osmWc(k.osm) : k.a === 'parkovani' ? t('{n} vyhrazených stání ZTP', { n: k.n }) : osmEntry(k.osm)) : k.txt || (k.rows || []).map(r => r.filter(x => x != null && x !== '').join(' ')).join('; ') || k.label) +
        (k.url ? ' <small>' + S(k.url) + (k.date ? ', ' + S(k.date) : '') + '</small>' : '') + '</li>').join('');
      return '<li><h3>' + S(s.n) + '</h3><p>' + S([(K.CATS[s.c] || {}).label, s.o, s.adr].filter(Boolean).join(' · ')) + '</p><p><b>' + S(t('Vstup: {s}', { s: stLabel(s.st).toLowerCase() })) + '</b></p>' +
        (known ? '<ul>' + known + '</ul>' : '') + (s.unknown.length ? '<p>' + S(t('Nevíme')) + ': ' + S(s.unknown.map(a => AREA_UNK[a] || a).join(', ')) + '</p>' : '') + '</li>';
    }).join('') + '</ol>').join('');
    const list = (title, arr, f) => arr.length ? '<h2>' + S(title) + '</h2><ul>' + arr.map(p => '<li>' + f(p) + '</li>').join('') + '</ul>' : '';
    const doc = '<!doctype html><html lang="' + L + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + S(pick(g.title)) + ' · Wherethru</title>' +
      '<style>body{font:17px/1.5 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#1F261C;background:#F7F7F5}h1{font-size:2rem;line-height:1.1;color:#3A4A34}h2{color:#3A4A34;border-top:1px solid #D9DED3;padding-top:12px;margin-top:32px}h3{margin:.2em 0}li{margin:.4em 0}small{color:#55604F}.note{border-radius:14px;padding:10px 14px;background:#EBEEE7}@media(prefers-color-scheme:dark){body{background:#171C15;color:#EEF1EA}h1,h2{color:#A9BBA0;border-color:#323C2E}small{color:#AEB8A7}.note{background:#262E23}}</style></head><body>' +
      '<p><b>Wherethru</b> · ' + S(pick(g.area)) + '</p><h1>' + S(pick(g.title)) + '</h1><p>' + S(pick(g.intro)) + '</p><p>' + S(pick(g.who)) + '</p>' +
      '<p class="note">' + S(t('Offline verze z prototypu. Údaje se mohou změnit, před cestou je ověřte u provozovatele. Staženo {date}.', { date: K.fmtDate(new Date().toISOString().slice(0, 10)) })) + '</p>' +
      stops +
      list(t('Bezbariérová WC'), g.wc, p => S(K.tx(p.n) + ' · ' + p.o + ' · ' + osmWc(p.t))) +
      list(t('Vyhrazená stání ZTP'), g.parking, p => S(K.tx(p.n) + ' · ' + t('{m} m od zastávky {name}', { m: p.near_m, name: p.near }) + (p.pk ? ' · ' + t('{n} vyhrazených stání ZTP', { n: p.pk }) : ''))) +
      list(t('Nádraží a zastávky'), g.stations, p => S(K.tx(p.n) + ' · ' + osmEntry(p.w))) +
      list(t('Kde přespat'), g.stay, p => S(K.tx(p.n) + ' · ' + p.o + ' · ' + osmEntry(p.w))) +
      list(t('Zdroje'), g.sources, s => S(s.url + (s.date ? ' (' + s.date + ')' : ''))) +
      '<p><small>' + S(t('Data: přispěvatelé OpenStreetMap (ODbL), otevřená data a weby provozovatelů uvedené výše.')) + '</small></p></body></html>';
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
      a.download = 'pruvodce-' + g.id + '.html';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      K.toast(t('Průvodce stažen jako soubor HTML. Otevřete ho i bez internetu.'));
    } catch (e) { K.toast(t('Stažení se nepovedlo. Zkuste tisk do PDF.')); }
  }

  // ---------- Start ----------
  async function init() {
    const id = new URLSearchParams(location.search).get('id');
    try { await load(); } catch (e) {
      $('#pv-list').innerHTML = '<li class="pv-empty">' + t('Průvodce se nepodařilo načíst. Zkuste stránku obnovit.') + '</li>';
      return;
    }
    if (id) {
      const g = DATA.pruvodci.find(x => x.id === id);
      if (g) {
        renderDetail(g);
        document.addEventListener('kp:tier', () => renderDetail(g));
        return;
      }
      $('#pv-count').textContent = t('Průvodce „{id}“ jsme nenašli. Vyberte si z katalogu.', { id });
    }
    bindFilters();
    renderCatalog();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
