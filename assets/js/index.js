/* Úvodní stránka: všechna čísla se počítají z data/stats.json (by_zeme a by_region – Česko a Bavorsko) */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const nf = (n) => K.nf(n || 0);
  const t = (k, p) => K.t(k, p);
  const krajName = (k, z) => K.krajName(k, z);

  // Místa s fotkou: skutečné záznamy z data/regions (stav 5. 10. 2026 Česko, 7. 10. 2026 Bavorsko), vybrané pevným
  // pravidlem, ne náhodně: vstup přístupný (w=yes), fotka na Commons (img), známá obec; seřazeno podle počtu úprav
  // v OSM (v), každá kategorie nejvýš 2×, nádraží nejvýš 1×. Počáteční zaměření platformy: 4 místa z Jihočeského kraje,
  // 2 z Dolního Bavorska a 2 z Horní Falce (bavorské obvody u hranice s jižními Čechami). Z Dolního Bavorska je
  // vynechaná Universität Passau, protože má v datech jako obec jen část města (Bergkeller).
  // Data se na úvodu kvůli fotkám nenačítají. Když stats.json začne nést pole „featured“, použije se to.
  const FEATURED = [
    { i: 'w28373782', _r: 'cz-jihocesky', n: 'Kamenný most', o: 'Písek', k: 'Jihočeský', c: 'pamatky', img: 'File:Písek, Kamenný most a nábřeží.JPG' },
    { i: 'n5673497189', _r: 'cz-jihocesky', n: 'Strakonice', o: 'Strakonice', k: 'Jihočeský', c: 'doprava', img: 'File:Bahnhof Strakonice 2008-07-11.jpg' },
    { i: 'w49939104', _r: 'cz-jihocesky', n: 'Galerie Dvořák', o: 'České Budějovice', k: 'Jihočeský', c: 'obchody', img: 'File:ČB, nám PO II, domy 36 a 37.jpg' },
    { i: 'n3254381661', _r: 'cz-jihocesky', n: 'Bludný kámen', o: 'České Budějovice', k: 'Jihočeský', c: 'pamatky', img: 'File:Bludny kamen - The devious stone, kdo na tenhle kamen slapne vecer, bude celou noc bloudit -) moc mile - panoramio.jpg' },
    { i: 'w24771505', _r: 'de-dolni-bavorsko', z: 'de', n: 'Dom St. Stephan', o: 'Passau', k: 'Dolní Bavorsko', c: 'pamatky', img: 'File:Passauer Dom.jpg' },
    { i: 'w38325155', _r: 'de-dolni-bavorsko', z: 'de', n: 'Neues Rathaus', o: 'Passau', k: 'Dolní Bavorsko', c: 'urady', img: 'File:Passau Neues Rathaus 01.jpg' },
    { i: 'w39962246', _r: 'de-horni-falc', z: 'de', n: 'Dom Sankt Peter', o: 'Regensburg', k: 'Horní Falc', c: 'pamatky', img: 'File:Regensburg Dom 160910.jpg' },
    { i: 'w93576146', _r: 'de-horni-falc', z: 'de', n: 'Historische Wurstkuchl', o: 'Regensburg', k: 'Horní Falc', c: 'restaurace', img: 'File:Wurstlkueche in Regensburg.JPG' },
  ];

  function renderPhotos(list) {
    const el = $('#photos'); if (!el) return;
    el.innerHTML = list.filter(p => p && p.i && p.n).map(p => {
      const href = K.placeUrl(p);
      const cat = K.CATS[p.c] ? K.CATS[p.c].label : '';
      return '<li class="ph-item">' +
        (p.img ? '<figure class="photo"><a href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async" width="640" height="480"></a>' +
          '<figcaption>' + t('Foto:') + ' <a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>' : '') +
        '<h3><a href="' + href + '">' + K.esc(p.n) + '</a></h3>' +
        '<p class="ph-meta">' + K.esc(p.o) + (p.k ? ' · ' + K.esc(krajName(p.k, p.z)) : '') + (p.z === 'de' ? ' · ' + K.esc(K.ZEME.de) : '') + '</p>' +
        '<p class="ph-meta">' + K.statusHtml('ok', t('Vstup přístupný')) + (cat ? ' <span class="muted">' + K.esc(cat) + '</span>' : '') + '</p>' +
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
    const br0 = st.by_region || {}, z0 = st.by_zeme || {};
    const vals = { total: t.total, w_yes: t.w_yes, w_limited: t.w_limited, x: t.x, img: t.img, parkovani: c.parkovani,
      jc: (br0['cz-jihocesky'] || {}).total, de: (z0.de || {}).total };
    document.querySelectorAll('[data-stat]').forEach(el => { const v = vals[el.dataset.stat]; el.textContent = v == null ? '–' : nf(v); });
    const z = st.by_zeme || {};
    const zl = $('#zeme-split');
    if (zl && z.cz && z.de) zl.textContent = K.t('Česko {a} · Bavorsko {b} míst', { a: nf(z.cz.total), b: nf(z.de.total) });

    // Pruh: podíl stavů vstupu; čísla jsou vždy i v legendě (tvar + text)
    const parts = [['ok', t.w_yes, K.t('Přístupné')], ['part', t.w_limited, K.t('Částečně')], ['no', t.w_no, K.t('Nepřístupné')]];
    const sum = parts.reduce((a, p) => a + (p[1] || 0), 0) || 1;
    if ($('#split')) $('#split').innerHTML = parts.map(([k, v]) => '<span class="' + k + '" style="width:' + ((v || 0) / sum * 100).toFixed(2) + '%"></span>').join('');
    if ($('#split-legend')) $('#split-legend').innerHTML = parts.map(([k, v, l]) => '<li class="rule-row"><span class="status ' + k + '"><i></i>' + l + '</span><span class="num">' + nf(v) + '</span><span class="num muted">' + Math.round((v || 0) / sum * 100) + ' %</span></li>').join('') +
      (t.w_None ? '<li class="rule-row split-none"><span class="muted">' + K.t('Bez údaje o vstupu (hlavně parkoviště a WC)') + '</span><span class="num">' + nf(t.w_None) + '</span><span></span></li>' : '');

    // Kategorie: textový výpis s živými počty, seřazeno od největší
    $('#tiles').innerHTML = Object.entries(K.CATS).filter(([k]) => c[k]).sort((a, b) => c[b[0]] - c[a[0]]).map(([k, cat]) =>
      '<li><a class="rule-row cat-row" href="mapa.html?kat=' + k + '"><b>' + cat.label + '</b><span class="cat-n"><span class="num">' + nf(c[k]) + '</span> ' + K.plural(c[k], 'místo', 'místa', 'míst') + '</span></a></li>').join('');

    // Kraje a vládní obvody: po zemích abecedně; tenký pruh ukazuje počet míst
    const br = st.by_region || {};
    let kr = Object.values(br).filter(r => r.nazev).map(r => [r.nazev, r.total, r.zeme]);
    if (!kr.length) kr = Object.entries(st.kraje || {}).filter(([k]) => k).map(([k, n]) => [k, n, 'cz']);
    const max = Math.max(1, ...kr.map(x => x[1]));
    $('#kraje').innerHTML = ['cz', 'de'].map(zz => {
      const g = kr.filter(x => x[2] === zz).sort((a, b) => krajName(a[0], zz).localeCompare(krajName(b[0], zz), K.LANG)); if (!g.length) return '';
      return '<li class="kraj-group"><p class="kicker">' + K.esc(K.ZEME[zz]) + ' · ' + K.t(zz === 'de' ? 'vládní obvody' : 'kraje') + '</p></li>' +
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

  // Ceny členství podle jazyka (KP.tierPrice); úroveň se přepíná v core.js
  function renderTierPrices() { document.querySelectorAll('[data-tier-price]').forEach(el => { el.textContent = K.tierPrice(el.dataset.tierPrice); }); }

  function init() {
    renderTierPrices();
    renderPhotos(FEATURED);
    bindTowns();
    K.loadStats().then(render).catch(() => {
      document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = '–'; });
      $('#tiles').innerHTML = '<li class="rule-row muted">' + K.t('Data se nepodařilo načíst. Otevřete web přes server, ne jako soubor.') + '</li>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
