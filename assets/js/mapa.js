/* Stránka Mapa míst: filtry (assets/js/filters.js), výpis a mapa nad skutečnými daty z data/regions/ (Česko a Bavorsko).
   Data se načítají po regionech podle výřezu mapy (KP.loadRegion); když je ve výřezu moc míst, panel nabídne výběr kraje / obvodu.
   PC: levý sloupec (hledání, kategorie, rychlé filtry, výsledky) + mapa; panel Filtry se vysune přes levý sloupec.
   Mobil: mapa na celou výšku, nahoře hledání a kategorie, výsledky ve vysouvacím panelu (přepínač Mapa / Seznam),
   panel Filtry zespodu. Filtry jsou v adrese stránky, takže jdou sdílet a tlačítko Zpět funguje. */
(function () {
  'use strict';
  const K = window.KP, KF = window.KPFilters, $ = (s) => document.querySelector(s), $$ = (s) => document.querySelectorAll(s);
  const PAGE = 40;
  const LIMIT = 45000; // víc míst najednou podle výřezu nenačítáme (paměť telefonu); stačí přiblížit nebo vybrat kraj
  const view = { inView: true, sort: K.store.get('map.sort', 'complete'), shown: PAGE, active: null };
  const mqDesk = matchMedia('(min-width: 900px)');
  let ctrl = null, ALL = [], map = null, bounds = null, filtered = [], IDX = [], overview = false, loadingIds = null, TOWNS = [], myPos = null;
  const LOADED = {}; // id regionu → pole míst
  const fmtN = (n) => K.nf(n);
  const unit = (n) => K.plural(n, 'místo', 'místa', 'míst');

  function colorOf(p) {
    if (p.c === 'parkovani') return 'park';
    const n = K.getNeeds();
    return n.active && K.hasTier('match') ? K.match(p, n).status : K.generalStatus(p);
  }
  const iconOf = (p) => (K.CATS[p.c] || {}).icon || 'pin';

  function inBounds(p) { return !bounds || (p.la >= bounds.s && p.la <= bounds.n && p.lo >= bounds.w && p.lo <= bounds.e); }
  function center() {
    if (view.sort === 'near' && myPos) return myPos;
    return bounds ? { la: (bounds.s + bounds.n) / 2, lo: (bounds.w + bounds.e) / 2 } : null;
  }

  // Výřez je moc velký: místo výsledků adresář krajů a obvodů ve výřezu (klepnutí = načíst a přiblížit)
  function regionDirHtml() {
    const zeme = ctrl.state.zeme;
    const ids = bounds ? regionIds(bounds) : IDX.map(r => r.id);
    const rs = IDX.filter(r => ids.includes(r.id));
    return '<li class="reg-note"><p><b>' + K.esc(KP.t('Ve výřezu je')) + ' ' + fmtN(rs.reduce((a, r) => a + r.pocet, 0)) + ' ' + K.esc(KP.t('míst.')) + '</b></p><p class="small">' + K.esc(KP.t('Tolik jich najednou nenačítáme. Přibližte mapu, hledejte obec, nebo vyberte kraj či vládní obvod')) + ':</p></li>' +
      ['cz', 'de'].filter(z => !zeme || z === zeme).map(z => {
        const g = rs.filter(r => r.zeme === z); if (!g.length) return '';
        return '<li class="reg-head"><p class="kicker">' + K.ZEME[z] + ' · ' + K.esc(z === 'de' ? KP.t('vládní obvody') : KP.t('kraje')) + '</p></li>' +
          g.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')).map(r => '<li><button type="button" class="reg-row" data-region="' + K.esc(r.nazev) + '"><span class="reg-main"><b>' + K.esc(K.krajName(r.nazev, r.zeme)) + '</b><span class="meta">' + K.esc(LOADED[r.id] ? KP.t('Načteno') : KP.t('Klepnutím načtete a přiblížíte')) + '</span></span><span class="num reg-n">' + fmtN(r.pocet) + '</span></button></li>').join('');
      }).join('');
  }

  function emptyHtml() {
    const relax = ctrl.relaxHtml(3);
    return '<li class="empty-state rc-empty">' + K.icon('search') + '<h3>' + K.esc(KP.t('Tady nic neodpovídá filtrům.')) + '</h3>' +
      '<p>' + K.esc(KP.t('Oddalte mapu, vypněte „Jen v oblasti mapy“ nebo zrušte některý filtr.')) + '</p>' + relax +
      (view.inView && filtered.length ? '<button type="button" class="btn btn-secondary btn-sm" data-all-areas>' + K.esc(KP.t('Ukázat {n} míst mimo výřez', { n: fmtN(filtered.length) })) + '</button>' : '') +
      '<p class="small"><a href="pridat.html">' + K.esc(KP.t('Znáte tu přístupné místo? Přidejte ho.')) + '</a></p></li>';
  }

  function render() {
    if (overview) {
      $('#count').innerHTML = '<span class="cnt-t">' + K.esc(KP.t('Vyberte oblast')) + '</span><span class="total">' + K.esc(ctrl.state.zeme ? K.ZEME[ctrl.state.zeme] : KP.t('Česko a Bavorsko')) + ': ' + fmtN(IDX.filter(r => !ctrl.state.zeme || r.zeme === ctrl.state.zeme).reduce((a, r) => a + r.pocet, 0)) + ' ' + K.esc(KP.t('míst')) + '</span>';
      $('#results').innerHTML = regionDirHtml();
      $('#more').hidden = true;
      return;
    }
    const visible = view.inView ? filtered.filter(inBounds) : filtered;
    const list = KF.sortList(visible, view.sort, { center: center() });
    const n = list.length;
    $('#count').innerHTML = '<span class="num">' + fmtN(n) + '</span> <span class="cnt-t">' + K.esc(unit(n)) + ' ' + K.esc(view.inView ? KP.t('v oblasti mapy') : KP.t('v načtených oblastech')) + '</span>' +
      (loadingIds ? '<span class="total">' + K.esc(KP.t('Načítám další místa…')) + '</span>' : '') +
      (view.inView && filtered.length !== n ? '<span class="total">' + K.esc(KP.t('z {n} podle filtrů', { n: fmtN(filtered.length) })) + '</span>' : '');
    $('#results').innerHTML = n ? list.slice(0, view.shown).map(p => KF.cardHtml(p, { mode: 'button', active: view.active })).join('') : emptyHtml();
    $('#more').hidden = n <= view.shown;
    $('#more').textContent = KP.t('Zobrazit dalších {n}', { n: fmtN(Math.min(PAGE, n - view.shown)) });
  }

  function refreshMap() { if (map) map.setPlaces(filtered, { colorOf, iconOf, onClick: (p) => select(p, true), key: JSON.stringify(K.getNeeds()) + K.hasTier('match') }); }
  function update() { view.shown = PAGE; filtered = ctrl.run(ALL); render(); refreshMap(); }

  // ---------- Výběr místa ----------
  function previewHtml(p) {
    const needs = K.getNeeds();
    const on = needs.active && K.hasTier('match');
    const m = on ? K.match(p, needs) : null;
    const ms = on ? K.matchScore(p, needs) : null;
    const c = p._c ?? (p._c = K.completeness(p));
    const operator = p.nw || /^rh[0-9a-f]+$/.test(p.i);
    const cat = K.CATS[p.c] || { icon: 'pin' };
    const saved = K.saved.has(p.i);
    const photo = p.img ? '<figure class="pv-photo"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="' + K.esc(p.n) + '" loading="lazy" decoding="async">' +
      '<figcaption>' + K.esc(KP.t('Foto')) + ': <a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>' : '';
    const w = K.W[p.w || 'null'];
    const states = p.c === 'parkovani'
      ? '<span class="plain">' + K.icon('parking-ztp') + (p.pk ? fmtN(p.pk) + ' ' + K.esc(KP.t('× parkování ZTP')) : K.esc(KP.t('Parkování pro ZTP'))) + '</span>'
      : K.statusHtml(w.st, w.label) + (p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : '') + (p.pk ? '<span class="plain">' + K.icon('parking-ztp') + fmtN(p.pk) + ' ' + K.esc(KP.t('× parkování ZTP')) + '</span>' : '');
    const tags = (KF.attrs.mer(p) ? '<span class="badge badge-verified">' + K.icon('ruler') + K.esc(KP.t('Naměřeno')) + '</span>' : KF.hasX(p) ? '<span class="badge badge-community">' + K.icon('shield') + K.esc(KP.t('Otevřená data')) + '</span>' : '') +
      (KF.hasR(p) ? '<span class="badge badge-business">' + K.icon('building') + K.esc(KP.t('Z webu provozovatele')) + '</span>' : '') +
      (operator || KF.hasX(p) ? '' : K.sourceBadge('komunita'));
    return '<header class="pv-head"><span class="pv-ic" aria-hidden="true">' + K.icon(cat.icon) + '</span><div class="pv-t"><p class="pv-kicker">' + [p.s && K.t(p.s), p.o].filter(Boolean).map(K.esc).join(' · ') + '</p><h2>' + K.esc(p.n) + '</h2></div>' +
      '<button class="icon-btn" type="button" data-close aria-label="' + K.esc(KP.t('Zavřít náhled')) + '">' + K.icon('close') + '</button></header>' + photo +
      '<div class="pv-states">' + states + '</div>' +
      (p.d ? '<p class="pv-desc">' + K.esc(p.d) + '</p>' : '') +
      (m ? '<p class="pv-match">' + K.statusHtml(m.status, (ms.pct === null ? '' : KP.t('{pct} % shoda', { pct: ms.pct }) + ', ') + K.lc(K.STATUS_LABEL[m.status]) + ' (' + KP.t('známe {k} z {n}', { k: ms.known, n: ms.total }) + ')') + (m.status !== 'ok' && m.fails.concat(m.unknown).length ? '<span class="muted">: ' + K.esc(m.fails.concat(m.unknown).join(', ')) + '</span>' : '') + '</p>' : pvNeedsCta()) +
      (tags ? '<p class="pv-tags">' + tags + '</p>' : '') +
      '<p class="pv-meta">' + (p.u ? '<span>' + K.esc(KP.t('Upraveno')) + ' ' + K.fmtDate(p.u) + '</span>' : '') + (p.cd ? '<span>' + K.esc(KP.t('Kontrola na místě')) + ' ' + K.fmtDate(p.cd) + '</span>' : '') + '</p>' +
      '<div class="pv-fill"><div class="tape-meter" style="--v:' + c + '" aria-hidden="true"></div><span>' + KP.t('Vyplněno <b class="num">{pct} %</b> údajů', { pct: c }) + '</span></div>' +
      '<div class="pv-actions"><a class="btn btn-primary" href="' + K.placeUrl(p) + '">' + K.esc(KP.t('Detail')) + ' ' + K.icon('arrow') + '</a>' +
      '<a class="btn btn-ghost" href="' + K.gmaps.directions(p) + '" target="_blank" rel="noopener">' + K.icon('nav') + K.esc(KP.t('Navigovat')) + '</a>' +
      '<button type="button" class="icon-btn rc-save pv-save" data-save="' + K.esc(p.i) + '" aria-pressed="' + saved + '" aria-label="' + K.esc((saved ? KP.t('Odebrat z uložených') : KP.t('Uložit')) + ': ' + p.n) + '">' + K.icon(saved ? 'heart-filled' : 'heart') + '</button></div>';
  }
  // Náhled bez osobní shody: nabídka Accessibility Match (Explorer); základní údaje nad tím zůstávají zdarma
  function pvNeedsCta() {
    const locked = !K.hasTier('match');
    return '<p class="pv-match-cta"><button class="btn btn-quiet btn-sm" type="button" data-pv-needs>' + K.icon('sliders') +
      K.esc(locked ? KP.t('Shoda s mými potřebami') : KP.t('Nastavit potřeby')) + '</button>' + (locked ? K.tierBadge('match') : '') + '</p>';
  }

  function select(p, fromMap) {
    view.active = p ? p.i : null;
    const box = $('#preview');
    $$('.rc[data-card]').forEach(b => b.classList.toggle('is-active', !!p && b.dataset.card === p.i));
    $('.map-layout').classList.toggle('has-preview', !!p);
    if (!p) { box.hidden = true; box.innerHTML = ''; if (map) map.focus(null); return; }
    box.hidden = false;
    box.innerHTML = previewHtml(p);
    const pn = box.querySelector('[data-pv-needs]');
    if (pn) pn.addEventListener('click', () => { if (K.hasTier('match')) K.needsDrawer(); else K.requireTier('match', () => K.needsDrawer()); });
    box.querySelector('[data-close]').addEventListener('click', () => {
      const id = view.active; select(null);
      const r = id && document.querySelector('.rc[data-card="' + CSS.escape(id) + '"] .rc-hit');
      if (r && (mqDesk.matches || sheetPos !== 'peek')) r.focus();
    });
    if (map) map.focus(p);
    if (mqDesk.matches) {
      const row = document.querySelector('.rc[data-card="' + CSS.escape(p.i) + '"]');
      if (fromMap && row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (!fromMap) $('#panel-scroll').scrollTop = 0;
      if (fromMap) box.querySelector('[data-close]').focus({ preventScroll: true });
    } else {
      box.querySelector('[data-close]').focus({ preventScroll: true });
    }
  }

  // Náhled: na PC nad seznamem, na mobilu plovoucí karta dole na mapě. Rychlé filtry: na PC nahoře, na mobilu v panelu výsledků.
  function placeParts() {
    const box = $('#preview');
    if (mqDesk.matches) $('#panel').insertBefore(box, $('#results-head'));
    else $('.map-wrap').appendChild(box);
    const slot = mqDesk.matches ? $('#quick-top') : $('#quick-sheet');
    if ($('#kf-quick').parentElement !== slot) { slot.appendChild($('#kf-quick')); slot.appendChild($('#kf-active')); }
  }

  // ---------- Vysouvací panel výsledků (mobil) ----------
  const SHEET = ['peek', 'half', 'full'];
  let sheetPos = 'peek';
  function sheetHeights() {
    const H = $('.map-layout').clientHeight;
    const peek = parseFloat(getComputedStyle($('.map-layout')).getPropertyValue('--peek-h')) || 96;
    const top = $('.map-top').offsetHeight;
    return { peek, half: Math.max(peek + 80, Math.round(H * 0.55)), full: Math.max(peek + 80, H - top - 4) };
  }
  function setSheet(pos) {
    sheetPos = pos;
    const lay = $('.map-layout'), panel = $('#panel');
    lay.dataset.sheet = pos;
    if (mqDesk.matches) { panel.style.height = ''; return; }
    panel.style.height = sheetHeights()[pos] + 'px';
    const toMap = pos !== 'peek';
    $('#view-btn').innerHTML = K.icon(toMap ? 'map' : 'list') + '<span class="lbl">' + K.esc(toMap ? KP.t('Mapa') : KP.t('Seznam')) + '</span>';
    $('#view-btn').setAttribute('aria-label', toMap ? KP.t('Zobrazit mapu') : KP.t('Zobrazit seznam'));
    $('#grip').setAttribute('aria-label', pos === 'full' ? KP.t('Zmenšit seznam') : KP.t('Zvětšit seznam'));
    $('#grip').setAttribute('aria-expanded', pos !== 'peek');
  }
  function bindSheet() {
    const panel = $('#panel');
    let drag = null, suppressClick = false;
    const start = (e) => {
      if (mqDesk.matches || e.button > 0) return;
      if (e.currentTarget !== $('#grip') && e.target.closest('button, select, input, label, a, .kf-quick, .kf-active')) return;
      drag = { y: e.clientY, h: panel.offsetHeight, t: performance.now(), moved: false, id: e.pointerId, el: e.currentTarget };
      panel.classList.add('dragging');
    };
    const move = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) < 6) return;
      if (!drag.moved) { drag.moved = true; try { drag.el.setPointerCapture(drag.id); } catch (err) { /* nic */ } }
      const hs = sheetHeights();
      panel.style.height = Math.min(hs.full, Math.max(hs.peek, drag.h - dy)) + 'px';
    };
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      panel.classList.remove('dragging');
      const d = drag; drag = null;
      if (!d.moved) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      const hs = sheetHeights(), h = panel.offsetHeight;
      const v = (h - d.h) / Math.max(1, performance.now() - d.t); // kladné = nahoru
      let pos;
      if (Math.abs(v) > 0.6) { const i = SHEET.indexOf(sheetPos); pos = v > 0 ? SHEET[Math.min(2, i + 1)] : SHEET[Math.max(0, i - 1)]; }
      else pos = SHEET.reduce((a, b) => Math.abs(hs[b] - h) < Math.abs(hs[a] - h) ? b : a);
      setSheet(pos);
    };
    [$('#grip'), $('#results-head')].forEach(el => {
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
    $('#grip').addEventListener('click', () => { if (suppressClick || mqDesk.matches) return; setSheet(sheetPos === 'peek' ? 'half' : sheetPos === 'half' ? 'full' : 'peek'); });
    $('#grip').addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); setSheet(SHEET[Math.min(2, SHEET.indexOf(sheetPos) + 1)]); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSheet(SHEET[Math.max(0, SHEET.indexOf(sheetPos) - 1)]); }
    });
    $('#view-btn').addEventListener('click', () => { if (view.active) select(null); setSheet(sheetPos === 'peek' ? 'full' : 'peek'); });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => setSheet(sheetPos), 120); });
    mqDesk.addEventListener('change', () => { placeParts(); setSheet(mqDesk.matches ? sheetPos : 'peek'); });
  }

  // ---------- Načítání po regionech ----------
  function regionIds(b) {
    const s = ctrl.state;
    if (s.kraj) { const r = K.regionByName(s.kraj); return r ? [r.id] : []; }
    return IDX.filter(r => (!s.zeme || r.zeme === s.zeme) && !(r.bbox[0] > b.e || r.bbox[2] < b.w || r.bbox[1] > b.n || r.bbox[3] < b.s)).map(r => r.id);
  }
  function rebuildAll() { ALL = [].concat(...Object.values(LOADED)); }
  async function ensureData() {
    if (!IDX.length) return;
    const ids = bounds ? regionIds(bounds) : [];
    const total = IDX.filter(r => ids.includes(r.id)).reduce((a, r) => a + r.pocet, 0);
    const need = ids.filter(id => !LOADED[id]);
    overview = !ctrl.state.kraj && total > LIMIT;
    if (overview || !need.length) { update(); return; }
    loadingIds = need; render();
    try {
      const lists = await Promise.all(need.map(id => K.loadRegion(id)));
      need.forEach((id, i) => { LOADED[id] = lists[i]; });
      rebuildAll();
    } catch (e) { K.toast(KP.t('Část míst se nepodařilo načíst. Zkuste posunout mapu znovu.')); }
    loadingIds = null;
    update();
  }
  function fitBox(rs) {
    if (!map || !rs.length) return;
    map.fitTo([{ la: Math.min(...rs.map(r => r.bbox[1])), lo: Math.min(...rs.map(r => r.bbox[0])) }, { la: Math.max(...rs.map(r => r.bbox[3])), lo: Math.max(...rs.map(r => r.bbox[2])) }]);
  }
  async function applyKraj() {
    const k = ctrl.state.kraj;
    const r = k ? K.regionByName(k) : null;
    if (k && !r) { ctrl.setArea('kraj', ''); return; }
    if (!r) { update(); await ensureData(); return; }
    if (!LOADED[r.id]) {
      loadingIds = [r.id]; render();
      try { LOADED[r.id] = await K.loadRegion(r.id); rebuildAll(); } catch (e) { K.toast(KP.t('Místa se nepodařilo načíst.')); }
      loadingIds = null;
    }
    overview = false; update();
    if (map && !ctrl.state.obec) fitBox([r]);
  }
  function applyZeme() {
    update();
    if (!ctrl.state.kraj) fitBox(IDX.filter(r => !ctrl.state.zeme || r.zeme === ctrl.state.zeme));
    ensureData();
  }
  // Obec z indexu obcí (obě země); při shodě jmen vyhraje obec s nejvíce místy ve zvolené zemi / kraji
  async function findTown(name) {
    const q = KF.norm(String(name || '').trim()); if (!q) return null;
    if (!TOWNS.length) TOWNS = await K.loadTowns().catch(() => []);
    const s = ctrl.state, kr = s.kraj && K.regionByName(s.kraj);
    return TOWNS.find(x => KF.norm(x[0]) === q && (!s.zeme || x[1].slice(0, 2) === s.zeme) && (!kr || kr.id === x[1])) || null;
  }
  async function zoomToQuery() {
    if (!map) return;
    const t = await findTown(ctrl.state.q);
    if (t) { view.inView = true; $('#in-view').checked = true; map.fitTo([{ la: t[3], lo: t[4] }, { la: t[5], lo: t[6] }]); }
    else if (filtered.length && filtered.length < 300) map.fitTo(filtered);
  }
  async function applyObec() {
    update();
    const t = await findTown(ctrl.state.obec);
    if (t && map) { view.inView = true; $('#in-view').checked = true; map.fitTo([{ la: t[3], lo: t[4] }, { la: t[5], lo: t[6] }]); }
  }

  // Nabídka krajů a obcí pro panel Filtry (z indexu regionů a obcí, nezávisí na tom, co je načtené)
  function areaOptions(s) {
    const kraje = [];
    ['cz', 'de'].filter(z => !s.zeme || z === s.zeme).forEach(z => IDX.filter(r => r.zeme === z).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'))
      .forEach(r => kraje.push({ value: r.nazev, label: K.krajName(r.nazev, r.zeme), count: r.pocet, group: K.ZEME[z] + ' ' + (z === 'de' ? KP.t('– vládní obvody') : KP.t('– kraje')) })));
    const kr = s.kraj && K.regionByName(s.kraj);
    const obce = TOWNS.filter(x => (!s.zeme || x[1].slice(0, 2) === s.zeme) && (!kr || x[1] === kr.id)).map(x => [x[0], x[2]]);
    return { kraje, obce };
  }

  function onFilters(x) {
    const k = x.key;
    if (view.active && !filtered.some(p => p.i === view.active)) { /* vybrané místo může zmizet; náhled necháme do dalšího výběru */ }
    if (k === 'kraj') applyKraj();
    else if (k === 'zeme') applyZeme();
    else if (k === 'obec') applyObec();
    else if (k === 'pop' || k === 'reset') { update(); ensureData(); }
    else if (k === 'tier') { update(); if (view.active) select(K.placeById(view.active), true); }
    else { update(); if (k === 'q' && x.submit) { zoomToQuery(); $('#q').blur(); } }
  }

  // ---------- Vrstvy mapy ----------
  function bindLayers() {
    const wrap = $('#map-wrap'), pop = $('#layers'), btn = $('#layers-btn');
    const setTiles = (v) => { wrap.classList.toggle('tiles-color', v === 'color'); pop.querySelectorAll('[data-tiles]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tiles === v)); K.store.set('map.tiles', v); };
    const setLegend = (on, save) => { $('#legend').hidden = !on; $('#legend-toggle').checked = on; if (save) K.store.set('map.legend', on); };
    setTiles(K.store.get('map.tiles', 'soft'));
    setLegend(K.store.get('map.legend', mqDesk.matches) === true); // na mobilu je legenda jen na přání (Vrstvy mapy)
    const openPop = (on) => { pop.hidden = !on; btn.setAttribute('aria-expanded', on); if (on) { const b = pop.querySelector('[aria-pressed="true"]'); if (b) b.focus(); } };
    btn.addEventListener('click', (e) => { e.stopPropagation(); openPop(pop.hidden); });
    pop.addEventListener('click', (e) => { const b = e.target.closest('[data-tiles]'); if (b) setTiles(b.dataset.tiles); });
    $('#legend-toggle').addEventListener('change', (e) => setLegend(e.target.checked, true));
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) openPop(false); });
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); openPop(false); btn.focus(); } });
  }

  // Řada kategorií: šipky na PC (myš neumí posouvat do strany)
  function bindCatScroll() {
    const row = $('#kf-cats'), wrap = row.parentElement;
    const upd = () => { wrap.classList.toggle('can-prev', row.scrollLeft > 4); wrap.classList.toggle('can-next', row.scrollLeft + row.clientWidth < row.scrollWidth - 4); };
    row.addEventListener('scroll', upd, { passive: true });
    wrap.querySelectorAll('[data-scroll]').forEach(b => b.addEventListener('click', () => row.scrollBy({ left: Number(b.dataset.scroll) * row.clientWidth * 0.7, behavior: 'smooth' })));
    new ResizeObserver(upd).observe(row);
    setTimeout(upd, 50);
  }

  function setSort(v) {
    if (v === 'match' && !K.hasTier('match')) {
      $('#sort').value = view.sort;
      K.requireTier('match', () => { view.sort = 'match'; $('#sort').value = 'match'; K.store.set('map.sort', 'match'); if (!K.getNeeds().active) K.needsDrawer(); render(); });
      return;
    }
    if (v === 'near' && !myPos && map) {
      // vzdálenost od středu mapy; s polohou od vás
      K.toast(KP.t('Řadím od středu mapy. Pro řazení od vás klepněte na Moje poloha.'));
    }
    view.sort = v; K.store.set('map.sort', v);
    if (v === 'match' && !K.getNeeds().active) K.needsDrawer();
    view.shown = PAGE; render();
  }

  function bind() {
    // výsledky
    $('#in-view').addEventListener('change', () => { view.inView = $('#in-view').checked; view.shown = PAGE; render(); });
    $('#sort').value = view.sort;
    if ($('#sort').value !== view.sort) { view.sort = 'complete'; $('#sort').value = 'complete'; }
    $('#sort').addEventListener('change', () => setSort($('#sort').value));
    $('#more').addEventListener('click', () => { view.shown += PAGE; render(); });
    $('#results').addEventListener('click', e => {
      const rg = e.target.closest('[data-region]'); if (rg) { ctrl.setArea('kraj', rg.dataset.region); return; }
      if (e.target.closest('[data-all-areas]')) { view.inView = false; $('#in-view').checked = false; render(); return; }
      if (e.target.closest('[data-save]')) return;
      const b = e.target.closest('.rc[data-card]'); if (!b) return;
      select(K.placeById(b.dataset.card), false);
    });
    ctrl.bindRelax($('#results'));
    KF.bindSave($('#results'), (id) => K.placeById(id));
    KF.bindSave($('#preview'), (id) => K.placeById(id));
    $('#results').addEventListener('dblclick', e => { const b = e.target.closest('.rc[data-card]'); const p = b && K.placeById(b.dataset.card); if (p) location.href = K.placeUrl(p); });
    $('#locate').addEventListener('click', () => {
      if (!map) return;
      map.locate().then(c => { myPos = { la: c.latitude, lo: c.longitude }; if (view.sort === 'near') render(); })
        .catch(() => K.toast(KP.t('Polohu se nepodařilo zjistit. Povolte ji v prohlížeči.')));
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || ctrl.isOpen()) return;
      if (view.active && !document.querySelector('.tier-layer, .drawer')) select(null);
    });
    document.addEventListener('kp:needs', () => { update(); if (view.active) select(K.placeById(view.active), true); });
    // Fotka z Commons se nenačetla: miniaturu nahradí ikona kategorie, náhledová fotka zmizí
    document.addEventListener('error', e => {
      const img = e.target; if (!(img instanceof HTMLImageElement)) return;
      const md = img.closest('.rc-media');
      if (md) { const card = md.closest('.rc'); const p = card && K.placeById(card.dataset.card); md.classList.add('no-photo'); md.setAttribute('aria-hidden', 'true'); md.innerHTML = K.icon(p ? iconOf(p) : 'pin'); return; }
      const fig = img.closest('.pv-photo'); if (fig) fig.remove();
    }, true);
    bindSheet();
    bindLayers();
    bindCatScroll();
  }

  async function init() {
    ctrl = KF.create({
      id: 'mapa',
      els: { search: $('#q'), form: $('#search-form'), filterBtn: $('#filters-open'), filterCount: $('#filter-count'), cats: $('#kf-cats'), quick: $('#kf-quick'), active: $('#kf-active'), panelHost: $('#kf-host') },
      quick: ['step', 'wc', 'pk', 'lift', 'mer', 'img'],
      sections: ['cats', 'access', 'adv', 'source', 'more', 'area', 'needs'],
      obecMode: 'input',
      panelMode: () => 'dialog',
      // V přehledu krajů ještě nejsou načtená místa: počty 0 neznamenají, že nic neodpovídá
      emptyLabel: () => (overview ? KP.t('Nejdřív vyberte oblast na mapě') : ''),
      areaOptions,
      onChange: onFilters,
      onApply: () => { if (!mqDesk.matches && sheetPos === 'peek') setSheet('half'); },
    });
    placeParts();
    bind();
    setSheet('peek');
    try { IDX = await K.loadRegionsIndex(); }
    catch (e) { $('#count').textContent = KP.t('Data se nepodařilo načíst. Otevřete web přes server (viz README), ne jako soubor.'); return; }
    if (ctrl.state.kraj && !K.regionByName(ctrl.state.kraj)) ctrl.state.kraj = '';
    ctrl.fillArea();
    K.loadTowns().then(t => { TOWNS = t; $('#obce').innerHTML = t.slice(0, 800).map(x => '<option value="' + K.esc(x[0]) + '">').join(''); ctrl.fillArea(); }).catch(() => {});
    map = await KPMap.create($('#map'));
    if (map.engine === 'leaflet' && !(window.KP_CONFIG || {}).googleMapsApiKey) {
      const n = $('#engine-note'); n.hidden = false;
      n.textContent = KP.t('Podklad: OpenStreetMap. U každého místa vede odkaz do Google Maps (navigace, Street View).');
      setTimeout(() => { n.hidden = true; }, 9000);
    }
    let mt;
    map.onMove(b => { bounds = b; view.shown = PAGE; render(); clearTimeout(mt); mt = setTimeout(ensureData, 250); });
    // Výchozí výřez: Česko a Bavorsko (nebo zvolená země / kraj / obec z odkazu)
    if (ctrl.state.kraj) await applyKraj();
    else fitBox(IDX.filter(r => !ctrl.state.zeme || r.zeme === ctrl.state.zeme));
    bounds = map.bounds();
    await ensureData();
    if (ctrl.state.obec) applyObec();
    else if (ctrl.state.q) zoomToQuery();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
