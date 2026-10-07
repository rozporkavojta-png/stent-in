/* Přidat nebo upravit místo: 5 kroků, průběžný odhad kategorie podle metodiky POV, uložení do prohlížeče */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const MAX_PHOTOS = 8;
  const TYPES = [
    ['ubytovani', 'Ubytování', 'bed'], ['restaurace', 'Restaurace, kavárna', 'food'], ['wc', 'Veřejné WC', 'wc'],
    ['pamatky', 'Památka, muzeum', 'museum'], ['kultura', 'Kultura', 'theater'], ['urady', 'Úřad, pošta', 'building'],
    ['zdravi', 'Lékař, lékárna', 'pharmacy'], ['obchody', 'Obchod', 'bookmark'], ['parkovani', 'Parkoviště', 'parking'], ['jine', 'Jiné', 'info'],
  ];
  // které části kontrolního seznamu se ukážou pro daný typ
  const SECTIONS = {
    vstup: t => t !== 'parkovani',
    uvnitr: t => !['wc', 'parkovani'].includes(t),
    wc: t => t !== 'parkovani',
    park: t => t !== 'wc',
    ubyt: t => t === 'ubytovani',
  };
  const STEP_NAMES = ['Místo', 'Typ místa', 'Přístupnost', 'Fotky', 'Souhrn'];
  const state = { step: 1, sub: 0, place: null, places: [], photos: [], towns: [], regions: {}, wide: null };

  // ---------- Kroky ----------
  function toTop() {
    const f = $('#wizard');
    if (f.getBoundingClientRect().top < 0) f.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function go(n, sub) {
    if (n === 3) { applyType(); showSub(sub === 'last' ? parts().length - 1 : 0); }
    if (n === 5) renderSummary();
    state.step = n;
    $$('.step').forEach(s => { s.hidden = Number(s.dataset.step) !== n; });
    $$('#steps [data-go]').forEach(b => {
      const k = Number(b.dataset.go);
      if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('done', k < n);
    });
    $('#step-num').textContent = n;
    $('#step-count').textContent = 'Krok ' + n + ' z 5';
    updateName();
    $('#btn-prev').hidden = n === 1;
    $('#btn-next').hidden = n === 5;
    $('#btn-submit').hidden = n !== 5;
    const h = document.querySelector('.step[data-step="' + n + '"] h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    toTop();
  }
  function updateName() {
    let t = STEP_NAMES[state.step - 1];
    if (state.step === 3) { const ps = parts(); t += ', část ' + (state.sub + 1) + ' z ' + ps.length; }
    $('#step-name').textContent = t;
  }

  // ---------- Krok 3: jedna část kontrolního seznamu na obrazovku ----------
  function parts() { return $$('.step[data-step="3"] .fgroup').filter(f => !f.hidden); }
  function showSub(i) {
    const ps = parts();
    state.sub = Math.max(0, Math.min(i, ps.length - 1));
    $$('.step[data-step="3"] .fgroup').forEach(f => f.classList.toggle('is-off', f !== ps[state.sub]));
    $('#sub-tabs').innerHTML = ps.map((f, k) => '<button type="button" class="chip" data-sub="' + k + '" aria-pressed="' + (k === state.sub) + '">' +
      K.esc(f.querySelector('legend').textContent.trim()) + '</button>').join('');
    updateName();
  }
  function next() {
    if (!canLeave(state.step)) return;
    if (state.step === 3 && state.sub < parts().length - 1) { showSub(state.sub + 1); focusPart(); return; }
    go(state.step + 1);
  }
  function prev() {
    if (state.step === 3 && state.sub > 0) { showSub(state.sub - 1); focusPart(); return; }
    go(state.step - 1, state.step === 4 ? 'last' : undefined);
  }
  function focusPart() {
    const lg = parts()[state.sub].querySelector('legend');
    lg.setAttribute('tabindex', '-1'); lg.focus({ preventScroll: true }); toTop();
  }

  function canLeave(n) {
    if (n === 1 && !state.place && !($('#is-new').checked && $('#np-name').value.trim())) {
      K.toast('Vyberte místo ze seznamu, nebo zaškrtněte „přidám nové“ a napište název.'); return false;
    }
    if (n === 2 && !selectedType()) { K.toast('Vyberte typ místa.'); return false; }
    return true;
  }

  // ---------- Krok 1: hledání ----------
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  // Hledá v načtených regionech; když dotaz obsahuje obec (Česko i Bavorsko), načte její region.
  // Tlačítko „Hledat všude“ projde všechny regiony postupně a nechá si jen nalezená místa.
  const hay = (p) => p._s || (p._s = norm(p.n + ' ' + p.o + ' ' + (p.a || '') + ' ' + p.s));
  function townRegion(q) {
    let best = null;
    for (const t of state.towns) {
      const n = norm(t[0]);
      if (n.length >= 3 && (' ' + q + ' ').includes(' ' + n + ' ') && (!best || t[2] > best[2])) best = t;
    }
    return best ? best[1] : null;
  }
  function searchPlaces() {
    const q = norm($('#find').value.trim());
    const list = $('#pick');
    if (q.length < 2) { list.innerHTML = ''; return; }
    const words = q.split(/\s+/);
    const rid = townRegion(q);
    if (rid && !state.regions[rid]) {
      state.regions[rid] = 'loading';
      K.loadRegion(rid).then(arr => { state.regions[rid] = arr; searchPlaces(); }).catch(() => { delete state.regions[rid]; });
    }
    const pool = [].concat(state.places, ...Object.values(state.regions).filter(Array.isArray), state.wide && state.wide.q === q ? state.wide.hits : []);
    const hits = [], seen = new Set();
    for (const p of pool) {
      if (seen.has(p.i)) continue;
      if (words.every(w => hay(p).includes(w))) { seen.add(p.i); hits.push(p); if (hits.length >= 25) break; }
    }
    const wideBtn = !(state.wide && state.wide.q === q) ? '<li><button type="button" class="btn btn-quiet btn-sm" data-wide>' + K.icon('search') + 'Hledat ve všech místech v Česku a v Bavorsku</button></li>' : '';
    list.innerHTML = (hits.length ? hits.map(p => '<li><button type="button" data-id="' + p.i + '" aria-pressed="' + (state.place && state.place.i === p.i) + '">' +
      '<span class="pp-txt"><b>' + K.esc(p.n) + '</b><small>' + K.esc(p.s) + ' · ' + K.esc([p.a, p.o, K.zemeOf(p) === 'de' ? 'Bavorsko' : ''].filter(Boolean).join(', ')) + '</small></span>' +
      '<span class="pp-mark">' + K.icon('check') + '</span></button></li>').join('')
      : '<li class="muted small">' + (state.regions[rid] === 'loading' ? 'Načítám místa v obci…' : 'Nic jsme nenašli. Zkuste jiný tvar názvu, přidejte obec, nebo přidejte místo jako nové.') + '</li>') +
      (hits.length < 25 ? wideBtn : '');
  }
  function searchEverywhere() {
    const q = norm($('#find').value.trim()); if (q.length < 2) return;
    const words = q.split(/\s+/);
    $('#find-hint').textContent = 'Prohledávám všechna místa…';
    K.loadAll(p => words.every(w => hay(p).includes(w)), { onProgress: (d, n) => { $('#find-hint').textContent = 'Prohledávám všechna místa… ' + d + ' z ' + n + ' oblastí'; } })
      .then(hits => { state.wide = { q, hits }; $('#find-hint').textContent = 'Prohledali jsme všechna místa v Česku a v Bavorsku.'; searchPlaces(); })
      .catch(() => { $('#find-hint').textContent = 'Hledání se nepovedlo. Zkuste to znovu.'; });
  }
  function findLoaded(id) {
    return state.places.find(p => p.i === id) || K.placeById(id) || (state.wide ? state.wide.hits.find(p => p.i === id) : null) || null;
  }
  function pickPlace(id) {
    state.place = findLoaded(id);
    $$('#pick [data-id]').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
    if (state.place) {
      $('#is-new').checked = false; $('#new-place').hidden = true;
      $('#osm-link').href = K.osmEditUrl(state.place);
      const t = $('#types input[value="' + state.place.c + '"]');
      if (t) t.checked = true;
      if (state.place.sc !== undefined) $('#v-steps').value = state.place.sc;
      if (state.place.dw) $('#v-door').value = state.place.dw;
      if (state.place.pk) $('#p-n').value = state.place.pk;
      if (state.place.t === 'yes') { $('#w-has').checked = true; toggleDeps(); }
      if (state.place.d && !$('#note').value) $('#note').value = state.place.d;
      verdict();
    }
  }

  // ---------- Krok 2: typ ----------
  function selectedType() { const r = $('#types input:checked'); return r ? r.value : null; }
  function applyType() {
    const t = selectedType() || 'jine';
    $$('[data-sec]').forEach(f => { f.hidden = !SECTIONS[f.dataset.sec](t); });
  }

  // ---------- Krok 3: závislá pole ----------
  function toggleDeps() {
    $$('[data-ramp]').forEach(e => { e.hidden = !$('#v-ramp').checked; });
    $$('[data-lift]').forEach(e => { e.hidden = !$('#u-lift').checked; });
    $$('[data-wc]').forEach(e => { e.hidden = !$('#w-has').checked; });
  }
  const num = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number(v.replace(',', '.')); };

  // ---------- Odhad kategorie podle metodiky POV ----------
  // 0 = přístupný, 1 = částečně, 2 = nepřístupný
  function evaluate() {
    const notes = []; let worst = -1;
    const rate = (lvl, text) => { worst = Math.max(worst, lvl); notes.push([lvl, text]); };
    const t = selectedType() || 'jine';
    if (SECTIONS.vstup(t)) {
      const ramp = $('#v-ramp').checked, steps = num('#v-steps'), h = num('#v-stepcm'), door = num('#v-door');
      if (ramp) {
        const s = num('#v-slope'), len = num('#v-rlen'), w = num('#v-rwid');
        if (s !== null) {
          const short = len !== null && len <= 3;
          const [ok, part] = short ? [12.5, 16.5] : [8, 12.5];
          if (s <= ok) rate(0, 'Rampa ' + K.fmt(s) + ' %: vyhovuje (max ' + K.fmt(ok) + ' %' + (short ? ' do 3 m' : '') + ')');
          else if (s <= part) rate(1, 'Rampa ' + K.fmt(s) + ' %: jen částečně (max ' + K.fmt(part) + ' %)');
          else rate(2, 'Rampa ' + K.fmt(s) + ' % je příliš strmá');
          if (len === null) notes.push([-1, 'Doplňte délku rampy, podle ní se určuje přípustný sklon']);
        }
        if (w !== null) { if (w >= 110) rate(0, 'Šířka rampy ' + w + ' cm'); else rate(2, 'Rampa užší než 110 cm (' + w + ' cm)'); }
      } else if (steps !== null) {
        if (steps === 0) rate(0, 'Vstup bez schodu');
        else if (steps === 1 && h !== null && h <= 2) rate(0, 'Práh ' + K.fmt(h) + ' cm');
        else if (steps === 1 && (h === null || h <= 7)) rate(1, h === null ? 'Jeden schod: doplňte výšku' : 'Jeden schod ' + K.fmt(h) + ' cm');
        else rate(2, steps === 1 ? 'Schod ' + K.fmt(h) + ' cm (víc než 7 cm)' : steps + ' schodů bez rampy');
      } else if (h !== null) {
        if (h <= 2) rate(0, 'Práh ' + K.fmt(h) + ' cm'); else if (h <= 7) rate(1, 'Schod ' + K.fmt(h) + ' cm'); else rate(2, 'Schod ' + K.fmt(h) + ' cm');
      }
      if (door !== null) { if (door >= 80) rate(0, 'Vstupní dveře ' + door + ' cm'); else if (door >= 70) rate(1, 'Vstupní dveře ' + door + ' cm (pod 80)'); else rate(2, 'Vstupní dveře ' + door + ' cm (pod 70)'); }
    }
    if (SECTIONS.uvnitr(t)) {
      const floors = num('#u-floors');
      if ($('#u-lift').checked) {
        const d = num('#u-ldoor'), w = num('#u-lw'), dp = num('#u-ld');
        if (d !== null) { if (d >= 80) rate(0, 'Dveře výtahu ' + d + ' cm'); else if (d >= 70) rate(1, 'Dveře výtahu ' + d + ' cm'); else rate(2, 'Dveře výtahu ' + d + ' cm'); }
        if (w !== null && dp !== null) { if (w >= 100 && dp >= 125) rate(0, 'Kabina ' + w + ' × ' + dp + ' cm'); else if (w >= 100 && dp >= 110) rate(1, 'Kabina ' + w + ' × ' + dp + ' cm'); else rate(2, 'Kabina ' + w + ' × ' + dp + ' cm je malá'); }
      } else if ($('#u-plat').checked) rate(1, 'Jen schodišťová plošina: nejvýš částečně přístupné');
      else if (floors !== null && floors > 1) rate(1, floors + ' podlaží bez výtahu: přístupné jen přízemí');
      const nar = num('#u-narrow');
      if (nar !== null) { if (nar >= 80) rate(0, 'Vnitřní průchody ' + nar + ' cm'); else if (nar >= 70) rate(1, 'Nejužší průchod ' + nar + ' cm'); else rate(2, 'Nejužší průchod ' + nar + ' cm'); }
    }
    let wcCat = null;
    if (SECTIONS.wc(t) && $('#w-has').checked) {
      const d = num('#w-door'), w = num('#w-w'), dp = num('#w-d'), side = num('#w-side'), out = $('#w-out').checked;
      if (d !== null && w !== null && dp !== null) {
        const sideOk = (v) => side === null || side >= v;
        if (d >= 80 && w >= 160 && dp >= 160 && sideOk(80) && out) wcCat = 'WC I: přístupná';
        else if (d >= 70 && w >= 140 && dp >= 140 && sideOk(70) && out) wcCat = 'WC II: částečně přístupná';
        else wcCat = 'Běžné WC: nesplňuje WC II';
      }
    }
    return { worst, notes, wcCat };
  }

  const CAT = [['ok', 'Přístupný'], ['part', 'Částečně přístupný'], ['no', 'Nepřístupný']];
  function verdict() {
    const r = evaluate();
    const box = $('#verdict');
    if (r.worst < 0 && !r.wcCat) { box.innerHTML = '<p class="muted small">Vyplňte vstup a uvidíte, do které kategorie místo patří.</p>'; return r; }
    const [st, label] = r.worst >= 0 ? CAT[r.worst] : ['unk', 'Zatím nelze určit'];
    box.innerHTML = '<div class="big">' + K.statusHtml(st, '') + label + '</div>' +
      '<ul>' + r.notes.map(([lvl, t]) => '<li>' + (lvl >= 0 ? K.statusHtml(CAT[lvl][0], '') : '') + ' ' + K.esc(t) + '</li>').join('') + '</ul>' +
      (r.wcCat ? '<p class="small verdict-wc"><b>Toaleta:</b> ' + r.wcCat + '</p>' : '');
    return r;
  }

  // ---------- Krok 4: fotky ----------
  function addFiles(files) {
    Array.from(files).filter(f => /^image\//.test(f.type)).forEach(f => {
      if (state.photos.length >= MAX_PHOTOS) { K.toast('Nejvýš ' + MAX_PHOTOS + ' fotek.'); return; }
      const item = { name: f.name, label: 'vstup', url: '' };
      state.photos.push(item);
      const r = new FileReader();
      r.onload = () => { item.url = r.result; renderPhotos(); };
      r.readAsDataURL(f);
    });
  }
  function renderPhotos() {
    const opts = ['vstup', 'toaleta', 'parkování', 'pokoj', 'koupelna', 'výtah', 'interiér'];
    $('#photo-list').innerHTML = state.photos.map((p, i) => '<div class="photo-item">' + (p.url ? '<img src="' + p.url + '" alt="Náhled: ' + K.esc(p.name) + '">' : '') +
      '<div class="ctl"><label class="sr-only" for="ph-' + i + '">Co je na fotce</label><select id="ph-' + i + '" data-i="' + i + '">' +
      opts.map(o => '<option' + (o === p.label ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
      '<button class="btn btn-quiet btn-sm" type="button" data-rm="' + i + '">Odebrat</button></div></div>').join('');
  }

  // ---------- Krok 5: souhrn ----------
  function collect() {
    const vals = {};
    $$('[data-sec]:not([hidden]) input, [data-sec]:not([hidden]) select').forEach(el => {
      const hid = el.closest('[hidden]'); if (hid && !hid.classList.contains('step')) return; // skrytý krok 3 nevadí, skrytá pole ano
      const lab = (document.querySelector('label[for="' + el.id + '"]') || el.closest('label') || {}).textContent;
      if (el.type === 'checkbox') { if (el.checked) vals[el.id] = { label: (lab || '').trim(), value: 'ano' }; }
      else if (el.value !== '') {
        const unit = el.parentElement.classList.contains('input-unit') ? ' ' + el.parentElement.querySelector('span').textContent : '';
        vals[el.id] = { label: (lab || '').trim(), value: el.value + unit };
      }
    });
    return vals;
  }
  function placeLabel() {
    if (state.place) return state.place.n + (state.place.o ? ', ' + state.place.o : '');
    return [$('#np-name').value.trim(), $('#np-street').value.trim(), $('#np-city').value.trim()].filter(Boolean).join(', ');
  }
  function renderSummary() {
    const vals = collect(), r = evaluate();
    const t = TYPES.find(x => x[0] === selectedType());
    const rows = [['Místo', placeLabel()], ['Typ', t ? t[1] : '–']].concat(Object.values(vals).map(v => [v.label, v.value]));
    if ($('#note').value.trim()) rows.push(['Poznámka', $('#note').value.trim()]);
    rows.push(['Fotky', state.photos.length ? state.photos.map(p => p.label).join(', ') : 'žádné']);
    if (r.worst >= 0) rows.push(['Odhad kategorie', CAT[r.worst][1]]);
    $('#summary').innerHTML = '<dl>' + rows.map(([a, b]) => '<dt>' + K.esc(a) + '</dt><dd>' + K.esc(b) + '</dd>').join('') + '</dl>' +
      (Object.keys(vals).length ? '' : '<p class="callout small summary-warn">Zatím jste nevyplnili žádný údaj o přístupnosti. Vraťte se ke kroku 3, i jedno číslo pomůže.</p>');
  }

  function submit(e) {
    e.preventDefault();
    const r = evaluate();
    const drafts = K.store.get('drafts', []);
    drafts.unshift({
      id: 'd' + Date.now(),
      created: new Date().toISOString().slice(0, 10),
      place: state.place ? { i: state.place.i, r: state.place._r || '', n: state.place.n, o: state.place.o } : { n: $('#np-name').value.trim(), a: $('#np-street').value.trim(), o: $('#np-city').value.trim() },
      type: selectedType(),
      values: collect(),
      note: $('#note').value.trim(),
      photos: state.photos.map(p => p.label),
      nick: $('#nick').value.trim(),
      aid: $('#aid').value,
      category: r.worst >= 0 ? CAT[r.worst][1] : null,
      wc: r.wcCat,
    });
    K.store.set('drafts', drafts.slice(0, 50));
    $$('.step').forEach(s => { s.hidden = true; });
    $('#steps').hidden = true; $('#wz-progress').hidden = true; $('#wz-nav').hidden = true;
    const d = $('#done'); d.hidden = false; d.focus();
  }

  function init() {
    $('#types').innerHTML = TYPES.map(([v, l]) => '<label><input type="radio" name="type" value="' + v + '"><span>' + l + '</span></label>').join('');
    $('#steps').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; const n = Number(b.dataset.go); if (n <= state.step || canLeave(state.step)) go(n); });
    $('#btn-next').addEventListener('click', next);
    $('#btn-prev').addEventListener('click', prev);
    $('#sub-tabs').addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (b) { showSub(Number(b.dataset.sub)); focusPart(); } });
    $('#is-new').addEventListener('change', () => { $('#new-place').hidden = !$('#is-new').checked; if ($('#is-new').checked) { state.place = null; $$('#pick [data-id]').forEach(b => b.setAttribute('aria-pressed', 'false')); $('#osm-link').href = 'https://www.openstreetmap.org/edit'; $('#np-name').focus(); } });
    let t; $('#find').addEventListener('input', () => { clearTimeout(t); t = setTimeout(searchPlaces, 150); });
    $('#pick').addEventListener('click', e => { if (e.target.closest('[data-wide]')) { searchEverywhere(); return; } const b = e.target.closest('[data-id]'); if (b) pickPlace(b.dataset.id); });
    $('#types').addEventListener('change', () => { applyType(); verdict(); });
    $('#btn-prev').hidden = true;
    ['#v-ramp', '#u-lift', '#w-has'].forEach(s => $(s).addEventListener('change', toggleDeps));
    $('#wizard').addEventListener('input', verdict);
    $('#wizard').addEventListener('change', verdict);
    $('#photos').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    $('#photo-list').addEventListener('change', e => { const s = e.target.closest('[data-i]'); if (s) state.photos[Number(s.dataset.i)].label = s.value; });
    $('#photo-list').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { state.photos.splice(Number(b.dataset.rm), 1); renderPhotos(); } });
    $('#wizard').addEventListener('submit', submit);
    $('#wizard').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && state.step < 5) e.preventDefault(); });

    const sp = new URLSearchParams(location.search);
    Promise.all([K.loadRegionsIndex(), K.loadTowns().catch(() => [])]).then(async ([idx, towns]) => {
      state.towns = towns;
      const total = idx.reduce((a, r) => a + r.pocet, 0);
      $('#find-hint').textContent = 'Napište název a obec. Hledáme mezi ' + total.toLocaleString('cs-CZ') + ' místy v Česku a v Bavorsku.';
      const id = sp.get('id');
      if (id) {
        const p = await K.findPlace(id, sp.get('r')).catch(() => null);
        if (p) { state.places = [p]; $('#find').value = p.n + (p.o ? ' ' + p.o : ''); searchPlaces(); pickPlace(id); }
      }
      if ($('#find').value) searchPlaces();
    }).catch(() => { $('#find-hint').textContent = 'Seznam míst se nenačetl. Můžete přidat místo jako nové.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
