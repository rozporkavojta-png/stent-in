/* Profil podniku: hledání, převzetí, checklist krok za krokem s fotkami, náhled veřejného profilu, motivace,
   statistiky jen z tohoto prohlížeče a doporučení, co zlepšit. FUNKČNÍ PROTOTYP: vše jen v localStorage (KP.business). */
(function () {
  'use strict';
  const K = window.KP, KC = window.KPCheck, B = K.business, C = K.community, esc = K.esc;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const PFX = 'ck', MAX_PH = 3;
  const state = { p: null, step: 0, photos: {}, editClaim: false, kraje: null, krajeP: null, search: null };

  const plural = (n, a, b, c) => n + ' ' + K.plural(n, a, b, c);
  const catLabel = (p) => (K.CATS[p.c] || {}).label || (p.s && K.t(p.s)) || K.t('Místo');
  const prof = () => (state.p && B.profile(state.p.i)) || { values: {}, photos: {}, description: '' };
  const claimed = () => state.p && B.claimed(state.p.i);

  // ---------- Výběr podniku ----------
  function open(p, opts) {
    state.p = p; state.step = 0; state.editClaim = false;
    loadPhotos();
    try {
      const u = new URL(location.href); u.searchParams.set('id', p.i); if (p._r) u.searchParams.set('r', p._r); else u.searchParams.delete('r');
      history.replaceState(null, '', u.pathname + u.search + location.hash);
    } catch (e) { /* bez URL API */ }
    $('#pd-work').hidden = false;
    renderAll();
    if (!(opts && opts.quiet)) { const h = $('#pd-place'); h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }
  function loadPhotos() {
    const ph = prof().photos || {};
    state.photos = {};
    Object.keys(ph).forEach(a => { state.photos[a] = (ph[a] || []).map(src => ({ src })); });
  }
  function renderAll() {
    renderPlace(); renderClaim(); renderCheck(); renderPreview(); renderWhy(); renderStats(); renderImprove(); renderNav(); renderMine();
  }

  function renderPlace() {
    const p = state.p, c = claimed();
    $('#pd-place').innerHTML = '<div class="wrap pd-place-in">' +
      '<div class="pd-place-txt"><p class="pd-place-cat">' + K.icon((K.CATS[p.c] || {}).icon || 'building') + esc(catLabel(p)) + (p.s && K.t(p.s) !== catLabel(p) ? ' · ' + esc(K.t(p.s)) : '') + '</p>' +
      '<h2 class="pd-place-name">' + esc(p.n) + '</h2>' +
      '<p class="pd-place-meta">' + esc([p.a, p.o, K.krajName(p.k, K.zemeOf(p)), K.ZEME[K.zemeOf(p)]].filter(Boolean).join(', ')) + '</p></div>' +
      '<div class="pd-place-side">' + (c ? K.statusHtml('ok', KP.t('Převzato v tomto prohlížeči')) : K.statusHtml('unk', KP.t('Profil zatím nikdo nepřevzal'))) +
      '<div class="row"><a class="btn btn-ghost btn-sm" href="' + K.placeUrl(p) + '">' + K.icon('eye') + (KP.t('Veřejný detail') + '</a><a class="btn btn-quiet btn-sm" href="#najit" data-other>' + KP.t('Jiný podnik') + '</a></div></div></div>');
  }

  function renderNav() {
    const pr = KC.progress(prof(), state.p.c), c = claimed();
    const items = [
      ['prevzeti', KP.t('Převzetí'), c ? KP.t('hotovo') : KP.t('nezačato'), c ? 'ok' : 'unk'],
      ['checklist', KP.t('Checklist'), pr.pct + ' %', pr.complete ? 'ok' : pr.pct ? 'part' : 'unk'],
      ['nahled', KP.t('Náhled profilu')], ['proc', KP.t('Proč vyplnit')], ['statistiky', KP.t('Statistiky')], ['zlepsit', KP.t('Co zlepšit')], ['sluzby', KP.t('Služby a ceník')],
    ];
    $('#pd-nav').innerHTML = ('<p class="pd-nav-t">' + KP.t('Profil podniku') + '</p><ul>') + items.map(([id, l, s, st]) =>
      '<li><a href="#' + id + '"><span>' + l + '</span>' + (s ? '<small>' + K.statusHtml(st, s) + '</small>' : '') + '</a></li>').join('') + '</ul>';
  }

  // Moje převzaté podniky (v tomto prohlížeči)
  function renderMine() {
    const list = B.claims();
    $('#pd-mine').innerHTML = list.length ? ('<h3 class="pd-mine-h">' + KP.t('Vaše převzaté podniky v tomto prohlížeči') + '</h3><ul class="rule-list pd-mine">') + list.map(c =>
      '<li><a class="rule-row" href="podnik.html?id=' + encodeURIComponent(c.placeId) + (c.place && c.place.r ? '&r=' + encodeURIComponent(c.place.r) : '') + '" data-mine="' + esc(c.placeId) + '"' + (state.p && state.p.i === c.placeId ? ' aria-current="true"' : '') + '>' +
      '<b>' + esc((c.place && c.place.n) || KP.t('Místo')) + '</b><small>' + esc((c.place && c.place.o) || '') + ' · ' + K.t('převzato') + ' ' + K.fmtDate(c.date) + '</small></a></li>').join('') + '</ul>' : '';
  }

  // ---------- 1. Převzetí ----------
  const ROLES = ['majitel nebo majitelka', 'jednatel nebo jednatelka', 'vedoucí provozu', 'pověřený zaměstnanec', 'správce budovy', 'jiná role'];
  function renderClaim() {
    const c = claimed(), box = $('#pd-claim');
    if (c && !state.editClaim) {
      box.innerHTML = '<div class="pd-claimed">' + K.statusHtml('ok', (KP.t('Profil jste převzali') + ' ') + K.fmtDate(c.date)) +
        '<table class="data kv-table pd-kv"><tbody>' +
        [[KP.t('Jméno'), c.name], [KP.t('Role'), c.role && K.t(c.role)], ['E-mail', c.email], [KP.t('Telefon'), c.phone], [KP.t('Poznámka'), c.note]].filter(r => r[1]).map(r => '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>').join('') +
        '</tbody></table>' +
        ('<p class="small pd-note">' + KP.t('Převzetí platí jen v tomto prohlížeči a nikdo ho neověřil. V ostré verzi bychom ověřili, že za podnik opravdu jednáte, třeba kódem poslaným na e-mail nebo telefon uvedený na webu podniku.') + '</p>') +
        ('<div class="row"><a class="btn btn-primary" href="#checklist">' + KP.t('Pokračovat na checklist') + '</a><button type="button" class="btn btn-ghost" data-claim-edit>' + KP.t('Upravit údaje') + '</button>') +
        ('<button type="button" class="btn btn-quiet" data-unclaim data-label="' + KP.t('Zrušit převzetí') + '">' + KP.t('Zrušit převzetí') + '</button></div></div>');
      return;
    }
    const v = c || {};
    box.innerHTML = '<form class="form-block pd-claim-form" id="pd-claim-form" novalidate>' +
      ('<p class="pd-claim-lead">' + KP.t('Převzetím se stanete správcem profilu') + ' <b>') + esc(state.p.n) + ('</b>' + KP.t('. Údaje budou u místa označené jako') + ' <span class="badge badge-business">') + K.icon('building') + (KP.t('Provozovatel') + '</span></p>') +
      ('<div class="pd-two"><div class="field"><label for="cl-name">' + KP.t('Jméno a příjmení') + '</label><input id="cl-name" type="text" autocomplete="name" required value="') + esc(v.name || '') + '"></div>' +
      ('<div class="field"><label for="cl-role">' + KP.t('Vaše role v podniku') + '</label><select id="cl-role" required><option value="">' + KP.t('Vyberte') + '</option>') + ROLES.map(r => '<option value="' + r + '"' + (v.role === r ? ' selected' : '') + '>' + K.t(r) + '</option>').join('') + '</select></div></div>' +
      ('<div class="pd-two"><div class="field"><label for="cl-email">' + KP.t('E-mail') + '</label><input id="cl-email" type="email" autocomplete="email" required value="') + esc(v.email || '') + ('"><span class="hint">' + KP.t('Nejlépe na doméně podniku.') + '</span></div>') +
      ('<div class="field"><label for="cl-phone">' + KP.t('Telefon (nepovinné)') + '</label><input id="cl-phone" type="tel" autocomplete="tel" value="') + esc(v.phone || '') + '"></div></div>' +
      ('<div class="field"><label for="cl-note">' + KP.t('Poznámka (nepovinné)') + '</label><textarea id="cl-note" rows="2" maxlength="1000">') + esc(v.note || '') + '</textarea></div>' +
      '<label class="check"><input type="checkbox" id="cl-ok"' + (c ? ' checked' : '') + ('> ' + KP.t('Prohlašuji, že jsem oprávněn(a) spravovat údaje o tomto podniku a že je budu uvádět pravdivě.') + '</label>') +
      '<p class="pd-err" id="cl-err" role="alert" hidden></p>' +
      '<p class="small pd-note">' + esc(K.PROTOTYPE_NOTE) + (' ' + KP.t('Nic se nikam neodesílá a nikdo vás nebude kontaktovat.') + '</p>') +
      '<div class="row"><button class="btn btn-primary btn-lg" type="submit">' + (c ? KP.t('Uložit změny') : KP.t('Převzít profil')) + '</button>' + (c ? ('<button class="btn btn-quiet" type="button" data-claim-cancel>' + KP.t('Zrušit úpravy') + '</button>') : '') + '</div></form>';
  }
  function submitClaim(e) {
    e.preventDefault();
    const f = e.target, err = $('#cl-err'), miss = [];
    const val = (id) => $('#' + id, f).value.trim();
    if (!val('cl-name')) miss.push(KP.t('jméno'));
    if (!val('cl-role')) miss.push('role');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val('cl-email'))) miss.push(KP.t('platný e-mail'));
    if (!$('#cl-ok', f).checked) miss.push(KP.t('prohlášení'));
    if (miss.length) { err.hidden = false; err.textContent = K.t('Doplňte prosím') + ': ' + miss.join(', ') + '.'; return; }
    const r = B.claim(state.p.i, { name: val('cl-name'), role: val('cl-role'), email: val('cl-email'), phone: val('cl-phone'), note: val('cl-note') });
    if (!r) { err.hidden = false; err.textContent = KP.t('Uložení se nepovedlo. Úložiště prohlížeče je plné nebo vypnuté.'); return; }
    const first = !state.editClaim;
    state.editClaim = false;
    renderAll();
    K.toast(first ? KP.t('Profil převzat. Uloženo jen v tomto prohlížeči.') : KP.t('Údaje uloženy v tomto prohlížeči.'));
    if (first) goSection('checklist');
  }
  function goSection(id) {
    const s = document.getElementById(id); if (!s) return;
    s.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const h = s.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  // ---------- 2. Checklist krok za krokem ----------
  function renderCheck() {
    const box = $('#pd-check'), steps = KC.steps(state.p.c), pr = KC.progress(prof(), state.p.c);
    if (!claimed()) {
      box.innerHTML = '<div class="pd-locked"><p>' + K.icon('info') + (KP.t('Checklist se odemkne po převzetí profilu. Pro') + ' <b>') + esc(K.lc(catLabel(state.p))) + ('</b> ' + KP.t('se budeme ptát na') + ':</p>') +
        '<ol class="pd-step-preview">' + steps.map(s => '<li><b>' + s.label + '</b><span>' + plural(s.items.length, KP.t('údaj'), KP.t('údaje'), KP.t('údajů')) + (s.photos.length ? ', ' + plural(s.photos.length, 'fotka', 'fotky', 'fotek') : '') + '</span></li>').join('') + '</ol>' +
        ('<a class="btn btn-primary" href="#prevzeti">' + KP.t('Převzít profil') + '</a></div>');
      return;
    }
    const n = steps.length, i = Math.min(state.step, n);
    const nav = ('<ol class="ck-steps" aria-label="' + KP.t('Kroky checklistu') + '">') + steps.map((s, k) => {
      const b = pr.byStep[k];
      return '<li><button type="button" data-step="' + k + '"' + (k === i ? ' aria-current="step"' : '') + ' class="' + (b.done === b.total ? 'is-done' : b.done ? 'is-part' : '') + '">' +
        '<span class="ck-st-n">' + String(k + 1).padStart(2, '0') + '</span><span class="ck-st-l">' + s.label + '</span><span class="ck-st-c">' + b.done + '/' + b.total + '</span></button></li>';
    }).join('') + '<li><button type="button" data-step="' + n + '"' + (i === n ? ' aria-current="step"' : '') + ' class="' + (pr.complete ? 'is-done' : '') + '"><span class="ck-st-n">' + String(n + 1).padStart(2, '0') + '</span><span class="ck-st-l">' + K.t('Popis a souhrn') + '</span><span class="ck-st-c">' + pr.pct + ' %</span></button></li></ol>';
    const meter = ('<div class="pd-progress"><div class="pd-meter" role="img" aria-label="' + KP.t('Checklist vyplněn na ')) + pr.pct + ' %"><span style="width:' + pr.pct + '%"></span></div>' +
      '<p class="small">' + (pr.complete ? K.statusHtml('ok', K.t('Kompletní profil')) + ' ' + K.t('Všechny údaje i fotky jsou vyplněné.') : K.t('Vyplněno {a} z {b} údajů a {c} z {d} fotek.', { a: pr.done, b: pr.total, c: pr.photosDone, d: pr.photosTotal })) +
      ' <span class="pd-saved" id="ck-saved" aria-live="polite">' + (prof().updated ? K.t('Naposledy uloženo {d}, jen v tomto prohlížeči.', { d: K.fmtDate(prof().updated) }) : '') + '</span></p></div>';
    let body;
    if (i < n) {
      const s = steps[i], vals = prof().values || {};
      body = '<div class="ck-panel" id="ck-panel"><h3 class="ck-h" tabindex="-1">' + K.icon(s.icon) + K.t('Krok {i} z {n}', { i: i + 1, n: n + 1 }) + ': ' + s.label + '</h3><p class="ck-intro">' + esc(s.intro) + '</p>' +
        s.items.map(c => KC.fieldHtml(c, vals[c.key], PFX, state.p)).join('') +
        s.photos.map(ph => KC.photoSlotHtml(ph, state.photos[ph.key] || [], PFX, MAX_PH)).join('') +
        ('<p class="small ck-help">' + KP.t('Nevíte si rady s měřením?') + ' <a href="metodika.html#mereni" target="_blank" rel="noopener">' + KP.t('Jak měřit dveře, schody, rampu a WC') + '</a>' + KP.t('. Prázdné pole nevadí, je lepší nevyplnit než hádat.') + '</p></div>');
    } else {
      const vals = prof().values || {};
      body = '<div class="ck-panel" id="ck-panel"><h3 class="ck-h" tabindex="-1">' + K.icon('list') + K.t('Krok {i} z {n}', { i: n + 1, n: n + 1 }) + ': ' + K.t('Popis a souhrn') + '</h3>' +
        ('<div class="field"><label for="ck-desc">' + KP.t('Popis přístupnosti vlastními slovy') + '</label><p class="ck-how" id="ck-desc-how">' + KP.t('Co by měl vědět host, který přijede poprvé. Třeba kde je bezbariérový vstup, jestli je potřeba zazvonit, kde je klíč od WC.') + '</p>') +
        '<textarea id="ck-desc" rows="4" maxlength="3000" aria-describedby="ck-desc-how">' + esc(prof().description || '') + '</textarea></div>' +
        ('<h4 class="ck-sum-h">' + KP.t('Souhrn vyplněných údajů') + '</h4><div class="table-wrap"><table class="data ck-sum"><tbody>') +
        steps.map((s, k) => '<tr class="ck-sum-area"><th colspan="2" scope="colgroup">' + s.label + ' <button type="button" class="btn btn-quiet btn-sm" data-step="' + k + ('">' + KP.t('Upravit') + '<span class="sr-only"> ') + s.label + '</span></button></th></tr>' +
          s.items.map(c => { const t = KC.valueText(c, vals[c.key]); return '<tr><td>' + esc(c.label) + '</td><td>' + (t ? esc(t) : ('<span class="muted">' + KP.t('nevyplněno') + '</span>')) + '</td></tr>'; }).join('') +
          s.photos.map(ph => { const nph = (state.photos[ph.key] || []).length; return '<tr><td>' + K.t('Fotka') + ': ' + esc(ph.label) + '</td><td>' + (nph ? plural(nph, 'fotka', 'fotky', 'fotek') : '<span class="muted">' + K.t('chybí') + '</span>') + '</td></tr>'; }).join('')).join('') +
        '</tbody></table></div></div>';
    }
    const navBtns = '<div class="ck-nav">' + (i > 0 ? ('<button type="button" class="btn btn-ghost" data-prev>' + KP.t('Zpět') + '</button>') : '<span></span>') +
      (i < n ? ('<button type="button" class="btn btn-primary" data-next>' + KP.t('Uložit a pokračovat') + '</button>') : ('<button type="button" class="btn btn-primary" data-finish>' + KP.t('Uložit profil') + '</button>')) + '</div>';
    box.innerHTML = meter + nav + body + navBtns + '<p class="pd-err" id="ck-err" role="alert" hidden></p>';
    bindPhotoInputs();
  }
  function bindPhotoInputs() {
    $$('#pd-check [data-ph-add]').forEach(inp => inp.addEventListener('change', () => {
      const a = inp.dataset.phAdd, list = (state.photos[a] = state.photos[a] || []);
      Array.from(inp.files || []).filter(f => /^image\//.test(f.type)).forEach(f => {
        if (list.length >= MAX_PH) { K.toast(K.t('K této části nejvýš {n} fotky.', { n: MAX_PH })); return; }
        list.push({ src: URL.createObjectURL(f), file: f });
      });
      keepValues(() => renderCheck());
      const add = $('#pd-check [data-photo="' + a + '"] .ck-ph-add') || $('#pd-check [data-photo="' + a + '"] h4');
      if (add) add.focus();
    }));
  }
  // Překreslení kroku bez ztráty rozepsaných hodnot (uloží je do paměti a vrátí zpět)
  function keepValues(fn) {
    const panel = $('#ck-panel'); const snap = {};
    if (panel) $$('input:not([type=file]), textarea', panel).forEach(el => { snap[el.id || el.name + '=' + el.value] = el.type === 'radio' ? el.checked : el.value; });
    fn();
    const p2 = $('#ck-panel'); if (!p2) return;
    $$('input:not([type=file]), textarea', p2).forEach(el => {
      const k = el.id || el.name + '=' + el.value;
      if (!(k in snap)) return;
      if (el.type === 'radio') el.checked = snap[k]; else el.value = snap[k];
    });
  }
  // Uloží aktuální krok → Promise<bool>
  function saveStep() {
    const steps = KC.steps(state.p.c), i = state.step, panel = $('#ck-panel'), err = $('#ck-err');
    const data = {};
    if (i < steps.length) {
      const s = steps[i];
      data.values = KC.read(panel, PFX, s.items);
      const bad = s.items.filter(c => ['cm', 'pct', 'count'].includes(c.type)).find(c => { const el = $('#' + PFX + '-' + c.key, panel); return el && el.value.trim() !== '' && !el.checkValidity(); });
      if (bad) { err.hidden = false; err.textContent = K.t('Zkontrolujte údaj „{f}“. Číslo je mimo rozsah.', { f: bad.label }); $('#' + PFX + '-' + bad.key, panel).focus(); return Promise.resolve(false); }
      if (s.photos.length) { data.photos = {}; s.photos.forEach(ph => { data.photos[ph.key] = (state.photos[ph.key] || []).map(x => x.file || x.src); }); }
    } else {
      data.description = $('#ck-desc', panel).value.trim();
    }
    const btns = $$('#pd-check .ck-nav button'); btns.forEach(b => { b.disabled = true; });
    return B.saveProfile(state.p.i, data).then(r => {
      btns.forEach(b => { b.disabled = false; });
      if (!r.ok) { err.hidden = false; err.textContent = r.error; return false; }
      Object.values(state.photos).forEach(l => l.forEach(x => { if (x.file) URL.revokeObjectURL(x.src); }));
      loadPhotos();
      return true;
    });
  }
  function goStep(k, focus) {
    state.step = k;
    renderCheck(); renderPreview(); renderWhy(); renderImprove(); renderNav();
    if (focus !== false) {
      const h = $('#pd-check .ck-h'); if (h) { h.focus({ preventScroll: true }); const sec = $('#checklist'); if (sec.getBoundingClientRect().top < 0 || $('#ck-panel').getBoundingClientRect().top > innerHeight) $('#pd-check .ck-steps').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    }
  }

  // ---------- 3. Náhled veřejného profilu ----------
  function scoreText(v) { return v === null || v === undefined ? '–' : v + ' %'; }
  function featState(v) { return v === true ? ['ok', KP.t('Ano')] : v === 'part' ? ['part', KP.t('Částečně')] : v === false ? ['no', KP.t('Ne')] : ['unk', KP.t('Netýká se')]; }
  function srcBadge(k) {
    if (k.local) return '<span class="badge badge-business">' + K.icon('building') + (KP.t('Provozovatel, jen zde') + '</span>');
    return K.sourceBadge(k.src);
  }
  function renderPreview() {
    const p = state.p, s = K.facilitiesScore(p), pr = KC.progress(prof(), p.c), pf = prof();
    const areaRows = s.relevant.map(a => {
      const d = s.detail[a] || {}, pct = d.pct;
      return '<li class="pv-area"><span class="pv-a-l">' + K.AREAS[a] + '</span>' +
        '<span class="pv-bar" role="img" aria-label="' + K.AREAS[a] + ': ' + (pct === null ? K.t('bez údajů') : pct + ' %') + '"><span style="width:' + (pct || 0) + '%"></span></span>' +
        '<span class="pv-a-v">' + (pct === null ? ('<span class="muted">' + KP.t('bez údajů') + '</span>') : '<b>' + pct + ' %</b>') + '</span>' +
        '<small class="pv-a-d">' + K.t('{k} z {n} prvků známe', { k: d.known || 0, n: d.tracked || 0 }) + '</small></li>';
    }).join('');
    const known = s.known.slice().sort((x, y) => s.relevant.indexOf(x.area) - s.relevant.indexOf(y.area));
    const feats = known.length ? '<ul class="rule-list pv-feats">' + known.map(k => { const [st, t] = featState(k.v); return '<li class="pv-feat"><span class="pv-f-l">' + esc(k.label) + '<small>' + K.AREAS[k.area] + (k.note && k.note !== k.label ? ' · ' + esc(k.note) : '') + '</small></span>' + K.statusHtml(st, t) + srcBadge(k) + '</li>'; }).join('') + '</ul>'
      : ('<p class="pd-empty">' + KP.t('O vybavení místa zatím nevíme nic. Návštěvníci uvidí „Chybí údaje“.') + '</p>');
    const phAreas = Object.keys(pf.photos || {}).filter(a => (pf.photos[a] || []).length);
    const photos = phAreas.length ? '<ul class="pv-photos">' + [].concat(...phAreas.map(a => pf.photos[a].map((src, i) => '<li><figure class="photo"><img src="' + esc(src) + '" alt="' + esc((B.PHOTO_AREAS.find(x => x.key === a) || {}).label || a) + ', fotka ' + (i + 1) + '"><figcaption><span class="badge badge-tape">' + esc((B.PHOTO_AREAS.find(x => x.key === a) || {}).label || a) + ('</span> ' + KP.t('od provozovatele') + '</figcaption></figure></li>')))).join('') + '</ul>'
      : ('<p class="pd-empty">' + KP.t('Zatím žádné fotky od provozovatele.') + '</p>');
    const userPh = C.photos(p.i).filter(x => x.from === 'review').length;
    $('#pd-preview').innerHTML =
      '<div class="pv-top">' +
        ('<div class="tile pv-tile"><span class="k">' + KP.t('Accessibility Facilities Score') + '</span><span class="v pv-big">') + scoreText(s.total) + ('</span><small>' + KP.t('Podíl sledovaných prvků, které místo prokazatelně nabízí.') + '</small></div>') +
        ('<div class="tile pv-tile"><span class="k">' + KP.t('Úplnost checklistu') + '</span><span class="v pv-big">') + pr.pct + ' %</span><small>' + K.t('{a} z {b} údajů, {c} z {d} fotek.', { a: pr.done, b: pr.total, c: pr.photosDone, d: pr.photosTotal }) + '</small></div>' +
        ('<div class="tile pv-tile"><span class="k">' + KP.t('Údaje, které známe') + '</span><span class="v pv-big">') + s.coverage + (' %</span><small>' + KP.t('Ze všech zdrojů dohromady.') + '</small></div>') +
      '</div>' +
      '<div class="pv-marks">' + (pr.complete ? '<span class="pv-mark is-on">' + K.icon('check') + (KP.t('Kompletní profil') + '</span>') : '<span class="pv-mark">' + K.icon('info') + K.t('Profil není kompletní: chybí {n}', { n: plural(pr.missing.length, KP.t('položka'), KP.t('položky'), KP.t('položek')) }) + '</span>') +
        '<span class="pv-mark">' + K.icon('shield') + (KP.t('Neověřeno nezávisle') + '</span></div>') +
      ('<p class="small muted pv-expl">' + KP.t('Skóre počítá jen prvky, o kterých víme. Neznámé ho nesnižují ani nezvyšují. Údaje z checklistu jsou označené jako „Provozovatel“, dokud je mapovač neověří.') + ' <a href="metodika.html#overeni">' + KP.t('Úrovně ověření') + '</a></p>') +
      ('<h3 class="pv-h">' + KP.t('Skóre po oblastech') + '</h3><ul class="pv-areas">') + areaRows + '</ul>' +
      ('<h3 class="pv-h">' + KP.t('Vybavení, které návštěvníci uvidí') + '</h3>') + feats +
      ('<h3 class="pv-h">' + KP.t('Fotky') + '</h3>') + photos + (userPh ? '<p class="small">' + K.t('Návštěvníci k místu přidali v tomto prohlížeči {n}.', { n: plural(userPh, 'fotku', 'fotky', 'fotek') }) + '</p>' : '') +
      (pf.description ? ('<h3 class="pv-h">' + KP.t('Popis od provozovatele') + '</h3><p class="pv-desc">') + esc(pf.description) + '</p>' : '') +
      '<p class="small pd-note">' + esc(K.PROTOTYPE_NOTE) + (' ' + KP.t('Veřejný detail místa ukáže vaše údaje jen v tomto prohlížeči.') + ' <a href="') + K.placeUrl(p) + ('">' + KP.t('Otevřít detail místa') + '</a></p>');
  }

  // ---------- 4. Proč vyplnit ----------
  function renderWhy() {
    const p = state.p, pr = KC.progress(prof(), p.c), hasWc = !['parkovani', 'priroda'].includes(p.c);
    const needs = Object.assign({}, K.DEFAULT_NEEDS, { active: true, aid: KP.t('mechanický vozík'), needWc: hasWc, needParking: p.c === 'parkovani' });
    const ms = K.matchScore(p, needs), reqs = C.requests(p.i);
    const who = hasWc ? K.t('Návštěvník na mechanickém vozíku, který potřebuje bezbariérové WC,') : K.t('Návštěvník na mechanickém vozíku');
    $('#pd-why').innerHTML = '<ul class="rule-grid pd-why">' +
      ('<li><h3>' + KP.t('Uvidí vás ti, kdo hledají') + '</h3><p>' + KP.t('Lidé si v mapě nastaví své potřeby a filtrují. Místo s vyplněnými údaji se jim ukáže jako „vyhovuje“, místo bez údajů jako „chybí údaje“.') + '</p>') +
        '<p class="pd-live">' + who + ' ' + K.t('u vás teď uvidí') + ': ' + K.statusHtml(ms.status, K.STATUS_LABEL[ms.status]) + '<small>' + (ms.pct !== null ? K.t('{pct} % shoda', { pct: ms.pct }) + ', ' : '') + K.t('známe {k} z {n} údajů. Spočítáno z dat, která o místě máme.', { k: ms.known, n: ms.total }) + '</small></p></li>' +
      ('<li><h3>' + KP.t('Označení „Kompletní profil“') + '</h3><p>' + KP.t('Když vyplníte všechny údaje a fotky z checklistu, profil dostane označení, které návštěvník vidí hned ve výsledcích.') + '</p>') +
        '<p class="pd-live">' + (pr.complete ? K.statusHtml('ok', KP.t('Váš profil je kompletní')) : K.statusHtml('part', K.t('Chybí {n}', { n: plural(pr.missing.length, KP.t('položka'), KP.t('položky'), KP.t('položek')) }))) + '</p></li>' +
      ('<li><h3>' + KP.t('Odpovíte na žádosti zákazníků') + '</h3><p>' + KP.t('U místa bez údajů může návštěvník kliknout na „Požádat o informace o přístupnosti“. Žádost přijde vám a uvidíte, které oblasti lidi zajímají.') + '</p>') +
        '<p class="pd-live">' + (reqs.length ? K.t('{n} zadané v tomto prohlížeči.', { n: plural(reqs.length, KP.t('žádost'), KP.t('žádosti'), KP.t('žádostí')) }) + ' <a href="#statistiky">' + K.t('Zobrazit') + '</a>' : KP.t('V tomto prohlížeči zatím nikdo o údaje nepožádal.')) + '</p></li>' +
      ('<li><h3>' + KP.t('Ukažte, co máte') + '</h3><p>' + KP.t('Fotka vstupu, toalety nebo koupelny řekne víc než číslo. Host se rozhodne dřív a nemusí volat.') + '</p></li>') +
      '</ul>';
  }

  // ---------- 5. Statistiky (jen tento prohlížeč) ----------
  function renderStats() {
    const p = state.p, st = B.stats(p.i), reqs = C.requests(p.i), reps = C.reports(p.i);
    const rows = [
      [st.views, KP.t('Zobrazení detailu místa'), 'eye'], [st.impressions, KP.t('Výskyt ve výsledcích hledání a v mapě'), 'search'],
      [st.requests, KP.t('Žádosti o informace o přístupnosti'), 'message'], [st.reports, KP.t('Nahlášené změny'), 'flag'],
      [st.reviews, KP.t('Hodnocení a zkušenosti'), 'star'], [st.photos, KP.t('Fotky od návštěvníků'), 'camera'], [st.confirmations, KP.t('Potvrzené nebo zpochybněné údaje'), 'check'],
    ];
    const any = rows.some(r => r[0] > 0);
    const FL = {}; K.FEATURES.forEach(f => { FL[f.k] = f.label; });
    $('#pd-stats').innerHTML =
      ('<p class="callout pd-stat-note"><b>' + KP.t('Jen tento prohlížeč.') + '</b> ' + KP.t('Počítáme jen to, co se stalo v tomto prohlížeči, třeba když jste si sami otevřeli detail místa nebo zadali žádost. Nejsou to skutečné návštěvy. V ostré verzi tu budou skutečné statistiky ze všech návštěv.') + '</p>') +
      (any ? '' : ('<p class="pd-empty">' + KP.t('Zatím žádná událost. Otevřete') + ' <a href="') + K.placeUrl(p) + ('">' + KP.t('detail místa') + '</a> ' + KP.t('nebo ho najděte v') + ' <a href="mapa.html">' + KP.t('mapě') + '</a> ' + KP.t('a čísla se tu změní.') + '</p>')) +
      '<ul class="rule-list pd-stat-list">' + rows.map(([n, l, ic]) => '<li class="pd-stat-row">' + K.icon(ic) + '<span>' + l + '</span><b class="num">' + n + '</b></li>').join('') + '</ul>' +
      (st.first ? '<p class="small muted">' + K.t('První událost {a}, poslední {b}.', { a: K.fmtDate(st.first), b: K.fmtDate(st.last) }) + '</p>' : '') +
      (reqs.length ? ('<h3 class="pv-h">' + KP.t('Žádosti o informace') + '</h3><ul class="rule-list pd-req">') + reqs.map(r => '<li class="rule-row"><span class="num">' + K.fmtDate(r.date) + '</span><span>' + (r.areas && r.areas.length ? (KP.t('Zajímá') + ': ') + r.areas.map(a => K.AREAS[a] || a).join(', ') : KP.t('Bez upřesnění oblasti')) + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</span></li>').join('') + '</ul>' : '') +
      (reps.length ? ('<h3 class="pv-h">' + KP.t('Nahlášené změny') + '</h3><ul class="rule-list pd-req">') + reps.map(r => '<li class="rule-row"><span class="num">' + K.fmtDate(r.date) + '</span><span>' + (r.field ? '<b>' + esc(FL[r.field] || r.field) + ':</b> ' : '') + esc(r.text || '') + '</span></li>').join('') + '</ul>' : '');
  }

  // ---------- 6. Co zlepšit ----------
  // Doporučení k prvkům, které místo nemá nebo má jen částečně. Mezní hodnoty podle metodiky POV (metodika.html#prahy).
  const ADVICE = {
    bezSchodu: KP.t('U vstupu jsou schody. Pomůže rampa: do délky 3 m nejvýš 12,5 %, do 9 m nejvýš 8 %, široká aspoň 110 cm. Jiná možnost je bezbariérový boční vstup se zvonkem.'),
    dvere80: KP.t('Vstupní dveře jsou užší než 80 cm. Pomůže otevírat obě křídla, nebo dveře s širším křídlem. Pro částečnou přístupnost stačí 70 cm.'),
    prah2: KP.t('Práh je vyšší než 2 cm. Pomůže náběhový klín nebo snížení prahu. Do 7 cm je vstup jen částečně přístupný.'),
    wcBb: KP.t('Chybí bezbariérové WC. Kabina WC I má aspoň 160 × 160 cm, dveře 80 cm otevírané ven a volné místo 80 cm vedle mísy.'),
    wcDvere80: KP.t('Dveře WC jsou užší než 80 cm. Dveře by se měly otevírat ven, aby šly zavřít i s vozíkem uvnitř.'),
    wcMadla: KP.t('Doplňte madla u mísy, aspoň jedno sklopné na straně volného místa pro přesednutí.'),
    wcOtoceni: KP.t('V kabině WC chybí volná plocha 150 × 150 cm pro otočení vozíku. Zkontrolujte, jestli plochu nezabírá vybavení, které jde přesunout.'),
    prostory: KP.t('Část hlavních prostor není na vozíku dostupná. Uveďte aspoň, které části přístupné jsou.'),
    vytah: KP.t('Bez výtahu jsou vyšší podlaží nedostupná. Možnost je schodišťová plošina, nebo služby v přízemí. Kabina výtahu má mít aspoň 100 × 125 cm a dveře 80 cm.'),
    pruchody80: KP.t('Některé dveře nebo průchody uvnitř jsou užší než 80 cm. Pro částečnou přístupnost stačí 70 cm.'),
    otoceni: KP.t('Chybí volný prostor 150 × 150 cm pro otočení vozíku. Pomůže přestavět nábytek.'),
    parkZTP: KP.t('U vstupu není vyhrazené stání pro ZTP. Kolmé stání má být široké 350 cm a co nejblíž vstupu.'),
    parkSirka: KP.t('Stání ZTP je užší než 350 cm. Vedle auta pak není místo pro vozík.'),
    pokojBb: KP.t('Chybí bezbariérový pokoj. Zrušená vyhláška 398/2009 Sb. požadovala u hotelů aspoň 5 % bezbariérových pokojů.'),
    pokojDvere80: KP.t('Dveře pokoje nebo koupelny jsou užší než 80 cm.'),
    sprcha: KP.t('Sprcha není v úrovni podlahy. Host na vozíku potřebuje sprchu bez vaničky a bez obrubníku.'),
    sedatko: KP.t('Ve sprše chybí sedátko. Sklopné sedátko na stěnu se dá doplnit bez stavební úpravy.'),
    koupelnaMadla: KP.t('V koupelně chybí madla u sprchy a u WC.'),
  };
  function measureAdvice(p) {
    const m = K.facts(p).m, out = [];
    const s = m.sklonPct && m.sklonPct.v;
    if (s > 16.5) out.push({ st: 'no', label: K.t('Sklon rampy') + ' ' + K.fmt(s) + ' %', text: KP.t('Rampa je strmější než 16,5 %. Podle metodiky je nepřístupná při jakékoli délce. Pomůže delší rampa s mezipodestou nebo plošina.') });
    else if (s > 12.5) out.push({ st: 'part', label: K.t('Sklon rampy') + ' ' + K.fmt(s) + ' %', text: KP.t('Rampa do délky 3 m je s tímto sklonem jen částečně přístupná, delší rampa je nepřístupná. Přístupná rampa má do 3 m nejvýš 12,5 %, do 9 m nejvýš 8 %.') });
    else if (s > 8) out.push({ st: 'part', label: K.t('Sklon rampy') + ' ' + K.fmt(s) + ' %', text: KP.t('Rampa nad 8 %: do délky 3 m vyhovuje, delší rampa je jen částečně přístupná. Zapište do popisu délku rampy.') });
    if (m.postelProstorCm && m.postelProstorCm.v < 150) out.push({ st: 'part', label: K.t('Prostor vedle postele') + ' ' + K.fmt(m.postelProstorCm.v) + ' cm', text: KP.t('Vedle postele je méně než 150 cm, tedy méně než kruh pro otočení vozíku. Napište do popisu, z které strany se dá přesednout.') });
    return out;
  }
  function loadKraje() {
    if (!state.krajeP) state.krajeP = fetch('data/kraje_info.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => (state.kraje = d)).catch(() => (state.kraje = false));
    return state.krajeP;
  }
  function renderImprove() {
    const p = state.p, imp = B.improvements(p), steps = KC.steps(p.c), isClaimed = !!claimed();
    const fixes = imp.filter(x => x.state !== 'missing').map(x => ({ st: x.state, label: x.label, text: ADVICE[x.key] || '' })).concat(measureAdvice(p));
    const miss = imp.filter(x => x.state === 'missing');
    const stepOf = (a) => steps.findIndex(s => s.a === a);
    const byArea = {}; miss.forEach(m => { (byArea[m.area] = byArea[m.area] || []).push(m); });
    const fixHtml = fixes.length ? '<ul class="rule-list pd-adv">' + fixes.map(f => '<li class="pd-adv-row">' + K.statusHtml(f.st, f.st === 'no' ? KP.t('Nemá') : KP.t('Částečně')) + '<div><b>' + esc(f.label) + '</b>' + (f.text ? '<p>' + esc(f.text) + '</p>' : '') + '</div></li>').join('') + '</ul>' +
      ('<p class="small">' + KP.t('Mezní hodnoty podle') + ' <a href="metodika.html#prahy">' + KP.t('metodiky kategorizace přístupnosti') + '</a> ' + KP.t('Pražské organizace vozíčkářů.') + '</p>')
      : '<p class="pd-empty">' + (K.facilitiesScore(p).known.length ? KP.t('U prvků, o kterých víme, nevidíme nic, co by chybělo.') : KP.t('Zatím nevíme, co místo má. Vyplňte checklist a doporučení se tu objeví.')) + '</p>';
    const missHtml = miss.length ? '<ul class="rule-list pd-miss">' + Object.keys(byArea).map(a => {
      const k = stepOf(a);
      return '<li class="pd-miss-row"><div><b>' + K.AREAS[a] + '</b><small>' + byArea[a].map(m => esc(m.label)).join(' · ') + '</small></div>' +
        (k >= 0 ? (isClaimed ? '<button type="button" class="btn btn-ghost btn-sm" data-goto-step="' + k + ('">' + KP.t('Doplnit') + '</button>') : ('<a class="btn btn-quiet btn-sm" href="#prevzeti">' + KP.t('Převzít a doplnit') + '</a>')) : '') + '</li>';
    }).join('') + '</ul>' : ('<p class="pd-empty">' + KP.t('Všechny sledované prvky jsou vyplněné.') + '</p>');
    $('#pd-improve').innerHTML = ('<h3 class="pv-h">' + KP.t('Co upravit') + '</h3>') + fixHtml +
      ('<h3 class="pv-h">' + KP.t('Co doplnit') + '</h3><p class="small muted">' + KP.t('Tyto údaje o místě zatím nikdo nezadal. Neznamená to, že chybí.') + '</p>') + missHtml +
      ('<h3 class="pv-h">' + KP.t('Kde hledat podporu a radu') + '</h3><div id="pd-support"><p class="small muted">' + KP.t('Načítám přehled pro váš kraj…') + '</p></div>');
    loadKraje().then(() => renderSupport());
  }
  function renderSupport() {
    const box = $('#pd-support'); if (!box || !state.p) return;
    const p = state.p, z = K.zemeOf(p), d = state.kraje, kr = d && d.kraje ? d.kraje[p.k] : null;
    const link = (x) => '<li><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.t) + '</a></li>';
    let html = '';
    if (z === 'de') {
      html = ('<p>' + KP.t('Přehled dotací a poradenství pro Bavorsko zatím nemáme. Co jsme o bavorské straně zjistili, je v části') + ' <a href="zdroje.html#bavorsko">' + KP.t('Zdroje a trh: Bavorsko') + '</a>.</p>');
    } else {
      html += ('<div class="pd-sup-block"><h4>' + KP.t('Celostátní programy') + '</h4><p>' + KP.t('Programy na odstraňování bariér, které jsme našli, jsou určené') + ' <b>' + KP.t('obcím') + '</b>, ' + KP.t('ne podnikům') + ': <a href="https://mmr.gov.cz/Narodni-dotace/Podpora-a-rozvoj-regionu/Podpora-pro-odstranovani-barier-v-budovach-pro-(6)" target="_blank" rel="noopener">' + KP.t('MMR, Podpora pro odstraňování bariér v budovách') + '</a> ' + KP.t('(poslední ověřený ročník 2025) a') + ' <a href="https://vlada.gov.cz/cz/ppov/vvzpo/program-mobility/program-mobility-79350/" target="_blank" rel="noopener">' + KP.t('Národní program přístupnosti pro všechny 2026–2035') + '</a>' + KP.t('. Program přímo pro podniky jsme nenašli. Pokud jste v budově obce, zeptejte se na obecním úřadě. Přehled') + ': <a href="zdroje.html#financovani">' + KP.t('Zdroje a trh: Financování') + '</a>.</p></div>');
      if (kr) {
        if ((kr.dotace || []).length) html += '<div class="pd-sup-block"><h4>' + K.t('Dotace kraje') + ' (' + esc(K.krajName(p.k, 'cz')) + ')</h4><ul class="pd-links">' + kr.dotace.map(link).join('') + ('</ul><p class="small muted">' + KP.t('Podmínky a oprávněné žadatele si ověřte u programu.') + '</p></div>');
        else html += '<div class="pd-sup-block"><h4>' + K.t('Dotace kraje') + ' (' + esc(K.krajName(p.k, 'cz')) + (')</h4><p>' + KP.t('V přehledu dotací kraje jsme program na odstraňování bariér nenašli.') + ' <a href="zdroje.html#financovani">' + KP.t('Jak jsme hledali') + '</a></p></div>');
        if ((kr.plan || []).length) html += ('<div class="pd-sup-block"><h4>' + KP.t('Krajský plán') + '</h4><ul class="pd-links">') + kr.plan.map(link).join('') + '</ul></div>';
        if ((kr.organizace || []).length) html += ('<div class="pd-sup-block"><h4>' + KP.t('Kdo poradí') + '</h4><p class="small">' + KP.t('Organizace lidí s postižením ve vašem kraji. Mohou poradit s úpravou nebo zprostředkovat mapovače.') + '</p><ul class="pd-links">') + kr.organizace.map(link).join('') + '</ul></div>';
        if (d.checked_date) html += '<p class="small muted">' + K.t('Odkazy jsme zkontrolovali {d}.', { d: K.fmtDate(d.checked_date) }) + '</p>';
      } else if (d === false) html += ('<p class="small muted">' + KP.t('Přehled pro kraj se nepodařilo načíst.') + '</p>');
      html += ('<p class="small">' + KP.t('Seznam dodavatelů ramp, madel a plošin zatím nemáme. Pomoc s výběrem úprav nabízíme jako službu') + ' <a href="#sluzby">' + KP.t('poradenství') + '</a> ' + KP.t('(návrh).') + '</p>');
    }
    box.innerHTML = html;
  }

  // ---------- Události ----------
  function bind() {
    $('#pd-work').addEventListener('submit', e => { if (e.target.id === 'pd-claim-form') submitClaim(e); });
    $('#pd-work').addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-other]')) { e.preventDefault(); $('#pd-q').focus(); $('#najit').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
      if (t.closest('[data-claim-edit]')) { state.editClaim = true; renderClaim(); $('#cl-name').focus(); return; }
      if (t.closest('[data-claim-cancel]')) { state.editClaim = false; renderClaim(); return; }
      const un = t.closest('[data-unclaim]');
      if (un) {
        if (un.dataset.armed) { B.unclaim(state.p.i); state.step = 0; renderAll(); K.toast(KP.t('Převzetí zrušeno. Vyplněné údaje zůstaly uložené v tomto prohlížeči.')); return; }
        un.dataset.armed = '1'; un.textContent = KP.t('Opravdu zrušit? Klikněte znovu');
        setTimeout(() => { if (un.isConnected) { delete un.dataset.armed; un.textContent = un.dataset.label; } }, 4000);
        return;
      }
      const rm = t.closest('[data-ph-rm]');
      if (rm) { const l = state.photos[rm.dataset.phRm] || []; const x = l.splice(Number(rm.dataset.i), 1)[0]; if (x && x.file) URL.revokeObjectURL(x.src); keepValues(() => renderCheck()); const s = $('#pd-check [data-photo="' + rm.dataset.phRm + '"] h4'); if (s) { s.setAttribute('tabindex', '-1'); s.focus(); } return; }
      const st = t.closest('#pd-check [data-step]');
      if (st) { const k = Number(st.dataset.step); saveStep().then(ok => { if (ok) goStep(k); }); return; }
      if (t.closest('[data-next]')) { saveStep().then(ok => { if (ok) { goStep(state.step + 1); } }); return; }
      if (t.closest('[data-prev]')) { saveStep().then(ok => { if (ok) goStep(state.step - 1); }); return; }
      if (t.closest('[data-finish]')) {
        saveStep().then(ok => { if (!ok) return; goStep(state.step, false); const sv = $('#ck-saved'); if (sv) sv.textContent = (KP.t('Uloženo') + ' ') + K.fmtDate(prof().updated) + (', ' + KP.t('jen v tomto prohlížeči.')); K.toast(KP.t('Profil uložen v tomto prohlížeči.')); goSection('nahled'); });
        return;
      }
      const gs = t.closest('[data-goto-step]');
      if (gs) { state.step = Number(gs.dataset.gotoStep); renderCheck(); renderNav(); goSection('checklist'); setTimeout(() => { const h = $('#pd-check .ck-h'); if (h) h.focus({ preventScroll: true }); }, 400); }
    });
    $('#pd-mine').addEventListener('click', e => {
      const a = e.target.closest('[data-mine]'); if (!a) return;
      e.preventDefault();
      const id = a.dataset.mine, c = B.claimed(id);
      K.findPlace(id, c && c.place && c.place.r).then(p => { if (p) open(p); else K.toast(KP.t('Místo se nepodařilo načíst.')); }).catch(() => K.toast(KP.t('Místo se nepodařilo načíst.')));
    });
    // Data se mohla změnit v jiné záložce (detail místa, mapa)
    addEventListener('storage', () => { if (state.p) { renderStats(); renderWhy(); renderNav(); renderMine(); } });
  }

  function init() {
    $$('[data-proto]').forEach(el => { el.textContent = K.PROTOTYPE_NOTE.replace(/^Prototyp:\s*/, '').replace(/^./, c => c.toUpperCase()); });
    bind();
    renderMineOnly();
    state.search = KC.placeSearch({ input: $('#pd-q'), list: $('#pd-pick'), hint: $('#pd-q-hint'), onPick: open, selected: () => state.p && state.p.i,
      emptyText: KP.t('Nic jsme nenašli. Zkuste jiný tvar názvu nebo přidejte obec. Když podnik v mapě není, přidejte ho přes formulář Přidat místo.') });
    const sp = new URLSearchParams(location.search), id = sp.get('id');
    if (id) {
      $('#pd-q-hint').textContent = KP.t('Načítám podnik…');
      K.findPlace(id, sp.get('r')).then(p => {
        if (!p) { $('#pd-q-hint').textContent = KP.t('Podnik z odkazu jsme nenašli. Vyhledejte ho podle názvu.'); return; }
        state.search.addPlaces([p]);
        $('#pd-q').value = p.n + (p.o ? ' ' + p.o : '');
        state.search.ready.then(() => state.search.run());
        open(p, { quiet: !location.hash });
        if (location.hash) { const s = document.getElementById(location.hash.slice(1)); if (s) setTimeout(() => s.scrollIntoView({ block: 'start' }), 50); }
      }).catch(() => { $('#pd-q-hint').textContent = KP.t('Podnik se nepodařilo načíst. Vyhledejte ho podle názvu.'); });
    }
  }
  function renderMineOnly() { const list = B.claims(); if (list.length) renderMine(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
