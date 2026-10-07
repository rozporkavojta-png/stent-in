/* Stránka Komunita: přehled funkcí prototypu, kolekce míst (sdílení odkazem v URL), náhled budoucího profilu,
   smazání komunitních dat, žádosti o informace a formulář zájmu. Vše jen v localStorage, nic se neodesílá.
   Čísla na stránce jsou jen záznamy uživatele z tohoto prohlížeče. */
(function () {
  'use strict';
  const K = window.KP, C = K.community, $ = (s, r) => (r || document).querySelector(s);
  const t = (k, p) => K.t(k, p);
  const plural = (n, one, few, many) => n + ' ' + K.plural(n, one, few, many);
  const esc = K.esc;

  // Dvojí klik pro mazání: první klik se zeptá, druhý provede
  function confirmClick(btn, ask, run) {
    if (btn.dataset.confirm) { run(); return; }
    btn.dataset.confirm = '1'; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = ask;
    setTimeout(() => { if (btn.isConnected && btn.dataset.confirm) { delete btn.dataset.confirm; btn.textContent = btn.dataset.label; } }, 5000);
  }

  // ---------- Místa: načtení podle id (cache) ----------
  const PLACES = new Map();
  function regionOf(id) { const p = PLACES.get(id); return (p && p._r) || K.store.get('placeRegion', {})[id] || ''; }
  async function loadPlaces(pairs) {
    const todo = pairs.filter(([i]) => !PLACES.has(i));
    for (const [i, r] of todo) {
      let p = null;
      try { p = await K.findPlace(i, r || undefined); } catch (e) { p = null; }
      PLACES.set(i, p);
    }
  }
  function placeRow(id, extra) {
    const p = PLACES.get(id);
    if (!p) return '<li class="rule-row ko-place"><div class="ko-place-t"><b>' + t('Místo už v aktuálních datech není') + '</b><small class="num">' + esc(id) + '</small></div>' + (extra || '') + '</li>';
    const w = K.W[p.w || 'null'] || K.W['null'];
    const st = p.c !== 'parkovani' && w ? K.statusHtml(w.st, w.short) : '';
    let fit = '';
    const needs = K.getNeeds();
    if (needs.active) {
      const m = K.matchScore(p, needs);
      fit = K.statusHtml(m.status, m.pct === null ? t('Chybí údaje k vašim potřebám') : t('{pct} % shoda s vašimi potřebami', { pct: m.pct })) +
        (m.total ? '<small>' + t('Známe {k} z {n} údajů, které potřebujete', { k: m.known, n: m.total }) + '</small>' : '');
    }
    const meta = [(K.CATS[p.c] || {}).label, p.o, K.zemeOf(p) === 'de' ? K.ZEME.de : ''].filter(Boolean).join(' · ');
    return '<li class="rule-row ko-place"><div class="ko-place-t"><a href="' + K.placeUrl(p) + '"><b>' + esc(p.n) + '</b></a>' +
      (meta ? '<small>' + esc(meta) + '</small>' : '') + '<span class="ko-place-st">' + st + fit + '</span></div>' + (extra || '') + '</li>';
  }

  // ---------- Sdílení kolekce odkazem (vše v URL, bez serveru) ----------
  function shareUrl(c) {
    try {
      const o = { n: c.name, p: c.ids.slice(0, 100).map(i => [i, regionOf(i)]) };
      return location.origin + location.pathname + '#kolekce=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
    } catch (e) { return ''; }
  }
  function parseShare(hash) {
    try {
      const m = String(hash || '').match(/kolekce=([^&]+)/); if (!m) return null;
      const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      const pairs = (Array.isArray(o.p) ? o.p : []).filter(x => Array.isArray(x) && typeof x[0] === 'string' && /^[\w.:-]{1,80}$/.test(x[0])).slice(0, 100)
        .map(x => [x[0], typeof x[1] === 'string' ? x[1].slice(0, 80) : '']);
      return { name: String(o.n || t('Sdílená kolekce')).slice(0, 80), pairs };
    } catch (e) { return null; }
  }

  // ---------- Moje kolekce ----------
  const OPEN = new Set();
  async function renderCollections(focusSel) {
    const box = $('#coll-list'), list = C.collections(), saved = K.saved.all();
    if (!list.length) {
      box.innerHTML = '<div class="ko-empty"><p class="muted">' + t('Zatím nemáte žádnou kolekci. Vytvořte ji nahoře a přidejte do ní uložená místa.') + '</p>' +
        (saved.length ? '' : '<p class="muted small">' + t('Místa si nejdřív uložte tlačítkem Uložit v detailu místa.') + '</p><a class="btn btn-ghost" href="mapa.html">' + t('Otevřít mapu') + '</a>') + '</div>';
      renderMock(); return;
    }
    const ids = [...new Set(list.flatMap(c => c.ids).concat(saved))];
    if (ids.some(i => !PLACES.has(i))) {
      if (!box.innerHTML) box.innerHTML = '<p class="muted">' + t('Načítám místa…') + '</p>';
      await loadPlaces(ids.map(i => [i, regionOf(i)]));
    }
    box.innerHTML = list.slice().reverse().map(c => {
      const open = OPEN.has(c.id) || list.length === 1;
      const avail = saved.filter(i => !c.ids.includes(i));
      const opts = avail.map(i => '<option value="' + esc(i) + '">' + esc((PLACES.get(i) || {}).n || i) + '</option>').join('');
      const add = !saved.length
        ? '<p class="small muted">' + t('Do kolekce přidáváte uložená místa. Zatím nemáte žádné.') + ' <a href="mapa.html">' + t('Najít místo na mapě') + '</a></p>'
        : !avail.length ? '<p class="small muted">' + t('Všechna uložená místa už v kolekci jsou.') + '</p>'
          : '<form class="ko-add" data-add="' + esc(c.id) + '"><div class="field"><label for="add-' + esc(c.id) + '">' + t('Přidat uložené místo') + '</label><select id="add-' + esc(c.id) + '">' + opts + '</select></div><button class="btn btn-ghost" type="submit">' + t('Přidat') + '</button></form>';
      const rows = c.ids.length ? '<ul class="rule-list ko-places">' + c.ids.map(i => placeRow(i, '<button class="btn btn-quiet btn-sm" type="button" data-rm="' + esc(i) + '" data-coll="' + esc(c.id) + '" aria-label="' + esc(t('Odebrat z kolekce {name}: {place}', { name: c.name, place: (PLACES.get(i) || {}).n || i })) + '">' + t('Odebrat') + '</button>')).join('') + '</ul>'
        : '<p class="muted small">' + t('Kolekce je prázdná.') + '</p>';
      return '<details class="ko-coll" data-id="' + esc(c.id) + '"' + (open ? ' open' : '') + '><summary><span class="ko-coll-n">' + esc(c.name) + '</span><small>' + plural(c.ids.length, 'místo', 'místa', 'míst') + ' · ' + t('založeno {date}', { date: K.fmtDate(c.date) }) + '</small></summary>' +
        '<div class="ko-coll-b">' + rows + add +
        '<div class="row ko-coll-acts"><button class="btn btn-primary btn-sm" type="button" data-share="' + esc(c.id) + '"' + (c.ids.length ? '' : ' disabled') + '>' + t('Sdílet odkazem') + '</button>' +
        '<button class="btn btn-quiet btn-sm" type="button" data-del="' + esc(c.id) + '">' + t('Smazat kolekci') + '</button></div>' +
        '<div class="ko-share" hidden><label for="sh-' + esc(c.id) + '">' + t('Odkaz na kolekci') + '</label><input id="sh-' + esc(c.id) + '" type="url" readonly><p class="small muted">' + t('Odkaz obsahuje názvy a čísla míst, nic dalšího. Kdo ho otevře, kolekci uvidí a může si ji uložit.') + '</p></div>' +
        '</div></details>';
    }).join('');
    box.querySelectorAll('details.ko-coll').forEach(d => d.addEventListener('toggle', () => { if (d.open) OPEN.add(d.dataset.id); else OPEN.delete(d.dataset.id); }));
    if (focusSel) { const f = $(focusSel, box); if (f) f.focus(); }
    renderMock(); renderCounts();
  }
  function bindCollections() {
    const form = $('#coll-form'), msg = $('#coll-msg');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#coll-name').value.trim();
      if (!name) { msg.textContent = t('Napište název kolekce.'); $('#coll-name').focus(); return; }
      const c = C.saveCollection({ name: name.slice(0, 80), ids: [] });
      if (!c) { msg.textContent = t('Kolekci se nepodařilo uložit. Úložiště prohlížeče je plné nebo vypnuté.'); return; }
      OPEN.add(c.id); $('#coll-name').value = '';
      msg.textContent = t('Kolekce „{name}“ vytvořena.', { name: c.name }) + ' ' + K.PROTOTYPE_NOTE;
      renderCollections('[data-id="' + c.id + '"] summary');
    });
    const box = $('#coll-list');
    box.addEventListener('submit', e => {
      const f = e.target.closest('[data-add]'); if (!f) return;
      e.preventDefault();
      const id = f.dataset.add, sel = $('select', f);
      if (!sel.value) return;
      if (!C.addToCollection(id, sel.value)) { msg.textContent = t('Místo se nepodařilo přidat. Úložiště prohlížeče je plné nebo vypnuté.'); return; }
      OPEN.add(id); msg.textContent = t('Místo přidáno do kolekce.');
      renderCollections('#add-' + id);
    });
    box.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]'), del = e.target.closest('[data-del]'), sh = e.target.closest('[data-share]');
      if (rm) { C.removeFromCollection(rm.dataset.coll, rm.dataset.rm); OPEN.add(rm.dataset.coll); msg.textContent = t('Místo odebráno z kolekce.'); renderCollections('[data-id="' + rm.dataset.coll + '"] summary'); }
      else if (del) confirmClick(del, t('Opravdu smazat? Klikněte znovu'), () => { C.deleteCollection(del.dataset.del); OPEN.delete(del.dataset.del); msg.textContent = t('Kolekce smazána.'); renderCollections(); $('#coll-name').focus(); });
      else if (sh) {
        const c = C.collections().find(x => x.id === sh.dataset.share); if (!c) return;
        const url = shareUrl(c), wrap = sh.closest('.ko-coll-b').querySelector('.ko-share'), inp = $('input', wrap);
        wrap.hidden = false; inp.value = url; inp.select();
        if (navigator.share) { navigator.share({ title: c.name, url }).catch(() => {}); return; }
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => K.toast(t('Odkaz zkopírován.'))).catch(() => K.toast(t('Odkaz zkopírujte z políčka pod kolekcí.')));
      }
    });
  }

  // Sdílená kolekce z odkazu
  async function renderShared() {
    const sec = $('#sdilena'), box = $('#shared-coll'), s = parseShare(location.hash);
    if (!s) { sec.hidden = true; return; }
    sec.hidden = false;
    if (!s.pairs.length) { box.innerHTML = '<p class="muted">' + t('Odkaz neobsahuje žádná místa.') + '</p>'; return; }
    box.innerHTML = '<p class="muted">' + t('Načítám místa…') + '</p>';
    await loadPlaces(s.pairs);
    const found = s.pairs.filter(([i]) => PLACES.get(i));
    box.innerHTML = '<h3 class="ko-shared-n">' + esc(s.name) + '</h3><p class="small muted">' + plural(s.pairs.length, 'místo', 'místa', 'míst') + '</p>' +
      '<ul class="rule-list ko-places">' + s.pairs.map(([i]) => placeRow(i)).join('') + '</ul>' +
      '<div class="row ko-coll-acts"><button class="btn btn-primary" type="button" id="shared-save"' + (found.length ? '' : ' disabled') + '>' + t('Uložit kolekci k sobě') + '</button><span class="small muted" id="shared-msg" role="status" aria-live="polite"></span></div>';
    $('#shared-save').addEventListener('click', () => {
      found.forEach(([i]) => K.rememberRegion(PLACES.get(i)));
      const c = C.saveCollection({ name: s.name, ids: found.map(([i]) => i) });
      $('#shared-msg').textContent = c ? t('Uloženo do Mých kolekcí.') + ' ' + K.PROTOTYPE_NOTE : t('Nepodařilo se uložit. Úložiště prohlížeče je plné nebo vypnuté.');
      if (c) { $('#shared-save').disabled = true; OPEN.add(c.id); renderCollections(); }
    });
    sec.scrollIntoView({ block: 'start' });
  }

  // ---------- Co už funguje: vlastní počty ----------
  function renderCounts() {
    const reviews = C.myReviews();
    const n = {
      reviews: [reviews.length, 'ko.rev1', 'ko.rev2', 'ko.rev5'],
      photos: [reviews.reduce((s, r) => s + (r.photos || []).length, 0), 'fotka', 'fotky', 'fotek'],
      confirm: [C.myConfirmations().length, 'ko.conf1', 'ko.conf2', 'ko.conf5'],
      reports: [C.mine('reports').length, 'ko.rep1', 'ko.rep2', 'ko.rep5'],
      routes: [C.routes().length, 'trasa', 'trasy', 'tras'],
      itineraries: [C.itineraries().length, 'itinerář', 'itineráře', 'itinerářů'],
      collections: [C.collections().length, 'ko.coll1', 'ko.coll2', 'ko.coll5'],
    };
    document.querySelectorAll('[data-count]').forEach(el => {
      const x = n[el.dataset.count]; if (!x) return;
      el.innerHTML = x[0] ? '<small>' + t('Vaše') + '</small><b class="num">' + x[0] + '</b><small>' + esc(K.plural(x[0], x[1], x[2], x[3])) + '</small>' : '<small>' + t('Zatím nic') + '</small>';
    });
  }

  // ---------- Náhled budoucího profilu ----------
  function renderMock() {
    const me = C.me(), routes = C.routes(), colls = C.collections(), revs = C.myReviews();
    $('#mock-nick').textContent = me.nick || t('Vaše přezdívka');
    if (routes.length) $('#mock-routes').textContent = t('Vaše trasy:') + ' ' + routes.slice(0, 3).map(r => r.name || t('Trasa')).join(', ') + (routes.length > 3 ? ' ' + t('a další') : '');
    if (colls.length) $('#mock-colls').textContent = t('Vaše kolekce:') + ' ' + colls.slice(0, 3).map(c => c.name).join(', ') + (colls.length > 3 ? ' ' + t('a další') : '');
    if (revs.length) $('#mock-revs').textContent = t('Vaše hodnocení:') + ' ' + plural(new Set(revs.map(r => r.placeId)).size, 'místo', 'místa', 'míst');
  }
  function bindNick() {
    const inp = $('#nick'); inp.value = C.me().nick;
    $('#nick-form').addEventListener('submit', e => {
      e.preventDefault();
      if (C.setMe({ nick: inp.value.trim() })) { renderMock(); K.toast(inp.value.trim() ? t('Přezdívka uložena jen v tomto prohlížeči.') : t('Přezdívka smazána.')); }
      else K.toast(t('Nepodařilo se uložit. Úložiště prohlížeče je vypnuté.'));
    });
  }

  // ---------- Žádosti o informace ----------
  function renderRequests() {
    const list = C.mine('requests');
    $('#ko-requests').innerHTML = list.length
      ? '<p class="small muted">' + t('Vaše žádosti z tohoto prohlížeče:') + '</p><ul class="ko-req">' + list.map(r => '<li><a href="' + K.placeUrl({ i: r.placeId, _r: (r.place && r.place.r) || '' }) + '">' + esc((r.place && r.place.n) || t('Místo {id}', { id: r.placeId })) + '</a> <small>' + K.fmtDate(r.date) + '</small></li>').join('') + '</ul>'
      : '<p class="small muted">' + t('Zatím jste o nic nepožádali.') + '</p>';
  }

  // ---------- Smazání komunitních dat (GDPR) ----------
  const WIPE_KEYS = ['reviews', 'exp', 'confirm', 'reports', 'requests', 'routes', 'itineraries', 'collections', 'me', 'interest'];
  function bindWipe() {
    const btn = $('#wipe');
    btn.addEventListener('click', () => confirmClick(btn, t('Opravdu smazat vše? Klikněte znovu'), () => {
      let ok = true;
      WIPE_KEYS.forEach(k => { try { localStorage.removeItem('kp.' + k); } catch (e) { ok = false; } });
      delete btn.dataset.confirm; btn.textContent = btn.dataset.label;
      $('#wipe-msg').textContent = ok ? t('Smazáno. V tomto prohlížeči teď nejsou žádná vaše hodnocení, trasy ani kolekce.') : t('Úložiště prohlížeče není dostupné, nebylo co smazat.');
      OPEN.clear(); $('#nick').value = '';
      renderCounts(); renderCollections(); renderMock(); renderRequests();
      $('#mock-routes').textContent = t('Sdílené trasy se zobrazí tady.'); $('#mock-colls').textContent = t('Veřejné kolekce míst se zobrazí tady.'); $('#mock-revs').textContent = t('Hodnocení míst se zobrazí tady.');
    }));
  }

  // ---------- Formulář zájmu ----------
  function bindInterest() {
    const form = $('#interest'), msg = $('#k-msg');
    const prev = K.store.get('interest', null);
    if (prev) msg.textContent = t('Zájem máte uložený od {date}. Můžete ho upravit a uložit znovu.', { date: K.fmtDate(prev.date) });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = $('#k-email', form);
      if (!email.value.trim() || !email.checkValidity()) { msg.textContent = t('Zadejte prosím platný e-mail, třeba jmeno@example.cz.'); email.focus(); return; }
      if (!$('#k-ok', form).checked) { msg.textContent = t('Zaškrtněte souhlas s uložením v prohlížeči.'); return; }
      const ok = K.store.set('interest', {
        name: $('#k-name', form).value.trim(), email: email.value.trim(), role: $('#k-role', form).value,
        interests: [...form.querySelectorAll('[name="k-int"]:checked')].map(c => c.value), date: new Date().toISOString().slice(0, 10),
      });
      msg.textContent = ok ? t('Uloženo v tomto prohlížeči. Nic jsme neodeslali. Až spustíme seznam zájemců, oznámíme to na této stránce.') : t('Nepodařilo se uložit. Úložiště prohlížeče je plné nebo vypnuté.');
    });
  }

  function init() {
    $('#ko-note').textContent = K.PROTOTYPE_NOTE;
    renderCounts(); renderMock(); renderRequests();
    bindCollections(); bindNick(); bindWipe(); bindInterest();
    renderCollections();
    renderShared();
    addEventListener('hashchange', () => { if (/kolekce=/.test(location.hash)) renderShared(); });
    document.addEventListener('kp:needs', () => renderCollections());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
