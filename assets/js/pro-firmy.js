/* Pro podniky, obce a destinace (pro-firmy.html): formulář zájmu (jen localStorage) a ukázka reportu pro obce a DMO.
   Report se počítá v prohlížeči ze skutečných dat regionu (data/regions/*.json), nic se nedoplňuje ani neodhaduje. */
(function () {
  'use strict';
  const K = window.KP, $ = (s, r) => (r || document).querySelector(s);
  const NO_WC = ['parkovani', 'priroda']; // u těchto kategorií údaj o WC nedává smysl (stejně jako kraj.html)
  const FOCUS = ['cz-jihocesky', 'de-dolni-bavorsko', 'de-horni-falc']; // počáteční zaměření: jižní Čechy a Bavorsko u hranice
  const TOP = 20;
  const state = { region: null, rows: [], cats: [], sum: null, showAll: false, token: 0 };

  // ---------- Formulář zájmu ----------
  function initForm() {
    const f = document.getElementById('claim-form'), err = document.getElementById('c-err');
    document.getElementById('z-proto').textContent = K.PROTOTYPE_NOTE + ' ' + K.t('Nikdo vás zatím nebude kontaktovat.');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      const miss = [], v = (id) => f.querySelector('#' + id).value.trim();
      if (!v('c-name')) miss.push(K.t('název'));
      if (!v('c-city')) miss.push(K.t('obec'));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('c-email'))) miss.push(K.t('platný e-mail'));
      if (!f.querySelector('#c-ok').checked) miss.push(K.t('potvrzení oprávnění'));
      if (miss.length) { err.hidden = false; err.textContent = K.t('Doplňte prosím: {list}.', { list: miss.join(', ') }); return; }
      const list = K.store.get('interest', []);
      list.unshift({ name: v('c-name'), city: v('c-city'), type: v('c-type'), person: v('c-person'), email: v('c-email'), plan: v('c-plan'), date: new Date().toISOString().slice(0, 10) });
      if (!K.store.set('interest', list.slice(0, 20))) { err.hidden = false; err.textContent = K.t('Uložení se nepovedlo. Úložiště prohlížeče je plné nebo vypnuté.'); return; }
      err.hidden = true;
      K.toast(K.t('Zájem uložen jen v tomto prohlížeči. Nic jsme neodeslali.'));
      f.reset();
    });
  }

  // ---------- Report pro obce a destinace ----------
  const nf = (n) => { try { return Number(n).toLocaleString(K.i18n.locale()); } catch (e) { return String(n); } };
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const pctTxt = (a, b) => (b ? pct(a, b) + ' %' : '–');
  function regionLabel(r) { return r.zeme === 'cz' ? K.krajName(r.nazev, 'cz') : K.krajName(r.nazev, 'de'); }

  // Má místo slovní popis, nějaké měření nebo fotku?
  function hasDetail(p) {
    if (p.d || p.img) return true;
    try { return Object.keys(K.facts(p).m || {}).length > 0; } catch (e) { return false; }
  }
  function aggregate(list) {
    const sum = { n: 0, wUnk: 0, yes: 0, no: 0, wcRel: 0, tUnk: 0, noDetail: 0, park: 0 };
    const by = {}, cats = {};
    list.forEach(p => {
      if (p.c === 'parkovani') { sum.park++; return; }
      const o = p.o || K.t('bez obce');
      const c = by[o] || (by[o] = { o, n: 0, wUnk: 0, yes: 0, no: 0, wcRel: 0, tUnk: 0, noDetail: 0 });
      const ck = K.CATS[p.c] ? p.c : 'jine';
      const g = cats[ck] || (cats[ck] = { c: ck, n: 0, wUnk: 0, yes: 0, no: 0, wcRel: 0, tUnk: 0, noDetail: 0 });
      const det = hasDetail(p);
      [c, g, sum].forEach(x => {
        x.n++;
        if (!p.w) x.wUnk++; else if (p.w === 'yes') x.yes++; else if (p.w === 'no') x.no++;
        if (!NO_WC.includes(p.c)) { x.wcRel++; if (!p.t) x.tUnk++; }
        if (!det) x.noDetail++;
      });
    });
    return { sum, rows: Object.values(by), cats: Object.values(cats).sort((a, b) => b.n - a.n) };
  }
  function sortRows(rows, how) {
    const r = rows.slice();
    const share = (a, b) => (b ? a / b : 0);
    if (how === 'wc') r.sort((x, y) => share(y.tUnk, y.wcRel) - share(x.tUnk, x.wcRel) || y.n - x.n);
    else if (how === 'detail') r.sort((x, y) => share(y.noDetail, y.n) - share(x.noDetail, x.n) || y.n - x.n);
    else if (how === 'no') r.sort((x, y) => y.no - x.no || y.n - x.n);
    else r.sort((x, y) => y.n - x.n || x.o.localeCompare(y.o));
    return r;
  }
  function bar(a, b) {
    const v = pct(a, b);
    return '<span class="rp-cell"><span class="rp-bar" aria-hidden="true"><i style="width:' + v + '%"></i></span><b>' + pctTxt(a, b) + '</b></span>';
  }
  function stat(n, label, sub) {
    return '<div class="rp-stat"><span class="rp-n">' + n + '</span><span class="rp-l">' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  }
  function render() {
    const out = $('#rp-out'), r = state.region, s = state.sum;
    if (!r || !s) return;
    const min = Number($('#rp-min').value) || 1;
    const rows = sortRows(state.rows.filter(x => x.n >= min), $('#rp-sort').value);
    const shown = state.showAll ? rows : rows.slice(0, TOP);
    const name = regionLabel(r);
    const krajLink = 'kraj.html?k=' + encodeURIComponent(r.nazev);
    out.innerHTML =
      '<div class="rp-stats">' +
        stat(nf(s.n), K.t('míst v databázi'), K.t('bez {n} parkovišť ZTP', { n: nf(s.park) })) +
        stat(pctTxt(s.wUnk, s.n), K.t('bez údaje o vstupu'), K.t('{a} z {b} míst', { a: nf(s.wUnk), b: nf(s.n) })) +
        stat(pctTxt(s.tUnk, s.wcRel), K.t('bez údaje o WC'), K.t('{a} z {b} míst, kde WC dává smysl', { a: nf(s.tUnk), b: nf(s.wcRel) })) +
        stat(pctTxt(s.noDetail, s.n), K.t('bez popisu, měření a fotky'), K.t('{a} z {b} míst', { a: nf(s.noDetail), b: nf(s.n) })) +
      '</div>' +
      '<div class="table-wrap rp-table-wrap"><table class="data rp-table">' +
        '<caption>' + K.esc(K.t('{kraj}: obce, kde máme aspoň {n} {mist}', { kraj: name, n: min, mist: K.plural(min, 'rp.misto1', 'rp.misto2', 'rp.misto5') })) + '</caption>' +
        '<thead><tr><th scope="col">' + K.t('Obec') + '</th><th scope="col" class="num">' + K.t('Míst') + '</th><th scope="col" class="num">' + K.t('Vstup přístupný') + '</th><th scope="col" class="num">' + K.t('Vstup nepřístupný') + '</th><th scope="col" class="num">' + K.t('Bez údaje o vstupu') + '</th><th scope="col">' + K.t('Bez údaje o WC') + '</th><th scope="col">' + K.t('Bez popisu, měření a fotky') + '</th></tr></thead><tbody>' +
        (shown.length ? shown.map(c => '<tr><th scope="row"><a href="mapa.html?kraj=' + encodeURIComponent(r.nazev) + '&amp;q=' + encodeURIComponent(c.o) + '">' + K.esc(c.o) + '</a></th>' +
          '<td class="num">' + nf(c.n) + '</td><td class="num">' + pctTxt(c.yes, c.n) + '</td><td class="num">' + nf(c.no) + '</td><td class="num">' + nf(c.wUnk) + '</td>' +
          '<td>' + (c.wcRel ? bar(c.tUnk, c.wcRel) : '<span class="muted">–</span>') + '</td><td>' + bar(c.noDetail, c.n) + '</td></tr>').join('')
          : '<tr><td colspan="7" class="muted">' + K.t('Žádná obec nemá tolik míst. Zvolte menší počet.') + '</td></tr>') +
      '</tbody></table></div>' +
      '<p class="small muted rp-count">' + K.t('Zobrazeno {a} z {b} obcí.', { a: nf(shown.length), b: nf(rows.length) }) + '</p>' +
      catTable(name) +
      '<div class="row rp-actions">' +
        (rows.length > TOP ? '<button type="button" class="btn btn-ghost" data-rp-all>' + (state.showAll ? K.t('Zobrazit jen prvních {n}', { n: TOP }) : K.t('Zobrazit všechny obce ({n})', { n: nf(rows.length) })) + '</button>' : '') +
        '<button type="button" class="btn btn-primary" data-rp-csv>' + K.icon('upload') + K.t('Stáhnout report jako CSV') + '</button>' +
        '<a class="btn btn-quiet" href="' + krajLink + '">' + K.t('Přehled kraje na mapě') + '</a>' +
      '</div>';
  }
  // Pro destinační společnosti: stejné údaje podle typu místa (ubytování, restaurace, cíle…)
  function catTable(name) {
    const cats = state.cats || [];
    if (!cats.length) return '';
    const label = (k) => (K.CATS[k] ? K.CATS[k].label : K.t('Ostatní'));
    return '<h3 class="pf-sub rp-cat-h">' + K.esc(K.t('Podle typu místa')) + '</h3>' +
      '<p class="small muted rp-cat-note">' + K.esc(K.t('Pro destinační společnosti: které typy míst mají údaje a kde chybí. Celý kraj nebo vládní obvod, bez ohledu na počet míst v obci.')) + '</p>' +
      '<div class="table-wrap rp-table-wrap"><table class="data rp-table">' +
        '<caption>' + K.esc(K.t('{kraj}: místa podle typu', { kraj: name })) + '</caption>' +
        '<thead><tr><th scope="col">' + K.t('Typ místa') + '</th><th scope="col" class="num">' + K.t('Míst') + '</th><th scope="col" class="num">' + K.t('Vstup přístupný') + '</th><th scope="col">' + K.t('Bez údaje o vstupu') + '</th><th scope="col">' + K.t('Bez údaje o WC') + '</th><th scope="col">' + K.t('Bez popisu, měření a fotky') + '</th></tr></thead><tbody>' +
        cats.map(c => '<tr><th scope="row">' + (K.CATS[c.c] ? '<a href="mapa.html?kraj=' + encodeURIComponent(state.region.nazev) + '&amp;kat=' + encodeURIComponent(c.c) + '">' + K.esc(label(c.c)) + '</a>' : K.esc(label(c.c))) + '</th>' +
          '<td class="num">' + nf(c.n) + '</td><td class="num">' + pctTxt(c.yes, c.n) + '</td><td>' + bar(c.wUnk, c.n) + '</td>' +
          '<td>' + (c.wcRel ? bar(c.tUnk, c.wcRel) : '<span class="muted">' + K.esc(K.t('nepočítáme')) + '</span>') + '</td><td>' + bar(c.noDetail, c.n) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }
  function csv() {
    const r = state.region; if (!r) return;
    const min = Number($('#rp-min').value) || 1;
    const rows = sortRows(state.rows.filter(x => x.n >= min), $('#rp-sort').value);
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const head = [K.t('Obec'), K.t('Míst'), K.t('Vstup přístupný'), K.t('Vstup nepřístupný'), K.t('Bez údaje o vstupu'), K.t('Míst, kde WC dává smysl'), K.t('Bez údaje o WC'), K.t('Bez popisu, měření a fotky')];
    const lines = [head.map(q).join(';')].concat(rows.map(c => [c.o, c.n, c.yes, c.no, c.wUnk, c.wcRel, c.tUnk, c.noDetail].map(q).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'report-' + r.id + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    K.toast(K.t('Report uložen jako CSV. Data zůstala jen u vás.'));
  }
  function loadReport(id) {
    const out = $('#rp-out'), token = ++state.token;
    state.region = K.regionMeta(id); state.showAll = false;
    out.innerHTML = '<p class="muted">' + K.t('Načítám {n} míst…', { n: nf(state.region ? state.region.pocet : 0) }) + '</p>';
    K.loadRegion(id).then(list => {
      if (token !== state.token) return;
      const a = aggregate(list); state.sum = a.sum; state.rows = a.rows; state.cats = a.cats;
      render();
    }).catch(() => { if (token === state.token) out.innerHTML = '<p class="callout">' + K.t('Data o místech se nepodařilo načíst. Zkuste stránku obnovit.') + '</p>'; });
  }
  function initReport() {
    const sel = $('#rp-region'); if (!sel) return;
    const src = $('#rp-src');
    if (src && K.OSM_DATE) src.innerHTML = K.esc(K.t('Zdroj: OpenStreetMap (ODbL), staženo {cz} pro Česko a {de} pro Bavorsko, a další otevřená data.', { cz: K.fmtDate(K.OSM_DATE.cz), de: K.fmtDate(K.OSM_DATE.de) })) + ' <a href="zdroje.html">' + K.esc(K.t('Všechny zdroje')) + '</a>';
    K.loadRegionsIndex().then(idx => {
      const opt = (r) => '<option value="' + K.esc(r.id) + '">' + K.esc(regionLabel(r)) + '</option>';
      const focus = FOCUS.map(id => idx.find(r => r.id === id)).filter(Boolean);
      const rest = (z) => idx.filter(r => r.zeme === z && !FOCUS.includes(r.id)).sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)));
      sel.innerHTML = '<optgroup label="' + K.esc(K.t('Jižní Čechy a Bavorsko u hranice')) + '">' + focus.map(opt).join('') + '</optgroup>' +
        '<optgroup label="' + K.esc(K.t('Další kraje v Česku')) + '">' + rest('cz').map(opt).join('') + '</optgroup>' +
        '<optgroup label="' + K.esc(K.t('Další vládní obvody v Bavorsku')) + '">' + rest('de').map(opt).join('') + '</optgroup>';
      let start = 'cz-jihocesky';
      try { const q = new URLSearchParams(location.search).get('report'); if (q && idx.some(r => r.id === q)) start = q; } catch (e) { /* bez URL API */ }
      sel.value = start;
      loadReport(start);
    }).catch(() => { $('#rp-out').innerHTML = '<p class="callout">' + K.t('Data o místech se nepodařilo načíst. Zkuste stránku obnovit.') + '</p>'; });
    sel.addEventListener('change', () => loadReport(sel.value));
    $('#rp-sort').addEventListener('change', render);
    $('#rp-min').addEventListener('change', render);
    $('#rp-out').addEventListener('click', e => {
      if (e.target.closest('[data-rp-csv]')) { csv(); return; }
      const all = e.target.closest('[data-rp-all]');
      if (all) { state.showAll = !state.showAll; render(); const b = $('#rp-out [data-rp-all]'); if (b) b.focus(); }
    });
  }

  function init() { initForm(); initReport(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
