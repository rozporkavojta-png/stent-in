/* Stránka Kraje: přehled všech krajů a detail kraje (kraj.html?k=<název>). Vše se počítá z data/places.json. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const ST = [['yes', 'ok', 'Přístupné'], ['limited', 'part', 'Částečně'], ['no', 'no', 'Nepřístupné'], ['null', 'unk', 'Neuvedeno']];
  const NO_WC = ['parkovani', 'priroda']; // u těchto kategorií údaj o WC nedává smysl
  let ALL = [], map = null, INFO = null;

  const nf = (n) => Number(n).toLocaleString('cs-CZ');
  function pct(a, b) { if (!b) return '0 %'; const v = a / b * 100; return (v > 0 && v < 1 ? '< 1' : String(Math.round(v))) + ' %'; }
  function plural(n, one, few, many) { return n === 1 ? one : n > 1 && n < 5 ? few : many; }
  function fullName(k) { return k === 'Hlavní město Praha' ? k : k === 'Vysočina' ? 'Kraj Vysočina' : k + ' kraj'; }
  function shortSlug(k) { return 'kraj.html?k=' + encodeURIComponent(k); }

  function aggregate(list) {
    const a = { n: list.length, acc: 0, w: { yes: 0, limited: 0, no: 0, null: 0 }, tYes: 0, wcPublic: 0, wcPublicYes: 0, park: 0, parkSpots: 0, cats: {}, cities: {} };
    list.forEach(p => {
      a.cats[p.c] = (a.cats[p.c] || 0) + 1;
      if (p.c === 'parkovani') { a.park++; if (p.pk) a.parkSpots += Number(p.pk) || 0; }
      else { a.acc++; a.w[String(p.w || 'null')]++; }
      if (p.t === 'yes') a.tYes++;
      if (p.c === 'wc') { a.wcPublic++; if (p.t === 'yes') a.wcPublicYes++; }
      if (p.o) {
        const c = a.cities[p.o] || (a.cities[p.o] = { o: p.o, n: 0, acc: 0, yes: 0, wUnk: 0, wcRel: 0, tUnk: 0, noDetail: 0 });
        c.n++;
        if (p.c !== 'parkovani') {
          c.acc++;
          if (p.w === 'yes') c.yes++;
          if (!p.w) c.wUnk++;
          if (!(p.d || p.sc !== undefined || p.dw || p.rp || p.img)) c.noDetail++;
        }
        if (!NO_WC.includes(p.c)) { c.wcRel++; if (!p.t) c.tUnk++; }
      }
    });
    return a;
  }

  // Pruhový graf podílu stavů vstupu; hodnoty jsou vždy i v popiscích pod pruhem (tvar + text)
  function shareBar(w, total, opts) {
    const o = opts || {};
    const seg = ST.map(([k, st, label]) => {
      const v = w[k] || 0; if (!v) return '';
      const p = v / total * 100;
      return '<span class="kr-seg ' + st + '" style="width:' + p.toFixed(2) + '%" title="' + label + ': ' + nf(v) + ' (' + pct(v, total) + ')">' + (p >= 9 && !o.compact ? '<b>' + pct(v, total) + '</b>' : '') + '</span>';
    }).join('');
    const legend = o.noLegend ? '' : '<ul class="kr-legend">' + ST.map(([k, st, label]) => '<li>' + K.statusHtml(st, label) + ' <span class="num">' + nf(w[k] || 0) + '</span> <span class="muted num">(' + pct(w[k] || 0, total) + ')</span></li>').join('') + '</ul>';
    return '<div class="kr-bar' + (o.compact ? ' compact' : '') + '" role="img" aria-label="' + ST.map(([k, , label]) => label + ' ' + pct(w[k] || 0, total)).join(', ') + '">' + seg + '</div>' + legend;
  }

  // Sekce stránky: bílá plocha, sekce dělí tenká linka (pages-d.css), obsah vždy ve .wrap
  function sec(inner, opts) {
    const o = opts || {};
    return '<section class="section kr-sec' + (o.tight ? ' kr-tight' : '') + '"' + (o.label ? ' aria-labelledby="' + o.label + '"' : '') + '><div class="wrap">' + inner + '</div></section>';
  }
  function head(id, title, note, kicker) {
    return '<div class="head-row"><div>' + (kicker ? '<p class="kicker">' + kicker + '</p>' : '') + '<h2 id="' + id + '">' + title + '</h2>' + (note ? '<p class="muted head-note">' + note + '</p>' : '') + '</div></div>';
  }

  // Velké číslo s popisem (.stat), bez ikon
  function kpi(value, label, sub) {
    return '<p class="stat kr-stat"><span class="n num">' + value + '</span><span class="l">' + label + '</span>' + (sub ? '<small class="muted">' + sub + '</small>' : '') + '</p>';
  }

  // ---------- Přehled všech krajů ----------
  function renderOverview(stats) {
    document.title = 'Kraje · kudyprojedu.cz';
    const groups = {};
    ALL.forEach(p => { if (p.k) (groups[p.k] = groups[p.k] || []).push(p); });
    const rows = Object.keys(groups).map(k => Object.assign({ k }, aggregate(groups[k]))).sort((a, b) => b.n - a.n);
    const cz = aggregate(ALL);
    $('#kr-body').innerHTML =
      sec('<div class="kr-kpis">' +
        kpi(nf(cz.n), 'míst v databázi', nf(cz.acc) + ' s údajem o vstupu, ' + nf(cz.park) + ' parkovišť ZTP') +
        kpi(pct(cz.w.yes, cz.acc), 'míst přístupných na vozíku', nf(cz.w.yes) + ' z ' + nf(cz.acc)) +
        kpi(nf(cz.tYes), 'míst s bezbariérovým WC', 'z toho ' + nf(cz.wcPublicYes) + ' veřejných toalet') +
        kpi(nf(cz.parkSpots), 'vyhrazených stání ZTP', 'na ' + nf(cz.park) + ' parkovištích') +
        '</div>', { tight: true }) +
      sec(head('kr-all-h', 'Všech ' + rows.length + ' krajů', 'Seřazeno podle počtu míst. Podíl počítáme z míst s údajem o vstupu (bez parkovišť). Názvem kraje otevřete detail.', 'Přehled') +
        '<ul class="kr-legend kr-legend-top">' + ST.map(([, st, label]) => '<li>' + K.statusHtml(st, label) + '</li>').join('') + '</ul>' +
        '<table class="data kr-table"><caption class="sr-only">Kraje podle počtu míst</caption><thead><tr>' +
          '<th scope="col">Kraj</th><th scope="col" class="num">Míst</th><th scope="col" class="kr-col-bar">Vstupy podle stavu</th><th scope="col" class="num">Přístupných</th><th scope="col" class="num">WC</th><th scope="col" class="num">Stání ZTP</th></tr></thead><tbody>' +
        rows.map(r =>
          '<tr><th scope="row"><a href="' + shortSlug(r.k) + '">' + K.esc(fullName(r.k)) + '</a></th>' +
          '<td class="num kr-n" data-l="Míst">' + nf(r.n) + '</td>' +
          '<td class="kr-col-bar">' + shareBar(r.w, r.acc, { compact: true, noLegend: true }) + '</td>' +
          '<td class="num" data-l="Přístupných">' + pct(r.w.yes, r.acc) + '</td>' +
          '<td class="num" data-l="WC">' + nf(r.tYes) + '</td>' +
          '<td class="num" data-l="Stání ZTP">' + nf(r.parkSpots) + '</td></tr>').join('') +
        '</tbody></table>' +
        (stats && stats.kraje && stats.kraje[''] ? '<p class="small muted" style="margin-top:16px">' + nf(stats.kraje['']) + ' ' + plural(stats.kraje[''], 'místo leží', 'místa leží', 'míst leží') + ' mimo hranice krajů (u státní hranice) a v přehledu nejsou.</p>' : ''),
        { label: 'kr-all-h' });
  }

  // Odkazy z rešerše krajských webů (data/kraje_info.json): krajský plán, atlasy přístupnosti, organizace, dotace
  function infoHtml(k) {
    const r = INFO && INFO.kraje && INFO.kraje[k];
    if (!r) return '';
    const links = (lst) => '<ul class="kr-links">' + lst.map(x => '<li><a href="' + K.esc(x.u) + '" target="_blank" rel="noopener">' + K.esc(x.t) + '</a></li>').join('') + '</ul>';
    const box = (h, lst, empty) => '<div class="kr-info"><h3>' + h + '</h3>' + (lst && lst.length ? links(lst) : '<p class="muted small">' + K.esc(empty) + '</p>') + '</div>';
    return sec(head('kr-info-h', 'Plán, atlasy, organizace a dotace', 'Odkazy jsme našli na webech kraje, měst a organizací (kontrola ' + K.esc(K.fmtDate(INFO.checked_date)) + '). Seznam není úplný.', 'Odkazy') +
      '<div class="kr-info-grid">' +
      box('Krajský plán vyrovnávání příležitostí', r.plan, r.pozn || 'Plán jsme nenašli.') +
      box('Atlasy a mapy přístupnosti', r.atlasy, 'Atlas přístupnosti jsme v kraji nenašli.') +
      box('Organizace lidí s postižením', r.organizace, 'Organizaci jsme v rešerši nenašli.') +
      (r.dotace ? box('Krajské dotace', r.dotace, 'Krajskou dotaci jsme v rešerši nenašli.') : '') +
      '</div>', { label: 'kr-info-h' });
  }

  // ---------- Detail kraje ----------
  function renderKraj(k) {
    const list = ALL.filter(p => p.k === k);
    const a = aggregate(list);
    const name = fullName(k);
    document.title = name + ' · kudyprojedu.cz';
    $('#kr-title').textContent = name;
    $('#crumb-kraj').outerHTML = '<span aria-hidden="true">›</span><span aria-current="page">' + K.esc(name) + '</span>';
    $('#kr-lede').textContent = 'V databázi je ' + nf(a.n) + ' ' + plural(a.n, 'místo', 'místa', 'míst') + ' z tohoto kraje. Přístupných na vozíku je ' + pct(a.w.yes, a.acc) + ' z těch, u kterých známe vstup.';

    const cities = Object.values(a.cities).sort((x, y) => y.n - x.n);
    const topCities = cities.slice(0, 12);
    const maxCity = topCities.length ? topCities[0].n : 1;
    const gaps = cities.filter(c => c.wcRel >= 10).sort((x, y) => (y.tUnk / y.wcRel) - (x.tUnk / x.wcRel) || y.wcRel - x.wcRel).slice(0, 10);
    const cats = Object.entries(a.cats).sort((x, y) => y[1] - x[1]);
    const maxCat = cats.length ? cats[0][1] : 1;
    const wcRelTotal = list.filter(p => !NO_WC.includes(p.c)).length;
    const tUnkTotal = list.filter(p => !NO_WC.includes(p.c) && !p.t).length;

    $('#kr-body').innerHTML =
      sec('<div class="kr-kpis">' +
        kpi(nf(a.n), 'míst v databázi', nf(a.acc) + ' s údajem o vstupu, ' + nf(a.park) + ' parkovišť ZTP') +
        kpi(nf(a.w.yes), 'přístupných na vozíku', pct(a.w.yes, a.acc) + ' míst s údajem o vstupu') +
        kpi(nf(a.tYes), 'míst s bezbariérovým WC', 'z toho ' + nf(a.wcPublicYes) + ' veřejných toalet') +
        kpi(nf(a.parkSpots), 'vyhrazených stání ZTP', 'na ' + nf(a.park) + ' ' + plural(a.park, 'parkovišti', 'parkovištích', 'parkovištích')) +
        '</div>', { tight: true }) +

      sec('<div class="split-grid"><div class="split-h"><p class="kicker">Vstup</p><h2 id="kr-share-h">Přístupnost vstupu</h2><p class="muted small">' + nf(a.acc) + ' míst s údajem o vstupu (parkoviště nepočítáme). Hodnoty zadali dobrovolníci do OpenStreetMap.</p></div>' +
        '<div class="split-b kr-share">' + shareBar(a.w, a.acc) + '</div></div>', { label: 'kr-share-h' }) +

      sec(head('kr-map-h', 'Místa na mapě', '', 'Mapa') +
        '<div class="kr-map-tools"><label class="check"><input type="checkbox" id="kr-park"> Zobrazit i parkování ZTP (' + nf(a.park) + ')</label><a class="btn btn-ghost" href="mapa.html">Otevřít velkou mapu</a></div>' +
        '<div class="kr-map-wrap"><div id="kr-map" class="map-canvas" role="region" aria-label="Mapa míst v kraji"></div></div>' +
        '<div id="kr-pick" class="kr-pickcard" hidden></div>', { label: 'kr-map-h' }) +

      sec('<div class="kr-two">' +
        '<div aria-labelledby="kr-city-h"><p class="kicker">Obce</p><h2 class="kr-h" id="kr-city-h">Obce s nejvíce místy</h2><p class="muted small">Počet míst v databázi a podíl přístupných vstupů. Odkaz otevře obec na mapě.</p>' +
        '<ol class="kr-hbars">' + topCities.map(c => '<li><a href="mapa.html?q=' + encodeURIComponent(c.o) + '">' + K.esc(c.o) + '</a>' +
          '<span class="kr-hbar"><i style="width:' + (c.n / maxCity * 100).toFixed(1) + '%"></i></span><span class="num">' + nf(c.n) + '</span>' +
          '<small class="muted">přístupných ' + pct(c.yes, c.acc) + '</small></li>').join('') + '</ol></div>' +
        '<div aria-labelledby="kr-cat-h"><p class="kicker">Kategorie</p><h2 class="kr-h" id="kr-cat-h">Druhy míst</h2><p class="muted small">Kolik míst je v kraji v jednotlivých kategoriích.</p>' +
        '<ol class="kr-hbars kr-cats">' + cats.map(([c, v]) => '<li><span>' + K.esc(K.CATS[c] ? K.CATS[c].label : c) + '</span>' +
          '<span class="kr-hbar"><i style="width:' + (v / maxCat * 100).toFixed(1) + '%"></i></span><span class="num">' + nf(v) + '</span></li>').join('') + '</ol></div>' +
        '</div>') +

      sec(head('kr-gap-h', 'Kde chybí data', '', 'Mezery v datech') +
        '<p class="text">U ' + pct(tUnkTotal, wcRelTotal) + ' míst v kraji (' + nf(tUnkTotal) + ' z ' + nf(wcRelTotal) + ') nevíme, jestli mají bezbariérovou toaletu. Pro člověka na vozíku je to často rozhodující údaj. Obce níže mají nejvyšší podíl míst bez něj; počítáme jen obce s aspoň 10 místy.</p>' +
        (gaps.length ? '<div class="table-wrap"><table class="data kr-gap"><caption class="sr-only">Obce s nejvyšším podílem míst bez údaje o toaletě</caption><thead><tr><th scope="col">Obec</th><th scope="col" class="num">Míst</th><th scope="col" class="num">Bez údaje o WC</th><th scope="col" class="num">Bez popisu, měření a fotky</th><th scope="col" class="num">Bez údaje o vstupu</th></tr></thead><tbody>' +
          gaps.map(c => '<tr><th scope="row"><a href="mapa.html?q=' + encodeURIComponent(c.o) + '">' + K.esc(c.o) + '</a></th><td class="num">' + nf(c.wcRel) + '</td><td class="num"><b>' + pct(c.tUnk, c.wcRel) + '</b></td><td class="num">' + pct(c.noDetail, c.acc) + '</td><td class="num">' + pct(c.wUnk, c.acc) + '</td></tr>').join('') +
          '</tbody></table></div>' : '<p class="muted">V kraji není obec s aspoň 10 místy, u kterých by údaj o WC dával smysl.</p>') +
        '<p class="small muted text" style="margin-top:12px">„Bez popisu, měření a fotky“ znamená, že u místa není slovní popis, počet schodů, šířka dveří, rampa ani fotografie. Údaj o vstupu má v databázi skoro každé místo, protože bez něj místo do mapy nebereme; chybějící místa proto v tabulce nejsou vidět vůbec.</p>' +
        '<div class="row" style="margin-top:20px"><a class="btn btn-primary" href="pro-firmy.html#obce">Zmapovat obec s námi</a><a class="btn btn-ghost" href="pridat.html">Doplnit údaj o místě</a></div>',
        { label: 'kr-gap-h' }) +
      infoHtml(k);

    const base = list.filter(p => p.c !== 'parkovani');
    setupMap(base, true);
    $('#kr-park').addEventListener('change', e => { if (map) { const l = e.target.checked ? list : base; map.setPlaces(l, { colorOf, onClick: pick }); } });
  }

  function colorOf(p) { if (p.c === 'parkovani') return 'park'; const n = K.getNeeds(); return n.active ? K.match(p, n).status : K.generalStatus(p); }
  function pick(p) {
    const el = $('#kr-pick'); if (!el) { location.href = 'misto.html?id=' + encodeURIComponent(p.i); return; }
    const w = K.W[p.w || 'null'];
    el.hidden = false;
    el.innerHTML = '<div><b>' + K.esc(p.n) + '</b><div class="small muted">' + K.esc([p.s, p.o].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="row" style="gap:8px;margin-top:6px">' + (p.c !== 'parkovani' ? K.statusHtml(w.st, w.label) : '') + (p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : '') + (p.pk ? '<span class="fact">' + p.pk + '× ZTP</span>' : '') + '</div></div>' +
      '<a class="btn btn-primary" href="misto.html?id=' + encodeURIComponent(p.i) + '">Detail místa</a>';
    if (map) map.focus(p);
  }

  async function setupMap(list, withMap) {
    map = null;
    const el = $('#kr-map'); if (!el || !withMap) return;
    try {
      map = await KPMap.create(el);
      map.setPlaces(list, { colorOf, onClick: pick });
      map.fitTo(list);
    } catch (e) { el.innerHTML = '<p class="empty">Mapu se nepodařilo načíst.</p>'; }
  }

  async function init() {
    const sp = new URLSearchParams(location.search);
    const want = (sp.get('k') || '').trim();
    let stats = null;
    try { [ALL, stats, INFO] = await Promise.all([K.loadPlaces(), K.loadStats().catch(() => null), fetch('data/kraje_info.json').then(r => r.ok ? r.json() : null).catch(() => null)]); }
    catch (e) { $('#kr-body').innerHTML = sec('<p class="callout">Data o místech se nepodařilo načíst. Zkuste stránku obnovit.</p>', { tight: true }); return; }
    if (stats && stats.fetched) $('#kr-fetched').textContent = K.fmtDate(stats.fetched);
    const kraje = [...new Set(ALL.map(p => p.k).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
    const sel = $('#kr-select');
    sel.innerHTML += kraje.map(k => '<option value="' + K.esc(k) + '">' + K.esc(fullName(k)) + '</option>').join('');
    sel.addEventListener('change', () => { location.href = sel.value ? shortSlug(sel.value) : 'kraj.html'; });
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*kraj\s*/g, '').replace(/^kraj\s*/, '').trim();
    const match = want ? (kraje.find(k => norm(k) === norm(want)) || kraje.find(k => norm(want).length > 3 && norm(k).includes(norm(want)))) : null;
    if (want && !match) {
      $('#kr-body').innerHTML = sec('<p class="callout">Kraj „' + K.esc(want) + '“ neznáme. Vyberte ho ze seznamu výše.</p>', { tight: true });
      renderOverviewAppend(stats);
      return;
    }
    if (match) { sel.value = match; renderKraj(match); } else renderOverview(stats);
  }
  function renderOverviewAppend(stats) { const note = $('#kr-body').innerHTML; renderOverview(stats); $('#kr-body').insertAdjacentHTML('afterbegin', note); }

  init();
})();
