/* Úvodní stránka: všechna čísla se počítají z data/stats.json (by_zeme a by_region – Česko a Bavorsko) */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const nf = (n) => Number(n || 0).toLocaleString('cs-CZ');
  const plural = (n, one, few, many) => n === 1 ? one : n > 1 && n < 5 ? few : many;
  const krajName = (k, z) => K.krajName(k, z);

  // Místa s fotkou: skutečné záznamy z data/places.json (stav 5. 10. 2026), vybrané pevným pravidlem, ne náhodně:
  // vstup přístupný (w=yes), fotka na Commons (img), známá obec a kraj; z každého z 8 krajů s nejvíce místy
  // místo s nejvíce úpravami v OSM (v), každá kategorie nejvýš 2×, nádraží nejvýš 1×.
  // Bavorsko stejným pravidlem: ze 4 vládních obvodů s nejvíce místy (stav 7. 10. 2026), kategorie nejvýš 2×, nádraží 1×.
  // Data se na úvodu kvůli fotkám nenačítají. Když stats.json začne nést pole „featured“, použije se to.
  const FEATURED = [
    { i: 'w4053134', _r: 'cz-hlavni-mesto-praha', n: 'Karlův most', o: 'Praha', k: 'Hlavní město Praha', c: 'pamatky', img: 'File:Prague 07-2016 View from Petrinska Tower img2.jpg' },
    { i: 'w98290906', _r: 'cz-moravskoslezsky', n: 'Forum Nová Karolina', o: 'Ostrava', k: 'Moravskoslezský', c: 'obchody', img: 'File:Nova Karolina 2012.jpg' },
    { i: 'w29239083', _r: 'cz-jihomoravsky', n: 'Vaňkovka', o: 'Brno', k: 'Jihomoravský', c: 'obchody', img: 'File:Brno Galerie Vaňkovka.jpg' },
    { i: 'n24593605', _r: 'cz-stredocesky', n: 'Říčany', o: 'Říčany', k: 'Středočeský', c: 'doprava', img: 'File:Nádraží Říčany, budova, pohled z kolejiště.jpg' },
    { i: 'n5542528696', _r: 'cz-plzensky', n: 'CrossCafe', o: 'Plzeň', k: 'Plzeňský', c: 'restaurace', img: 'File:Kateřinská (032).jpg' },
    { i: 'w28373782', _r: 'cz-jihocesky', n: 'Kamenný most', o: 'Písek', k: 'Jihočeský', c: 'pamatky', img: 'File:Písek, Kamenný most a nábřeží.JPG' },
    { i: 'n1289293691', _r: 'cz-ustecky', n: 'Čínoherní studio', o: 'Ústí nad Labem', k: 'Ústecký', c: 'kultura', img: 'File:Ústí nad Labem - ulice Varšavská, Činoherní studio obr03.jpg' },
    { i: 'n3617604789', _r: 'cz-olomoucky', n: 'Wiener Kaffeehaus', o: 'Jeseník', k: 'Olomoucký', c: 'restaurace', img: 'File:Wiener Kaffeehaus, Priessnitz, Jeseník.jpg' },
    { i: 'w15804929', _r: 'de-horni-bavorsko', z: 'de', n: 'BMW Welt', o: 'München', k: 'Horní Bavorsko', c: 'pamatky', img: 'File:File:Bmwwelt2.jpg' },
    { i: 'w122811589', _r: 'de-stredni-franky', z: 'de', n: 'Universitätsklinikum Erlangen', o: 'Erlangen', k: 'Střední Franky', c: 'zdravi', img: 'File:Unikrankenhaus erlangen1.jpg' },
    { i: 'w152803329', _r: 'de-svabsko', z: 'de', n: 'Glacis-Galerie', o: 'Neu-Ulm', k: 'Švábsko', c: 'obchody', img: 'File:Glacis-Galerie Heiner-Metzger-Platz.jpg' },
    { i: 'n27453687', _r: 'de-dolni-franky', z: 'de', n: 'Würzburg Hauptbahnhof', o: 'Würzburg', k: 'Dolní Franky', c: 'doprava', img: 'File:Würzburg Hauptbahnhof Empfangsgebäude 0516.jpg' },
  ];

  function renderPhotos(list) {
    const el = $('#photos'); if (!el) return;
    el.innerHTML = list.filter(p => p && p.i && p.n).map(p => {
      const href = K.placeUrl(p);
      const cat = K.CATS[p.c] ? K.CATS[p.c].label : '';
      return '<li class="ph-item">' +
        (p.img ? '<figure class="photo"><a href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async" width="640" height="480"></a>' +
          '<figcaption>Foto: <a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>' : '') +
        '<h3><a href="' + href + '">' + K.esc(p.n) + '</a></h3>' +
        '<p class="ph-meta">' + K.esc(p.o) + (p.k ? ' · ' + K.esc(krajName(p.k, p.z)) : '') + (p.z === 'de' ? ' · Bavorsko' : '') + '</p>' +
        '<p class="ph-meta">' + K.statusHtml('ok', 'Vstup přístupný') + (cat ? ' <span class="muted">' + K.esc(cat) + '</span>' : '') + '</p>' +
        '</li>';
    }).join('');
    // Fotka, která se nenačte, zmizí; položka zůstane jako text
    el.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { const f = img.closest('figure'); if (f) f.remove(); }, { once: true }));
  }

  // Součet za obě země (by_zeme); když chybí, starý formát jen pro ČR
  function totals(st) {
    const zs = Object.values(st.by_zeme || {});
    if (!zs.length) { const c = st.cats || {}; return { total: st.total, w_yes: c.w_yes, w_limited: c.w_limited, w_no: c.w_no, w_None: c.w_None, x: st.measured, cats: c }; }
    const t = { total: 0, w_yes: 0, w_limited: 0, w_no: 0, w_None: 0, x: 0, r: 0, img: 0, cats: {} };
    zs.forEach(z => {
      ['total', 'w_yes', 'w_limited', 'w_no', 'w_None', 'x', 'r', 'img'].forEach(k => { t[k] += z[k] || 0; });
      Object.entries(z.cats || {}).forEach(([k, v]) => { t.cats[k] = (t.cats[k] || 0) + v; });
    });
    return t;
  }

  function render(st) {
    const t = totals(st), c = t.cats || {};
    const vals = { total: t.total, w_yes: t.w_yes, w_limited: t.w_limited, x: t.x, parkovani: c.parkovani };
    document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = nf(vals[el.dataset.stat]); });
    const z = st.by_zeme || {};
    const zl = $('#zeme-split');
    if (zl && z.cz && z.de) zl.textContent = 'Česko ' + nf(z.cz.total) + ' · Bavorsko ' + nf(z.de.total) + ' míst';

    // Pruh: podíl stavů vstupu; čísla jsou vždy i v legendě (tvar + text)
    const parts = [['ok', t.w_yes, 'Přístupné'], ['part', t.w_limited, 'Částečně'], ['no', t.w_no, 'Nepřístupné']];
    const sum = parts.reduce((a, p) => a + (p[1] || 0), 0) || 1;
    $('#split').innerHTML = parts.map(([k, v]) => '<span class="' + k + '" style="width:' + ((v || 0) / sum * 100).toFixed(2) + '%"></span>').join('');
    $('#split-legend').innerHTML = parts.map(([k, v, l]) => '<li class="rule-row"><span class="status ' + k + '"><i></i>' + l + '</span><span class="num">' + nf(v) + '</span><span class="num muted">' + Math.round((v || 0) / sum * 100) + ' %</span></li>').join('') +
      (t.w_None ? '<li class="rule-row split-none"><span class="muted">Bez údaje o vstupu (hlavně parkoviště a WC)</span><span class="num">' + nf(t.w_None) + '</span><span></span></li>' : '');

    // Kategorie: textový výpis s živými počty, seřazeno od největší
    $('#tiles').innerHTML = Object.entries(K.CATS).filter(([k]) => c[k]).sort((a, b) => c[b[0]] - c[a[0]]).map(([k, cat]) =>
      '<li><a class="rule-row cat-row" href="mapa.html?kat=' + k + '"><b>' + cat.label + '</b><span class="cat-n"><span class="num">' + nf(c[k]) + '</span> ' + plural(c[k], 'místo', 'místa', 'míst') + '</span></a></li>').join('');

    // Kraje a vládní obvody: po zemích abecedně; tenký pruh ukazuje počet míst
    const br = st.by_region || {};
    let kr = Object.values(br).filter(r => r.nazev).map(r => [r.nazev, r.total, r.zeme]);
    if (!kr.length) kr = Object.entries(st.kraje || {}).filter(([k]) => k).map(([k, n]) => [k, n, 'cz']);
    const max = Math.max(1, ...kr.map(x => x[1]));
    $('#kraje').innerHTML = ['cz', 'de'].map(zz => {
      const g = kr.filter(x => x[2] === zz).sort((a, b) => a[0].localeCompare(b[0], 'cs')); if (!g.length) return '';
      return '<li class="kraj-group"><p class="kicker">' + K.ZEME[zz] + (zz === 'de' ? ' · vládní obvody' : ' · kraje') + '</p></li>' +
        g.map(([k, n]) => '<li><a class="rule-row" href="kraj.html?k=' + encodeURIComponent(k) + '"><b>' + K.esc(krajName(k, zz)) + '</b><span class="num">' + nf(n) + '</span><span class="kr-line" aria-hidden="true"><i style="width:' + (n / max * 100).toFixed(1) + '%"></i></span></a></li>').join('');
    }).join('');

    $('#hero-obce').innerHTML = (st.cities || []).filter(x => x.o).slice(0, 400).map(x => '<option value="' + K.esc(x.o) + '">').join('');

    if (Array.isArray(st.featured) && st.featured.length) renderPhotos(st.featured.slice(0, 12));
  }

  // Našeptávač obcí v obou zemích: data/regions/obce.json se stáhne až při prvním kliknutí do hledání
  function bindTowns() {
    const q = $('#hq'); if (!q) return;
    q.addEventListener('focus', () => {
      K.loadTowns().then(t => { $('#hero-obce').innerHTML = t.slice(0, 1000).map(x => '<option value="' + K.esc(x[0]) + '">').join(''); }).catch(() => {});
    }, { once: true });
  }

  function init() {
    renderPhotos(FEATURED);
    bindTowns();
    K.loadStats().then(render).catch(() => {
      document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = '–'; });
      $('#tiles').innerHTML = '<li class="rule-row muted">Data se nepodařilo načíst. Otevřete web přes server, ne jako soubor.</li>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
