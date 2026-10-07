/* Můj profil: profil přístupnosti, uložená místa, hodnocení a fotky, trasy a itineráře, převzaté podniky,
   hlášení a žádosti, rozepsané příspěvky. Vše z localStorage tohoto prohlížeče (prototyp bez serveru). */
(function () {
  'use strict';
  const K = window.KP, $ = (s) => document.querySelector(s);
  const C = K.community, B = K.business;

  function setCount(sel, n) { const el = $(sel); el.hidden = !n; el.textContent = n; }
  const plural = (n, one, few, many) => n + ' ' + K.plural(n, one, few, many);
  const empty = (text, href, label, ghost) => '<div class="pf-empty"><p class="muted">' + text + '</p>' + (href ? '<a class="btn ' + (ghost ? 'btn-ghost' : 'btn-primary') + '" href="' + href + '">' + label + '</a>' : '') + '</div>';
  // Odkaz na místo podle uloženého id a regionu (bez načítání dat)
  const placeLink = (id, ref) => '<a class="pf-link" href="' + K.placeUrl({ i: id, _r: (ref && ref.r) || '' }) + '"><b>' + K.esc((ref && ref.n) || (KP.t('Místo') + ' ') + id) + '</b></a>';
  // Dvojí klik pro mazání: první klik se zeptá, druhý smaže
  function confirmClick(btn, label, run) {
    if (btn.dataset.confirm) { run(); return; }
    btn.dataset.confirm = '1'; btn.textContent = label || KP.t('Opravdu smazat? Klikněte znovu');
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = btn.dataset.label || KP.t('Smazat'); } }, 5000);
  }

  // ---------- Profil přístupnosti (formulář přímo na stránce) ----------
  function renderNeeds() {
    const n = K.getNeeds();
    $('#needs-state').innerHTML = n.active ? K.statusHtml('ok', KP.t('Zapnuto')) : K.statusHtml('unk', KP.t('Vypnuto'));
    $('#needs-fields').innerHTML = K.needsForm.html(n, 'pf');
    K.needsForm.bind($('#needs-form'), 'pf');
  }
  function bindNeeds() {
    $('#needs-form').addEventListener('submit', (e) => {
      e.preventDefault();
      K.setNeeds(K.needsForm.read($('#needs-form'), 'pf'));
      K.toast(KP.t('Profil uložen. Místa teď hodnotíme podle vás.'));
    });
    $('#needs-off').addEventListener('click', () => { K.setNeeds(Object.assign(K.getNeeds(), { active: false })); K.toast(KP.t('Hodnocení podle profilu je vypnuté.')); });
  }

  // ---------- Uložená místa ----------
  function placeRow(p, needs) {
    const st = p.c !== 'parkovani' ? K.statusHtml(K.W[p.w || 'null'].st, K.W[p.w || 'null'].short) : '';
    let fit = '';
    if (needs.active) {
      const m = K.matchScore(p, needs);
      fit = '<span class="pf-fit">' + K.statusHtml(m.status, m.pct === null ? K.t('Chybí údaje') : m.status === 'unk' ? K.t('Chybí údaje, {pct} % ze známých', { pct: m.pct }) : K.t('{pct} % shoda s vašimi potřebami', { pct: m.pct })) +
        (m.total ? '<small>' + K.t('Známe {k} z {n} údajů, které potřebujete', { k: m.known, n: m.total }) + '</small>' : '') + '</span>';
    }
    const fs = K.facilitiesScore(p);
    const fsTxt = fs.total === null ? K.t('Vybavení: bez údajů') : K.t('Vybavení {pct} % sledovaných prvků', { pct: fs.total });
    const ph = p.img ? '<figure class="photo pf-ph"><img src="' + K.esc(K.commonsImg(p.img, 640)) + '" alt="" loading="lazy" decoding="async">' +
      '<figcaption><a href="' + K.esc(K.commonsPage(p.img)) + ('" target="_blank" rel="noopener">' + KP.t('Foto: Wikimedia Commons') + '</a></figcaption></figure>') : '';
    return '<li class="rule-row pf-row' + (ph ? ' has-ph' : '') + '">' + ph +
      '<div class="pf-txt"><a class="pf-link" href="' + K.placeUrl(p) + '"><b>' + K.esc(p.n) + '</b></a>' +
      '<small>' + K.esc([p.s && K.t(p.s), p.o, K.zemeOf(p) === 'de' ? K.t('Bavorsko') : ''].filter(Boolean).join(' · ')) + '</small>' + st + fit +
      '<small>' + fsTxt + '</small></div></li>';
  }
  // Fotka, která se nenačte, zmizí i s popiskem; řádek funguje dál bez ní
  function dropBrokenPhotos(root) {
    root.querySelectorAll('.pf-ph img').forEach(img => img.addEventListener('error', () => {
      const li = img.closest('.pf-row'); if (li) li.classList.remove('has-ph'); img.closest('figure').remove();
    }, { once: true }));
  }
  let SAVED_ITEMS = null;
  function renderSaved() {
    const ids = K.saved.all();
    setCount('#saved-n', ids.length);
    if (!ids.length) { $('#saved').innerHTML = empty(KP.t('Zatím nemáte uložená žádná místa. Uložíte je tlačítkem Uložit v detailu místa.'), 'mapa.html', KP.t('Otevřít mapu')); return; }
    const draw = (items) => {
      const missing = ids.length - items.length, needs = K.getNeeds();
      $('#saved').innerHTML = (needs.active ? '' : ('<p class="small muted">' + KP.t('Shodu v procentech uvidíte, až vyplníte profil přístupnosti.') + '</p>')) +
        '<ul class="pf-list rule-list">' + items.map(p => placeRow(p, needs)).join('') + '</ul>' +
        (missing ? '<p class="small muted">' + K.t('{n} v aktuálních datech není.', { n: plural(missing, KP.t('uložené místo už'), KP.t('uložená místa už'), KP.t('uložených míst už')) }) + '</p>' : '');
      dropBrokenPhotos($('#saved'));
    };
    if (SAVED_ITEMS) { draw(SAVED_ITEMS); return; }
    $('#saved').innerHTML = ('<p class="muted">' + KP.t('Načítám uložená místa…') + '</p>');
    K.findPlaces(ids).then(items => { SAVED_ITEMS = items; draw(items); })
      .catch(() => { $('#saved').innerHTML = ('<p class="muted">' + KP.t('Seznam míst se nepodařilo načíst.') + '</p>'); });
  }
  function renderCollections() {
    const list = C.collections();
    if (!list.length) { $('#collections').innerHTML = ''; return; }
    $('#collections').innerHTML = ('<h3 class="pf-sub">' + KP.t('Moje kolekce') + '</h3><ul class="pf-list rule-list">') + list.map(c =>
      '<li class="rule-row pf-line"><span class="pf-txt"><b>' + K.esc(c.name) + '</b><small>' + plural(c.ids.length, KP.t('místo'), KP.t('místa'), KP.t('míst')) + ' · ' + K.fmtDate(c.date) + '</small></span>' +
      '<button class="btn btn-quiet btn-sm" type="button" data-del-coll="' + K.esc(c.id) + ('" data-label="' + KP.t('Smazat') + '">' + KP.t('Smazat') + '</button></li>')).join('') + '</ul>';
  }

  // ---------- Hodnocení a fotky ----------
  const AREA_LBL = { vstup: KP.t('Vstup'), wc: 'WC', parkovani: KP.t('Parkování'), interier: KP.t('Pohyb uvnitř'), pokoj: KP.t('Pokoj') };
  function renderReviews() {
    const list = C.myReviews();
    const photos = list.reduce((s, r) => s + (r.photos || []).length, 0);
    setCount('#rev-n', list.length);
    if (!list.length) { $('#reviews').innerHTML = empty(KP.t('Zatím jste nehodnotili žádné místo. Hodnocení, zkušenost a fotky přidáte v detailu místa.'), 'mapa.html', KP.t('Najít místo'), true); return; }
    $('#reviews').innerHTML = '<p class="small muted">' + plural(list.length, 'ko.rev1', 'ko.rev2', 'ko.rev5') + ', ' + plural(photos, 'fotka', 'fotky', 'fotek') + '. ' + K.esc(K.PROTOTYPE_NOTE) + '</p>' +
      '<ul class="pf-list rule-list">' + list.map(r => {
        const rt = Object.keys(AREA_LBL).filter(a => r.ratings && r.ratings[a]).map(a => '<span>' + AREA_LBL[a] + ' <b class="num">' + r.ratings[a] + '/5</b></span>').join('');
        const ph = (r.photos || []).map((src, i) => '<li><img src="' + src + '" alt="' + K.t('Vaše fotka {i} k místu {n}', { i: i + 1, n: K.esc((r.place && r.place.n) || r.placeId) }) + '" loading="lazy" decoding="async"></li>').join('');
        return '<li class="rule-row pf-rev"><div class="pf-txt">' + placeLink(r.placeId, r.place) +
          '<small>' + K.fmtDate(r.date) + (r.aid ? ' · ' + K.esc(K.t(r.aid)) : '') + '</small>' +
          (rt ? '<p class="pf-ratings">' + rt + '</p>' : '') + (r.text ? '<p class="pf-quote">' + K.esc(r.text) + '</p>' : '') +
          (ph ? '<ul class="pf-photos">' + ph + '</ul>' : '') + '</div>' +
          '<button class="btn btn-quiet btn-sm" type="button" data-del-rev="' + K.esc(r.id) + '" data-place="' + K.esc(r.placeId) + ('" data-label="' + KP.t('Smazat') + '">' + KP.t('Smazat') + '</button></li>');
      }).join('') + '</ul>';
  }

  // ---------- Trasy a itineráře ----------
  function renderRoutes() {
    const routes = C.routes(), its = C.itineraries();
    setCount('#routes-n', routes.length + its.length);
    if (!routes.length && !its.length) { $('#routes').innerHTML = empty(KP.t('Zatím nemáte uloženou trasu ani itinerář. Trasu naplánujete a uložíte na stránce Trasy.'), 'trasy.html', KP.t('Plánovat trasu'), true); return; }
    const chain = (stops) => stops.map(s => K.esc(s.n || s.i)).join((' <span aria-hidden="true">→</span><span class="sr-only">, ' + KP.t('potom') + '</span> '));
    const rRow = (r) => {
      const way = (r.stops && r.stops.length) ? chain(r.stops) : r.from ? K.esc(r.from) + (' <span aria-hidden="true">→</span><span class="sr-only">' + KP.t('do') + '</span> ') + K.esc(r.to) : '';
      const meta = [K.fmtDate(r.date), r.barriers && r.barriers.length ? plural(r.barriers.length, KP.t('zapsaná překážka'), KP.t('zapsané překážky'), KP.t('zapsaných překážek')) : '',
        r.comments && r.comments.length ? plural(r.comments.length, KP.t('poznámka'), KP.t('poznámky'), KP.t('poznámek')) : '', r.confirmed ? K.t('aktuálnost potvrzena') + ' ' + K.fmtDate(r.confirmed) : ''].filter(Boolean).join(' · ');
      const share = r.stops && r.stops.length ? '<button class="btn btn-quiet btn-sm" type="button" data-share="' + K.esc(r.id) + ('">' + KP.t('Kopírovat odkaz') + '</button>') : '';
      return ('<li class="rule-row pf-line"><span class="pf-txt"><span class="badge badge-soon">' + KP.t('Trasa') + '</span><b>') + K.esc(r.name || KP.t('Trasa')) + '</b>' + (way ? '<span class="small">' + way + '</span>' : '') +
        (r.note ? '<small>' + K.esc(r.note) + '</small>' : '') + '<small>' + meta + '</small></span>' +
        '<span class="pf-acts">' + share + '<button class="btn btn-quiet btn-sm" type="button" data-del-route="' + K.esc(r.id) + ('" data-label="' + KP.t('Smazat') + '">' + KP.t('Smazat') + '</button></span></li>');
    };
    const iRow = (it) => ('<li class="rule-row pf-line"><span class="pf-txt"><span class="badge badge-soon">' + KP.t('Itinerář') + '</span><b>') + K.esc(it.name || KP.t('Itinerář')) + '</b>' +
      (it.stops.length ? '<span class="small">' + chain(it.stops) + '</span>' : '') + (it.note ? '<small>' + K.esc(it.note) + '</small>' : '') +
      '<small>' + K.fmtDate(it.date) + ' · ' + plural(it.stops.length, KP.t('zastávka'), KP.t('zastávky'), KP.t('zastávek')) + '</small></span>' +
      '<span class="pf-acts"><button class="btn btn-quiet btn-sm" type="button" data-del-it="' + K.esc(it.id) + ('" data-label="' + KP.t('Smazat') + '">' + KP.t('Smazat') + '</button></span></li>');
    $('#routes').innerHTML = '<ul class="pf-list rule-list">' + routes.map(rRow).join('') + its.map(iRow).join('') + '</ul>';
  }

  // ---------- Převzaté profily podniků ----------
  function renderClaims() {
    const list = B.claims();
    setCount('#biz-n', list.length);
    if (!list.length) { $('#claims').innerHTML = empty(KP.t('Nespravujete žádný podnik. Provozovatel může převzít profil svého místa a doplnit ho podle checklistu.'), 'pro-firmy.html', KP.t('Pro podniky'), true); return; }
    $('#claims').innerHTML = '<p class="small muted">' + K.esc(B.note) + (' ' + KP.t('Statistiky počítají jen to, co se stalo v tomto prohlížeči.') + '</p><ul class="pf-list rule-list">') + list.map(c => {
      const pr = B.progress(c.placeId, c.place && c.place.c), st = B.stats(c.placeId);
      const stat = [plural(st.views, 'pf.view1', 'zobrazení detailu', 'zobrazení detailu'), plural(st.impressions, KP.t('výskyt ve výsledcích'), KP.t('výskyty ve výsledcích'), KP.t('výskytů ve výsledcích')), plural(st.requests, KP.t('žádost o údaje'), KP.t('žádosti o údaje'), KP.t('žádostí o údaje'))].join(' · ');
      return '<li class="rule-row pf-biz"><div class="pf-txt">' + placeLink(c.placeId, c.place) +
        ('<small>' + KP.t('Převzato') + ' ') + K.fmtDate(c.date) + (c.role ? ' · ' + K.esc(K.t(c.role)) : '') + '</small>' +
        '<div class="pf-meter" role="img" aria-label="' + K.t('Checklist vyplněn na {pct} %', { pct: pr.pct }) + '"><span style="width:' + pr.pct + '%"></span></div>' +
        '<small>' + (pr.complete ? K.statusHtml('ok', K.t('Profil je kompletní')) : K.t('Checklist: {a} z {b} údajů, {c} z {d} fotek', { a: pr.done, b: pr.total, c: pr.photosDone, d: pr.photosTotal })) + '</small>' +
        '<small>' + stat + '</small></div>' +
        '<span class="pf-acts"><a class="btn btn-ghost btn-sm" href="podnik.html?id=' + encodeURIComponent(c.placeId) + (c.place && c.place.r ? '&r=' + encodeURIComponent(c.place.r) : '') + ('#checklist">' + KP.t('Doplnit profil') + '</a>') +
        '<button class="btn btn-quiet btn-sm" type="button" data-unclaim="' + K.esc(c.placeId) + ('" data-label="' + KP.t('Zrušit převzetí') + '">' + KP.t('Zrušit převzetí') + '</button></span></li>');
    }).join('') + '</ul>';
  }

  // ---------- Hlášení, potvrzení, žádosti ----------
  const FIELD_LBL = {}; K.FEATURES.forEach(f => { FIELD_LBL[f.k] = f.label; });
  function renderReports() {
    const reps = C.mine('reports'), reqs = C.mine('requests'), conf = C.myConfirmations();
    setCount('#rep-n', reps.length + reqs.length + conf.length);
    if (!reps.length && !reqs.length && !conf.length) { $('#reports').innerHTML = empty(KP.t('Zatím jste nic nenahlásili ani nepotvrdili. V detailu místa můžete potvrdit údaj, nahlásit změnu nebo požádat podnik o doplnění.')); return; }
    const rows = [];
    reqs.forEach(r => rows.push([r.date, KP.t('Žádost o údaje'), placeLink(r.placeId, r.place), r.areas && r.areas.length ? (KP.t('Oblasti') + ': ') + r.areas.map(a => AREA_LBL[a] || a).join(', ') : '']));
    // Starší potvrzení nemají uložený název místa, vezmeme ho z jiného záznamu ke stejnému místu
    const refs = {}; reqs.concat(reps, C.myReviews()).forEach(r => { if (r.place && r.place.n) refs[r.placeId] = r.place; });
    conf.forEach(c => rows.push([c.date, c.v === 'yes' ? KP.t('Potvrzeno') : KP.t('Neplatí'), placeLink(c.placeId, (c.place && c.place.n) ? c.place : refs[c.placeId] || c.place), FIELD_LBL[c.field] || c.field]));
    reps.forEach(r => rows.push([r.date, KP.t('Hlášení změny'), placeLink(r.placeId, r.place), (r.field ? (FIELD_LBL[r.field] || r.field) + ': ' : '') + r.text]));
    rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    $('#reports').innerHTML = '<p class="small muted">' + K.esc(K.PROTOTYPE_NOTE) + '</p><ul class="pf-list rule-list">' + rows.map(([d, kind, link, txt]) =>
      '<li class="rule-row pf-line"><span class="pf-txt"><span class="badge badge-soon">' + kind + '</span>' + link + (txt ? '<small>' + K.esc(txt) + '</small>' : '') + '<small>' + K.fmtDate(d) + '</small></span></li>').join('') + '</ul>';
  }

  // ---------- Rozepsané příspěvky (pridat.html) ----------
  function renderDrafts() {
    const d = K.store.get('drafts', []);
    setCount('#drafts-n', d.length);
    if (!d.length) { $('#drafts').innerHTML = empty(KP.t('Zatím jste nic nepřidali.'), 'pridat.html', KP.t('Přidat místo'), true); return; }
    $('#drafts').innerHTML = ('<p class="small muted">' + KP.t('Uloženo jen v tomto prohlížeči, zatím neodesláno.') + '</p><ul class="pf-list rule-list">') + d.map(x =>
      '<li><a class="rule-row pf-draft" href="' + (x.place && x.place.i ? K.placeUrl({ i: x.place.i, _r: x.place.r }) : 'pridat.html') + '">' +
      '<span class="pf-date num">' + K.fmtDate(x.created) + '</span>' +
      '<span class="pf-txt"><b>' + K.esc(x.place && x.place.n || KP.t('Bez názvu')) + '</b><small>' +
      K.t('{a} údajů · {b} fotek', { a: Object.keys(x.values || {}).length, b: (x.photos || []).length }) + (x.category ? ' · ' + K.esc(K.t(x.category)) : '') + '</small></span>' +
      '<span class="pf-go">' + K.icon('arrow') + '</span></a></li>').join('') + '</ul>' +
      ('<button class="btn btn-quiet btn-sm pf-clear" type="button" id="clear-drafts" data-label="' + KP.t('Smazat všechny příspěvky') + '">' + KP.t('Smazat všechny příspěvky') + '</button>');
  }

  // ---------- Akce (jedno delegované poslouchání) ----------
  function bindActions() {
    document.querySelector('.pf-main').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.delRev) confirmClick(b, null, () => { C.deleteReview(b.dataset.place, b.dataset.delRev); renderReviews(); K.toast(KP.t('Hodnocení smazáno.')); });
      else if (b.dataset.delRoute) confirmClick(b, null, () => { C.deleteRoute(b.dataset.delRoute); renderRoutes(); K.toast(KP.t('Trasa smazána.')); });
      else if (b.dataset.delIt) confirmClick(b, null, () => { C.deleteItinerary(b.dataset.delIt); renderRoutes(); K.toast(KP.t('Itinerář smazán.')); });
      else if (b.dataset.delColl) confirmClick(b, null, () => { C.deleteCollection(b.dataset.delColl); renderCollections(); K.toast(KP.t('Kolekce smazána.')); });
      else if (b.dataset.unclaim) confirmClick(b, KP.t('Opravdu zrušit? Klikněte znovu'), () => { B.unclaim(b.dataset.unclaim); renderClaims(); K.toast(KP.t('Převzetí zrušeno. Vyplněný profil zůstal uložený.')); });
      else if (b.id === 'clear-drafts') confirmClick(b, null, () => { K.store.set('drafts', []); renderDrafts(); K.toast(KP.t('Příspěvky smazány.')); });
      else if (b.dataset.share) {
        const r = C.routes().find(x => x.id === b.dataset.share), url = r && C.routeShareUrl(r);
        if (!url) return;
        const done = () => K.toast(KP.t('Odkaz na trasu je ve schránce.'));
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt((KP.t('Zkopírujte odkaz') + ':'), url));
        else window.prompt((KP.t('Zkopírujte odkaz') + ':'), url);
      }
    });
    $('#wipe').addEventListener('click', function () {
      confirmClick(this, KP.t('Smaže potřeby, uložená místa, hodnocení, trasy i podniky. Klikněte znovu'), () => {
        try { Object.keys(localStorage).filter(k => k.indexOf('kp.') === 0 && k !== 'kp.theme').forEach(k => localStorage.removeItem(k)); } catch (e) { /* bez úložiště */ }
        SAVED_ITEMS = null; renderAll(); K.toast(KP.t('Vaše data v tomto prohlížeči jsou smazaná.'));
      });
    });
  }

  function renderAll() { renderNeeds(); renderSaved(); renderCollections(); renderReviews(); renderRoutes(); renderClaims(); renderReports(); renderDrafts(); }
  function init() {
    renderAll(); bindNeeds(); bindActions();
    document.addEventListener('kp:needs', () => { renderNeeds(); renderSaved(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
