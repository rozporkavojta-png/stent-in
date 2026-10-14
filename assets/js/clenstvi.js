/* Členství Free / Explorer / Traveller (clenstvi.html; klíče free / plus / premium v KP.TIERS). PROTOTYP: tlačítka jen
   přepnou úroveň v prohlížeči (KP.setTier), nic se neplatí a nesbírají se žádné údaje. Srovnávací tabulka ukazuje
   stav vždy tvarem a textem. */
(function () {
  'use strict';
  const K = window.KP, t = (k, p) => K.t(k, p), $ = (s) => document.querySelector(s);

  // Srovnání „Proč si připlatit?“: [funkce, Free, Explorer, Traveller]
  const ROWS = [
    ['Mapa a informace o místech', 1, 1, 1],
    ['Recenze a komunita', 1, 1, 1],
    ['Uložená místa', 'až 5', 1, 1],
    ['Osobní profil požadavků', 0, 1, 1],
    ['Automatický Accessibility Match', 0, 1, 1],
    ['AI jednodenní výlety', 0, 1, 1],
    ['AI vícedenní dovolené', 0, 0, 1],
    ['Offline itineráře', 0, 0, 1],
    ['Concierge a asistence', 0, 0, 1],
    ['Výhody u partnerů', 0, 0, 1],
  ];
  const yes = () => '<span class="cl-yes">' + K.icon('check') + t('ano') + '</span>';
  const no = () => '<span class="cl-no">' + K.icon('close') + t('ne') + '</span>';
  const cell = (v) => (typeof v === 'string' ? '<span class="cl-yes">' + K.icon('check') + K.esc(t(v)) + '</span>' : v ? yes() : no());

  function renderTable() {
    const tb = $('#cmp-body'); if (!tb) return;
    tb.innerHTML = ROWS.map(r => '<tr><th scope="row">' + K.esc(t(r[0])) + '</th>' + r.slice(1).map(v => '<td>' + cell(v) + '</td>').join('') + '</tr>').join('');
  }

  function renderState() {
    const cur = K.tier();
    const tag = $('#cl-now-tag'); if (tag) tag.innerHTML = K.tierTag(cur);
    document.querySelectorAll('[data-tier-card]').forEach(card => {
      const on = card.dataset.tierCard === cur;
      card.classList.toggle('is-current', on);
      const c = card.querySelector('.cl-cur'); if (c) c.hidden = !on;
      const b = card.querySelector('[data-try-tier]');
      if (b) {
        const lbl = b.querySelector('span');
        if (lbl) lbl.textContent = on ? t('Tuto úroveň teď zkoušíte') : t('Vyzkoušet {tier}', { tier: K.TIERS[b.dataset.tryTier].label });
        b.disabled = on; b.setAttribute('aria-disabled', on);
      }
    });
    document.querySelectorAll('[data-tier-price]').forEach(el => { el.textContent = K.tierPrice(el.dataset.tierPrice); });
  }

  function init() {
    renderTable();
    renderState();
    document.querySelectorAll('[data-try-tier]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.tryTier;
      K.setTier(k);
      K.toast(t('Zkoušíte úroveň {tier}. Prototyp, nic se neplatí.', { tier: K.TIERS[k].label }));
    }));
    document.addEventListener('kp:tier', renderState);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
