/* Stránka Ubytování: výpis míst s c='ubytovani' ze všech regionů v data/regions/ (Česko a Bavorsko; výtah data/regions/ubytovani.json,
   záložně KP.loadAll). Filtry sdílí s mapou (assets/js/filters.js): hledání s tlačítkem Filtry, řada druhů ubytování s ikonami,
   rychlé čipy přístupnosti v lepivé liště (v5), Další filtry (PC okno pod tlačítkem, mobil spodní panel), aktivní filtry, filtry v adrese stránky.
   Filtry pokojů (bezbariérový pokoj, sprcha, madla) jen z údajů, které opravdu máme (rešerše webů provozovatelů, pole r):
   [{ url, date, source_type, claim, items: { vstup, wc, pokoj, koupelna, parkovani, vytah, jine }, measurements: [{ co, hodnota, jednotka }] }] */
(function () {
  'use strict';
  const K = window.KP, KF = window.KPFilters, $ = (s) => document.querySelector(s);
  const PAGE = 30;
  let ALL = [], shown = PAGE, ctrl = null, sortBy = K.store.get('ub.sort', 'complete');
  const nf = (n) => K.nf(n);
  const reports = (p) => (Array.isArray(p.r) ? p.r.filter(r => r && typeof r === 'object') : []);

  // Řazení: „Nejvíc údajů“ dává dopředu ubytování s údaji od provozovatele (jako dřív), ostatní řazení ze sdíleného modulu
  function sorted(list) {
    if (sortBy !== 'complete') return KF.sortList(list, sortBy === 'match' && !K.hasTier('match') ? 'complete' : sortBy);
    const RANK = { yes: 0, limited: 1, null: 2, no: 3 };
    return list.slice().sort((a, b) => (reports(b).length > 0) - (reports(a).length > 0) || b._c - a._c || RANK[String(a.w || 'null')] - RANK[String(b.w || 'null')] || a.n.localeCompare(b.n, 'cs'));
  }

  // Accessibility Match (Explorer): shoda s osobním profilem jen při zapnutém profilu; údaje o vstupu a WC jsou vždy zdarma
  function matchNote() {
    const el = $('#ub-match-note'), needs = K.getNeeds();
    const locked = !K.hasTier('match');
    const txt = locked ? KP.t('Shodu s vašimi potřebami v procentech ukazuje Accessibility Match.')
      : needs.active ? KP.t('U každého ubytování ukazujeme shodu s vaším profilem potřeb.') : KP.t('Nastavte si profil potřeb a u každého ubytování uvidíte shodu v procentech.');
    el.innerHTML = '<span class="ub-mn-ic" aria-hidden="true">' + K.icon('wheel') + '</span><p>' + K.esc(txt) + (locked ? ' ' + K.tierBadge('match') : '') + '</p>' +
      '<button class="btn btn-secondary btn-sm" type="button" data-ub-needs>' + K.icon('sliders') + K.esc(locked ? KP.t('Zobrazit shodu') : needs.active ? KP.t('Upravit potřeby') : KP.t('Nastavit potřeby')) + '</button>';
  }

  function render(reset) {
    if (reset) shown = PAGE;
    matchNote();
    const list = sorted(ctrl.run(ALL));
    const n = list.length, withR = ALL.filter(p => reports(p).length).length;
    $('#ub-count').innerHTML = KP.t('<b class="num">{n}</b> z {all} ubytování', { n: nf(n), all: nf(ALL.length) }) +
      (withR ? '<span class="muted small"> · ' + K.esc(KP.t('{n} s údaji od provozovatele', { n: nf(withR) })) + '</span>' : '');
    $('#ub-list').innerHTML = n ? list.slice(0, shown).map(p => KF.cardHtml(p, { mode: 'link', showCountry: true })).join('')
      : '<li class="empty-state rc-empty">' + K.icon('bed') + '<h3>' + K.esc(KP.t('Filtrům nic neodpovídá.')) + '</h3><p>' + K.esc(KP.t('Zkuste jiný kraj nebo u vstupu zvolte i částečně přístupný.')) + '</p>' +
        ctrl.relaxHtml(3) + (ctrl.state.src.has('web') ? '<p class="small">' + K.esc(KP.t('Údaje z webů provozovatelů teprve doplňujeme.')) + '</p>' : '') +
        '<p class="small"><a href="pridat.html">' + K.esc(KP.t('Znáte přístupné ubytování? Přidejte ho.')) + '</a></p></li>';
    $('#ub-more').hidden = n <= shown;
    $('#ub-more').textContent = KP.t('Zobrazit dalších {n}', { n: Math.min(PAGE, n - shown) });
  }

  function areaOptions(s) {
    const kn = {}; ALL.forEach(p => { if (p.k && (!s.zeme || K.zemeOf(p) === s.zeme)) kn[p.k] = (kn[p.k] || 0) + 1; });
    const kraje = [];
    ['cz', 'de'].forEach(z => Object.keys(kn).filter(k => ((K.regionByName(k) || {}).zeme || 'cz') === z).sort((a, b) => a.localeCompare(b, 'cs'))
      .forEach(k => kraje.push({ value: k, label: K.LANG === 'cs' ? k : K.krajName(k), count: kn[k], group: K.ZEME[z] + ' ' + (z === 'de' ? KP.t('– vládní obvody') : KP.t('– kraje')) })));
    const on = {}; ALL.forEach(p => { if (p.o && (!s.kraj || p.k === s.kraj) && (!s.zeme || K.zemeOf(p) === s.zeme)) on[p.o] = (on[p.o] || 0) + 1; });
    const obce = Object.keys(on).sort((a, b) => a.localeCompare(b, 'cs')).map(o => [o, on[o]]);
    return { kraje, obce };
  }

  async function init() {
    let data;
    $('#ub-count').textContent = KP.t('Načítám ubytování z Česka a Bavorska…');
    try {
      // Výtah jen s ubytováním (tools/build_web_index.py, asi 1,4 MB); bez něj projde všechny regiony
      data = await Promise.all([fetch('data/regions/ubytovani.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), K.loadRegionsIndex()]).then(([d]) => d)
        .catch(() => K.loadAll(p => p.c === 'ubytovani', { onProgress: (d, n) => { $('#ub-count').textContent = KP.t('Načítám ubytování… {d} z {n} oblastí', { d, n }); } }));
    } catch (e) { $('#ub-count').innerHTML = '<span class="callout">' + K.esc(KP.t('Data se nepodařilo načíst. Zkuste stránku obnovit.')) + '</span>'; return; }
    ALL = data;
    ALL.forEach(p => { p._c = K.completeness(p); });

    // Rychlé čipy jen pro údaje, které v datech ubytování opravdu jsou
    const quick = ['step', 'wc', 'lift', 'room', 'web', 'img'].filter(k => k === 'step' || ALL.some(p => KF.attrs[k](p)));
    ctrl = KF.create({
      id: 'ubytovani',
      els: { bar: $('#ub-bar'), search: $('#f-q'), form: $('#ub-form'), filterBtn: $('#ub-open'), filterCount: $('#ub-nfilters'), cats: $('#ub-typ'), quick: $('#ub-quick'), active: $('#ub-active'), panelHost: $('#ub-kf') },
      catMode: 'typ', quick, unit: ['ubytování', 'ubytování', 'ubytování'],
      sections: ['typ', 'access', 'room', 'adv', 'source', 'more', 'contact', 'area', 'needs'],
      obecMode: 'select',
      panelMode: () => 'dialog', // v5: Další filtry z lišty – PC okno pod tlačítkem, mobil spodní panel
      areaOptions,
      onChange: () => render(true),
      onApply: () => { $('#ub-results').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); },
    });
    if (ctrl.state.kraj && !ALL.some(p => p.k === ctrl.state.kraj)) ctrl.setArea('kraj', '');

    $('#f-sort').value = sortBy;
    if ($('#f-sort').value !== sortBy) { sortBy = 'complete'; $('#f-sort').value = sortBy; }
    $('#f-sort').addEventListener('change', () => {
      const v = $('#f-sort').value;
      if (v === 'match' && !K.hasTier('match')) {
        $('#f-sort').value = sortBy;
        K.requireTier('match', () => { sortBy = 'match'; $('#f-sort').value = 'match'; K.store.set('ub.sort', 'match'); if (!K.getNeeds().active) K.needsDrawer(); render(true); });
        return;
      }
      sortBy = v; K.store.set('ub.sort', v);
      if (v === 'match' && !K.getNeeds().active) K.needsDrawer();
      render(true);
    });
    $('#ub-more').addEventListener('click', () => { shown += PAGE; render(false); });
    document.addEventListener('click', e => {
      if (!e.target.closest('[data-ub-needs]')) return;
      if (K.hasTier('match')) K.needsDrawer(); else K.requireTier('match', () => K.needsDrawer());
    });
    document.addEventListener('kp:needs', () => render(false));
    ctrl.bindRelax($('#ub-list'));
    KF.bindSave($('#ub-list'), (id) => ALL.find(p => p.i === id));
    // Fotka z Commons se nenačetla: místo ní ikona
    document.addEventListener('error', e => {
      const img = e.target; if (!(img instanceof HTMLImageElement)) return;
      const md = img.closest('.rc-media'); if (!md) return;
      md.classList.add('no-photo'); md.setAttribute('aria-hidden', 'true'); md.innerHTML = K.icon('bed');
    }, true);
    render(true);
  }

  init();
})();
