/* Úvodní stránka: všechna čísla se počítají z data/stats.json */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const nf = (n) => Number(n || 0).toLocaleString('cs-CZ');
  const plural = (n, one, few, many) => n === 1 ? one : n > 1 && n < 5 ? few : many;
  const krajName = (k) => k === 'Hlavní město Praha' ? k : k === 'Vysočina' ? 'Kraj Vysočina' : k + ' kraj';

  // Místa s fotkou: skutečné záznamy z data/places.json (stav 5. 10. 2026), vybrané pevným pravidlem, ne náhodně:
  // vstup přístupný (w=yes), fotka na Commons (img), známá obec a kraj; z každého z 8 krajů s nejvíce místy
  // místo s nejvíce úpravami v OSM (v), každá kategorie nejvýš 2×, nádraží nejvýš 1×.
  // Celý places.json (9 MB) se na úvodu kvůli osmi fotkám nenačítá. Když stats.json začne nést pole „featured“, použije se to.
  const FEATURED = [
    { i: 'w4053134', n: 'Karlův most', o: 'Praha', k: 'Hlavní město Praha', c: 'pamatky', img: 'File:Prague 07-2016 View from Petrinska Tower img2.jpg' },
    { i: 'w98290906', n: 'Forum Nová Karolina', o: 'Ostrava', k: 'Moravskoslezský', c: 'obchody', img: 'File:Nova Karolina 2012.jpg' },
    { i: 'w29239083', n: 'Vaňkovka', o: 'Brno', k: 'Jihomoravský', c: 'obchody', img: 'File:Brno Galerie Vaňkovka.jpg' },
    { i: 'n24593605', n: 'Říčany', o: 'Říčany', k: 'Středočeský', c: 'doprava', img: 'File:Nádraží Říčany, budova, pohled z kolejiště.jpg' },
    { i: 'n5542528696', n: 'CrossCafe', o: 'Plzeň', k: 'Plzeňský', c: 'restaurace', img: 'File:Kateřinská (032).jpg' },
    { i: 'w28373782', n: 'Kamenný most', o: 'Písek', k: 'Jihočeský', c: 'pamatky', img: 'File:Písek, Kamenný most a nábřeží.JPG' },
    { i: 'n1289293691', n: 'Čínoherní studio', o: 'Ústí nad Labem', k: 'Ústecký', c: 'kultura', img: 'File:Ústí nad Labem - ulice Varšavská, Činoherní studio obr03.jpg' },
    { i: 'n3617604789', n: 'Wiener Kaffeehaus', o: 'Jeseník', k: 'Olomoucký', c: 'restaurace', img: 'File:Wiener Kaffeehaus, Priessnitz, Jeseník.jpg' },
  ];

  function renderPhotos(list) {
    const el = $('#photos'); if (!el) return;
    el.innerHTML = list.filter(p => p && p.i && p.n).map(p => {
      const href = 'misto.html?id=' + encodeURIComponent(p.i);
      const cat = K.CATS[p.c] ? K.CATS[p.c].label : '';
      return '<li class="ph-item">' +
        (p.img ? '<figure class="photo"><a href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async" width="640" height="480"></a>' +
          '<figcaption>Foto: <a href="' + K.esc(K.commonsPage(p.img)) + '" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>' : '') +
        '<h3><a href="' + href + '">' + K.esc(p.n) + '</a></h3>' +
        '<p class="ph-meta">' + K.esc(p.o) + (p.k ? ' · ' + K.esc(krajName(p.k)) : '') + '</p>' +
        '<p class="ph-meta">' + K.statusHtml('ok', 'Vstup přístupný') + (cat ? ' <span class="muted">' + K.esc(cat) + '</span>' : '') + '</p>' +
        '</li>';
    }).join('');
    // Fotka, která se nenačte, zmizí; položka zůstane jako text
    el.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { const f = img.closest('figure'); if (f) f.remove(); }, { once: true }));
  }

  function render(st) {
    const c = st.cats || {};
    const vals = { total: st.total, w_yes: c.w_yes, w_limited: c.w_limited, t_yes: c.t_yes, parkovani: c.parkovani };
    document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = nf(vals[el.dataset.stat]); });
    if (st.fetched) $('#fetched').textContent = K.fmtDate(st.fetched);

    // Pruh: podíl stavů vstupu; čísla jsou vždy i v legendě (tvar + text)
    const parts = [['ok', c.w_yes, 'Přístupné'], ['part', c.w_limited, 'Částečně'], ['no', c.w_no, 'Nepřístupné']];
    const sum = parts.reduce((a, p) => a + (p[1] || 0), 0) || 1;
    $('#split').innerHTML = parts.map(([k, v]) => '<span class="' + k + '" style="width:' + ((v || 0) / sum * 100).toFixed(2) + '%"></span>').join('');
    $('#split-legend').innerHTML = parts.map(([k, v, l]) => '<li class="rule-row"><span class="status ' + k + '"><i></i>' + l + '</span><span class="num">' + nf(v) + '</span><span class="num muted">' + Math.round((v || 0) / sum * 100) + ' %</span></li>').join('') +
      (c.w_None ? '<li class="rule-row split-none"><span class="muted">Bez údaje o vstupu (hlavně parkoviště a WC)</span><span class="num">' + nf(c.w_None) + '</span><span></span></li>' : '');

    // Kategorie: textový výpis s živými počty, seřazeno od největší
    $('#tiles').innerHTML = Object.entries(K.CATS).filter(([k]) => c[k]).sort((a, b) => c[b[0]] - c[a[0]]).map(([k, cat]) =>
      '<li><a class="rule-row cat-row" href="mapa.html?kat=' + k + '"><b>' + cat.label + '</b><span class="cat-n"><span class="num">' + nf(c[k]) + '</span> ' + plural(c[k], 'místo', 'místa', 'míst') + '</span></a></li>').join('');

    // Kraje: abecedně, ať se dají snadno najít; tenký pruh ukazuje počet míst
    const kr = Object.entries(st.kraje || {}).filter(([k]) => k).sort((a, b) => a[0].localeCompare(b[0], 'cs'));
    const max = Math.max(1, ...kr.map(x => x[1]));
    $('#kraje').innerHTML = kr.map(([k, n]) => '<li><a class="rule-row" href="kraj.html?k=' + encodeURIComponent(k) + '"><b>' + K.esc(krajName(k)) + '</b><span class="num">' + nf(n) + '</span><span class="kr-line" aria-hidden="true"><i style="width:' + (n / max * 100).toFixed(1) + '%"></i></span></a></li>').join('');

    $('#hero-obce').innerHTML = (st.cities || []).filter(x => x.o).slice(0, 400).map(x => '<option value="' + K.esc(x.o) + '">').join('');

    if (Array.isArray(st.featured) && st.featured.length) renderPhotos(st.featured.slice(0, 8));
  }

  function init() {
    renderPhotos(FEATURED);
    K.loadStats().then(render).catch(() => {
      document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = '–'; });
      $('#tiles').innerHTML = '<li class="rule-row muted">Data se nepodařilo načíst. Otevřete web přes server, ne jako soubor.</li>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
