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

  // Styly pro členství, sledování, seznamy a sdílení (pages-b.css patří i jiným stránkám, proto tady)
  (function profilCss() {
    if (document.getElementById('pf-tier-css')) return;
    const st = document.createElement('style'); st.id = 'pf-tier-css';
    st.textContent =
      '.pf-tier-now{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:0 0 4px}' +
      '.pf-tier-now b{font-family:var(--f-display);font-size:1.4rem}.pf-tier-now span:last-child{color:var(--ink-2)}' +
      '.pf-tier-price{margin:0 0 16px;font-weight:700}' +
      '.pf-tier-list{list-style:none;margin:0 0 16px;padding:0;border-top:1px solid var(--rule)}' +
      '.pf-tier-list li{display:grid;grid-template-columns:84px minmax(0,1fr);gap:12px;align-items:center;min-height:44px;padding:8px 0;border-bottom:1px solid var(--line)}' +
      '.pf-tier-list li.is-off{color:var(--ink-3)}' +
      '.pf-mark{display:inline-flex;align-items:center}.pf-mark svg{width:20px;height:20px}' +
      '.pf-lock{display:grid;gap:8px;padding:14px 16px;border:1px solid var(--rule);border-left:6px solid var(--signal);background:var(--surface);margin:0 0 12px}' +
      '.pf-lock p{margin:0}.pf-lock .btn{justify-self:start}' +
      '.pf-changes{list-style:none;margin:6px 0 0;padding:8px 12px;border-left:4px solid var(--signal);background:var(--surface-2);display:grid;gap:4px}' +
      '.pf-chfrom{text-decoration:line-through;color:var(--ink-3)}.pf-chto{font-weight:700}' +
      '.pf-collform{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 12px}.pf-collform input{flex:1 1 220px;min-height:44px}' +
      '.pf-cplaces{list-style:none;margin:6px 0;padding:0;display:grid;gap:2px}' +
      '.pf-cplaces li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;min-height:44px}' +
      '.pf-coll select{min-height:44px;max-width:100%}' +
      '.pf-shared{padding:16px;border:2px solid var(--rule);border-left:8px solid var(--signal);margin:0 0 24px}' +
      '.pf-shared h2{margin:0 0 8px}.pf-shared .row{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}';
    document.head.appendChild(st);
  })();

  // ---------- Členství (PROTOTYP: úroveň jen v tomto prohlížeči, nic se neplatí) ----------
  // Co je vždy zdarma: přesné body úrovně FREE
  const FREE_ITEMS = ['Interaktivní mapa bezbariérových míst', 'Podrobné informace o přístupnosti a fotografie', 'Základní vyhledávání a filtrování',
    'Recenze a zkušenosti ostatních uživatelů', 'Přidávání nových míst a hodnocení'];
  function renderTier() {
    const k = K.tier(), T = K.TIERS[k];
    const mark = (on, f) => on ? '<span class="pf-mark">' + K.icon('check') + '<span class="sr-only">' + KP.t('obsahuje') + '</span></span>' : '<span class="pf-mark">' + K.tierTag(K.tierOf(f)) + '</span>';
    const free = FREE_ITEMS.map(x => '<li>' + mark(true) + '<span>' + K.esc(KP.t(x)) + '</span></li>').join('') +
      '<li>' + mark(true) + '<span>' + K.esc(K.hasTier('unlimitedSaves') ? KP.t('Neomezené ukládání míst a itinerářů') : K.t('Uložení až {n} oblíbených míst', { n: K.FREE_SAVE_LIMIT })) + '</span></li>';
    const paid = Object.keys(K.FEATURES_TIER).filter(f => f !== 'unlimitedSaves').map(f => {
      const on = K.hasTier(f), info = K.FEATURE_INFO[f] || { label: f };
      return '<li' + (on ? '' : ' class="is-off"') + '>' + mark(on, f) + '<span>' + K.esc(info.label) + '</span></li>';
    }).join('');
    $('#tier-box').innerHTML =
      '<p class="pf-tier-now">' + K.tierTag(k) + '<b>' + K.esc(T.name) + '</b><span>' + K.esc(T.claim) + '</span></p>' +
      '<p class="pf-tier-price num">' + K.esc(T.priceLabel) + '</p>' +
      '<div class="pf-form-actions"><button class="btn btn-primary" type="button" data-tier-switch>' + K.esc(KP.t('Změnit úroveň (prototyp)')) + '</button>' +
      '<a class="btn btn-ghost" href="clenstvi.html">' + K.esc(KP.t('Porovnat úrovně')) + '</a></div>' +
      '<h3 class="pf-sub">' + K.esc(KP.t('Co vaše úroveň obsahuje')) + '</h3>' +
      '<ul class="pf-tier-list">' + free + paid + '</ul>' +
      '<p class="callout small">' + K.esc(K.TIER_NOTE) + '</p>' +
      '<p class="small muted">' + K.esc(K.TIER_PROTO_NOTE) + ' ' + K.esc(KP.t('Základní informace o přístupnosti a jejich opravy nikdy nezávisí na platbě.')) + '</p>';
    document.querySelectorAll('[data-tier-badge]').forEach(el => { el.innerHTML = K.tierBadge(el.dataset.tierBadge, { onlyLocked: true }); });
  }
  // Panel „funkce je v PLUS / PREMIUM“; po vyzkoušení se stránka překreslí událostí kp:tier
  function lockHtml(feature, extra) {
    const info = K.FEATURE_INFO[feature] || { label: feature, desc: '' };
    return '<div class="pf-lock"><p><b>' + K.esc(info.label) + '</b> ' + K.tierBadge(feature) + '</p><p class="small">' + K.esc(info.desc) + (extra ? ' ' + K.esc(extra) : '') + '</p>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-try="' + K.esc(feature) + '">' + K.esc(KP.t('Vyzkoušet (prototyp)')) + '</button></div>';
  }

  // ---------- Profil přístupnosti (formulář přímo na stránce) ----------
  function renderNeeds() {
    const n = K.getNeeds(), has = K.hasTier('needsProfile');
    $('#needs-form').hidden = !has;
    $('#needs-lock').hidden = has;
    if (!has) {
      $('#needs-state').innerHTML = K.tierBadge('needsProfile');
      $('#needs-lock').outerHTML = '<div id="needs-lock">' + lockHtml('needsProfile', KP.t('Uložené potřeby se nemažou, ve FREE se jen nepoužijí.')) + '</div>';
      return;
    }
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
  // FREE: nejvýš KP.FREE_SAVE_LIMIT míst; nad limit se nic nemaže, jen nejde přidat další
  function limitLine(n) {
    if (K.hasTier('unlimitedSaves')) return '';
    return '<p class="small">' + K.esc(K.t('Uloženo {n} z {max} míst. Neomezené ukládání je součást PLUS.', { n, max: K.FREE_SAVE_LIMIT })) + ' ' + K.tierBadge('unlimitedSaves') + '</p>';
  }
  let SAVED_ITEMS = null;
  function renderSaved() {
    const ids = K.saved.all();
    setCount('#saved-n', ids.length);
    if (!ids.length) { $('#saved').innerHTML = empty(KP.t('Zatím nemáte uložená žádná místa. Uložíte je tlačítkem Uložit v detailu místa.'), 'mapa.html', KP.t('Otevřít mapu')); return; }
    const draw = (items) => {
      const missing = ids.length - items.length, needs = K.getNeeds();
      $('#saved').innerHTML = limitLine(ids.length) + (needs.active ? '' : ('<p class="small muted">' + (K.hasTier('match') ? KP.t('Shodu v procentech uvidíte, až vyplníte profil přístupnosti.') : KP.t('Shoda v procentech (Accessibility Match) je součást PLUS.') + ' ' + K.tierBadge('match')) + '</p>')) +
        '<ul class="pf-list rule-list">' + items.map(p => placeRow(p, needs)).join('') + '</ul>' +
        (missing ? '<p class="small muted">' + K.t('{n} v aktuálních datech není.', { n: plural(missing, KP.t('uložené místo už'), KP.t('uložená místa už'), KP.t('uložených míst už')) }) + '</p>' : '');
      dropBrokenPhotos($('#saved'));
    };
    if (SAVED_ITEMS) { draw(SAVED_ITEMS); return; }
    $('#saved').innerHTML = ('<p class="muted">' + KP.t('Načítám uložená místa…') + '</p>');
    K.findPlaces(ids).then(items => { SAVED_ITEMS = items; draw(items); })
      .catch(() => { $('#saved').innerHTML = ('<p class="muted">' + KP.t('Seznam míst se nepodařilo načíst.') + '</p>'); });
  }
  // ---------- Vlastní seznamy (PLUS) ----------
  // Seznamy = KP.community.collections ({id, name, ids, date}). Názvy míst se dohledají z dat (KP.findPlaces).
  const NAMES = {};
  const TRIED = new Set();
  let namesLoading = false;
  function nameOf(id) { return NAMES[id] && NAMES[id].n ? NAMES[id].n : (KP.t('Místo') + ' ' + id); }
  function loadNames(ids) {
    const miss = ids.filter(id => !NAMES[id] && !TRIED.has(id));
    if (!miss.length || namesLoading) return;
    namesLoading = true; miss.forEach(id => TRIED.add(id));
    K.findPlaces(miss).then(items => { items.forEach(p => { NAMES[p.i] = { n: p.n, r: p._r || '' }; }); })
      .catch(() => {}).then(() => { namesLoading = false; renderCollections(); });
  }
  function renderCollections() {
    const list = C.collections(), has = K.hasTier('customLists');
    const head = '<h3 class="pf-sub">' + K.esc(KP.t('Vlastní seznamy')) + ' ' + K.tierBadge('customLists', { onlyLocked: true }) + '</h3>';
    if (!has && !list.length) { $('#collections').innerHTML = head + lockHtml('customLists'); return; }
    loadNames([].concat(...list.map(c => c.ids)).concat(K.saved.all()));
    const savedOpts = K.saved.all();
    const form = has ? '<form class="pf-collform" data-coll-new><label class="sr-only" for="coll-name">' + K.esc(KP.t('Název seznamu')) + '</label>' +
      '<input id="coll-name" type="text" maxlength="60" placeholder="' + K.esc(KP.t('Název seznamu, třeba Výlet do Českých Budějovic')) + '" required>' +
      '<button class="btn btn-ghost" type="submit">' + K.icon('plus') + K.esc(KP.t('Vytvořit seznam')) + '</button></form>' : lockHtml('customLists', KP.t('Vaše dřívější seznamy zůstávají, upravovat je jde v PLUS.'));
    const row = (c) => {
      const places = c.ids.map(id => '<li><a href="' + K.placeUrl({ i: id, _r: (NAMES[id] && NAMES[id].r) || '' }) + '">' + K.esc(nameOf(id)) + '</a>' +
        (has ? '<button class="btn btn-quiet btn-sm" type="button" data-coll-rm="' + K.esc(c.id) + '" data-place="' + K.esc(id) + '">' + K.esc(KP.t('Odebrat')) + '</button>' : '') + '</li>').join('');
      const add = has && savedOpts.some(id => !c.ids.includes(id)) ? '<label class="sr-only" for="ca-' + K.esc(c.id) + '">' + K.esc(KP.t('Přidat uložené místo')) + '</label><select id="ca-' + K.esc(c.id) + '" data-coll-add="' + K.esc(c.id) + '"><option value="">' + K.esc(KP.t('Přidat uložené místo…')) + '</option>' +
        savedOpts.filter(id => !c.ids.includes(id)).map(id => '<option value="' + K.esc(id) + '">' + K.esc(nameOf(id)) + '</option>').join('') + '</select>' : '';
      return '<li class="rule-row pf-line pf-coll"><span class="pf-txt"><b>' + K.esc(c.name) + '</b><small>' + plural(c.ids.length, KP.t('místo'), KP.t('místa'), KP.t('míst')) + ' · ' + K.fmtDate(c.date) + '</small>' +
        (places ? '<ul class="pf-cplaces">' + places + '</ul>' : '') + add + '</span>' +
        '<span class="pf-acts">' + (has && c.ids.length ? '<button class="btn btn-quiet btn-sm" type="button" data-coll-share="' + K.esc(c.id) + '">' + K.esc(KP.t('Kopírovat odkaz')) + '</button>' : '') +
        '<button class="btn btn-quiet btn-sm" type="button" data-del-coll="' + K.esc(c.id) + ('" data-label="' + KP.t('Smazat') + '">' + KP.t('Smazat') + '</button></span></li>');
    };
    $('#collections').innerHTML = head + form + (list.length ? '<ul class="pf-list rule-list">' + list.map(row).join('') + '</ul>' : '<p class="small muted">' + K.esc(KP.t('Zatím nemáte žádný seznam. Místa si roztřídíte třeba podle výletu.')) + '</p>');
  }

  // ---------- Sdílení odkazem (seznam: PLUS, vše pro cestovního partnera: PREMIUM) ----------
  // Bez serveru: obsah je zakódovaný v odkazu profil.html#sdileni=<base64 JSON {k, n, s:[[id, region, název]], l:[{n, s}]}>
  const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = (x) => { try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(x))))); } catch (e) { return null; } };
  const ref = (id) => [id, (NAMES[id] && NAMES[id].r) || (K.store.get('placeRegion', {})[id] || ''), NAMES[id] ? NAMES[id].n : ''];
  const shareUrl = (o) => location.origin + location.pathname.replace(/[^/]*$/, '') + 'profil.html#sdileni=' + encodeURIComponent(enc(o));
  function copy(url, okMsg) {
    const done = () => K.toast(okMsg);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt(KP.t('Zkopírujte odkaz') + ':', url));
    else window.prompt(KP.t('Zkopírujte odkaz') + ':', url);
  }
  function renderPartner() {
    const box = $('#partner-box'); if (!box) return;
    if (!K.hasTier('partnerShare')) { box.innerHTML = lockHtml('partnerShare'); return; }
    box.innerHTML = '<p class="small muted">' + K.esc(KP.t('Prototyp: účty zatím nejsou. Partnerovi pošlete odkaz s vašimi uloženými místy a seznamy. V ostré verzi bude moct používat i prémiové funkce.')) + '</p>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-partner-link>' + K.icon('share') + K.esc(KP.t('Kopírovat odkaz pro partnera')) + '</button>';
  }
  // Otevřený sdílený odkaz: náhled míst a import (seznam do vlastních seznamů, místa do uložených)
  let SHARED = null;
  function renderShared() {
    const box = $('#shared-in');
    if (!SHARED) { box.innerHTML = ''; return; }
    const s = SHARED, all = (s.s || []).concat(...(s.l || []).map(l => l.s || []));
    const li = (x) => '<li><a href="' + K.placeUrl({ i: x[0], _r: x[1] || '' }) + '">' + K.esc(x[2] || (KP.t('Místo') + ' ' + x[0])) + '</a></li>';
    box.innerHTML = '<section class="pf-shared" aria-labelledby="shared-h"><p class="kicker">' + K.esc(s.k === 'partner' ? KP.t('Sdíleno od cestovního partnera') : KP.t('Sdílený seznam')) + '</p>' +
      '<h2 id="shared-h">' + K.esc(s.n || KP.t('Sdílený seznam')) + '</h2>' +
      (s.s && s.s.length ? '<ul class="pf-cplaces">' + s.s.map(li).join('') + '</ul>' : '') +
      (s.l || []).map(l => '<p><b>' + K.esc(l.n) + '</b></p><ul class="pf-cplaces">' + (l.s || []).map(li).join('') + '</ul>').join('') +
      '<p class="small muted">' + K.esc(KP.t('Odkaz nese jen seznam míst. Nic se neodesílá na server.')) + '</p>' +
      '<div class="row">' + (all.length ? '<button class="btn btn-primary" type="button" data-shared-save>' + K.esc(KP.t('Uložit jako můj seznam')) + ' ' + K.tierBadge('customLists', { onlyLocked: true }) + '</button>' : '') +
      '<button class="btn btn-quiet" type="button" data-shared-close>' + K.esc(KP.t('Zavřít')) + '</button></div></section>';
  }
  function importShared() {
    const s = SHARED; if (!s) return;
    const lists = [{ n: s.n, s: s.s || [] }].concat(s.l || []).filter(l => l.s && l.s.length);
    lists.forEach(l => {
      l.s.forEach(x => { if (x[1]) K.rememberRegion({ i: x[0], _r: x[1] }); NAMES[x[0]] = NAMES[x[0]] || { n: x[2] || '', r: x[1] || '' }; });
      C.saveCollection({ name: String(l.n || KP.t('Sdílený seznam')).slice(0, 60), ids: l.s.map(x => x[0]) });
    });
    SHARED = null; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* bez historie */ }
    renderShared(); renderCollections(); K.toast(KP.t('Seznam uložen do vašich seznamů.'));
  }

  // ---------- Sledovaná místa a změny (PLUS) ----------
  let WATCH_ITEMS = null;
  function renderWatch() {
    const W = K.watch, ids = W ? W.ids() : [];
    setCount('#watch-n', ids.length);
    const has = K.hasTier('changeAlerts');
    if (!ids.length) { $('#watch').innerHTML = has ? empty(KP.t('Zatím nic nesledujete. V detailu místa zapněte Sledovat změny.'), 'mapa.html', KP.t('Najít místo'), true) : lockHtml('changeAlerts'); return; }
    const all = W.all();
    if (!has) {
      $('#watch').innerHTML = lockHtml('changeAlerts', KP.t('Sledovaná místa zůstávají uložená, změny ukážeme v PLUS.')) +
        '<ul class="pf-list rule-list">' + ids.map(id => '<li class="rule-row pf-line"><span class="pf-txt">' + placeLink(id, all[id]) + '<small>' + K.esc(K.t('Sledujete od {d}', { d: K.fmtDate(all[id].date) })) + '</small></span></li>').join('') + '</ul>';
      return;
    }
    const draw = (items) => {
      const byId = {}; items.forEach(p => { byId[p.i] = p; });
      $('#watch').innerHTML = '<p class="small muted">' + K.esc(KP.t('Prototyp: porovnáváme otisk údajů uložený v tomto prohlížeči s aktuálními daty.')) + '</p><ul class="pf-list rule-list">' + ids.map(id => {
        const w = all[id], p = byId[id], ch = p ? W.changes(p) : null;
        const state = !p ? '<small>' + K.statusHtml('no', KP.t('Místo už v aktuálních datech není')) + '</small>'
          : ch.length ? '<ul class="pf-changes">' + ch.map(c => '<li><b>' + K.esc(c.label) + '</b>: <span class="pf-chfrom">' + K.esc(c.from) + '</span> <span aria-hidden="true">→</span><span class="sr-only">' + K.esc(KP.t('nově')) + '</span> <span class="pf-chto">' + K.esc(c.to) + '</span></li>').join('') + '</ul>'
          : '<small>' + K.statusHtml('ok', KP.t('Beze změny')) + '</small>';
        return '<li class="rule-row pf-line"><span class="pf-txt">' + (p ? '<a class="pf-link" href="' + K.placeUrl(p) + '"><b>' + K.esc(p.n) + '</b></a>' : placeLink(id, w)) +
          '<small>' + K.esc(K.t('Sledujete od {d}', { d: K.fmtDate(w.date) })) + '</small>' + state + '</span>' +
          '<span class="pf-acts">' + (ch && ch.length ? '<button class="btn btn-ghost btn-sm" type="button" data-watch-ack="' + K.esc(id) + '">' + K.esc(KP.t('Beru na vědomí')) + '</button>' : '') +
          '<button class="btn btn-quiet btn-sm" type="button" data-unwatch="' + K.esc(id) + '">' + K.esc(KP.t('Nesledovat')) + '</button></span></li>';
      }).join('') + '</ul>';
    };
    if (WATCH_ITEMS) { draw(WATCH_ITEMS); return; }
    $('#watch').innerHTML = '<p class="muted">' + K.esc(KP.t('Porovnávám sledovaná místa…')) + '</p>';
    K.findPlaces(ids).then(items => { WATCH_ITEMS = items; draw(items); })
      .catch(() => { $('#watch').innerHTML = '<p class="muted">' + K.esc(KP.t('Seznam míst se nepodařilo načíst.')) + '</p>'; });
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
        SAVED_ITEMS = null; WATCH_ITEMS = null; K.setTier('free'); renderAll(); K.toast(KP.t('Vaše data v tomto prohlížeči jsou smazaná.'));
      });
    });
  }

  // Akce členství, seznamů, sledování a sdílení: jedno poslouchání na celé stránce (prvky jsou i mimo .pf-main)
  function bindTierActions() {
    document.querySelector('.pf-layout').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-tier-switch')) K.tierSwitch();
      else if (b.dataset.try) K.requireTier(b.dataset.try, () => {});
      else if (b.dataset.unwatch) { K.watch.remove(b.dataset.unwatch); renderWatch(); K.toast(KP.t('Změny u tohoto místa už nesledujete.')); }
      else if (b.dataset.watchAck) { const p = (WATCH_ITEMS || []).find(x => x.i === b.dataset.watchAck); if (p) { K.watch.accept(p); renderWatch(); K.toast(KP.t('Změny vzaty na vědomí.')); } }
      else if (b.dataset.collRm) { C.removeFromCollection(b.dataset.collRm, b.dataset.place); renderCollections(); }
      else if (b.dataset.collShare) {
        const c = C.collections().find(x => x.id === b.dataset.collShare); if (!c) return;
        copy(shareUrl({ k: 'list', n: c.name, s: c.ids.map(ref) }), KP.t('Odkaz na seznam je ve schránce.'));
      } else if (b.hasAttribute('data-partner-link')) {
        K.requireTier('partnerShare', () => copy(shareUrl({ k: 'partner', n: KP.t('Moje uložená místa'), s: K.saved.all().map(ref), l: C.collections().map(c => ({ n: c.name, s: c.ids.map(ref) })) }), KP.t('Odkaz pro partnera je ve schránce.')));
      } else if (b.hasAttribute('data-shared-save')) K.requireTier('customLists', importShared);
      else if (b.hasAttribute('data-shared-close')) { SHARED = null; try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* bez historie */ } renderShared(); }
    });
    document.querySelector('.pf-layout').addEventListener('change', (e) => {
      const s = e.target.closest('[data-coll-add]'); if (!s || !s.value) return;
      C.addToCollection(s.dataset.collAdd, s.value); renderCollections(); K.toast(KP.t('Místo přidáno do seznamu.'));
      const again = document.querySelector('[data-coll-add="' + CSS.escape(s.dataset.collAdd) + '"]'); if (again) again.focus();
    });
    document.querySelector('.pf-layout').addEventListener('submit', (e) => {
      if (!e.target.matches('[data-coll-new]')) return;
      e.preventDefault();
      const name = $('#coll-name').value.trim(); if (!name) { $('#coll-name').focus(); return; }
      K.requireTier('customLists', () => { if (C.saveCollection({ name: name.slice(0, 60), ids: [] })) { renderCollections(); K.toast(KP.t('Seznam vytvořen.')); } });
    });
  }
  function readShared() {
    const m = location.hash.match(/sdileni=([^&]+)/); if (!m) return null;
    const o = dec(m[1]);
    const okList = (a) => Array.isArray(a) ? a.filter(x => Array.isArray(x) && typeof x[0] === 'string' && x[0]).slice(0, 500).map(x => [String(x[0]).slice(0, 40), String(x[1] || '').slice(0, 40), String(x[2] || '').slice(0, 120)]) : [];
    if (!o || typeof o !== 'object') return null;
    return { k: o.k === 'partner' ? 'partner' : 'list', n: String(o.n || '').slice(0, 60), s: okList(o.s), l: Array.isArray(o.l) ? o.l.slice(0, 50).map(l => ({ n: String((l && l.n) || '').slice(0, 60), s: okList(l && l.s) })) : [] };
  }

  function renderAll() { renderTier(); renderNeeds(); renderSaved(); renderCollections(); renderWatch(); renderPartner(); renderShared(); renderReviews(); renderRoutes(); renderClaims(); renderReports(); renderDrafts(); }
  function init() {
    SHARED = readShared();
    renderAll(); bindNeeds(); bindActions(); bindTierActions();
    if (SHARED) { const h = $('#shared-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }
    document.addEventListener('kp:needs', () => { renderNeeds(); renderSaved(); });
    document.addEventListener('kp:tier', () => { renderTier(); renderNeeds(); renderSaved(); renderCollections(); renderWatch(); renderPartner(); renderShared(); });
    document.addEventListener('kp:saved', () => { SAVED_ITEMS = null; renderSaved(); renderCollections(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
