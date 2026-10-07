/* Stránka Ubytování: výpis míst s c='ubytovani' ze všech regionů v data/regions/ (Česko a Bavorsko; výtah data/regions/ubytovani.json, záložně KP.loadAll), filtry v řadě čipů (na mobilu ve spodním panelu) a řazení.
   Výpis je adresář s linkami (verze 3, DESIGN.md), fotka z Wikimedia Commons jen u míst s polem img.
   Pole r (nepovinné) = údaje z webu provozovatele:
   [{ url, date, source_type, claim, items: { vstup, wc, pokoj, koupelna, parkovani, vytah, jine }, measurements: [{ co, hodnota, jednotka }] }] */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const PAGE = 30;
  const RANK = { yes: 0, limited: 1, null: 2, no: 3 };
  const W_SETS = { yl: ['yes', 'limited'], y: ['yes'], l: ['limited'], u: ['null'], n: ['no'], all: ['yes', 'limited', 'null', 'no'] };
  const TOGGLES = ['#f-wc', '#f-r', '#f-web'];
  const mobile = matchMedia('(max-width: 899px)');
  let ALL = [], shown = PAGE;

  const nf = (n) => K.nf(n);
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function reports(p) { return Array.isArray(p.r) ? p.r.filter(r => r && typeof r === 'object') : []; }
  const pressed = (s) => $(s).getAttribute('aria-pressed') === 'true';
  const setPressed = (s, on) => $(s).setAttribute('aria-pressed', on ? 'true' : 'false');

  function state() {
    return {
      q: norm($('#f-q').value.trim()), kraj: $('#f-kraj').value, obec: $('#f-obec').value, typ: $('#f-typ').value,
      wKey: $('#f-w').value, w: new Set(W_SETS[$('#f-w').value] || W_SETS.yl),
      wc: pressed('#f-wc'), r: pressed('#f-r'), web: pressed('#f-web'), sort: $('#f-sort').value,
    };
  }
  // Kolik filtrů se liší od výchozího stavu (hledání a řazení se nepočítá)
  function activeCount(s) { return [s.kraj, s.obec, s.typ, s.wKey !== 'yl', s.wc, s.r, s.web].filter(Boolean).length; }

  function filter(s) {
    return ALL.filter(p => {
      if (s.kraj && p.k !== s.kraj) return false;
      if (s.obec && p.o !== s.obec) return false;
      if (s.typ && p.s !== s.typ) return false;
      if (!s.w.has(String(p.w || 'null'))) return false;
      if (s.wc && p.t !== 'yes') return false;
      if (s.r && !reports(p).length) return false;
      if (s.web && !(p.web || p.ph)) return false;
      if (s.q && !norm(p.n + ' ' + (p.o || '') + ' ' + (p.s || '')).includes(s.q)) return false;
      return true;
    });
  }

  function sort(list, by) {
    const cmpName = (a, b) => a.n.localeCompare(b.n, 'cs');
    const f = {
      name: cmpName,
      obec: (a, b) => (a.o || '').localeCompare(b.o || '', 'cs') || cmpName(a, b),
      access: (a, b) => RANK[String(a.w || 'null')] - RANK[String(b.w || 'null')] || (b.t === 'yes') - (a.t === 'yes') || reports(b).length - reports(a).length || b._c - a._c || cmpName(a, b),
      complete: (a, b) => (reports(b).length > 0) - (reports(a).length > 0) || b._c - a._c || RANK[String(a.w || 'null')] - RANK[String(b.w || 'null')] || cmpName(a, b),
    }[by] || cmpName;
    return list.slice().sort(f);
  }

  // Řádek adresáře: text vlevo, fotka z Wikimedia Commons vpravo (jen pokud existuje)
  function cardHtml(p) {
    const w = K.W[p.w || 'null'];
    const rs = reports(p);
    const unknown = [];
    if (!p.t) unknown.push(K.t('toaleta'));
    if (!rs.length) unknown.push(KP.t('pokoj a koupelna'));
    const href = K.placeUrl(p);
    const photo = p.img ? '<figure class="photo ub-photo"><a href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + K.commonsImg(p.img, 320) + '" srcset="' + K.commonsImg(p.img, 320) + ' 320w, ' + K.commonsImg(p.img, 640) + ' 640w" sizes="(min-width: 640px) 220px, 120px" width="320" height="213" alt="" loading="lazy" decoding="async"></a>' +
      '<figcaption><a href="' + K.commonsPage(p.img) + ('" target="_blank" rel="noopener">' + KP.t('Foto: Wikimedia Commons') + '</a></figcaption></figure>') : '';
    return '<li class="ub-row' + (p.img ? ' has-photo' : '') + '"><a class="ub-card" href="' + href + '">' +
      '<span class="ub-name">' + K.esc(p.n) + '</span>' +
      '<span class="ub-meta">' + K.esc([p.o, p.s && K.t(p.s), K.zemeOf(p) === 'de' ? K.t('Bavorsko') : ''].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="ub-facts">' + K.statusHtml(w.st, K.t('Vstup') + ': ' + K.lc(w.short)) +
      (p.t ? K.statusHtml(K.T[p.t].st, K.T[p.t].label) : K.statusHtml('unk', KP.t('WC neuvedeno'))) + '</span>' +
      (rs.length ? ('<span class="badge badge-business" title="' + KP.t('Údaj jsme přečetli na webu ubytování, neověřili jsme ho na místě.') + '">') + K.icon('building') + (KP.t('Podle webu provozovatele') + '</span>') : '') +
      '<span class="ub-foot"><span class="ub-unknown">' + (unknown.length ? K.t('Neznáme') + ': ' + unknown.join(', ') : K.t('Údaje {pct} %', { pct: p._c })) + '</span>' +
      ('<span class="ub-go">' + KP.t('Detail')) + K.icon('arrow') + '</span></span>' +
      '</a>' + photo + '</li>';
  }

  function fillObce() {
    const kraj = $('#f-kraj').value, cur = $('#f-obec').value;
    const counts = {};
    ALL.forEach(p => { if (p.o && (!kraj || p.k === kraj)) counts[p.o] = (counts[p.o] || 0) + 1; });
    const obce = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'cs'));
    $('#f-obec').innerHTML = ('<option value="">' + KP.t('Všechny obce') + '</option>') + obce.map(o => '<option value="' + K.esc(o) + '">' + K.esc(o) + ' (' + counts[o] + ')</option>').join('');
    $('#f-obec').value = obce.includes(cur) ? cur : '';
  }

  function writeUrl(s) {
    const sp = new URLSearchParams();
    if (s.kraj) sp.set('kraj', s.kraj);
    if (s.obec) sp.set('obec', s.obec);
    if (s.wKey !== 'yl') sp.set('vstup', s.wKey);
    if (s.wc) sp.set('wc', '1');
    if (s.r) sp.set('provozovatel', '1');
    const qs = sp.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) { /* bez historie */ }
  }

  function render(reset) {
    if (reset) shown = PAGE;
    const s = state();
    const list = sort(filter(s), s.sort);
    const n = list.length, withR = ALL.filter(p => reports(p).length).length;
    $('#ub-count').innerHTML = K.t('<b class="num">{n}</b> z {all} ubytování', { n: nf(n), all: nf(ALL.length) }) +
      (withR ? '<span class="muted small"> · ' + K.t('{n} s údaji od provozovatele', { n: nf(withR) }) + '</span>' : '');
    $('#ub-list').innerHTML = n ? list.slice(0, shown).map(cardHtml).join('')
      : ('<li class="empty ub-empty"><p><b>' + KP.t('Filtrům nic neodpovídá.') + '</b></p><p class="small">' + KP.t('Zkuste jiný kraj nebo u vstupu zvolte i částečně přístupný.') + '</p>') + (s.r ? ('<p class="small">' + KP.t('Údaje z webů provozovatelů teprve doplňujeme.') + '</p>') : '') + ('<p class="small"><a href="pridat.html">' + KP.t('Znáte přístupné ubytování? Přidejte ho.') + '</a></p></li>');
    $('#ub-more').hidden = n <= shown;
    $('#ub-more').textContent = K.t('Zobrazit dalších {n}', { n: Math.min(PAGE, n - shown) });
    $('#ub-apply').textContent = n ? K.t('Zobrazit {n} ubytování', { n: nf(n) }) : K.t('Nic neodpovídá');
    // Vzhled aktivních filtrů
    [['#f-kraj', s.kraj], ['#f-obec', s.obec], ['#f-typ', s.typ], ['#f-w', s.wKey !== 'yl']].forEach(([sel, on]) => $(sel).classList.toggle('on', !!on));
    const a = activeCount(s);
    $('#ub-nfilters').hidden = !a; $('#ub-nfilters').textContent = a;
    $('#f-reset').hidden = !a;
    writeUrl(s);
  }

  // ---------- Spodní panel s filtry (mobil) ----------
  let lastFocus = null;
  function openSheet() {
    lastFocus = document.activeElement;
    $('#ub-form').classList.add('sheet');
    $('#ub-form').setAttribute('role', 'dialog'); $('#ub-form').setAttribute('aria-modal', 'true'); $('#ub-form').setAttribute('aria-labelledby', 'ub-sheet-title');
    $('#ub-backdrop').hidden = false; $('#ub-open').setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    $('#f-kraj').focus();
  }
  function closeSheet() {
    if (!$('#ub-form').classList.contains('sheet')) return;
    $('#ub-form').classList.remove('sheet');
    ['role', 'aria-modal', 'aria-labelledby'].forEach(at => $('#ub-form').removeAttribute(at));
    $('#ub-backdrop').hidden = true; $('#ub-open').setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  async function init() {
    let stats = null, data;
    $('#ub-count').textContent = KP.t('Načítám ubytování z Česka a Bavorska…');
    try {
      [data, stats] = await Promise.all([
        // Výtah jen s ubytováním (tools/build_web_index.py, asi 1,4 MB); bez něj projde všechny regiony
        Promise.all([fetch('data/regions/ubytovani.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), K.loadRegionsIndex()]).then(([d]) => d)
          .catch(() => K.loadAll(p => p.c === 'ubytovani', { onProgress: (d, n) => { $('#ub-count').textContent = K.t('Načítám ubytování… {d} z {n} oblastí', { d, n }); } })),
        K.loadStats().catch(() => null)]);
    }
    catch (e) { $('#ub-count').innerHTML = ('<span class="callout">' + KP.t('Data se nepodařilo načíst. Zkuste stránku obnovit.') + '</span>'); return; }
    ALL = data;
    ALL.forEach(p => { p._c = K.completeness(p); });

    const kn = {}; ALL.forEach(p => { if (p.k) kn[p.k] = (kn[p.k] || 0) + 1; });
    const kraje = Object.keys(kn);
    const zk = (z) => kraje.filter(k => ((K.regionByName(k) || {}).zeme || 'cz') === z).sort((a, b) => a.localeCompare(b, 'cs'));
    $('#f-kraj').innerHTML += ['cz', 'de'].map(z => zk(z).length ? '<optgroup label="' + K.ZEME[z] + (z === 'de' ? (' ' + KP.t('– vládní obvody')) : (' ' + KP.t('– kraje'))) + '">' +
      zk(z).map(k => '<option value="' + K.esc(k) + '">' + K.esc(K.LANG === 'cs' ? k : K.krajName(k)) + ' (' + kn[k] + ')</option>').join('') + '</optgroup>' : '').join('');
    const typy = {}; ALL.forEach(p => { if (p.s) typy[p.s] = (typy[p.s] || 0) + 1; });
    $('#f-typ').innerHTML += Object.entries(typy).sort((a, b) => b[1] - a[1]).map(([t, c]) => '<option value="' + K.esc(t) + '">' + K.esc(K.t(t)) + ' (' + c + ')</option>').join('');

    const sp = new URLSearchParams(location.search);
    if (sp.get('kraj') && kraje.includes(sp.get('kraj'))) $('#f-kraj').value = sp.get('kraj');
    fillObce();
    if (sp.get('obec')) { $('#f-obec').value = sp.get('obec'); if ($('#f-obec').value !== sp.get('obec')) $('#f-obec').value = ''; }
    if (W_SETS[sp.get('vstup')]) $('#f-w').value = sp.get('vstup');
    if (sp.get('wc') === '1') setPressed('#f-wc', true);
    if (sp.get('provozovatel') === '1') setPressed('#f-r', true);

    let t;
    $('#f-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(true), 200); });
    $('#f-kraj').addEventListener('change', () => { fillObce(); render(true); });
    ['#f-obec', '#f-typ', '#f-w', '#f-sort'].forEach(s => $(s).addEventListener('change', () => render(true)));
    TOGGLES.forEach(s => $(s).addEventListener('click', () => { setPressed(s, !pressed(s)); render(true); }));
    $('#ub-form').addEventListener('submit', e => e.preventDefault());
    $('#ub-form').addEventListener('reset', () => setTimeout(() => { TOGGLES.forEach(s => setPressed(s, false)); $('#f-w').value = 'yl'; fillObce(); render(true); }, 0));
    $('#ub-more').addEventListener('click', () => { shown += PAGE; render(false); });

    $('#ub-open').addEventListener('click', openSheet);
    $('#ub-close').addEventListener('click', closeSheet);
    $('#ub-apply').addEventListener('click', () => { closeSheet(); $('#ub-count').scrollIntoView({ block: 'nearest' }); });
    $('#ub-backdrop').addEventListener('click', closeSheet);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
    mobile.addEventListener('change', e => { if (!e.matches) closeSheet(); });
    render(true);
  }

  init();
})();
