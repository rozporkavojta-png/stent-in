/* Přidat nebo upravit místo: komunitní návrh nového místa, doplnění údajů nebo hlášení změny.
   Krok „Přístupnost“ používá stejný standardizovaný checklist jako profil podniku (KPCheck + KP.business.CHECKLIST).
   FUNKČNÍ PROTOTYP: vše se ukládá jen do tohoto prohlížeče (kp.drafts, kp.reports, kp.reviews). */
(function () {
  'use strict';
  const K = window.KP, KC = window.KPCheck, $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const MAX_PHOTOS = 6, PFX = 'pr';
  const TYPES = [
    ['ubytovani', KP.t('Ubytování'), 'bed'], ['restaurace', KP.t('Restaurace, kavárna'), 'food'], ['wc', KP.t('Veřejné WC'), 'wc'],
    ['pamatky', KP.t('Památka, muzeum'), 'museum'], ['kultura', KP.t('Kultura'), 'theater'], ['urady', KP.t('Úřad, pošta'), 'building'],
    ['zdravi', KP.t('Lékař, lékárna'), 'pharmacy'], ['obchody', KP.t('Obchod'), 'bookmark'], ['sport', KP.t('Sport, bazén'), 'star'],
    ['priroda', KP.t('Příroda, vyhlídka'), 'tree'], ['parkovani', KP.t('Parkoviště'), 'parking'], ['jine', KP.t('Jiné'), 'info'],
  ];
  const STEP_NAMES = [KP.t('Co a kde'), KP.t('Typ místa'), KP.t('Přístupnost'), KP.t('Fotky'), KP.t('Souhrn')];
  const MODE_TXT = { doplnit: KP.t('Doplnění údajů'), zmena: KP.t('Hlášení změny'), nove: KP.t('Návrh nového místa') };
  const state = { step: 1, sub: 0, place: null, photos: [], search: null, builtFor: null };

  const mode = () => ($('#modes input:checked') || {}).value || 'doplnit';
  const selectedType = () => { const r = $('#types input:checked'); return r ? r.value : null; };
  const items = () => [].concat(...KC.steps(selectedType() || 'jine').map(s => s.items));

  // ---------- Kroky ----------
  function toTop() { const f = $('#wizard'); if (f.getBoundingClientRect().top < 0) f.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  function go(n, sub) {
    if (n === 3) { buildChecklist(); showSub(sub === 'last' ? parts().length - 1 : 0); }
    if (n === 4) photoNote();
    if (n === 5) renderSummary();
    state.step = n;
    $$('.step').forEach(s => { s.hidden = Number(s.dataset.step) !== n; });
    $$('#steps [data-go]').forEach(b => {
      const k = Number(b.dataset.go);
      if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('done', k < n);
    });
    $('#step-num').textContent = n;
    $('#step-count').textContent = K.t('Krok {i} z {n}', { i: n, n: 5 });
    updateName();
    $('#btn-prev').hidden = n === 1;
    $('#btn-next').hidden = n === 5;
    $('#btn-submit').hidden = n !== 5;
    $('#btn-submit').textContent = mode() === 'zmena' ? KP.t('Uložit hlášení') : KP.t('Uložit příspěvek');
    const h = document.querySelector('.step[data-step="' + n + '"] h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    toTop();
  }
  function updateName() {
    let t = STEP_NAMES[state.step - 1];
    if (state.step === 3) { const ps = parts(); t += ', ' + K.t('část {i} z {n}', { i: state.sub + 1, n: ps.length }); }
    $('#step-name').textContent = t;
  }

  // ---------- Krok 3: checklist po částech ----------
  // Části se staví podle typu místa; rozepsané hodnoty se při změně typu zachovají
  function buildChecklist() {
    const t = selectedType() || 'jine', key = t + '|' + mode() + '|' + (state.place ? state.place.i : '');
    if (state.builtFor === key) return;
    const prev = $('#ck-parts').children.length ? KC.read($('#ck-parts'), PFX, KP_ALL()) : {};
    const prevZm = $('#zm-text') ? { f: $('#zm-field').value, t: $('#zm-text').value } : null;
    const steps = KC.steps(t), p = state.place;
    let html = '';
    if (mode() === 'zmena') {
      const fs = p ? K.facilitiesScore(p) : null;
      const opts = (fs ? fs.relevant : Object.keys(K.AREAS)).map(a => '<optgroup label="' + K.AREAS[a] + '">' +
        K.FEATURES.filter(f => f.a === a).map(f => '<option value="' + f.k + '">' + K.esc(f.label) + '</option>').join('') + '</optgroup>').join('');
      html += ('<fieldset class="fgroup" data-part="zmena"><legend>' + KP.t('Co se změnilo') + '</legend>') +
        ('<div class="field full"><label for="zm-field">' + KP.t('Kterého údaje se změna týká') + '</label><select id="zm-field"><option value="">' + KP.t('Něco jiného nebo víc věcí') + '</option>') + opts + '</select></div>' +
        ('<div class="field full"><label for="zm-text">' + KP.t('Co je teď jinak') + '</label><textarea id="zm-text" maxlength="2000" placeholder="' + KP.t('Např. od září je u vstupu rampa, schod zmizel. Nebo: výtah je dlouhodobě mimo provoz.') + '"></textarea>') +
        ('<span class="hint">' + KP.t('Když znáte nové hodnoty, vyplňte je v dalších částech. Nic dalšího vyplňovat nemusíte.') + '</span></div></fieldset>');
    }
    html += steps.map(s => '<fieldset class="fgroup pr-ck" data-part="' + s.a + '"><legend>' + s.label + '</legend>' +
      '<p class="ck-intro full">' + K.esc(s.intro) + '</p>' +
      s.items.map(c => KC.fieldHtml(c, prev[c.key], PFX, p)).join('') + '</fieldset>').join('');
    $('#ck-parts').innerHTML = html;
    if (prevZm && $('#zm-text')) { $('#zm-field').value = prevZm.f; $('#zm-text').value = prevZm.t; }
    state.builtFor = key;
  }
  // Všechny položky (pro čtení rozepsaných hodnot napříč typy)
  function KP_ALL() { return K.business.CHECKLIST; }
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
    const m = mode();
    if (n === 1) {
      if (m === 'nove' && !$('#np-name').value.trim()) { K.toast(KP.t('Napište název nového místa.')); $('#np-name').focus(); return false; }
      if (m !== 'nove' && !state.place) { K.toast(KP.t('Vyberte místo ze seznamu. Když v něm není, zvolte „Navrhnout nové místo“.')); $('#find').focus(); return false; }
    }
    if (n === 2 && !selectedType()) { K.toast(KP.t('Vyberte typ místa.')); return false; }
    if (n === 3 && m === 'zmena' && state.sub === 0 && $('#zm-text') && !$('#zm-text').value.trim()) { K.toast(KP.t('Napište, co je teď jinak.')); $('#zm-text').focus(); return false; }
    return true;
  }

  // ---------- Krok 1: druh příspěvku a místo ----------
  function applyMode() {
    const m = mode();
    $('#find-block').hidden = m === 'nove';
    $('#new-place').hidden = m !== 'nove';
    if (m === 'nove') { state.place = null; $$('#pick [data-id]').forEach(b => b.setAttribute('aria-pressed', 'false')); $('#osm-link').href = 'https://www.openstreetmap.org/edit'; }
    $('#btn-submit').textContent = m === 'zmena' ? KP.t('Uložit hlášení') : KP.t('Uložit příspěvek');
    state.builtFor = null;
  }
  function pickPlace(p) {
    state.place = p;
    $('#osm-link').href = K.osmEditUrl(p);
    $('#biz-link').href = 'podnik.html?id=' + encodeURIComponent(p.i) + (p._r ? '&r=' + encodeURIComponent(p._r) : '');
    const t = $('#types input[value="' + p.c + '"]');
    if (t) t.checked = true;
    if (p.d && !$('#note').value && mode() === 'doplnit') $('#note').placeholder = K.t('Teď v mapě') + ': ' + p.d;
    state.builtFor = null;
    verdict();
  }

  // ---------- Odhad kategorie podle metodiky POV z hodnot checklistu ----------
  // 0 = přístupný, 1 = částečně, 2 = nepřístupný
  function evaluate() {
    const v = $('#ck-parts').children.length ? KC.read($('#ck-parts'), PFX, KP_ALL()) : {};
    const has = (k) => v[k] !== undefined && v[k] !== '';
    const notes = []; let worst = -1;
    const rate = (lvl, text) => { worst = Math.max(worst, lvl); notes.push([lvl, text]); };
    if (has('vstupBezSchodu')) rate({ yes: 0, part: 1, no: 2 }[v.vstupBezSchodu], { yes: KP.t('Vstup bez schodů nebo s rampou'), part: KP.t('Vstup jen částečně bez bariér'), no: KP.t('Vstup se schody') }[v.vstupBezSchodu]);
    if (has('schodyPocet') && v.schodyPocet > 1 && v.vstupBezSchodu !== 'yes') rate(2, K.t('{n} schodů u vstupu', { n: v.schodyPocet }));
    if (has('prahCm')) { const h = v.prahCm; rate(h <= 2 ? 0 : h <= 7 ? 1 : 2, K.t('Práh nebo schod') + ' ' + K.fmt(h) + ' cm' + (h <= 2 ? '' : ' ' + (h <= 7 ? K.t('(víc než 2 cm)') : K.t('(víc než 7 cm)')))); }
    if (has('vstupDvereCm')) { const d = v.vstupDvereCm; rate(d >= 80 ? 0 : d >= 70 ? 1 : 2, K.t('Vstupní dveře') + ' ' + K.fmt(d) + ' cm'); }
    if (has('rampaSklonPct')) { const s = v.rampaSklonPct; rate(s <= 8 ? 0 : s <= 12.5 ? 1 : 2, K.t('Rampa') + ' ' + K.fmt(s) + ' %' + (s <= 8 ? '' : ' ' + (s <= 12.5 ? K.t('(vyhovuje jen do 3 m délky)') : K.t('(příliš strmá pro rampu delší než 3 m)')))); }
    if (has('prostory') && v.prostory !== 'yes') rate(v.prostory === 'part' ? 1 : 2, v.prostory === 'part' ? KP.t('Jen část prostor přístupná') : KP.t('Hlavní prostory nepřístupné'));
    if (has('vytah') && v.vytah === 'no') rate(1, KP.t('Bez výtahu: přístupné jen přízemí'));
    if (has('pruchodyCm')) { const d = v.pruchodyCm; rate(d >= 80 ? 0 : d >= 70 ? 1 : 2, K.t('Nejužší průchod') + ' ' + K.fmt(d) + ' cm'); }
    let wcCat = null;
    if (has('wc')) wcCat = { yes: KP.t('Bezbariérové WC'), part: KP.t('WC částečně přístupné'), no: KP.t('WC není bezbariérové') }[v.wc] + (has('wcDvereCm') ? ', ' + K.t('dveře') + ' ' + K.fmt(v.wcDvereCm) + ' cm' : '');
    return { worst, notes, wcCat };
  }
  const CAT = [['ok', KP.t('Přístupný')], ['part', KP.t('Částečně přístupný')], ['no', KP.t('Nepřístupný')]];
  function verdict() {
    const r = evaluate(), box = $('#verdict');
    if (r.worst < 0 && !r.wcCat) { box.innerHTML = ('<p class="muted small">' + KP.t('Vyplňte vstup a uvidíte, do které kategorie místo patří.') + '</p>'); return r; }
    const [st, label] = r.worst >= 0 ? CAT[r.worst] : ['unk', KP.t('Zatím nelze určit')];
    box.innerHTML = '<div class="big">' + K.statusHtml(st, '') + label + '</div>' +
      '<ul>' + r.notes.map(([lvl, t]) => '<li>' + K.statusHtml(CAT[lvl][0], '') + ' ' + K.esc(t) + '</li>').join('') + '</ul>' +
      (r.wcCat ? ('<p class="small verdict-wc"><b>' + KP.t('Toaleta') + ':</b> ') + K.esc(r.wcCat) + '</p>' : '');
    return r;
  }

  // ---------- Krok 4: fotky se štítkem oblasti ----------
  const PH = K.business.PHOTO_AREAS;
  function photoNote() {
    $('#photo-note').textContent = mode() === 'nove'
      ? KP.t('U nového místa si fotky v prototypu neukládáme, zapíšeme jen, co na nich je. V ostré verzi se odešlou s návrhem.')
      : KP.t('Fotky uložíme k místu jen v tomto prohlížeči a uvidíte je v jeho detailu. V ostré verzi je zkontroluje moderátor.');
  }
  function addFiles(files) {
    Array.from(files).filter(f => /^image\//.test(f.type)).forEach(f => {
      if (state.photos.length >= MAX_PHOTOS) { K.toast(K.t('Nejvýš {n} fotek.', { n: MAX_PHOTOS })); return; }
      state.photos.push({ name: f.name, area: 'vstup', file: f, url: URL.createObjectURL(f) });
    });
    renderPhotos();
  }
  function renderPhotos() {
    const t = selectedType() || 'jine';
    const opts = PH.filter(a => t === 'ubytovani' || !a.hotel);
    $('#photo-list').innerHTML = state.photos.map((p, i) => '<div class="photo-item"><img src="' + p.url + '" alt="' + K.t('Náhled') + ': ' + K.esc(p.name) + '">' +
      '<div class="ctl"><label class="sr-only" for="ph-' + i + ('">' + KP.t('Co je na fotce') + '</label><select id="ph-') + i + '" data-i="' + i + '">' +
      opts.map(o => '<option value="' + o.key + '"' + (o.key === p.area ? ' selected' : '') + '>' + o.label + '</option>').join('') + '</select>' +
      '<button class="btn btn-quiet btn-sm" type="button" data-rm="' + i + ('">' + KP.t('Odebrat') + '<span class="sr-only"> ' + KP.t('fotku') + ' ') + (i + 1) + '</span></button></div></div>').join('');
  }
  const phLabel = (k) => (PH.find(a => a.key === k) || {}).label || k;

  // ---------- Krok 5: souhrn ----------
  function collect() {
    const raw = KC.read($('#ck-parts'), PFX, items()), vals = {};
    items().forEach(c => { const t = KC.valueText(c, raw[c.key]); if (t) vals[c.key] = { label: c.label, value: t }; });
    Object.keys(raw).forEach(k => { if (raw[k] === '') delete raw[k]; });
    return { raw, vals };
  }
  function placeLabel() {
    if (mode() !== 'nove' && state.place) return state.place.n + (state.place.o ? ', ' + state.place.o : '');
    return [$('#np-name').value.trim(), $('#np-street').value.trim(), $('#np-city').value.trim()].filter(Boolean).join(', ');
  }
  function renderSummary() {
    const { vals } = collect(), r = evaluate();
    const t = TYPES.find(x => x[0] === selectedType());
    const rows = [[KP.t('Druh příspěvku'), MODE_TXT[mode()]], [KP.t('Místo'), placeLabel()], [KP.t('Typ'), t ? t[1] : '–']];
    if (mode() === 'zmena' && $('#zm-text')) {
      const f = K.FEATURES.find(x => x.k === $('#zm-field').value);
      rows.push([KP.t('Změna'), (f ? f.label + ': ' : '') + $('#zm-text').value.trim()]);
    }
    Object.values(vals).forEach(v => rows.push([v.label, v.value]));
    if ($('#note').value.trim()) rows.push([KP.t('Poznámka'), $('#note').value.trim()]);
    rows.push([KP.t('Fotky'), state.photos.length ? state.photos.map(p => phLabel(p.area)).join(', ') : KP.t('žádné')]);
    if (r.worst >= 0) rows.push([KP.t('Odhad kategorie'), CAT[r.worst][1]]);
    $('#summary').innerHTML = '<dl>' + rows.map(([a, b]) => '<dt>' + K.esc(a) + '</dt><dd>' + K.esc(b) + '</dd>').join('') + '</dl>' +
      (Object.keys(vals).length || mode() === 'zmena' ? '' : ('<p class="callout small summary-warn">' + KP.t('Zatím jste nevyplnili žádný údaj o přístupnosti. Vraťte se ke kroku 3, i jedno číslo pomůže.') + '</p>'));
  }

  async function submit(e) {
    e.preventDefault();
    const m = mode(), p = m === 'nove' ? null : state.place, r = evaluate(), { raw, vals } = collect();
    const btn = $('#btn-submit'); btn.disabled = true;
    const fail = (msg) => { btn.disabled = false; K.toast(msg); };
    let report = null, photosSaved = 0;
    if (m === 'zmena' && p) {
      const f = $('#zm-field').value, txt = $('#zm-text').value.trim();
      const extra = Object.values(vals).map(v => v.label + ': ' + v.value).join('; ');
      report = K.community.report(p.i, txt + (extra ? ' (' + K.t('nové hodnoty') + ': ' + extra + ')' : ''), f);
      if (!report) return fail(KP.t('Hlášení se nepodařilo uložit. Úložiště prohlížeče je plné nebo vypnuté.'));
    }
    if (p && state.photos.length) {
      const res = await K.community.addReview(p.i, { text: $('#note').value.trim(), aid: $('#aid').value, photos: state.photos.map(x => x.file), photoAreas: state.photos.map(x => x.area) });
      if (!res.ok) return fail(res.error);
      photosSaved = res.review.photos.length;
    }
    const drafts = K.store.get('drafts', []);
    drafts.unshift({
      id: 'd' + Date.now(), kind: m,
      created: new Date().toISOString().slice(0, 10),
      place: p ? { i: p.i, r: p._r || '', n: p.n, o: p.o } : { n: $('#np-name').value.trim(), a: $('#np-street').value.trim(), o: $('#np-city').value.trim() },
      type: selectedType(),
      values: vals, raw,
      note: $('#note').value.trim(),
      change: report ? { field: report.field, text: report.text, id: report.id } : null,
      photos: state.photos.map(x => phLabel(x.area)),
      nick: $('#nick').value.trim(),
      aid: $('#aid').value,
      category: r.worst >= 0 ? CAT[r.worst][1] : null,
      wc: r.wcCat,
    });
    if (!K.store.set('drafts', drafts.slice(0, 50))) return fail(KP.t('Příspěvek se nepodařilo uložit. Úložiště prohlížeče je plné nebo vypnuté.'));
    if (state.photos.length) state.photos.forEach(x => URL.revokeObjectURL(x.url));
    $$('.step').forEach(s => { s.hidden = true; });
    $('#steps').hidden = true; $('#wz-progress').hidden = true; $('#wz-nav').hidden = true;
    const done = $('#done');
    $('#done-text').textContent = K.PROTOTYPE_NOTE + ' ' +
      (m === 'zmena' ? (KP.t('Hlášení uvidíte v detailu místa a ve svém profilu.') + ' ') : m === 'nove' ? (KP.t('Návrh nového místa najdete ve svém profilu.') + ' ') : (KP.t('Příspěvek najdete ve svém profilu.') + ' ')) +
      (photosSaved ? (KP.t('Fotky jsme přidali k místu.') + ' ') : '') + KP.t('V ostré verzi ho zkontroluje moderátor.');
    if (p) done.querySelector('.row').insertAdjacentHTML('afterbegin', '<a class="btn btn-ghost" href="' + K.placeUrl(p) + ('">' + KP.t('Zpět na místo') + '</a>'));
    done.hidden = false; done.focus();
  }

  function init() {
    $('#pr-proto').textContent = K.PROTOTYPE_NOTE;
    const p2 = document.querySelector('[data-proto2]'); if (p2) p2.textContent = K.PROTOTYPE_NOTE + (' ' + KP.t('Příspěvek uvidíte ve svém profilu.'));
    $('#aid').insertAdjacentHTML('beforeend', K.AIDS.filter(a => a !== 'jiné').concat(['jsem doprovod']).map(a => '<option value="' + a + '">' + K.t(a) + '</option>').join(''));
    $('#types').innerHTML = TYPES.map(([v, l]) => '<label><input type="radio" name="type" value="' + v + '"><span>' + l + '</span></label>').join('');
    $('#steps').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; const n = Number(b.dataset.go); if (n <= state.step || canLeave(state.step)) go(n); });
    $('#btn-next').addEventListener('click', next);
    $('#btn-prev').addEventListener('click', prev);
    $('#sub-tabs').addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (b) { showSub(Number(b.dataset.sub)); focusPart(); } });
    $('#modes').addEventListener('change', applyMode);
    $('#types').addEventListener('change', () => { state.builtFor = null; buildChecklist(); verdict(); renderPhotos(); });
    $('#btn-prev').hidden = true;
    $('#wizard').addEventListener('input', verdict);
    $('#wizard').addEventListener('change', verdict);
    $('#photos').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    $('#photo-list').addEventListener('change', e => { const s = e.target.closest('[data-i]'); if (s) state.photos[Number(s.dataset.i)].area = s.value; });
    $('#photo-list').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { const x = state.photos.splice(Number(b.dataset.rm), 1)[0]; if (x) URL.revokeObjectURL(x.url); renderPhotos(); $('#photos').focus(); } });
    $('#wizard').addEventListener('submit', submit);
    $('#wizard').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && state.step < 5) e.preventDefault(); });

    state.search = KC.placeSearch({ input: $('#find'), list: $('#pick'), hint: $('#find-hint'), onPick: pickPlace, selected: () => state.place && state.place.i,
      emptyText: KP.t('Nic jsme nenašli. Zkuste jiný tvar názvu nebo přidejte obec. Když místo v mapě není, zvolte nahoře „Navrhnout nové místo“.') });
    const sp = new URLSearchParams(location.search);
    if (sp.get('nahlasit')) { $('#modes input[value="zmena"]').checked = true; }
    if (sp.get('nove')) { $('#modes input[value="nove"]').checked = true; }
    applyMode();
    const id = sp.get('id');
    if (id) {
      K.findPlace(id, sp.get('r')).then(p => {
        if (!p) return;
        state.search.addPlaces([p]);
        $('#find').value = p.n + (p.o ? ' ' + p.o : '');
        pickPlace(p);
        state.search.ready.then(() => { state.search.run(); });
      }).catch(() => null);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
