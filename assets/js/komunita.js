/* Stránka Komunita: formulář zájmu – ukládá se jen v prohlížeči, nikam se neodesílá */
(function () {
  'use strict';
  const K = window.KP;
  function init() {
    const form = document.getElementById('interest'), msg = document.getElementById('k-msg');
    const prev = K.store.get('interest', null);
    if (prev) msg.textContent = 'Zájem máte uložený od ' + K.fmtDate(prev.date) + '. Můžete ho upravit a uložit znovu.';
    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = form.querySelector('#k-email');
      if (!email.value.trim() || !email.checkValidity()) { msg.textContent = 'Zadejte prosím platný e-mail, třeba jmeno@example.cz.'; email.focus(); return; }
      if (!form.querySelector('#k-ok').checked) { msg.textContent = 'Zaškrtněte souhlas s uložením v prohlížeči.'; return; }
      K.store.set('interest', {
        name: form.querySelector('#k-name').value.trim(), email: email.value.trim(), role: form.querySelector('#k-role').value,
        interests: [...form.querySelectorAll('[name="k-int"]:checked')].map(c => c.value), date: new Date().toISOString().slice(0, 10),
      });
      msg.textContent = 'Uloženo v tomto prohlížeči. Nic jsme neodeslali. Až spustíme seznam zájemců, oznámíme to na této stránce.';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
