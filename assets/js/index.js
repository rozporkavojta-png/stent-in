/* Úvodní stránka (v4 Wherethru): všechna čísla se počítají z dat (data/stats.json a data/regions), nic se nevymýšlí.
   Hodnocení ani počty recenzí neukazujeme, v datech nejsou. Místo nich počet míst se vstupem přístupným na vozíku. */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const nf = (n) => K.nf(n || 0);
  const t = (k, p) => K.t(k, p);
  const krajName = (k, z) => K.krajName(k, z);

  // Oblíbené cíle: skutečné obce, fotka z Wikimedia Commons stažená zmenšená do assets/img (autor a licence ověřené přes
  // Commons API 14. 10. 2026, seznam v assets/img/CREDITS.md). Počty yes / n spočítané z data/regions/*.json
  // (pole o = obec, w = 'yes'), stav 5. 10. 2026 Česko a 7. 10. 2026 Bavorsko. České obce se po načtení přepíšou
  // hodnotami z data/stats.json (cities), aby čísla vždy seděla s mapou.
  const DEST = [
    { o: 'České Budějovice', k: 'Jihočeský', z: 'cz', yes: 163, n: 425, img: 'mesto-ceske-budejovice.jpg', au: 'Txllxt TxllxT', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', page: 'File:České Budějovice - Náměstí Přemysla Otakara II - Samson Fountain 1727.jpg' },
    { o: 'Český Krumlov', k: 'Jihočeský', z: 'cz', yes: 68, n: 172, img: 'mesto-cesky-krumlov.jpg', au: 'Moebius1', lic: 'CC BY-SA 3.0', licUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', page: 'File:Cesky Krumlov Panorama.jpg' },
    { o: 'Třeboň', k: 'Jihočeský', z: 'cz', yes: 14, n: 54, img: 'mesto-trebon.jpg', au: 'Pohled 111', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', page: 'File:Žižkovo náměstí (Třeboň) 01.jpg' },
    { o: 'Železná Ruda', sub: 'Šumava', k: 'Plzeňský', z: 'cz', yes: 7, n: 23, img: 'mesto-zelezna-ruda.jpg', au: 'Lubor Ferenc', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', page: 'File:Šumava - Černé jezero (2).jpg', alt: 'Černé jezero na Šumavě' },
    { o: 'Passau', k: 'Dolní Bavorsko', z: 'de', yes: 87, n: 183, img: 'mesto-passau.jpg', au: 'Rolf Kranz', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', page: 'File:Passaublick Unterfreinberg, Denkmalensemble Altstadt und Veste Oberhaus.jpg' },
    { o: 'Regensburg', k: 'Horní Falc', z: 'de', yes: 371, n: 687, img: 'mesto-regensburg.jpg', au: 'Tilman2007', lic: 'CC BY-SA 4.0', licUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', page: 'File:Steinerne Brücke und Dom, von Nordwesten Regensburg 20190822 028.jpg' },
  ];

  // Doporučujeme: skutečné záznamy z data/regions (stav 5. 10. 2026 Česko, 7. 10. 2026 Bavorsko), vybrané pevným
  // pravidlem, ne náhodně: vstup přístupný (w=yes), fotka na Commons (img), známá obec; seřazeno podle počtu úprav
  // v OSM (v), každá kategorie nejvýš 2×, nádraží nejvýš 1×. 4 místa z Jihočeského kraje, 2 z Dolního Bavorska
  // a 2 z Horní Falce. Universität Passau je vynechaná, protože má v datech jako obec jen část města (Bergkeller).
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

  const where = (k, z) => K.esc(krajName(k, z || 'cz')) + ' · ' + K.esc(K.ZEME[z || 'cz'] || '');

  function renderDest() {
    const el = $('#dest'); if (!el) return;
    el.innerHTML = DEST.map(d => {
      const href = 'mapa.html?q=' + encodeURIComponent(d.o);
      const title = d.o + (d.sub ? ' · ' + d.sub : '');
      return '<li class="place-tile dest-tile">' +
        '<div class="place-tile-media"><img src="assets/img/' + d.img + '" alt="' + K.esc(d.alt ? t(d.alt) : d.o) + '" width="720" height="540" loading="lazy" decoding="async"></div>' +
        '<span class="place-tile-access" title="' + K.esc(t('Místa přístupná na vozíku')) + '">' + K.icon('wheel') + '</span>' +
        '<div class="place-tile-body">' +
          '<h3><a href="' + href + '">' + K.esc(title) + '</a></h3>' +
          '<p class="meta">' + where(d.k, d.z) + '</p>' +
          '<p class="dest-count"><b data-dest-yes="' + K.esc(d.o) + '">' + nf(d.yes) + '</b> <span data-dest-lbl="' + K.esc(d.o) + '">' + K.esc(t('míst přístupných na vozíku')) + '</span>' +
            ' <span class="muted" data-dest-n="' + K.esc(d.o) + '">' + K.esc(t('z {n} v mapě', { n: nf(d.n) })) + '</span></p>' +
          '<p class="credit">' + t('Foto:') + ' ' + K.esc(d.au) + ', <a href="' + K.esc(K.commonsPage(d.page)) + '" target="_blank" rel="noopener">Wikimedia Commons</a>, <a href="' + d.licUrl + '" target="_blank" rel="noopener">' + d.lic + '</a></p>' +
        '</div></li>';
    }).join('');
  }

  // České obce: přepsat počty hodnotami ze stats.json (cities), když tam obec je
  function updateDest(st) {
    (st.cities || []).forEach(c => {
      const d = DEST.find(x => x.o === c.o && x.z === 'cz'); if (!d) return;
      const sel = (a) => document.querySelector('[' + a + '="' + CSS.escape(d.o) + '"]');
      const y = sel('data-dest-yes'), n = sel('data-dest-n');
      if (y && c.yes != null) y.textContent = nf(c.yes);
      if (n && c.n != null) n.textContent = t('z {n} v mapě', { n: nf(c.n) });
    });
  }

  function renderPhotos(list) {
    const el = $('#photos'); if (!el) return;
    el.innerHTML = list.filter(p => p && p.i && p.n).map(p => {
      const href = K.placeUrl(p);
      const cat = K.CATS[p.c] ? K.CATS[p.c].label : '';
      const on = K.saved.has(p.i);
      return '<li class="place-tile">' +
        '<div class="place-tile-media' + (p.img ? '' : ' no-photo') + '">' + (p.img ? '<img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async" width="640" height="480">' : K.icon(K.CATS[p.c] ? K.CATS[p.c].icon : 'pin')) + '</div>' +
        '<span class="place-tile-access" title="' + K.esc(t('Vstup přístupný')) + '">' + K.icon('wheel') + '</span>' +
        '<button class="place-tile-save" type="button" data-save="' + K.esc(p.i) + '" aria-pressed="' + on + '" aria-label="' + K.esc(t('Uložit místo {name}', { name: p.n })) + '">' + K.icon('heart') + '</button>' +
        '<div class="place-tile-body">' +
          '<h3><a href="' + href + '">' + K.esc(p.n) + '</a></h3>' +
          '<p class="meta">' + K.esc(p.o) + ' · ' + where(p.k, p.z) + '</p>' +
          '<p class="facts">' + K.statusHtml('ok', t('Vstup přístupný')) + (cat ? ' <span class="badge">' + K.esc(cat) + '</span>' : '') + '</p>' +
          (p.img ? '<p class="credit">' + t('Foto:') + ' <a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">' + t('autor a licence na Wikimedia Commons') + '</a></p>' : '') +
        '</div></li>';
    }).join('');
    // Fotka, která se nenačte, se nahradí ikonou kategorie
    el.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
      const m = img.closest('.place-tile-media'); if (m) { m.classList.add('no-photo'); m.innerHTML = K.icon('camera'); }
    }, { once: true }));
    el.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => {
      const p = list.find(x => x.i === b.dataset.save); if (!p) return;
      const on = K.saved.toggle(p.i, p);
      if (!K.saved.blocked) { b.setAttribute('aria-pressed', on); K.toast(t(on ? 'Místo uloženo do profilu.' : 'Místo odebráno z uložených.')); }
    }));
  }
  function syncSaves() { document.querySelectorAll('#photos [data-save]').forEach(b => b.setAttribute('aria-pressed', K.saved.has(b.dataset.save))); }

  // Součet za obě země (by_zeme); když chybí, starý formát jen pro ČR
  function totals(st) {
    const zs = Object.values(st.by_zeme || {});
    if (!zs.length) { const c = st.cats || {}; return { total: st.total, w_yes: c.w_yes, w_limited: c.w_limited, w_no: c.w_no, w_None: c.w_None, x: st.measured, cats: c }; }
    const r = { total: 0, w_yes: 0, w_limited: 0, w_no: 0, w_None: 0, x: 0, r: 0, img: 0, cats: {} };
    zs.forEach(z => {
      ['total', 'w_yes', 'w_limited', 'w_no', 'w_None', 'x', 'r', 'img'].forEach(k => { r[k] += z[k] || 0; });
      Object.entries(z.cats || {}).forEach(([k, v]) => { r.cats[k] = (r.cats[k] || 0) + v; });
    });
    return r;
  }

  function render(st) {
    const tt = totals(st), c = tt.cats || {};
    const br = st.by_region || {}, z = st.by_zeme || {};
    const vals = { total: tt.total, w_yes: tt.w_yes, w_limited: tt.w_limited, x: tt.x, img: tt.img, parkovani: c.parkovani,
      jc: (br['cz-jihocesky'] || {}).total, de: (z.de || {}).total };
    document.querySelectorAll('[data-stat]').forEach(el => { const v = vals[el.dataset.stat]; el.textContent = v == null ? '–' : nf(v); });
    const zl = $('#zeme-split');
    if (zl && z.cz && z.de) zl.textContent = t('Česko {a} · Bavorsko {b} míst', { a: nf(z.cz.total), b: nf(z.de.total) });

    // Kategorie: dlaždice s ikonou a živým počtem, seřazeno od největší
    $('#tiles').innerHTML = Object.entries(K.CATS).filter(([k]) => c[k]).sort((a, b) => c[b[0]] - c[a[0]]).map(([k, cat]) =>
      '<li><a class="cat-tile" href="mapa.html?kat=' + k + '"><span class="cat-tile-ic">' + K.icon(cat.icon) + '</span><b>' + K.esc(cat.label) + '</b><span class="cat-n"><span class="num">' + nf(c[k]) + '</span> ' + K.plural(c[k], 'místo', 'místa', 'míst') + '</span></a></li>').join('');

    // Kraje a vládní obvody: po zemích abecedně; tenký pruh ukazuje počet míst
    let kr = Object.values(br).filter(r => r.nazev).map(r => [r.nazev, r.total, r.zeme]);
    if (!kr.length) kr = Object.entries(st.kraje || {}).filter(([k]) => k).map(([k, n]) => [k, n, 'cz']);
    const max = Math.max(1, ...kr.map(x => x[1]));
    $('#kraje').innerHTML = ['cz', 'de'].map(zz => {
      const g = kr.filter(x => x[2] === zz).sort((a, b) => krajName(a[0], zz).localeCompare(krajName(b[0], zz), K.LANG)); if (!g.length) return '';
      return '<li class="kraj-group"><p class="kicker">' + K.esc(K.ZEME[zz]) + ' · ' + t(zz === 'de' ? 'vládní obvody' : 'kraje') + '</p></li>' +
        g.map(([k, n]) => '<li><a class="rule-row" href="kraj.html?k=' + encodeURIComponent(k) + '"><b>' + K.esc(krajName(k, zz)) + '</b><span class="num">' + nf(n) + '</span><span class="kr-line" aria-hidden="true"><i style="width:' + (n / max * 100).toFixed(1) + '%"></i></span></a></li>').join('');
    }).join('');

    $('#hero-obce').innerHTML = (st.cities || []).filter(x => x.o).slice(0, 400).map(x => '<option value="' + K.esc(x.o) + '">').join('');
    updateDest(st);
    if (Array.isArray(st.featured) && st.featured.length) renderPhotos(st.featured.slice(0, 8));
  }

  // Našeptávač obcí v obou zemích: data/regions/obce.json se stáhne až při prvním kliknutí do hledání
  function bindTowns() {
    const q = $('#hq'); if (!q) return;
    q.addEventListener('focus', () => {
      K.loadTowns().then(list => { $('#hero-obce').innerHTML = list.slice(0, 1000).map(x => '<option value="' + K.esc(x[0]) + '">').join(''); }).catch(() => {});
    }, { once: true });
  }

  // Ceny členství podle jazyka (KP.tierPrice); úroveň se přepíná v core.js
  function renderTierPrices() { document.querySelectorAll('[data-tier-price]').forEach(el => { el.textContent = K.tierPrice(el.dataset.tierPrice); }); }

  function init() {
    renderTierPrices();
    renderDest();
    renderPhotos(FEATURED);
    bindTowns();
    document.addEventListener('kp:saved', syncSaves);
    K.loadStats().then(render).catch(() => {
      document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = '–'; });
      $('#tiles').innerHTML = '<li class="muted">' + t('Data se nepodařilo načíst. Otevřete web přes server, ne jako soubor.') + '</li>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
