/* Stránka Mapa míst: filtry, výpis a mapa nad skutečnými daty z data/regions/ (Česko a Bavorsko).
   Data se načítají po regionech podle výřezu mapy (KP.loadRegion); když je ve výřezu moc míst, panel nabídne výběr kraje / obvodu.
   PC: levý panel (hledání, čipy, výsledky) + mapa. Mobil: mapa na celou výšku, výsledky ve vysouvacím panelu. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s), $$ = (s) => document.querySelectorAll(s);
  const PAGE = 40;
  const DEFAULT_W = ['yes', 'limited'];
  const LIMIT = 45000; // víc míst najednou podle výřezu nenačítáme (paměť telefonu); stačí přiblížit nebo vybrat kraj
  const state = {
    q: '', cats: new Set(), w: new Set(DEFAULT_W), wc: false, pk: false, desc: false, chk: false, img: false, ek: false, hx: false, hr: false,
    kraj: '', zeme: '', needsOnly: false, inView: true, sort: 'complete', shown: PAGE, active: null,
  };
  const CHECKS = [['#f-wc', 'wc'], ['#f-pk', 'pk'], ['#f-desc', 'desc'], ['#f-chk', 'chk'], ['#f-img', 'img'], ['#f-ek', 'ek'], ['#f-hx', 'hx'], ['#f-hr', 'hr'], ['#f-needs', 'needsOnly']];
  const mqDesk = matchMedia('(min-width: 900px)');
  let ALL = [], map = null, bounds = null, filtered = [], CAT_COUNTS = {}, W_COUNTS = {}, IDX = [], overview = false, loadingIds = null, TOWNS = [];
  const LOADED = {}; // id regionu → pole míst

  const plural = (n, a, b, c) => n === 1 ? a : n > 1 && n < 5 ? b : c;
  const fmtN = (n) => n.toLocaleString('cs-CZ');

  function readUrl() {
    const sp = new URLSearchParams(location.search);
    if (sp.get('q')) state.q = sp.get('q');
    if (sp.get('kat')) sp.get('kat').split(',').forEach(c => { if (K.CATS[c]) state.cats.add(c); });
    const h = location.hash.slice(1);
    if (h && K.CATS[h]) state.cats.add(h);
    if (sp.get('wc') === '1') state.wc = true;
    if (sp.get('namereno') === '1') state.hx = true;
    if (sp.get('provozovatel') === '1') state.hr = true;
    if (sp.get('potreby') === '1') state.needsOnly = true;
    if (K.ZEME[sp.get('zeme')]) state.zeme = sp.get('zeme');
    if (sp.get('kraj')) state.kraj = sp.get('kraj');
  }

  function colorOf(p) {
    if (p.c === 'parkovani') return 'park';
    const n = K.getNeeds();
    return n.active ? K.match(p, n).status : K.generalStatus(p);
  }

  const hasX = (p) => Array.isArray(p.x) && p.x.length > 0;
  const hasR = (p) => Array.isArray(p.r) && p.r.length > 0;
  function srcBadges(p) {
    return (hasX(p) ? '<span class="badge badge-verified" title="Rozměry naměřené podle metodiky (otevřená data)">' + K.icon('ruler') + 'Naměřeno</span>' : '') +
      (hasR(p) ? '<span class="badge badge-business" title="Informace o přístupnosti z webu provozovatele">' + K.icon('building') + 'Od provozovatele</span>' : '');
  }

  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function applyFilters() {
    const q = norm(state.q.trim());
    const needs = K.getNeeds();
    return ALL.filter(p => {
      if (state.cats.size && !state.cats.has(p.c)) return false;
      if (p.c !== 'parkovani' && !state.w.has(String(p.w || 'null'))) return false;
      if (state.wc && p.t !== 'yes') return false;
      if (state.pk && !(p.pk || p.pw === 'yes')) return false;
      if (state.desc && !p.d) return false;
      if (state.chk && !p.cd) return false;
      if (state.img && !p.img) return false;
      if (state.ek && p.ek !== 'yes') return false;
      if (state.hx && !hasX(p)) return false;
      if (state.hr && !hasR(p)) return false;
      if (state.kraj && p.k !== state.kraj) return false;
      if (state.zeme && K.zemeOf(p) !== state.zeme) return false;
      if (state.needsOnly && needs.active && K.match(p, needs).status !== 'ok') return false;
      if (q && !(p._s || (p._s = norm(p.n + ' ' + p.o + ' ' + (p.a || '') + ' ' + p.s))).includes(q)) return false;
      return true;
    });
  }

  function inBounds(p) { return !bounds || (p.la >= bounds.s && p.la <= bounds.n && p.lo >= bounds.w && p.lo <= bounds.e); }

  function sortList(list) {
    const c = bounds ? { la: (bounds.s + bounds.n) / 2, lo: (bounds.w + bounds.e) / 2 } : null;
    const by = {
      complete: (a, b) => (b._c ?? (b._c = K.completeness(b))) - (a._c ?? (a._c = K.completeness(a))) || a.n.localeCompare(b.n, 'cs'),
      near: (a, b) => c ? K.distanceKm(c, a) - K.distanceKm(c, b) : 0,
      fresh: (a, b) => (b.u || '').localeCompare(a.u || ''),
      name: (a, b) => a.n.localeCompare(b.n, 'cs'),
    }[state.sort];
    return list.slice().sort(by);
  }

  // Jeden řádek stavů: vstup a toaleta (tvar + text), u parkovišť počet míst
  function statesHtml(p, long) {
    const out = [];
    if (p.c === 'parkovani') out.push('<span class="plain">' + K.icon('parking') + (p.pk ? p.pk + ' ' + plural(p.pk, 'místo', 'místa', 'míst') + ' pro ZTP' : 'Parkování pro ZTP') + '</span>');
    else {
      const w = K.W[p.w || 'null'];
      out.push(K.statusHtml(w.st, long ? w.label : 'Vstup: ' + w.short.toLowerCase()));
      if (p.t) out.push(K.statusHtml(K.T[p.t].st, K.T[p.t].label));
      if (p.pk) out.push('<span class="plain">' + K.icon('parking') + p.pk + '× parkování ZTP</span>');
    }
    return out.join('');
  }

  function metaText(p) { return [p.s, p.o].filter(Boolean).map(K.esc).join(' · '); }

  function resultHtml(p) {
    const needs = K.getNeeds();
    const m = needs.active ? K.match(p, needs) : null;
    const tags = srcBadges(p) + (m ? '<span class="badge badge-' + { ok: 'ok', part: 'part', no: 'no', unk: 'unk' }[m.status] + '">' + K.STATUS_SHORT[m.status] + '</span>' : '');
    // Řádek adresáře: název, typ · obec, stavy; u míst s fotkou malá miniatura vpravo
    const thumb = p.img ? '<span class="res-thumb"><img src="' + K.esc(K.commonsImg(p.img, 160)) + '" alt="" loading="lazy" decoding="async" width="72" height="54"></span>' : '';
    return '<li><button type="button" class="res' + (p.img ? ' has-thumb' : '') + (state.active === p.i ? ' is-active' : '') + '" data-id="' + p.i + '">' +
      '<span class="res-main">' +
      '<h3>' + K.esc(p.n) + '</h3><span class="meta">' + metaText(p) + '</span>' +
      '<span class="states">' + statesHtml(p) + '</span>' +
      (tags ? '<span class="tags">' + tags + '</span>' : '') +
      '</span>' + thumb + '</button></li>';
  }

  function activeCount() {
    const wDefault = state.w.size === DEFAULT_W.length && DEFAULT_W.every(x => state.w.has(x));
    const extra = state.desc + state.chk + state.img + state.ek + state.needsOnly;
    const all = (state.cats.size ? 1 : 0) + (wDefault ? 0 : 1) + state.wc + state.pk + state.hx + state.hr + (state.kraj ? 1 : 0) + (state.zeme ? 1 : 0) + extra;
    return { all, extra, wDefault };
  }

  // Výřez je moc velký: místo výsledků adresář krajů a obvodů ve výřezu (klepnutí = načíst a přiblížit)
  function regionDirHtml() {
    const ids = bounds ? regionIds(bounds) : IDX.map(r => r.id);
    const rs = IDX.filter(r => ids.includes(r.id));
    return '<li class="empty-res reg-note"><p><b>Ve výřezu je ' + fmtN(rs.reduce((a, r) => a + r.pocet, 0)) + ' míst.</b></p><p class="small">Tolik jich najednou nenačítáme. Přibližte mapu, hledejte obec, nebo vyberte kraj či vládní obvod:</p></li>' +
      ['cz', 'de'].map(z => {
        const g = rs.filter(r => r.zeme === z); if (!g.length) return '';
        return '<li class="reg-head"><p class="kicker">' + K.ZEME[z] + (z === 'de' ? ' · vládní obvody' : ' · kraje') + '</p></li>' +
          g.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')).map(r => '<li><button type="button" class="res reg-row" data-region="' + K.esc(r.nazev) + '"><span class="res-main"><h3>' + K.esc(K.krajName(r.nazev, r.zeme)) + '</h3><span class="meta">' + (LOADED[r.id] ? 'Načteno' : 'Klepnutím načtete a přiblížíte') + '</span></span><span class="num reg-n">' + fmtN(r.pocet) + '</span></button></li>').join('');
      }).join('');
  }

  function render() {
    if (overview) {
      filtered = applyFilters();
      $('#count').innerHTML = 'Vyberte oblast<span class="total">' + (state.zeme ? K.ZEME[state.zeme] : 'Česko a Bavorsko') + ': ' + fmtN(IDX.filter(r => !state.zeme || r.zeme === state.zeme).reduce((a, r) => a + r.pocet, 0)) + ' míst</span>';
      $('#results').innerHTML = regionDirHtml();
      $('#more').hidden = true;
      $('#f-apply').textContent = 'Zobrazit místa';
      syncControls();
      return;
    }
    filtered = applyFilters();
    const visible = state.inView ? filtered.filter(inBounds) : filtered;
    const list = sortList(visible);
    const n = list.length;
    $('#count').innerHTML = '<span class="num">' + fmtN(n) + '</span> ' + plural(n, 'místo', 'místa', 'míst') + (state.inView ? ' v oblasti mapy' : ' v načtených oblastech') + (loadingIds ? '<span class="total">Načítám další místa…</span>' : '') +
      (state.inView && filtered.length !== n ? '<span class="total">z ' + fmtN(filtered.length) + ' podle filtrů</span>' : '');
    $('#results').innerHTML = n ? list.slice(0, state.shown).map(resultHtml).join('')
      : '<li class="empty-res"><p><b>Tady nic neodpovídá filtrům.</b></p><p class="small">Oddalte mapu, vypněte „Jen v oblasti mapy“ nebo zrušte některý filtr.</p><p class="small"><a href="pridat.html">Znáte tu přístupné místo? Přidejte ho.</a></p></li>';
    $('#more').hidden = n <= state.shown;
    const nf = filtered.length;
    $('#f-apply').textContent = 'Zobrazit ' + fmtN(nf) + ' ' + plural(nf, 'místo', 'místa', 'míst');
    syncControls();
  }

  // Všechny ovládací prvky odráží stav (čipy, popover, panel filtrů)
  function syncControls() {
    const c = activeCount();
    $('#filter-count').hidden = !c.all; $('#filter-count').textContent = c.all;
    $('#more-count').hidden = !c.extra; $('#more-count').textContent = c.extra;
    $$('[data-toggle]').forEach(b => b.setAttribute('aria-pressed', !!state[b.dataset.toggle]));
    $$('#f-w [data-w]').forEach(b => b.setAttribute('aria-pressed', state.w.has(b.dataset.w)));
    $$('#f-cats input').forEach(i => { i.checked = state.cats.has(i.value); });
    CHECKS.forEach(([s, k]) => { $(s).checked = !!state[k]; });
    $('#f-kraj').value = state.kraj;
    $('#f-zeme').value = state.zeme;
    // popisky rozbalovacích čipů
    const wl = $('#lbl-w'), wc = wl.closest('.chip');
    if (state.w.size === 4) wl.textContent = 'Přístupnost: vše';
    else if (!state.w.size) wl.textContent = 'Přístupnost: nic';
    else if (state.w.size <= 2) wl.textContent = ['yes', 'limited', 'no', 'null'].filter(x => state.w.has(x)).map((x, i) => i ? K.W[x].short.toLowerCase() : K.W[x].short).join(', ');
    else wl.textContent = 'Přístupnost · ' + state.w.size;
    wc.classList.toggle('on', !c.wDefault);
    const cl = $('#lbl-cat');
    cl.textContent = !state.cats.size ? 'Kategorie' : state.cats.size === 1 ? K.CATS[[...state.cats][0]].label : 'Kategorie · ' + state.cats.size;
    cl.closest('.chip').classList.toggle('on', !!state.cats.size);
    const kl = $('#lbl-kraj');
    kl.textContent = state.kraj || 'Kraj / obvod';
    kl.closest('.chip').classList.toggle('on', !!state.kraj);
    const zl = $('#lbl-zeme');
    zl.textContent = state.zeme ? K.ZEME[state.zeme] : 'Země';
    zl.closest('.chip').classList.toggle('on', !!state.zeme);
    if (!$('#fpop').hidden) syncPop();
  }

  function refreshMap() { if (map) map.setPlaces(filtered, { colorOf, onClick: (p) => select(p, true) }); }
  function update() { state.shown = PAGE; render(); refreshMap(); }

  // ---------- Výběr místa ----------
  function previewHtml(p) {
    const needs = K.getNeeds();
    const m = needs.active ? K.match(p, needs) : null;
    const c = p._c ?? (p._c = K.completeness(p));
    const operator = p.nw || /^rh[0-9a-f]+$/.test(p.i);
    const photo = p.img ? '<figure class="photo pv-photo"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="' + K.esc(p.n) + '" loading="lazy" decoding="async">' +
      '<figcaption>Foto: <a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>' : '';
    return '<header><div><p class="kicker">' + metaText(p) + '</p><h2>' + K.esc(p.n) + '</h2></div>' +
      '<button class="icon-btn" type="button" data-close aria-label="Zavřít náhled">' + K.icon('close') + '</button></header>' + photo +
      '<div class="states">' + statesHtml(p, true) + '</div>' +
      (p.d ? '<p class="desc">' + K.esc(p.d) + '</p>' : '') +
      (m ? '<p class="match">' + K.statusHtml(m.status, K.STATUS_LABEL[m.status]) + (m.status !== 'ok' && m.fails.concat(m.unknown).length ? '<span class="muted">: ' + K.esc(m.fails.concat(m.unknown).join(', ')) + '</span>' : '') + '</p>' : '') +
      '<p class="meta">' + srcBadges(p) + (operator ? '' : K.sourceBadge('komunita')) + (p.u ? '<span>Upraveno ' + K.fmtDate(p.u) + '</span>' : '') + (p.cd ? '<span>Kontrola na místě ' + K.fmtDate(p.cd) + '</span>' : '') + '</p>' +
      '<div class="fill"><div class="tape-meter" style="--v:' + c + '" aria-hidden="true"></div><span>Vyplněno <b class="num">' + c + ' %</b> údajů</span></div>' +
      '<div class="actions"><a class="btn btn-primary" href="' + K.placeUrl(p) + '">Detail ' + K.icon('arrow') + '</a>' +
      '<a class="btn btn-ghost" href="' + K.gmaps.directions(p) + '" target="_blank" rel="noopener">' + K.icon('nav') + 'Navigovat</a></div>';
  }

  function select(p, fromMap) {
    state.active = p ? p.i : null;
    const box = $('#preview');
    $$('.res').forEach(b => b.classList.toggle('is-active', !!p && b.dataset.id === p.i));
    $('.map-layout').classList.toggle('has-preview', !!p);
    if (!p) { box.hidden = true; box.innerHTML = ''; if (map) map.focus(null); return; }
    box.hidden = false;
    box.innerHTML = previewHtml(p);
    box.querySelector('[data-close]').addEventListener('click', () => { const id = state.active; select(null); const r = id && document.querySelector('.res[data-id="' + CSS.escape(id) + '"]'); if (r && mqDesk.matches) r.focus(); });
    if (map) map.focus(p);
    if (mqDesk.matches) {
      const row = document.querySelector('.res[data-id="' + CSS.escape(p.i) + '"]');
      if (fromMap && row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (!fromMap) {
      box.querySelector('[data-close]').focus({ preventScroll: true });
    }
  }

  // Náhled: na PC nad seznamem, na mobilu plovoucí na mapě
  function placePreview() {
    const box = $('#preview');
    if (mqDesk.matches) $('#panel').insertBefore(box, $('#results-head'));
    else $('.map-wrap').appendChild(box);
  }

  // ---------- Vysouvací panel (mobil) ----------
  const SHEET = ['peek', 'half', 'full'];
  let sheetPos = 'peek';
  function sheetHeights() {
    const H = $('.map-layout').clientHeight;
    const peek = parseFloat(getComputedStyle($('.map-layout')).getPropertyValue('--peek-h')) || 96;
    const top = $('.map-top').offsetHeight;
    return { peek, half: Math.max(peek + 80, Math.round(H * 0.5)), full: Math.max(peek + 80, H - top - 4) };
  }
  function setSheet(pos) {
    sheetPos = pos;
    const lay = $('.map-layout'), panel = $('#panel');
    lay.dataset.sheet = pos;
    if (mqDesk.matches) { panel.style.height = ''; return; }
    panel.style.height = sheetHeights()[pos] + 'px';
    const toMap = pos !== 'peek';
    $('#view-btn').innerHTML = K.icon(toMap ? 'map' : 'list') + '<span class="lbl">' + (toMap ? 'Mapa' : 'Seznam') + '</span>';
    $('#grip').setAttribute('aria-label', pos === 'full' ? 'Zmenšit seznam' : 'Zvětšit seznam');
    $('#grip').setAttribute('aria-expanded', pos !== 'peek');
  }
  function bindSheet() {
    const panel = $('#panel');
    let drag = null, suppressClick = false;
    const start = (e) => {
      if (mqDesk.matches || e.button > 0) return;
      if (e.currentTarget !== $('#grip') && e.target.closest('button, select, input, label, a')) return;
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
    $('#view-btn').addEventListener('click', () => { if (state.active) select(null); setSheet(sheetPos === 'peek' ? 'full' : 'peek'); });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => setSheet(sheetPos), 120); });
    mqDesk.addEventListener('change', () => { placePreview(); setSheet(mqDesk.matches ? sheetPos : 'peek'); closePop(); });
  }

  // ---------- Rozbalovací výběr u čipů (PC) ----------
  let popKind = null, popBtn = null;
  function popHtml(kind) {
    if (kind === 'w') return ['yes', 'limited', 'no', 'null'].map(k => '<label class="opt"><input type="checkbox" value="' + k + '"' + (state.w.has(k) ? ' checked' : '') + '>' + K.statusHtml(K.W[k].st, K.W[k].short) + '<span class="t"></span><span class="n">' + fmtN(W_COUNTS[k] || 0) + '</span></label>').join('');
    if (kind === 'cat') return Object.entries(K.CATS).filter(([k]) => CAT_COUNTS[k]).map(([k, c]) => '<label class="opt"><input type="checkbox" value="' + k + '"' + (state.cats.has(k) ? ' checked' : '') + '>' + K.icon(c.icon) + '<span class="t">' + c.label + '</span><span class="n">' + fmtN(CAT_COUNTS[k]) + '</span></label>').join('');
    if (kind === 'zeme') return [['', 'Česko i Bavorsko'], ['cz', K.ZEME_LONG.cz], ['de', K.ZEME_LONG.de]].map(([z, l]) => '<label class="opt"><input type="radio" name="pop-zeme" value="' + z + '"' + (state.zeme === z ? ' checked' : '') + '><span class="t">' + l + '</span><span class="n">' + fmtN(IDX.filter(r => !z || r.zeme === z).reduce((a, r) => a + r.pocet, 0)) + '</span></label>').join('');
    return ['<label class="opt"><input type="radio" name="pop-kraj" value=""' + (!state.kraj ? ' checked' : '') + '><span class="t">Všechny kraje a obvody</span></label>']
      .concat(['cz', 'de'].filter(z => !state.zeme || state.zeme === z).map(z => '<p class="opt-group kicker">' + K.ZEME[z] + (z === 'de' ? ' · vládní obvody' : ' · kraje') + '</p>' +
        IDX.filter(r => r.zeme === z).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')).map(r => '<label class="opt"><input type="radio" name="pop-kraj" value="' + K.esc(r.nazev) + '"' + (state.kraj === r.nazev ? ' checked' : '') + '><span class="t">' + K.esc(K.krajName(r.nazev, r.zeme)) + '</span><span class="n">' + fmtN(r.pocet) + '</span></label>').join(''))).join('');
  }
  const POP_TITLE = { w: 'Přístupnost vstupu', cat: 'Kategorie', kraj: 'Kraj nebo vládní obvod', zeme: 'Země' };
  function openPop(kind, btn) {
    if (!mqDesk.matches) { openFilters(kind); return; }
    if (popKind === kind) { closePop(); return; }
    closePop();
    popKind = kind; popBtn = btn;
    $('#fpop-title').textContent = POP_TITLE[kind];
    $('#fpop-body').innerHTML = popHtml(kind);
    $('#fpop').hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const first = $('#fpop-body input'); if (first) first.focus();
  }
  function syncPop() {
    $$('#fpop-body input').forEach(i => {
      i.checked = popKind === 'w' ? state.w.has(i.value) : popKind === 'cat' ? state.cats.has(i.value) : popKind === 'zeme' ? state.zeme === i.value : state.kraj === i.value;
    });
  }
  function closePop(refocus) {
    if (!popKind) return;
    $('#fpop').hidden = true;
    if (popBtn) { popBtn.setAttribute('aria-expanded', 'false'); if (refocus) popBtn.focus(); }
    popKind = null; popBtn = null;
  }
  // ---------- Načítání po regionech ----------
  function regionIds(b) {
    if (state.kraj) { const r = K.regionByName(state.kraj); return r ? [r.id] : []; }
    return IDX.filter(r => (!state.zeme || r.zeme === state.zeme) && !(r.bbox[0] > b.e || r.bbox[2] < b.w || r.bbox[1] > b.n || r.bbox[3] < b.s)).map(r => r.id);
  }
  function rebuildAll() { ALL = [].concat(...Object.values(LOADED)); buildCounts(); }
  async function ensureData() {
    if (!IDX.length) return;
    const ids = bounds ? regionIds(bounds) : [];
    const total = IDX.filter(r => ids.includes(r.id)).reduce((a, r) => a + r.pocet, 0);
    const need = ids.filter(id => !LOADED[id]);
    overview = !state.kraj && total > LIMIT;
    if (overview || !need.length) { update(); return; }
    loadingIds = need; render();
    try {
      const lists = await Promise.all(need.map(id => K.loadRegion(id)));
      need.forEach((id, i) => { LOADED[id] = lists[i]; });
      rebuildAll();
    } catch (e) { K.toast('Část míst se nepodařilo načíst. Zkuste posunout mapu znovu.'); }
    loadingIds = null;
    update();
  }
  function fitBox(rs) {
    if (!map || !rs.length) return;
    map.fitTo([{ la: Math.min(...rs.map(r => r.bbox[1])), lo: Math.min(...rs.map(r => r.bbox[0])) }, { la: Math.max(...rs.map(r => r.bbox[3])), lo: Math.max(...rs.map(r => r.bbox[2])) }]);
  }
  async function setKraj(k) {
    const r = k ? K.regionByName(k) : null;
    state.kraj = r ? k : '';
    if (r && state.zeme && state.zeme !== r.zeme) state.zeme = '';
    if (!r) { update(); await ensureData(); return; }
    if (!LOADED[r.id]) {
      loadingIds = [r.id]; render();
      try { LOADED[r.id] = await K.loadRegion(r.id); rebuildAll(); } catch (e) { K.toast('Místa se nepodařilo načíst.'); }
      loadingIds = null;
    }
    overview = false; update();
    if (map) fitBox([r]);
  }
  function setZeme(z) {
    state.zeme = K.ZEME[z] ? z : '';
    const kr = state.kraj && K.regionByName(state.kraj);
    if (kr && state.zeme && kr.zeme !== state.zeme) state.kraj = '';
    buildCounts(); update();
    if (!state.kraj) fitBox(IDX.filter(r => !state.zeme || r.zeme === state.zeme));
    ensureData();
  }

  // ---------- Panel se všemi filtry ----------
  let lastFocus = null;
  function openFilters(section) {
    closePop();
    lastFocus = document.activeElement;
    $('#filters-backdrop').hidden = false; $('#filters-sheet').hidden = false;
    document.documentElement.style.overflow = 'hidden';
    const target = section && $('#fs-' + section);
    if (target) { target.scrollIntoView({ block: 'start' }); const f = target.querySelector('button, input, select'); if (f) f.focus(); }
    else $('#filters-close').focus();
  }
  function closeFilters() {
    if ($('#filters-sheet').hidden) return;
    $('#filters-backdrop').hidden = true; $('#filters-sheet').hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // Počty u kategorií a přístupnosti: z načtených oblastí (mění se s načítáním)
  function buildCounts() {
    CAT_COUNTS = {}; W_COUNTS = {};
    ALL.forEach(p => {
      if (state.zeme && K.zemeOf(p) !== state.zeme) return;
      CAT_COUNTS[p.c] = (CAT_COUNTS[p.c] || 0) + 1;
      if (p.c !== 'parkovani') { const w = String(p.w || 'null'); W_COUNTS[w] = (W_COUNTS[w] || 0) + 1; }
    });
    $('#f-cats').innerHTML = Object.keys(K.CATS).map(k =>
      '<label class="opt"><input type="checkbox" value="' + k + '"' + (state.cats.has(k) ? ' checked' : '') + '>' + K.icon(K.CATS[k].icon) + '<span class="t">' + K.CATS[k].label + '</span><span class="n">' + (CAT_COUNTS[k] ? fmtN(CAT_COUNTS[k]) : '') + '</span></label>').join('');
  }
  // Nabídka krajů a obvodů z indexu regionů (nezávisí na tom, co je načtené)
  function buildLists() {
    $('#f-kraj').innerHTML = '<option value="">Všechny kraje a obvody</option>' + ['cz', 'de'].map(z => '<optgroup label="' + K.ZEME[z] + (z === 'de' ? ' – vládní obvody' : ' – kraje') + '">' +
      IDX.filter(r => r.zeme === z).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')).map(r => '<option value="' + K.esc(r.nazev) + '">' + K.esc(K.krajName(r.nazev, r.zeme)) + '</option>').join('') + '</optgroup>').join('');
    buildCounts();
    K.loadTowns().then(t => { TOWNS = t; $('#obce').innerHTML = t.slice(0, 800).map(x => '<option value="' + K.esc(x[0]) + '">').join(''); }).catch(() => {});
  }

  // Hledání obce → přiblížit mapu na její místa
  // Obec z indexu obcí (obě země); při shodě jmen vyhraje obec s nejvíce místy ve zvolené zemi / kraji
  async function zoomToQuery() {
    const q = norm(state.q.trim()); if (!q || !map) return;
    if (!TOWNS.length) TOWNS = await K.loadTowns().catch(() => []);
    const kr = state.kraj && K.regionByName(state.kraj);
    const t = TOWNS.find(x => norm(x[0]) === q && (!state.zeme || x[1].slice(0, 2) === state.zeme) && (!kr || kr.id === x[1]));
    if (t) {
      state.inView = true; $('#in-view').checked = true;
      map.fitTo([{ la: t[3], lo: t[4] }, { la: t[5], lo: t[6] }]);
    } else if (filtered.length && filtered.length < 300) map.fitTo(filtered);
  }

  function resetAll() {
    Object.assign(state, { cats: new Set(), w: new Set(DEFAULT_W), wc: false, pk: false, desc: false, chk: false, img: false, ek: false, hx: false, hr: false, kraj: '', zeme: '', needsOnly: false, q: '' });
    $('#q').value = ''; buildCounts(); update(); ensureData();
  }

  function bind() {
    let t;
    $('#q').value = state.q;
    $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = $('#q').value; update(); }, 200); });
    $('#search-form').addEventListener('submit', e => { e.preventDefault(); clearTimeout(t); state.q = $('#q').value; update(); zoomToQuery(); $('#q').blur(); });
    $('#q').addEventListener('change', () => { state.q = $('#q').value; update(); zoomToQuery(); });

    // čipy
    $('.chip-row.quick').addEventListener('click', e => {
      const tg = e.target.closest('[data-toggle]');
      if (tg) { const k = tg.dataset.toggle; state[k] = !state[k]; update(); return; }
      const pop = e.target.closest('[data-pop]');
      if (pop) { e.stopPropagation(); openPop(pop.dataset.pop, pop); }
    });
    $('#fpop-body').addEventListener('change', e => {
      const i = e.target; if (!i.matches('input')) return;
      if (popKind === 'w') { i.checked ? state.w.add(i.value) : state.w.delete(i.value); update(); }
      else if (popKind === 'cat') { i.checked ? state.cats.add(i.value) : state.cats.delete(i.value); update(); }
      else if (popKind === 'kraj') setKraj(i.value);
      else if (popKind === 'zeme') setZeme(i.value);
    });
    $('#fpop-clear').addEventListener('click', () => {
      if (popKind === 'w') { state.w = new Set(DEFAULT_W); update(); }
      else if (popKind === 'cat') { state.cats.clear(); update(); }
      else if (popKind === 'kraj') setKraj('');
      else if (popKind === 'zeme') setZeme('');
    });
    $('#fpop-done').addEventListener('click', () => closePop(true));
    document.addEventListener('click', e => { if (popKind && !$('#fpop').contains(e.target) && !e.target.closest('[data-pop]')) closePop(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('#filters-sheet').hidden) closeFilters();
      else if (popKind) closePop(true);
      else if (state.active) select(null);
    });

    // panel filtrů
    $('#filters-open').addEventListener('click', () => openFilters());
    $('#more-filters').addEventListener('click', () => openFilters());
    $('#filters-close').addEventListener('click', closeFilters);
    $('#filters-backdrop').addEventListener('click', closeFilters);
    $('#f-apply').addEventListener('click', closeFilters);
    $('#f-w').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b) return; const k = b.dataset.w; state.w.has(k) ? state.w.delete(k) : state.w.add(k); update(); });
    $('#f-cats').addEventListener('change', e => { const i = e.target; i.checked ? state.cats.add(i.value) : state.cats.delete(i.value); update(); });
    CHECKS.forEach(([s, k]) => {
      $(s).addEventListener('change', () => { state[k] = $(s).checked; if (k === 'needsOnly' && state[k] && !K.getNeeds().active) K.needsDrawer(); update(); });
    });
    $('#f-kraj').addEventListener('change', () => setKraj($('#f-kraj').value));
    $('#f-zeme').addEventListener('change', () => setZeme($('#f-zeme').value));
    $('#f-reset').addEventListener('click', resetAll);

    // výsledky
    $('#in-view').addEventListener('change', () => { state.inView = $('#in-view').checked; state.shown = PAGE; render(); });
    $('#sort').addEventListener('change', () => { state.sort = $('#sort').value; render(); });
    $('#more').addEventListener('click', () => { state.shown += PAGE; render(); });
    $('#results').addEventListener('click', e => {
      const rg = e.target.closest('[data-region]'); if (rg) { setKraj(rg.dataset.region); return; }
      const b = e.target.closest('.res[data-id]'); if (!b) return; select(K.placeById(b.dataset.id), false);
    });
    $('#results').addEventListener('dblclick', e => { const b = e.target.closest('.res[data-id]'); const p = b && K.placeById(b.dataset.id); if (p) location.href = K.placeUrl(p); });
    $('#locate').addEventListener('click', () => map && map.locate().catch(() => K.toast('Polohu se nepodařilo zjistit. Povolte ji v prohlížeči.')));
    document.addEventListener('kp:needs', () => { update(); if (state.active) select(K.placeById(state.active), true); });
    // Fotka z Commons se nenačetla: miniaturu i náhledovou fotku odebrat, rozvržení funguje i bez ní
    document.addEventListener('error', e => {
      const img = e.target; if (!(img instanceof HTMLImageElement)) return;
      const th = img.closest('.res-thumb'); if (th) { th.closest('.res').classList.remove('has-thumb'); th.remove(); return; }
      const fig = img.closest('.pv-photo'); if (fig) fig.remove();
    }, true);
    bindSheet();
  }

  async function init() {
    readUrl();
    placePreview();
    bind();
    setSheet('peek');
    syncControls();
    try { IDX = await K.loadRegionsIndex(); }
    catch (e) { $('#count').textContent = 'Data se nepodařilo načíst. Otevřete web přes server (viz README), ne jako soubor.'; return; }
    if (state.kraj && !K.regionByName(state.kraj)) state.kraj = '';
    buildLists();
    map = await KPMap.create($('#map'));
    if (map.engine === 'leaflet' && !(window.KP_CONFIG || {}).googleMapsApiKey) {
      const n = $('#engine-note'); n.hidden = false;
      n.textContent = 'Podklad: OpenStreetMap. U každého místa vede odkaz do Google Maps (navigace, Street View).';
      setTimeout(() => { n.hidden = true; }, 9000);
    }
    let mt;
    map.onMove(b => { bounds = b; state.shown = PAGE; render(); clearTimeout(mt); mt = setTimeout(ensureData, 250); });
    // Výchozí výřez: Česko a Bavorsko (nebo zvolená země / kraj z odkazu)
    if (state.kraj) await setKraj(state.kraj);
    else fitBox(IDX.filter(r => !state.zeme || r.zeme === state.zeme));
    bounds = map.bounds();
    await ensureData();
    if (state.q) zoomToQuery();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
