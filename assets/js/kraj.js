/* Stránka Kraje: přehled krajů ČR a vládních obvodů Bavorska (z data/stats.json, bez stahování všech míst)
   a detail kraje / obvodu (kraj.html?k=<název>), který načte jen svůj region z data/regions/. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const ST = [['yes', 'ok', KP.t('Přístupné')], ['limited', 'part', KP.t('Částečně')], ['no', 'no', KP.t('Nepřístupné')], ['null', 'unk', KP.t('Neuvedeno')]];
  const NO_WC = ['parkovani', 'priroda']; // u těchto kategorií údaj o WC nedává smysl
  let ALL = [], map = null, INFO = null, IDX = [];

  // Bavorsko – souvislosti po vládních obvodech (převzato z data/research/out/tema_bavorsko_zemske.md):
  // osoby s těžkým zdravotním postižením (GdB ≥ 50) a obyvatelé k 31. 12. 2025 – Bayerisches Landesamt für Statistik, GENESIS-Online,
  // tabulky 22711-003z a 12411-003r, CC BY 4.0; nádraží DB přístupná pro vozík – DB InfraGO OpenStation, CC0 1.0, vydáno 7. 10. 2026.
  const BY_CTX = {
    'Horní Bavorsko': { de: 'Oberbayern', sb: 358095, obyv: 4767226, db: [240, 295] },
    'Dolní Bavorsko': { de: 'Niederbayern', sb: 114745, obyv: 1260007, db: [47, 56] },
    'Horní Falc': { de: 'Oberpfalz', sb: 119820, obyv: 1120630, db: [50, 76] },
    'Horní Franky': { de: 'Oberfranken', sb: 116855, obyv: 1051584, db: [92, 114] },
    'Střední Franky': { de: 'Mittelfranken', sb: 197870, obyv: 1795514, db: [131, 157] },
    'Dolní Franky': { de: 'Unterfranken', sb: 127685, obyv: 1314706, db: [46, 78] },
    'Švábsko': { de: 'Schwaben', sb: 156515, obyv: 1935836, db: [121, 148] },
  };
  // Otevřená data převzatá jen v některých obvodech (seznam s licencemi je v data/by/zdroje.json a na stránce Zdroje)
  const BY_OPEN = {
    'Horní Bavorsko': [[KP.t('Landeshauptstadt München – WC-Finder (veřejná WC s rozměry)'), 'https://opendata.muenchen.de/dataset/wc_finder', 'dl-de/by-2-0'],
      ['Landeshauptstadt München – Behindertenparkplätze', 'https://opendata.muenchen.de/dataset/behindertenparkplaetze', 'dl-de/by-2-0'],
      ['P+R Park & Ride GmbH München – P+R Anlagen', 'https://opendata.muenchen.de/dataset/p-r-anlagen-muenchen', 'dl-de/by-2-0'],
      ['Landeshauptstadt München – Wahlräume (Bundestagswahl 2025)', 'https://opendata.muenchen.de/dataset/bundestagswahl-2025-wahlraeume-in-muenchen', 'dl-de/by-2-0'],
      ['Stadt Haar – Points of Interest (Behindertenparkplatz)', 'https://open.bydata.de/datasets/poi-haar', 'CC BY 4.0'],
      ['BayernCloud Tourismus – Attraktionen in Bayern', 'https://open.bydata.de/datasets/https-data-bayerncloud-digital-api-v4-endpoints-list_attractions', KP.t('CC BY 4.0 (jen objekty s touto licencí)')]],
    'Švábsko': [['BayernCloud Tourismus – Attraktionen in Bayern', 'https://open.bydata.de/datasets/https-data-bayerncloud-digital-api-v4-endpoints-list_attractions', KP.t('CC BY 4.0 (jen objekty s touto licencí)')]],
    'Dolní Franky': [['Stadt Würzburg – Nette Toiletten im Stadtgebiet Würzburg', 'https://opendata.wuerzburg.de/explore/dataset/barrierefreie-toiletten-im-stadtgebiet-wuerzburg/', 'dl-de/by-2-0']],
  };

  const nf = (n) => K.nf(n);
  function pct(a, b) { if (!b) return K.LANG === 'en' ? '0%' : '0 %'; const v = a / b * 100; return (v > 0 && v < 1 ? '< 1' : String(Math.round(v))) + (K.LANG === 'en' ? '%' : ' %'); }
  function plural(n, one, few, many) { return n === 1 ? one : n > 1 && n < 5 ? few : many; }
  function fullName(k) { return K.krajName(k); }
  const isDe = (k) => { const r = K.regionByName(k); return !!r && r.zeme === 'de'; };
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

  // ---------- Přehled: kraje ČR a vládní obvody Bavorska (data/stats.json, by_region) ----------
  function regionRow(id, st) {
    const w = { yes: st.w_yes || 0, limited: st.w_limited || 0, no: st.w_no || 0, null: st.w_None || 0 };
    return { id, k: st.nazev, z: st.zeme, n: st.total || 0, w, known: w.yes + w.limited + w.no, x: st.x || 0, r: st.r || 0, img: st.img || 0, park: (st.cats || {}).parkovani || 0 };
  }
  function overviewTable(rows, z) {
    const word = z === 'de' ? KP.t('Vládní obvod') : KP.t('Kraj');
    return '<table class="data kr-table"><caption class="sr-only">' + (z === 'de' ? K.t('Vládní obvody Bavorska podle počtu míst') : K.t('Kraje České republiky podle počtu míst')) + '</caption><thead><tr>' +
      '<th scope="col">' + word + ('</th><th scope="col" class="num">' + KP.t('Míst') + '</th><th scope="col" class="kr-col-bar">' + KP.t('Vstupy podle stavu') + '</th><th scope="col" class="num">' + KP.t('Přístupných') + '</th><th scope="col" class="num">' + KP.t('Naměřeno') + '</th><th scope="col" class="num">' + KP.t('Fotky') + '</th></tr></thead><tbody>') +
      rows.map(r =>
        '<tr><th scope="row"><a href="' + shortSlug(r.k) + '">' + K.esc(K.krajName(r.k, r.z)) + '</a></th>' +
        '<td class="num kr-n" data-l="Míst">' + nf(r.n) + '</td>' +
        '<td class="kr-col-bar">' + shareBar(r.w, r.n, { compact: true, noLegend: true }) + '</td>' +
        '<td class="num" data-l="Přístupných">' + pct(r.w.yes, r.known) + '</td>' +
        '<td class="num" data-l="Naměřeno">' + nf(r.x) + '</td>' +
        '<td class="num" data-l="Fotky">' + nf(r.img) + '</td></tr>').join('') +
      '</tbody></table>';
  }
  function renderOverview(stats) {
    document.title = K.t('Kraje a obvody') + ' · kudyprojedu.cz';
    const br = (stats && stats.by_region) || {};
    const rows = Object.keys(br).map(id => regionRow(id, br[id])).sort((a, b) => b.n - a.n);
    if (!rows.length) { $('#kr-body').innerHTML = sec(('<p class="callout">' + KP.t('Přehled se nepodařilo spočítat. Zkuste stránku obnovit.') + '</p>'), { tight: true }); return; }
    const sum = (list) => list.reduce((a, r) => { a.n += r.n; a.known += r.known; a.yes += r.w.yes; a.x += r.x; a.r += r.r; a.park += r.park; return a; }, { n: 0, known: 0, yes: 0, x: 0, r: 0, park: 0 });
    const all = sum(rows);
    const part = (z, title, note) => {
      const list = rows.filter(r => r.z === z); if (!list.length) return '';
      const t = sum(list);
      return sec(head('kr-' + z + '-h', title, note, K.ZEME_LONG[z]) +
        '<p class="small muted">' + K.t('{n} míst, z toho {park} parkovišť ZTP · přístupných {pct} míst s údajem o vstupu · {x} s naměřenými údaji · {r} s údaji od provozovatele', { n: nf(t.n), park: nf(t.park), pct: pct(t.yes, t.known), x: nf(t.x), r: nf(t.r) }) + '</p>' +
        '<ul class="kr-legend kr-legend-top">' + ST.map(([, st, label]) => '<li>' + K.statusHtml(st, label) + '</li>').join('') + '</ul>' +
        overviewTable(list, z), { label: 'kr-' + z + '-h' });
    };
    $('#kr-body').innerHTML =
      sec('<div class="kr-kpis">' +
        kpi(nf(all.n), KP.t('míst v Česku a Bavorsku'), K.t('{a} s údajem o vstupu, {b} parkovišť ZTP', { a: nf(all.known), b: nf(all.park) })) +
        kpi(pct(all.yes, all.known), KP.t('míst přístupných na vozíku'), K.t('{a} z {b} s údajem o vstupu', { a: nf(all.yes), b: nf(all.known) })) +
        kpi(nf(all.x), KP.t('míst s naměřenými údaji'), KP.t('z otevřených dat měst, krajů a DB')) +
        kpi(nf(all.r), KP.t('míst s údaji od provozovatele'), KP.t('z rešerše webů provozovatelů a obcí')) +
        '</div>', { tight: true }) +
      part('cz', K.t('Všech {n} krajů', { n: rows.filter(r => r.z === 'cz').length }), KP.t('Seřazeno podle počtu míst. Pruh ukazuje všechna místa včetně těch bez údaje o vstupu (hlavně parkoviště), podíl přístupných počítáme jen z míst s údajem. Názvem kraje otevřete detail.')) +
      part('de', K.t('Všech {n} vládních obvodů', { n: rows.filter(r => r.z === 'de').length }), KP.t('Bavorsko se dělí na 7 vládních obvodů (Regierungsbezirke). Místa jsou ze stejných dotazů na OpenStreetMap jako v Česku, doplněná o otevřená data a rešerši webů. Názvy míst ponecháváme německy.')) +
      sec(('<p class="small muted">' + KP.t('21 míst z českých dat leží těsně za státní hranicí (nejdál 222 m, v Polsku a Sasku). V přehledu je počítáme k nejbližšímu kraji.') + '</p>'), { tight: true });
  }

  // Odkazy z rešerše krajských webů (data/kraje_info.json): krajský plán, atlasy přístupnosti, organizace, dotace
  function infoHtml(k) {
    const r = INFO && INFO.kraje && INFO.kraje[k];
    if (!r) return '';
    const links = (lst) => '<ul class="kr-links">' + lst.map(x => '<li><a href="' + K.esc(x.u) + '" target="_blank" rel="noopener">' + K.esc(x.t) + '</a></li>').join('') + '</ul>';
    const box = (h, lst, empty) => '<div class="kr-info"><h3>' + h + '</h3>' + (lst && lst.length ? links(lst) : '<p class="muted small">' + K.esc(empty) + '</p>') + '</div>';
    return sec(head('kr-info-h', KP.t('Plán, atlasy, organizace a dotace'), K.t('Odkazy jsme našli na webech kraje, měst a organizací (kontrola {d}). Seznam není úplný.', { d: K.esc(K.fmtDate(INFO.checked_date)) }), KP.t('Odkazy')) +
      '<div class="kr-info-grid">' +
      box(KP.t('Krajský plán vyrovnávání příležitostí'), r.plan, r.pozn || KP.t('Plán jsme nenašli.')) +
      box(KP.t('Atlasy a mapy přístupnosti'), r.atlasy, KP.t('Atlas přístupnosti jsme v kraji nenašli.')) +
      box(KP.t('Organizace lidí s postižením'), r.organizace, KP.t('Organizaci jsme v rešerši nenašli.')) +
      (r.dotace ? box(KP.t('Krajské dotace'), r.dotace, KP.t('Krajskou dotaci jsme v rešerši nenašli.')) : '') +
      '</div>', { label: 'kr-info-h' });
  }

  // ---------- Detail kraje ----------
  // Bavorsko: počet lidí s těžkým postižením a nádraží DB v obvodu, otevřená data převzatá jen tady
  function byContextHtml(k) {
    const c = BY_CTX[k]; if (!c) return '';
    const open = BY_OPEN[k] || [];
    return sec(head('kr-by-h', KP.t('Souvislosti v obvodu'), KP.t('Čísla nejsou z naší databáze míst, ale z oficiální statistiky a dat Deutsche Bahn.'), K.esc(c.de)) +
      '<div class="kr-kpis">' +
      kpi(nf(c.sb), KP.t('lidí s těžkým zdravotním postižením'), K.t('GdB ≥ 50, k 31. 12. 2025; {pct} % z {n} obyvatel', { pct: K.fmt((c.sb / c.obyv * 100).toFixed(1)), n: nf(c.obyv) })) +
      kpi(K.t('{a} z {b}', { a: c.db[0], b: c.db[1] }), K.t('nádraží DB přístupných na vozíku'), K.t('{pct} podle DB InfraGO OpenStation', { pct: pct(c.db[0], c.db[1]) })) +
      '</div>' +
      ('<p class="small muted">' + KP.t('Zdroje: Datenquelle: Bayerisches Landesamt für Statistik') + ', <a href="https://genesis-5-prod-extern.bayern.de/datenbank/online/statistic/22711" target="_blank" rel="noopener">' + KP.t('GENESIS-Online, statistika 22711') + '</a> ' + KP.t('a tabulka 12411-003r (CC BY 4.0)') + '; <a href="https://mobilithek.info/offers/879076212433727488" target="_blank" rel="noopener">' + KP.t('DB InfraGO – OpenStation') + '</a> ' + KP.t('(CC0 1.0), stav 7. 10. 2026.') + '</p>') +
      ('<div class="kr-info-grid"><div class="kr-info"><h3>' + KP.t('Otevřená data o přístupnosti v obvodu') + '</h3>') +
      (open.length ? '<ul class="kr-links">' + open.map(([t, u, l]) => '<li><a href="' + K.esc(u) + '" target="_blank" rel="noopener">' + K.esc(t) + '</a> <span class="small muted">' + K.esc(l) + '</span></li>').join('') + '</ul>'
        : ('<p class="muted small">' + KP.t('Kromě OpenStreetMap a nádraží DB jsme v obvodu nenašli otevřenou sadu o přístupnosti míst.') + '</p>')) +
      ('</div><div class="kr-info"><h3>' + KP.t('Celé Bavorsko') + '</h3><ul class="kr-links">') +
      ('<li><a href="https://mobilithek.info/offers/879076212433727488" target="_blank" rel="noopener">' + KP.t('DB InfraGO – OpenStation (nádraží a zastávky)') + '</a> <span class="small muted">' + KP.t('CC0 1.0') + '</span></li>') +
      ('<li><a href="https://download.geofabrik.de/europe/germany/bayern.html" target="_blank" rel="noopener">' + KP.t('OpenStreetMap – výřez Geofabrik pro Bavorsko') + '</a> <span class="small muted">' + KP.t('ODbL 1.0') + '</span></li>') +
      ('<li><a href="zdroje.html#bavorsko">' + KP.t('Všechny zdroje pro Bavorsko a jejich licence') + '</a></li></ul></div></div>'), { label: 'kr-by-h' });
  }

  async function renderKraj(k) {
    const r = K.regionByName(k);
    let list = [];
    try { list = (await K.loadRegion(r.id)).filter(p => p.k === k); }
    catch (e) { $('#kr-body').innerHTML = sec(('<p class="callout">' + KP.t('Data o místech se nepodařilo načíst. Zkuste stránku obnovit.') + '</p>'), { tight: true }); return; }
    ALL = list;
    const de = r.zeme === 'de';
    const a = aggregate(list);
    const name = fullName(k);
    document.title = name + ' · kudyprojedu.cz';
    $('#kr-title').textContent = name;
    const kick = document.querySelector('.kr-head .kicker'); if (kick) kick.textContent = de ? K.t('Bavorsko · vládní obvod') : K.t('Česko · kraj');
    $('#crumb-kraj').outerHTML = '<span aria-hidden="true">›</span><span aria-current="page">' + K.esc(name) + '</span>';
    $('#kr-lede').textContent = (de ? K.t('Vládní obvod v Bavorsku ({de}).', { de: BY_CTX[k] ? BY_CTX[k].de : '' }) + ' ' : '') + K.t(de ? KP.t('V databázi je {n} {mist} z tohoto obvodu.') : KP.t('V databázi je {n} {mist} z tohoto kraje.'), { n: nf(a.n), mist: plural(a.n, K.t('místo'), K.t('místa'), K.t('míst')) }) + ' ' + K.t('Přístupných na vozíku je {pct} z těch, u kterých známe vstup.', { pct: pct(a.w.yes, a.acc) }) + (de ? ' ' + K.t('Názvy míst ponecháváme německy.') : '');

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
        kpi(nf(a.n), KP.t('míst v databázi'), K.t('{a} s údajem o vstupu, {b} parkovišť ZTP', { a: nf(a.acc), b: nf(a.park) })) +
        kpi(nf(a.w.yes), KP.t('přístupných na vozíku'), K.t('{pct} míst s údajem o vstupu', { pct: pct(a.w.yes, a.acc) })) +
        kpi(nf(a.tYes), KP.t('míst s bezbariérovým WC'), K.t('z toho {n} veřejných toalet', { n: nf(a.wcPublicYes) })) +
        kpi(nf(a.parkSpots), KP.t('vyhrazených stání ZTP'), K.t('na {n} parkovištích', { n: nf(a.park) })) +
        '</div>', { tight: true }) +

      sec(('<div class="split-grid"><div class="split-h"><p class="kicker">' + KP.t('Vstup') + '</p><h2 id="kr-share-h">' + KP.t('Přístupnost vstupu') + '</h2><p class="muted small">') + K.t('{n} míst s údajem o vstupu (parkoviště nepočítáme). Hodnoty zadali dobrovolníci do OpenStreetMap.', { n: nf(a.acc) }) + '</p></div>' +
        '<div class="split-b kr-share">' + shareBar(a.w, a.acc) + '</div></div>', { label: 'kr-share-h' }) +

      sec(head('kr-map-h', KP.t('Místa na mapě'), '', KP.t('Mapa')) +
        '<div class="kr-map-tools"><label class="check"><input type="checkbox" id="kr-park"> ' + K.t('Zobrazit i parkování ZTP ({n})', { n: nf(a.park) }) + '</label><a class="btn btn-ghost" href="mapa.html?kraj=' + encodeURIComponent(k) + ('">' + KP.t('Otevřít velkou mapu') + '</a></div>') +
        '<div class="kr-map-wrap"><div id="kr-map" class="map-canvas" role="region" aria-label="' + (de ? K.t('Mapa míst v obvodu') : K.t('Mapa míst v kraji')) + '"></div></div>' +
        '<div id="kr-pick" class="kr-pickcard" hidden></div>', { label: 'kr-map-h' }) +

      sec('<div class="kr-two">' +
        ('<div aria-labelledby="kr-city-h"><p class="kicker">' + KP.t('Obce') + '</p><h2 class="kr-h" id="kr-city-h">' + KP.t('Obce s nejvíce místy') + '</h2><p class="muted small">' + KP.t('Počet míst v databázi a podíl přístupných vstupů. Odkaz otevře obec na mapě.') + '</p>') +
        '<ol class="kr-hbars">' + topCities.map(c => '<li><a href="mapa.html?kraj=' + encodeURIComponent(k) + '&amp;q=' + encodeURIComponent(c.o) + '">' + K.esc(c.o) + '</a>' +
          '<span class="kr-hbar"><i style="width:' + (c.n / maxCity * 100).toFixed(1) + '%"></i></span><span class="num">' + nf(c.n) + '</span>' +
          '<small class="muted">' + K.t('přístupných {pct}', { pct: pct(c.yes, c.acc) }) + '</small></li>').join('') + '</ol></div>' +
        ('<div aria-labelledby="kr-cat-h"><p class="kicker">' + KP.t('Kategorie') + '</p><h2 class="kr-h" id="kr-cat-h">' + KP.t('Druhy míst') + '</h2><p class="muted small">') + (de ? K.t('Kolik míst je v obvodu v jednotlivých kategoriích.') : K.t('Kolik míst je v kraji v jednotlivých kategoriích.')) + '</p>' +
        '<ol class="kr-hbars kr-cats">' + cats.map(([c, v]) => '<li><span>' + K.esc(K.CATS[c] ? K.CATS[c].label : c) + '</span>' +
          '<span class="kr-hbar"><i style="width:' + (v / maxCat * 100).toFixed(1) + '%"></i></span><span class="num">' + nf(v) + '</span></li>').join('') + '</ol></div>' +
        '</div>') +

      sec(head('kr-gap-h', KP.t('Kde chybí data'), '', KP.t('Mezery v datech')) +
        '<p class="text">' + K.t(de ? KP.t('U {pct} míst v obvodu ({a} z {b}) nevíme, jestli mají bezbariérovou toaletu. Pro člověka na vozíku je to často rozhodující údaj. Obce níže mají nejvyšší podíl míst bez něj; počítáme jen obce s aspoň 10 místy.') : KP.t('U {pct} míst v kraji ({a} z {b}) nevíme, jestli mají bezbariérovou toaletu. Pro člověka na vozíku je to často rozhodující údaj. Obce níže mají nejvyšší podíl míst bez něj; počítáme jen obce s aspoň 10 místy.'), { pct: pct(tUnkTotal, wcRelTotal), a: nf(tUnkTotal), b: nf(wcRelTotal) }) + '</p>' +
        (gaps.length ? ('<div class="table-wrap"><table class="data kr-gap"><caption class="sr-only">' + KP.t('Obce s nejvyšším podílem míst bez údaje o toaletě') + '</caption><thead><tr><th scope="col">' + KP.t('Obec') + '</th><th scope="col" class="num">' + KP.t('Míst') + '</th><th scope="col" class="num">' + KP.t('Bez údaje o WC') + '</th><th scope="col" class="num">' + KP.t('Bez popisu, měření a fotky') + '</th><th scope="col" class="num">' + KP.t('Bez údaje o vstupu') + '</th></tr></thead><tbody>') +
          gaps.map(c => '<tr><th scope="row"><a href="mapa.html?kraj=' + encodeURIComponent(k) + '&amp;q=' + encodeURIComponent(c.o) + '">' + K.esc(c.o) + '</a></th><td class="num">' + nf(c.wcRel) + '</td><td class="num"><b>' + pct(c.tUnk, c.wcRel) + '</b></td><td class="num">' + pct(c.noDetail, c.acc) + '</td><td class="num">' + pct(c.wUnk, c.acc) + '</td></tr>').join('') +
          '</tbody></table></div>' : '<p class="muted">' + (de ? K.t('V obvodu není obec s aspoň 10 místy, u kterých by údaj o WC dával smysl.') : K.t('V kraji není obec s aspoň 10 místy, u kterých by údaj o WC dával smysl.')) + '</p>') +
        ('<p class="small muted text" style="margin-top:12px">' + KP.t('„Bez popisu, měření a fotky“ znamená, že u místa není slovní popis, počet schodů, šířka dveří, rampa ani fotografie. Údaj o vstupu má v databázi skoro každé místo, protože bez něj místo do mapy nebereme; chybějící místa proto v tabulce nejsou vidět vůbec.') + '</p>') +
        ('<div class="row" style="margin-top:20px"><a class="btn btn-primary" href="pro-firmy.html#obce">' + KP.t('Zmapovat obec s námi') + '</a><a class="btn btn-ghost" href="pridat.html">' + KP.t('Doplnit údaj o místě') + '</a></div>'),
        { label: 'kr-gap-h' }) +
      (de ? byContextHtml(k) : infoHtml(k));

    const base = list.filter(p => p.c !== 'parkovani');
    setupMap(base, true);
    $('#kr-park').addEventListener('change', e => { if (map) { const l = e.target.checked ? list : base; map.setPlaces(l, { colorOf, onClick: pick }); } });
  }

  function colorOf(p) { if (p.c === 'parkovani') return 'park'; const n = K.getNeeds(); return n.active ? K.match(p, n).status : K.generalStatus(p); }
  function pick(p) {
    const el = $('#kr-pick'); if (!el) { location.href = K.placeUrl(p); return; }
    const w = K.W[p.w || 'null'];
    el.hidden = false;
    el.innerHTML = '<div><b>' + K.esc(p.n) + '</b><div class="small muted">' + K.esc([p.s && K.t(p.s), p.o].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="row" style="gap:8px;margin-top:6px">' + (p.c !== 'parkovani' ? K.statusHtml(w.st, w.label) : '') + (p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : '') + (p.pk ? '<span class="fact">' + p.pk + K.t('× ZTP') + '</span>' : '') + '</div></div>' +
      '<a class="btn btn-primary" href="' + K.placeUrl(p) + ('">' + KP.t('Detail místa') + '</a>');
    if (map) map.focus(p);
  }

  async function setupMap(list, withMap) {
    map = null;
    const el = $('#kr-map'); if (!el || !withMap) return;
    try {
      map = await KPMap.create(el);
      map.setPlaces(list, { colorOf, onClick: pick });
      map.fitTo(list);
    } catch (e) { el.innerHTML = ('<p class="empty">' + KP.t('Mapu se nepodařilo načíst.') + '</p>'); }
  }

  async function init() {
    const sp = new URLSearchParams(location.search);
    const want = (sp.get('k') || '').trim();
    let stats = null;
    try { [IDX, stats, INFO] = await Promise.all([K.loadRegionsIndex(), K.loadStats().catch(() => null), fetch('data/kraje_info.json').then(r => r.ok ? r.json() : null).catch(() => null)]); }
    catch (e) { $('#kr-body').innerHTML = sec(('<p class="callout">' + KP.t('Data o místech se nepodařilo načíst. Zkuste stránku obnovit.') + '</p>'), { tight: true }); return; }
    if (stats && stats.fetched) $('#kr-fetched').textContent = K.fmtDate(stats.fetched);
    const byZ = (z) => IDX.filter(r => r.zeme === z).map(r => r.nazev).sort((a, b) => a.localeCompare(b, 'cs'));
    const kraje = byZ('cz').concat(byZ('de'));
    const sel = $('#kr-select');
    sel.innerHTML = ('<option value="">' + KP.t('Přehled krajů a obvodů') + '</option>') + ['cz', 'de'].map(z => '<optgroup label="' + K.ZEME[z] + (z === 'de' ? (' ' + KP.t('– vládní obvody')) : (' ' + KP.t('– kraje'))) + '">' +
      byZ(z).map(k => '<option value="' + K.esc(k) + '">' + K.esc(fullName(k)) + '</option>').join('') + '</optgroup>').join('');
    sel.addEventListener('change', () => { location.href = sel.value ? shortSlug(sel.value) : 'kraj.html'; });
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*kraj\s*/g, '').replace(/^kraj\s*/, '').trim();
    const match = want ? (kraje.find(k => norm(k) === norm(want)) || kraje.find(k => norm(want).length > 3 && norm(k).includes(norm(want)))) : null;
    if (want && !match) {
      $('#kr-body').innerHTML = sec('<p class="callout">' + K.t('Kraj ani obvod „{k}“ neznáme. Vyberte ho ze seznamu výše.', { k: K.esc(want) }) + '</p>', { tight: true });
      renderOverviewAppend(stats);
      return;
    }
    if (match) { sel.value = match; $('#kr-body').innerHTML = sec(('<p class="muted">' + KP.t('Načítám místa…') + '</p>'), { tight: true }); renderKraj(match); } else renderOverview(stats);
  }
  function renderOverviewAppend(stats) { const note = $('#kr-body').innerHTML; renderOverview(stats); $('#kr-body').insertAdjacentHTML('afterbegin', note); }

  init();
})();
