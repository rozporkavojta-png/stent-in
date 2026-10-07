/* Itinerář: řetěz míst a tras (hotel → restaurace → muzeum → park). PROTOTYP bez serveru:
   rozpracovaný itinerář je v kp.itDraft, uložené v kp.itineraries (KP.community), otevřený v kp.itCurrent.
   Sdílení bez serveru: itinerar.html#it=<base64 JSON {n, s:[[id, region, poznámka]]}>.
   Přidání z jiných stránek: itinerar.html?add=<id místa>&r=<region> nebo itinerar.html?trasa=<id trasy>.
   Zastávka-trasa má id „t:<id trasy>“. */
(function () {
  'use strict';
  const K = window.KP, T = window.KPTrails, C = K.community, esc = K.esc, fmt = K.fmt;
  const $ = (s, r) => (r || document).querySelector(s);
  const DRAFT = 'itDraft', CURID = 'itCurrent', MAX_STOPS = 25;
  const empty = () => ({ id: null, name: '', note: '', stops: [] });
  let cur = empty(), shared = null, map = null, layers = [], TOWNS = [];
  const RES = new Map();

  // ---------- Stav ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadCurrent() {
    const id = K.store.get(CURID, null), it = id ? C.itineraries().find(x => x.id === id) : null;
    if (it) cur = Object.assign(empty(), clone(it));
    else { cur = Object.assign(empty(), K.store.get(DRAFT, {}) || {}); cur.id = null; }
    cur.stops = (cur.stops || []).filter(s => s && s.i).slice(0, MAX_STOPS);
  }
  function persist() {
    if (shared) return; // sdílený itinerář se ukládá až tlačítkem
    if (cur.id) { if (!C.saveItinerary(cur)) K.toast(KP.t('Úložiště prohlížeče je plné.')); }
    else if (!K.store.set(DRAFT, cur)) K.toast(KP.t('Úložiště prohlížeče je plné.'));
  }

  // ---------- Zastávky ----------
  const isTrail = (s) => /^t:/.test(s.i);
  async function resolve(s) {
    if (RES.has(s.i)) return RES.get(s.i);
    let v;
    if (isTrail(s)) {
      await T.load().catch(() => null);
      const t = T.byId(s.i.slice(2));
      v = t ? { kind: 'trail', t } : { kind: 'missing' };
    } else {
      const p = await K.findPlace(s.i, s.r).catch(() => null);
      v = p ? { kind: 'place', p } : { kind: 'missing' };
    }
    RES.set(s.i, v); return v;
  }
  function label(v, s) { return v.kind === 'place' ? v.p.n : v.kind === 'trail' ? T.name(v.t) : (s.n || KP.t('Neznámé místo')); }
  // Kudy se na zastávku přijde a odkud se odchází (u trasy z bodu do bodu je odchod v cíli)
  function ends(v) {
    if (v.kind === 'place') { const c = [v.p.la, v.p.lo]; return { a: c, b: c }; }
    if (v.kind === 'trail') return { a: v.t.start, b: v.t.typ === 'A→B' && v.t.cil ? v.t.cil : v.t.start };
    return null;
  }
  const ll = (c) => c[0] + '%2C' + c[1];
  const dirUrl = (a, b, mode) => 'https://www.google.com/maps/dir/?api=1&origin=' + ll(a) + '&destination=' + ll(b) + '&travelmode=' + mode;
  const pl = (n) => n + ' ' + K.plural(n, KP.t('zastávka'), KP.t('zastávky'), KP.t('zastávek'));
  const krajT = (k) => (k && K.LANG !== 'cs' ? K.krajName(k) : (k || ''));
  function distTxt(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : fmt((m / 1000).toFixed(1)) + ' km'; }

  function addStop(s, quiet) {
    if (cur.stops.length >= MAX_STOPS) { K.toast(K.t('Itinerář má nejvýš {n} zastávek.', { n: MAX_STOPS })); return false; }
    cur.stops.push({ i: s.i, r: s.r || '', n: s.n || '', note: '' });
    persist(); render();
    if (!quiet) K.toast(K.t('Přidáno do itineráře') + ': ' + (s.n || K.t('zastávka')));
    return true;
  }

  // ---------- Shoda s profilem ----------
  function stopMatch(v, n) {
    if (v.kind === 'place') return K.matchScore(v.p, n);
    if (v.kind === 'trail') return T.match(v.t, n);
    return null;
  }
  const ORDER = { no: 3, part: 2, unk: 1, ok: 0 };
  function scoreBlock(list) {
    const n = K.getNeeds();
    if (!list.length) return '';
    if (!n.active) return ('<div class="it-score it-off"><p><b>' + KP.t('Jak plán sedí k vašim potřebám?') + '</b> ' + KP.t('Nastavte si profil potřeb a u každé zastávky i za celý den to spočítáme z údajů, které opravdu máme.') + '</p><button class="btn btn-primary btn-sm" type="button" data-needs>' + KP.t('Nastavit profil potřeb') + '</button></div>');
    let met = 0, part = 0, known = 0, total = 0, worst = 'ok', okN = 0, counted = 0;
    const rows = list.map(({ v, s }, i) => {
      const r = stopMatch(v, n);
      if (!r) return '<li><span>' + (i + 1) + '. ' + esc(label(v, s)) + '</span>' + K.statusHtml('unk', KP.t('Nenalezeno')) + '</li>';
      counted++;
      const pn = r.partial.length;
      met += r.met.length; part += pn; known += r.known; total += r.total;
      if (ORDER[r.status] > ORDER[worst]) worst = r.status;
      if (r.status === 'ok') okN++;
      return '<li><span>' + (i + 1) + '. ' + esc(label(v, s)) + '</span>' + K.statusHtml(r.status, r.pct === null ? K.t('chybí údaje') : r.pct + (K.LANG === 'en' ? '%' : ' %')) + '</li>';
    });
    const pct = known ? Math.round((met + part * 0.5) / known * 100) : null;
    return '<div class="it-score st-' + worst + ('"><p class="st-match-q">' + KP.t('Celý plán podle vašeho profilu') + '</p>') +
      '<p class="big num">' + (pct === null ? K.t('Chybí údaje') : K.t('{pct} % shoda', { pct })) + '</p>' +
      '<p>' + K.t('Známe {k} z {n} sledovaných údajů. Bez výhrad vyhovuje {ok} z {c} zastávek.', { k: known, n: total, ok: okN, c: counted }) + '</p>' +
      '<p>' + K.statusHtml(worst, worst === 'ok' ? KP.t('Všechny zastávky vyhovují') : worst === 'part' ? KP.t('Někde budete potřebovat pomoc') : worst === 'no' ? KP.t('Aspoň jedna zastávka nevyhovuje') : KP.t('U některých zastávek chybí údaje')) + '</p>' +
      '<ul>' + rows.join('') + '</ul>' +
      '<button class="btn btn-quiet btn-sm" type="button" data-needs>' + K.t('Upravit profil') + ' (' + esc(K.aidLabel(n)) + ')</button></div>';
  }

  // ---------- Vykreslení ----------
  let renderSeq = 0;
  async function render() {
    const seq = ++renderSeq;
    $('#it-name').value = cur.name || '';
    const list = await Promise.all(cur.stops.map(async s => ({ s, v: await resolve(s) })));
    if (seq !== renderSeq) return;
    list.forEach(({ s, v }) => { if (!s.n && v.kind !== 'missing') s.n = label(v, s); if (v.kind === 'place' && !s.r && v.p._r) s.r = v.p._r; });
    const n = K.getNeeds();
    const box = $('#it-stops');
    if (!list.length) {
      box.innerHTML = ('<li class="it-empty"><p><b>' + KP.t('Itinerář je prázdný.') + '</b> ' + KP.t('Přidejte první zastávku níže, například hotel, ve kterém bydlíte. Pak restauraci, muzeum nebo bezbariérovou trasu.') + '</p></li>');
    } else {
      box.innerHTML = list.map(({ s, v }, i) => {
        const last = i === list.length - 1;
        let head = '', st = '', link = '#';
        if (v.kind === 'place') {
          const p = v.p, w = K.W[p.w || 'null'];
          link = K.placeUrl(p);
          head = '<p class="it-stop-k">' + esc((K.CATS[p.c] || {}).label || KP.t('Místo')) + (p.o ? ' · ' + esc(p.o) : '') + '</p>';
          st = K.statusHtml(p.c === 'parkovani' ? 'ok' : w.st, p.c === 'parkovani' ? KP.t('Parkování ZTP') : w.label);
        } else if (v.kind === 'trail') {
          const t = v.t, w = T.wh(t);
          link = T.detailUrl(t);
          head = '<p class="it-stop-k">' + K.t('Trasa') + ' · ' + esc(K.t(T.TYP[t.typ] || t.typ)) + ' · <span class="num">' + T.km(t.delka_km) + '</span> · ' + K.t('největší sklon') + ' <span class="num">' + T.pct(t.max_sklon) + '</span></p>';
          st = K.statusHtml(w[0], w[1]);
        } else {
          head = ('<p class="it-stop-k">' + KP.t('Nenalezeno') + '</p>');
          st = K.statusHtml('unk', KP.t('Místo se nepodařilo najít v datech'));
        }
        const r = n.active ? stopMatch(v, n) : null;
        const mt = r ? K.statusHtml(r.status, (r.pct === null ? K.t('Chybí údaje') : K.t('{pct} % shoda', { pct: r.pct })) + ', ' + K.t('známe {k} z {n}', { k: r.known, n: r.total })) : '';
        const name = label(v, s);
        let leg = '';
        if (!last) {
          const e1 = ends(v), v2 = list[i + 1].v, e2 = ends(v2);
          if (e1 && e2) {
            const d = K.distanceKm({ la: e1.b[0], lo: e1.b[1] }, { la: e2.a[0], lo: e2.a[1] }) * 1000;
            leg = '<li class="it-leg"><span class="it-leg-line" aria-hidden="true"></span><div class="it-leg-b">' +
              '<p class="small"><b>' + K.t('Přesun') + ' ' + (i + 1) + ' → ' + (i + 2) + '</b> · ' + K.t('vzdušnou čarou') + ' <span class="num">' + distTxt(d) + '</span>' + (d > 3000 ? '. ' + K.t('Na pěší přesun je to daleko, zvažte MHD nebo auto.') : '') + '</p>' +
              '<div class="it-leg-links">' +
              '<a class="btn btn-ghost btn-sm" href="' + dirUrl(e1.b, e2.a, 'walking') + '" target="_blank" rel="noopener">' + K.icon('nav') + (KP.t('Pěšky nebo na vozíku') + '</a>') +
              '<a class="btn btn-quiet btn-sm" href="' + dirUrl(e1.b, e2.a, 'transit') + '" target="_blank" rel="noopener">' + KP.t('MHD') + '</a>' +
              '<a class="btn btn-quiet btn-sm" href="' + dirUrl(e1.b, e2.a, 'driving') + ('" target="_blank" rel="noopener">' + KP.t('Autem') + '</a>') +
              '<a class="btn btn-quiet btn-sm" href="trasy.html?la=' + ((e1.b[0] + e2.a[0]) / 2).toFixed(5) + '&lo=' + ((e1.b[1] + e2.a[1]) / 2).toFixed(5) + ('">' + KP.t('Bariéry v ulicích') + '</a>') +
              '</div></div></li>';
          }
        }
        return '<li class="it-stop"><span class="it-no num" aria-hidden="true">' + (i + 1) + '</span><div class="it-stop-b">' + head +
          '<h3><span class="sr-only">' + K.t('Zastávka') + ' ' + (i + 1) + ': </span>' + (v.kind === 'missing' ? esc(name) : '<a href="' + link + '">' + esc(name) + '</a>') + '</h3>' +
          '<p class="it-stop-st">' + st + (mt ? ' ' + mt : '') + '</p>' +
          '<div class="field it-note"><label class="sr-only" for="note-' + i + ('">' + KP.t('Poznámka k zastávce') + ' ') + (i + 1) + '</label><input type="text" id="note-' + i + '" data-note="' + i + ('" maxlength="200" placeholder="' + KP.t('Poznámka, třeba čas nebo rezervace') + '" value="') + esc(s.note || '') + '"></div>' +
          '<div class="it-ctrl">' +
          '<button class="icon-btn it-up" type="button" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="' + K.t('Posunout výš') + ': ' + esc(name) + '">' + K.icon('chevron') + '</button>' +
          '<button class="icon-btn" type="button" data-down="' + i + '"' + (last ? ' disabled' : '') + ' aria-label="' + K.t('Posunout níž') + ': ' + esc(name) + '">' + K.icon('chevron') + '</button>' +
          '<button class="btn btn-quiet btn-sm" type="button" data-del="' + i + ('">' + KP.t('Odebrat') + '</button></div>') +
          '</div></li>' + leg;
      }).join('');
    }
    $('#it-score').innerHTML = scoreBlock(list);
    // celý plán v Google Maps (nejvýš 9 průjezdních bodů)
    const pts = [];
    list.forEach(({ v }) => { const e = ends(v); if (!e) return; pts.push(e.a); if (e.b !== e.a) pts.push(e.b); });
    const gm = $('#it-gm');
    if (pts.length >= 2 && pts.length - 2 <= 9) {
      gm.hidden = false;
      gm.href = 'https://www.google.com/maps/dir/?api=1&origin=' + ll(pts[0]) + '&destination=' + ll(pts[pts.length - 1]) + (pts.length > 2 ? '&waypoints=' + pts.slice(1, -1).map(c => c[0] + ',' + c[1]).join('%7C') : '') + '&travelmode=walking';
    } else gm.hidden = true;
    $('#it-save').textContent = cur.id && !shared ? KP.t('Uloženo v mých itinerářích') : KP.t('Uložit do mých itinerářů');
    $('#it-save').disabled = !!(cur.id && !shared);
    drawMap(list);
    renderList();
  }

  function drawMap(list) {
    if (!map) return;
    map.clearLayer(layers); layers = [];
    const all = [];
    let prev = null;
    list.forEach(({ v }, i) => {
      const e = ends(v); if (!e) return;
      if (v.kind === 'trail') (v.t.geometrie || []).forEach(part => { layers.push(T.drawPath(map, part, { color: '#101010', weight: 7 })); layers.push(T.drawPath(map, part, { color: '#FFD400', weight: 3 })); part.forEach(c => all.push({ la: c[0], lo: c[1] })); });
      if (prev) layers.push(T.drawPath(map, [prev, e.a], { color: '#101010', weight: 3, dash: '6 8', cap: 'butt' }));
      layers.push(T.drawPin(map, e.a, T.pinSvg(String(i + 1), 'start'), 28, (i + 1) + '. ' + label(v, {})));
      all.push({ la: e.a[0], lo: e.a[1] });
      prev = e.b;
    });
    if (all.length) map.fitTo(all);
  }

  function renderList() {
    const its = C.itineraries().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $('#it-list').innerHTML = its.length ? its.map(it => '<li' + (it.id === cur.id && !shared ? ' class="is-current"' : '') + '><span><b>' + esc(it.name || KP.t('Bez názvu')) + '</b><br><span class="small muted">' + pl((it.stops || []).length) + ' · ' + K.fmtDate(it.date) + (it.id === cur.id && !shared ? ' · ' + K.t('otevřený') : '') + '</span></span>' +
      '<span class="it-btns">' + (it.id === cur.id && !shared ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-open="' + esc(it.id) + ('">' + KP.t('Otevřít') + '</button>')) +
      '<button class="btn btn-quiet btn-sm" type="button" data-remove="' + esc(it.id) + ('">' + KP.t('Smazat') + '</button></span></li>')).join('')
      : ('<li><span class="muted">' + KP.t('Zatím žádný uložený itinerář. Rozpracovaný plán se ale v tomto prohlížeči drží i bez uložení.') + '</span></li>');
  }

  // ---------- Přidávání ----------
  async function renderSavedSource() {
    const box = $('#it-saved-res');
    const ids = K.saved.all(), tids = T.local.saved();
    if (!ids.length && !tids.length) { box.innerHTML = ('<li><span class="muted">' + KP.t('Zatím nemáte nic uloženého. Místo si uložíte srdíčkem na mapě nebo v detailu, trasu tlačítkem Uložit v katalogu tras. Nebo použijte hledání v obci.') + '</span></li>'); return; }
    box.innerHTML = ('<li><span class="muted">' + KP.t('Načítám uložená místa…') + '</span></li>');
    const places = await K.findPlaces(ids.slice(0, 40)).catch(() => []);
    await T.load().catch(() => null);
    const trails = tids.map(id => T.byId(id)).filter(Boolean);
    const rows = places.map(p => '<li><span><b>' + esc(p.n) + '</b><br><span class="muted">' + esc((K.CATS[p.c] || {}).label || '') + (p.o ? ' · ' + esc(p.o) : '') + '</span></span><button class="btn btn-ghost btn-sm" type="button" data-add="' + esc(p.i) + '" data-r="' + esc(p._r || '') + '" data-n="' + esc(p.n) + '">' + K.icon('plus') + (KP.t('Přidat') + '</button></li>'))
      .concat(trails.map(t => '<li><span><b>' + esc(T.name(t)) + ('</b><br><span class="muted">' + KP.t('Trasa') + ' · ') + esc(krajT(t.kraj)) + ' · ' + T.km(t.delka_km) + '</span></span><button class="btn btn-ghost btn-sm" type="button" data-add="t:' + esc(t.id) + '" data-n="' + esc(T.name(t)) + '">' + K.icon('plus') + (KP.t('Přidat') + '</button></li>')));
    box.innerHTML = rows.join('') || ('<li><span class="muted">' + KP.t('Uložená místa se nepodařilo načíst.') + '</span></li>');
  }

  async function findInTown(e) {
    e.preventDefault();
    const q = $('#it-town').value.trim().toLowerCase(), nameQ = $('#it-q').value.trim().toLowerCase(), box = $('#it-find-res');
    if (!q) return;
    const town = TOWNS.find(x => x[0].toLowerCase() === q) || TOWNS.find(x => x[0].toLowerCase().startsWith(q));
    if (!town) { box.innerHTML = '<li><span>' + K.t('Obec „{q}“ v naší databázi nemáme.', { q: esc($('#it-town').value) }) + '</span></li>'; return; }
    box.innerHTML = '<li><span class="muted">' + K.t('Načítám místa v obci {t}…', { t: esc(town[0]) }) + '</span></li>';
    let list = [];
    try { list = await K.loadRegion(town[1]); } catch (err) { box.innerHTML = ('<li><span>' + KP.t('Data se nepodařilo načíst. Zkuste to znovu.') + '</span></li>'); return; }
    const res = list.filter(p => (p.o === town[0] || (p.la >= town[3] && p.la <= town[5] && p.lo >= town[4] && p.lo <= town[6])) && (!nameQ || String(p.n).toLowerCase().includes(nameQ)))
      .sort((a, b) => (K.generalStatus(a) === 'ok' ? 0 : 1) - (K.generalStatus(b) === 'ok' ? 0 : 1) || a.n.localeCompare(b.n, 'cs'));
    if (!res.length) { box.innerHTML = '<li><span>' + K.t(nameQ ? KP.t('V obci {t} jsme místo s tímto názvem nenašli.') : KP.t('V obci {t} jsme žádné místo nenašli.'), { t: esc(town[0]) }) + '</span></li>'; return; }
    box.innerHTML = res.slice(0, 40).map(p => {
      const w = K.W[p.w || 'null'];
      return '<li><span><b>' + esc(p.n) + '</b><br><span class="muted">' + esc((K.CATS[p.c] || {}).label || '') + (p.s ? ' · ' + esc(K.t(p.s)) : '') + '</span> ' + K.statusHtml(p.c === 'parkovani' ? 'ok' : w.st, p.c === 'parkovani' ? KP.t('Parkování ZTP') : w.short) + '</span>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-add="' + esc(p.i) + '" data-r="' + esc(p._r || '') + '" data-n="' + esc(p.n) + '">' + K.icon('plus') + (KP.t('Přidat') + '</button></li>');
    }).join('') + (res.length > 40 ? '<li><span class="muted">' + K.t('A dalších {n}. Upřesněte název.', { n: res.length - 40 }) + '</span></li>' : '');
  }

  async function fillTrails() {
    try {
      const all = await T.load();
      const groups = {};
      all.forEach(t => { const k = K.t(T.ZEME[t.zeme] || t.zeme) + ', ' + krajT(t.kraj); (groups[k] = groups[k] || []).push(t); });
      $('#it-trail').innerHTML = ('<option value="">' + KP.t('Vyberte trasu') + '</option>') + Object.keys(groups).sort((a, b) => a.localeCompare(b, 'cs')).map(g =>
        '<optgroup label="' + esc(g) + '">' + groups[g].sort((a, b) => T.name(a).localeCompare(T.name(b), 'cs') || a.delka_km - b.delka_km).map(t => '<option value="' + esc(t.id) + '">' + esc(T.name(t)) + ' (' + T.km(t.delka_km) + ')</option>').join('') + '</optgroup>').join('');
    } catch (e) { $('#it-trail').innerHTML = ('<option value="">' + KP.t('Trasy se nepodařilo načíst') + '</option>'); }
  }

  // ---------- Sdílení odkazem ----------
  function encode(it) { const o = { n: it.name || '', s: it.stops.map(s => [s.i, s.r || '', s.note || '']) }; return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }
  function decode(h) {
    try {
      const m = String(h || '').match(/(?:^|[#&])it=([^&]+)/); if (!m) return null;
      const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      const stops = (Array.isArray(o.s) ? o.s : []).filter(x => Array.isArray(x) && typeof x[0] === 'string' && x[0].length < 80)
        .slice(0, MAX_STOPS).map(x => ({ i: x[0], r: String(x[1] || '').slice(0, 60), n: '', note: String(x[2] || '').slice(0, 200) }));
      return { id: null, name: String(o.n || KP.t('Sdílený itinerář')).slice(0, 80), note: '', stops };
    } catch (e) { return null; }
  }
  function shareUrl() { return location.href.replace(/[?#].*$/, '') + '#it=' + encodeURIComponent(encode(cur)); }
  async function doShare() {
    if (!cur.stops.length) { K.toast(KP.t('Itinerář je prázdný.')); return; }
    const url = shareUrl();
    $('#it-sharebox').innerHTML = ('<div class="field"><label for="it-link">' + KP.t('Odkaz na itinerář') + '</label><div class="it-sharebox"><input id="it-link" type="text" readonly value="') + esc(url) + ('"><button class="btn btn-ghost btn-sm" type="button" id="it-copy">' + KP.t('Kopírovat') + '</button></div>') +
      ('<span class="hint">' + KP.t('Odkaz nese celý seznam zastávek a poznámky. Kdo ho otevře, uvidí váš plán a může si ho uložit.') + '</span></div>');
    $('#it-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); K.toast(KP.t('Odkaz je zkopírovaný.')); } catch (e) { $('#it-link').select(); } });
    if (navigator.share && matchMedia('(max-width: 899px)').matches) { try { await navigator.share({ title: cur.name || KP.t('Itinerář'), url }); } catch (e) { /* zrušeno */ } }
  }
  function showSharedBanner() {
    const b = $('#it-shared');
    if (!shared) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = '<p><b>' + K.t('Díváte se na itinerář z odkazu') + '</b> (' + K.t('„{n}“', { n: esc(shared.name) }) + ', ' + pl(shared.stops.length) + '). ' + K.t('Kdo ho sestavil, nevíme. Úpravy se uloží, až si ho uložíte k sobě.') + '</p>' +
      ('<div class="row"><button class="btn btn-primary" type="button" id="it-keep">' + KP.t('Uložit k sobě') + '</button><button class="btn btn-ghost" type="button" id="it-back">' + KP.t('Zpět na můj itinerář') + '</button></div>');
    $('#it-keep').addEventListener('click', () => {
      const s = C.saveItinerary(Object.assign({}, cur, { id: null }));
      if (!s) { K.toast(KP.t('Úložiště prohlížeče je plné.')); return; }
      shared = null; cur = Object.assign(empty(), clone(s)); K.store.set(CURID, s.id);
      history.replaceState(null, '', location.pathname); showSharedBanner(); render(); K.toast(KP.t('Itinerář uložen v tomto prohlížeči.'));
    });
    $('#it-back').addEventListener('click', () => { shared = null; history.replaceState(null, '', location.pathname); loadCurrent(); showSharedBanner(); render(); });
  }

  // ---------- Události ----------
  function bind() {
    $('#it-name').addEventListener('input', () => { cur.name = $('#it-name').value.slice(0, 80); persist(); renderList(); });
    $('#it-stops').addEventListener('change', e => { const i = e.target.dataset.note; if (i === undefined) return; cur.stops[+i].note = e.target.value.slice(0, 200); persist(); });
    $('#it-stops').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = cur.stops;
      if (b.dataset.up !== undefined) { const i = +b.dataset.up; if (i > 0) { [s[i - 1], s[i]] = [s[i], s[i - 1]]; persist(); render().then(() => { const x = document.querySelector('[data-up="' + (i - 1) + '"]'); (x && !x.disabled ? x : document.querySelector('[data-down="' + (i - 1) + '"]')).focus(); }); } }
      else if (b.dataset.down !== undefined) { const i = +b.dataset.down; if (i < s.length - 1) { [s[i + 1], s[i]] = [s[i], s[i + 1]]; persist(); render().then(() => { const x = document.querySelector('[data-down="' + (i + 1) + '"]'); (x && !x.disabled ? x : document.querySelector('[data-up="' + (i + 1) + '"]')).focus(); }); } }
      else if (b.dataset.del !== undefined) { const gone = s.splice(+b.dataset.del, 1)[0]; persist(); render(); K.toast(K.t('Odebráno') + ': ' + (gone.n || K.t('zastávka'))); }
    });
    document.querySelector('.it-add').addEventListener('click', e => {
      const b = e.target.closest('[data-add]'); if (!b) return;
      addStop({ i: b.dataset.add, r: b.dataset.r || '', n: b.dataset.n || '' });
    });
    $('#it-find').addEventListener('submit', findInTown);
    $('#it-trail-form').addEventListener('submit', e => {
      e.preventDefault(); const id = $('#it-trail').value; if (!id) return;
      const t = T.byId(id); addStop({ i: 't:' + id, n: t ? T.name(t) : '' });
    });
    const tabs = [...document.querySelectorAll('.it-add-tabs [role="tab"]')];
    const show = (t) => tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; show(n); n.focus(); });
    });
    $('#it-save').addEventListener('click', () => {
      if (!cur.stops.length) { K.toast(KP.t('Nejdřív přidejte aspoň jednu zastávku.')); return; }
      const s = C.saveItinerary(Object.assign({}, cur, { name: cur.name || KP.t('Můj itinerář'), id: shared ? null : cur.id }));
      if (!s) { K.toast(KP.t('Úložiště prohlížeče je plné.')); return; }
      if (shared) { shared = null; history.replaceState(null, '', location.pathname); showSharedBanner(); }
      cur = Object.assign(empty(), clone(s)); K.store.set(CURID, s.id); K.store.set(DRAFT, empty());
      render(); K.toast(KP.t('Itinerář uložen v tomto prohlížeči.'));
    });
    $('#it-share').addEventListener('click', doShare);
    $('#it-new').addEventListener('click', () => {
      if (shared) { shared = null; history.replaceState(null, '', location.pathname); showSharedBanner(); }
      cur = empty(); K.store.set(CURID, null); K.store.set(DRAFT, cur); $('#it-sharebox').innerHTML = ''; render();
      $('#it-name').focus();
    });
    $('#it-list').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.open) {
        const it = C.itineraries().find(x => x.id === b.dataset.open); if (!it) return;
        if (shared) { shared = null; history.replaceState(null, '', location.pathname); showSharedBanner(); }
        cur = Object.assign(empty(), clone(it)); K.store.set(CURID, it.id); $('#it-sharebox').innerHTML = ''; render();
        window.scrollTo({ top: $('.it-grid').offsetTop - 70, behavior: 'smooth' });
      } else if (b.dataset.remove) {
        const it = C.itineraries().find(x => x.id === b.dataset.remove);
        if (!it || !window.confirm(K.t('Smazat itinerář „{name}“? Nejde to vrátit.', { name: it.name || K.t('Bez názvu') }))) return;
        C.deleteItinerary(it.id);
        if (cur.id === it.id && !shared) { cur = empty(); K.store.set(CURID, null); K.store.set(DRAFT, cur); render(); } else renderList();
      }
    });
    document.addEventListener('click', e => { if (e.target.closest('[data-needs]')) K.needsDrawer(); });
    document.addEventListener('kp:needs', () => render());
  }

  // ---------- Start ----------
  async function init() {
    $('#it-proto').textContent = K.PROTOTYPE_NOTE + (' ' + KP.t('Sdílet jde i teď: odkaz nese celý itinerář v sobě.'));
    loadCurrent();
    const sh = decode(location.hash);
    if (sh) { shared = sh; cur = clone(sh); }
    const sp = new URLSearchParams(location.search), add = sp.get('add'), tr = sp.get('trasa');
    bind();
    if (!shared && (add || tr)) {
      const s = tr ? { i: 't:' + tr, r: '' } : { i: add, r: sp.get('r') || '' };
      const last = cur.stops[cur.stops.length - 1];
      if (!(last && last.i === s.i)) {
        const v = await resolve(s);
        if (v.kind === 'missing') K.toast(tr ? KP.t('Trasu jsme nenašli.') : KP.t('Místo jsme nenašli.'));
        else { s.n = label(v, s); addStop(s); }
      }
      history.replaceState(null, '', location.pathname);
    }
    showSharedBanner();
    render();
    try { map = await KPMap.create($('#it-map'), { lat: 49.4, lng: 13.6, zoom: 6 }); render(); }
    catch (e) { $('#it-map').innerHTML = ('<p class="muted small st-map-err">' + KP.t('Mapu se nepodařilo načíst. Itinerář funguje dál.') + '</p>'); }
    renderSavedSource(); fillTrails();
    K.loadTowns().then(t => { TOWNS = t; $('#it-towns').innerHTML = t.slice(0, 1500).map(x => '<option value="' + esc(x[0]) + '">').join(''); }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
