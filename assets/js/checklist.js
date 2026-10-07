/* kudyprojedu.cz – sdílený standardizovaný checklist přístupnosti (profil podniku i komunitní příspěvek).
   Položky a fotky bere z KP.business (CHECKLIST, PHOTO_AREAS, checklistFor) v core.js; tady je jen vykreslení,
   čtení hodnot, rozdělení do kroků, hledání místa a štítek „co teď víme“ z KP.facts. */
(function () {
  'use strict';
  const K = window.KP;
  if (!K || !K.business) return;
  const B = K.business, esc = K.esc;

  // Kroky checklistu v pořadí, v jakém se místo obchází: vstup, parkování, uvnitř, WC, pokoj
  const STEP_DEF = [
    { a: 'vstup', label: KP.t('Vstup'), icon: 'door', photos: ['vstup'], intro: KP.t('Projděte cestu od chodníku ke dveřím. Rozhoduje nejvyšší schod a nejužší místo.') },
    { a: 'parkovani', label: KP.t('Parkování'), icon: 'parking', photos: ['parkovani'], intro: KP.t('Vyhrazená stání pro ZTP a cesta od nich ke vstupu.') },
    { a: 'interier', label: KP.t('Pohyb uvnitř'), icon: 'lift', photos: ['vytah'], intro: KP.t('Trasa návštěvníka uvnitř: hlavní prostory, dveře, průchody a výtah.') },
    { a: 'wc', label: 'WC', icon: 'wc', photos: ['wc'], intro: KP.t('Toaleta, kterou mohou používat hosté na vozíku.') },
    { a: 'pokoj', label: KP.t('Pokoj a koupelna'), icon: 'bed', photos: ['pokoj', 'koupelna'], intro: KP.t('Bezbariérový pokoj a jeho koupelna. Měřte ten pokoj, který hostům na vozíku nabízíte.') },
  ];
  const PHOTO = {}; B.PHOTO_AREAS.forEach(p => { PHOTO[p.key] = p; });
  const OPTS = {
    tri: [['yes', KP.t('Ano')], ['part', KP.t('Částečně')], ['no', KP.t('Ne')]],
    yn: [['yes', KP.t('Ano')], ['no', KP.t('Ne')]],
    yna: [['yes', KP.t('Ano')], ['no', KP.t('Ne')], ['na', KP.t('Netýká se')]],
  };
  const VAL_TXT = { yes: KP.t('Ano'), part: KP.t('Částečně'), no: KP.t('Ne'), na: KP.t('Netýká se') };
  const UNIT = { cm: 'cm', pct: '%' };
  const COUNT_UNIT = { schodyPocet: KP.t('schodů'), parkMist: KP.t('stání'), pokojuBb: KP.t('pokojů') };
  const LIMIT = { cm: [0, 1000, 0.5], pct: [0, 100, 0.1], count: [0, 500, 1] };

  // Kroky pro typ místa: jen oblasti, které checklist pro typ obsahuje; fotky jen k těmto oblastem
  function steps(cat) {
    const items = B.checklistFor(cat);
    return STEP_DEF.filter(s => items.some(c => c.area === s.a)).map(s => Object.assign({}, s, {
      items: items.filter(c => c.area === s.a),
      photos: s.photos.filter(k => PHOTO[k] && (cat === 'ubytovani' || !PHOTO[k].hotel)).map(k => PHOTO[k]),
    }));
  }
  // Postup podle kroků pro daný typ (stejný tvar jako KP.business.progress, ale fotky jen k oblastem typu místa)
  function progress(prof, cat) {
    const pr = prof || { values: {}, photos: {} }, vals = pr.values || {}, ph = pr.photos || {};
    const st = steps(cat), items = [].concat(...st.map(s => s.items)), photos = [].concat(...st.map(s => s.photos));
    const has = (c) => vals[c.key] !== undefined && vals[c.key] !== '' && vals[c.key] !== null;
    const done = items.filter(has), pDone = photos.filter(p => (ph[p.key] || []).length);
    const total = items.length + photos.length, have = done.length + pDone.length;
    return {
      done: done.length, total: items.length, photosDone: pDone.length, photosTotal: photos.length,
      pct: total ? Math.round(have / total * 100) : 0, complete: total > 0 && have === total,
      missing: items.filter(c => !has(c)).map(c => ({ key: c.key, area: c.area, label: c.label }))
        .concat(photos.filter(p => !(ph[p.key] || []).length).map(p => ({ key: 'foto:' + p.key, area: st.find(s => s.photos.includes(p)).a, label: (KP.t('Fotka') + ': ') + p.label }))),
      byStep: st.map(s => ({ a: s.a, label: s.label, done: s.items.filter(has).length + s.photos.filter(p => (ph[p.key] || []).length).length, total: s.items.length + s.photos.length })),
    };
  }

  // ---------- Co už o místě víme z jiných zdrojů (KP.facts) ----------
  const NOW = {
    vstupBezSchodu: ['f', 'bezSchodu'], schodyPocet: ['m', 'schody'], prahCm: ['m', 'prahCm'], vstupDvereCm: ['m', 'dvereCm'],
    rampaSklonPct: ['m', 'sklonPct'], prostory: ['f', 'prostory'], vytah: ['f', 'vytah'], pruchodyCm: ['m', 'pruchodyCm'],
    otoceni150: ['f', 'otoceni'], wc: ['f', 'wcBb'], wcDvereCm: ['m', 'wcDvereCm'], wcMadla: ['f', 'wcMadla'], wcOtoceni150: ['f', 'wcOtoceni'],
    parkMist: ['m', 'parkMist'], parkSirkaCm: ['m', 'parkSirkaCm'], pokojuBb: ['m', 'pokojuBb'], pokojDvereCm: ['m', 'pokojDvereCm'],
    postelVyskaCm: ['m', 'postelVyskaCm'], postelProstorCm: ['m', 'postelProstorCm'], sprchaUroven: ['f', 'sprcha'],
    sprchaSedatko: ['f', 'sedatko'], koupelnaMadla: ['f', 'koupelnaMadla'],
  };
  const FVAL = (v) => v === true ? KP.t('Ano') : v === 'part' ? KP.t('Částečně') : v === false ? KP.t('Ne') : v === 'na' ? KP.t('Netýká se') : '';
  // Údaj z jiného zdroje než z profilu podniku v tomto prohlížeči → {text, src} | null
  function known(p, key) {
    if (!p || !NOW[key]) return null;
    const [kind, k] = NOW[key];
    const fx = K.facts(p), c = (kind === 'f' ? fx.f : fx.m)[k];
    if (!c || c.local) return null;
    const text = kind === 'f' ? FVAL(c.v) : K.fmt(c.v) + (c.unit ? ' ' + c.unit : '');
    return text ? { text, src: c.src } : null;
  }
  function knownHtml(p, key) {
    const k = known(p, key);
    if (!k) return '';
    const s = K.SOURCES[k.src] || {};
    return ('<p class="ck-now">' + KP.t('V mapě teď') + ': <b>') + esc(k.text) + '</b> <span class="ck-now-src">(' + esc(s.short || k.src) + ')</span></p>';
  }

  // ---------- Vykreslení jedné položky ----------
  function fieldHtml(c, v, pfx, p) {
    const id = pfx + '-' + c.key, how = '<p class="ck-how" id="' + id + '-how">' + esc(c.how) + '</p>' + knownHtml(p, c.key);
    const cur = v === undefined || v === null ? '' : String(v);
    if (OPTS[c.type]) {
      return '<fieldset class="ck-item" data-key="' + c.key + '" aria-describedby="' + id + '-how"><legend>' + esc(c.label) + '</legend>' + how +
        '<div class="ck-seg">' + OPTS[c.type].concat([['', KP.t('Nevím')]]).map(([val, l], i) =>
          '<label class="ck-opt' + (val === '' ? ' ck-opt-unk' : '') + '"><input type="radio" name="' + id + '" id="' + id + '-' + i + '" value="' + val + '"' + (cur !== '' && cur === val ? ' checked' : '') + '><span>' + l + '</span></label>').join('') +
        '</div></fieldset>';
    }
    if (c.type === 'text') {
      return '<div class="ck-item field" data-key="' + c.key + '"><label for="' + id + '">' + esc(c.label) + '</label>' + how +
        '<textarea id="' + id + '" rows="3" maxlength="600" aria-describedby="' + id + '-how">' + esc(cur) + '</textarea></div>';
    }
    const [mn, mx, step] = LIMIT[c.type] || LIMIT.cm;
    const unit = UNIT[c.type] || COUNT_UNIT[c.key] || '';
    return '<div class="ck-item field" data-key="' + c.key + '"><label for="' + id + '">' + esc(c.label) + '</label>' + how +
      '<div class="input-unit ck-num"><input id="' + id + '" type="number" min="' + mn + '" max="' + mx + '" step="' + step + '" inputmode="' + (c.type === 'count' ? 'numeric' : 'decimal') + '" value="' + esc(cur) + '" aria-describedby="' + id + '-how">' +
      (unit ? '<span>' + unit + '</span>' : '') + '</div></div>';
  }
  // Přečte hodnoty položek z kořenového prvku → {klíč: hodnota | ''} ('' = smazat)
  function read(root, pfx, items) {
    const out = {};
    items.forEach(c => {
      const id = pfx + '-' + c.key;
      if (OPTS[c.type]) { const r = root.querySelector('input[name="' + id + '"]:checked'); out[c.key] = r ? r.value : ''; return; }
      const el = root.querySelector('#' + id); if (!el) return;
      const v = el.value.trim();
      if (c.type === 'text') { out[c.key] = v; return; }
      if (v === '') { out[c.key] = ''; return; }
      const n = Number(v.replace(',', '.'));
      out[c.key] = isFinite(n) && n >= 0 ? n : '';
    });
    return out;
  }
  // Čitelná hodnota pro souhrn
  function valueText(c, v) {
    if (v === undefined || v === null || v === '') return '';
    if (OPTS[c.type]) return VAL_TXT[v] || String(v);
    if (c.type === 'text') return String(v);
    const unit = UNIT[c.type] || COUNT_UNIT[c.key] || '';
    return K.fmt(v) + (unit ? ' ' + unit : '');
  }

  // ---------- Fotky: náhledy se štítkem oblasti ----------
  // items = [{src, file?}] – src je dataURL (uložená) nebo objectURL (nově vybraná)
  function photoSlotHtml(ph, list, pfx, max) {
    const id = pfx + '-ph-' + ph.key;
    return '<div class="ck-photos" data-photo="' + ph.key + '">' +
      '<div class="ck-ph-head"><h4>' + K.icon('camera') + (KP.t('Fotka') + ': ') + esc(ph.label) + '</h4><p class="ck-how">' + esc(ph.how) + (' ' + KP.t('Fotografujte prostor, ne lidi.') + '</p></div>') +
      ('<ul class="ck-ph-list" aria-label="' + KP.t('Fotky: ')) + esc(ph.label) + '">' + list.map((x, i) =>
        '<li><figure><img src="' + esc(x.src) + '" alt="' + K.t('Fotka') + ' ' + (i + 1) + ': ' + esc(ph.label) + '"><figcaption><span class="badge badge-tape">' + esc(ph.label) + '</span>' + (x.file ? ('<span class="ck-ph-new">' + KP.t('nová, neuložená') + '</span>') : '') + '</figcaption></figure>' +
        '<button type="button" class="btn btn-quiet btn-sm" data-ph-rm="' + ph.key + '" data-i="' + i + ('">' + KP.t('Odebrat') + '<span class="sr-only"> ' + KP.t('fotku') + ' ') + (i + 1) + '</span></button></li>').join('') + '</ul>' +
      (list.length < max ? '<label class="btn btn-ghost btn-sm ck-ph-add" for="' + id + '">' + K.icon('upload') + (KP.t('Přidat fotku') + '</label><input id="') + id + '" type="file" accept="image/*" multiple class="sr-only" data-ph-add="' + ph.key + '">'
        : '<p class="small muted">' + K.t('Nejvýš {n} fotky k této části.', { n: max }) + '</p>') +
      '</div>';
  }

  // ---------- Hledání místa (Česko i Bavorsko) ----------
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  const hay = (p) => p._s || (p._s = norm(p.n + ' ' + p.o + ' ' + (p.a || '') + ' ' + p.s));
  // opts: {input, list, hint, onPick(p), selected() → id, extraEmpty: html}
  function placeSearch(o) {
    const st = { towns: [], regions: {}, wide: null, extra: [] };
    function townRegion(q) {
      let best = null;
      for (const t of st.towns) { const n = norm(t[0]); if (n.length >= 3 && (' ' + q + ' ').includes(' ' + n + ' ') && (!best || t[2] > best[2])) best = t; }
      return best ? best[1] : null;
    }
    function run() {
      const q = norm(o.input.value.trim());
      if (q.length < 2) { o.list.innerHTML = ''; return; }
      const words = q.split(/\s+/), rid = townRegion(q);
      if (rid && !st.regions[rid]) {
        st.regions[rid] = 'loading';
        K.loadRegion(rid).then(arr => { st.regions[rid] = arr; run(); }).catch(() => { delete st.regions[rid]; });
      }
      const pool = [].concat(st.extra, ...Object.values(st.regions).filter(Array.isArray), st.wide && st.wide.q === q ? st.wide.hits : []);
      const hits = [], seen = new Set(), sel = o.selected ? o.selected() : null;
      for (const p of pool) {
        if (seen.has(p.i)) continue;
        if (words.every(w => hay(p).includes(w))) { seen.add(p.i); hits.push(p); if (hits.length >= 25) break; }
      }
      const wideBtn = !(st.wide && st.wide.q === q) ? '<li><button type="button" class="btn btn-quiet btn-sm ck-wide" data-wide>' + K.icon('search') + (KP.t('Hledat ve všech místech v Česku a v Bavorsku') + '</button></li>') : '';
      o.list.innerHTML = (hits.length ? hits.map(p => '<li><button type="button" data-id="' + esc(p.i) + '" aria-pressed="' + (sel === p.i) + '">' +
        '<span class="pp-txt"><b>' + esc(p.n) + '</b><small>' + esc(p.s ? K.t(p.s) : (K.CATS[p.c] || {}).label || '') + ' · ' + esc([p.a, p.o, K.zemeOf(p) === 'de' ? K.t('Bavorsko') : ''].filter(Boolean).join(', ')) + '</small></span>' +
        '<span class="pp-mark">' + K.icon('check') + '</span></button></li>').join('')
        : '<li class="muted small ck-none">' + (st.regions[rid] === 'loading' ? KP.t('Načítám místa v obci…') : (o.emptyText || KP.t('Nic jsme nenašli. Zkuste jiný tvar názvu nebo přidejte obec.'))) + '</li>') +
        (hits.length < 25 ? wideBtn : '');
    }
    function everywhere() {
      const q = norm(o.input.value.trim()); if (q.length < 2) return;
      const words = q.split(/\s+/);
      o.hint.textContent = KP.t('Prohledávám všechna místa…');
      K.loadAll(p => words.every(w => hay(p).includes(w)), { onProgress: (d, n) => { o.hint.textContent = K.t('Prohledávám všechna místa… {d} z {n} oblastí', { d, n }); } })
        .then(hits => { st.wide = { q, hits }; o.hint.textContent = KP.t('Prohledali jsme všechna místa v Česku a v Bavorsku.'); run(); })
        .catch(() => { o.hint.textContent = KP.t('Hledání se nepovedlo. Zkuste to znovu.'); });
    }
    function byId(id) {
      return st.extra.find(p => p.i === id) || K.placeById(id) || (st.wide ? st.wide.hits.find(p => p.i === id) : null) ||
        Object.values(st.regions).filter(Array.isArray).reduce((a, arr) => a || arr.find(p => p.i === id), null) || null;
    }
    let t;
    o.input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 150); });
    o.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); run(); } });
    o.list.addEventListener('click', e => {
      if (e.target.closest('[data-wide]')) { everywhere(); return; }
      const b = e.target.closest('[data-id]'); if (!b) return;
      const p = byId(b.dataset.id);
      o.list.querySelectorAll('[data-id]').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === b.dataset.id));
      if (p && o.onPick) o.onPick(p);
    });
    const ready = Promise.all([K.loadRegionsIndex(), K.loadTowns().catch(() => [])]).then(([idx, towns]) => {
      st.towns = towns;
      const total = idx.reduce((a, r) => a + (r.pocet || 0), 0);
      o.hint.textContent = K.t('Napište název a obec. Hledáme mezi {n} místy v Česku a v Bavorsku.', { n: K.nf(total) });
      if (o.input.value.trim()) run();
    }).catch(() => { o.hint.textContent = KP.t('Seznam míst se nenačetl. Zkuste stránku načíst znovu.'); });
    return { run, ready, addPlaces(list) { st.extra = st.extra.concat(list || []); } };
  }

  window.KPCheck = { STEP_DEF, steps, progress, fieldHtml, read, valueText, photoSlotHtml, placeSearch, known, knownHtml, VAL_TXT };
})();
