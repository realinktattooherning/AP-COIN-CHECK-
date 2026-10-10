(() => {
  const gate = document.getElementById('risk-gate');
  const change = document.getElementById('risk-change');
  const key = 'dkrugscan-profile-3.2';
  let previousFocus;
  function showGate() {
    previousFocus = document.activeElement;
    gate.showModal();
    document.body.classList.add('risk-choosing');
    document.getElementById('risk-title').focus({preventScroll:true});
    gate.scrollTop = 0;
  }
  function apply(level) {
    DKRisk.select(level);
    const profile = DKRisk.profiles[level];
    document.documentElement.dataset.risk = level;
    document.getElementById('risk-current').textContent = profile.short;
    document.getElementById('risk-note').textContent = profile.note;
    document.querySelectorAll('[data-profile-card]').forEach(el => el.classList.toggle('is-selected', el.dataset.profileCard === String(level)));
    document.querySelectorAll('[data-risk-rule]').forEach(el => {
      const relaxed = Number(level) === 1;
      el.textContent = relaxed ? 'advisory in level 1' : 'hard no';
      el.classList.toggle('advisory-tag', relaxed);
    });
    const choice = document.getElementById('hero-profile');
    if (choice) choice.textContent = profile.mode;
    const input = document.getElementById('go');
    if (input) input.textContent = Number(level) === 3 ? 'Paper scan' : 'Scan coin';
    document.querySelectorAll('[data-candidate-example]').forEach(el => {
      const label = Number(level) === 3 ? 'Paper only' : 'Research candidate';
      el.querySelector('.plate-label').textContent = label;
      el.setAttribute('aria-label', 'Example score: ' + label);
      el.classList.toggle('plate-go', Number(level) !== 3);
      el.classList.toggle('plate-na', Number(level) === 3);
    });
    const scale = document.getElementById('profile-scale-note');
    if (scale) scale.textContent = Number(level) === 3 ? 'Learning only: scores describe the checks. No score is a buy candidate in this profile.' : Number(level) === 1 ? 'Level 1: market cap and socials do not change the profile score. Original results stay visible as advisory. Missing security data still caps the score at 3.' : 'If a required check cannot run, the report says INCOMPLETE and the score is capped at 3. A blank never counts as a pass.';
    try { sessionStorage.setItem(key, String(level)); } catch {}
    if (gate.open) gate.close();
    document.body.classList.remove('risk-choosing');
    window.dispatchEvent(new Event('risk-profile-change'));
  }
  gate.querySelectorAll('[data-choose-risk]').forEach(button => button.addEventListener('click', () => {
    apply(button.dataset.chooseRisk);
    (previousFocus && previousFocus !== document.body ? previousFocus : change).focus();
  }));
  gate.addEventListener('cancel', event => {
    if (!DKRisk.chosen()) event.preventDefault();
    else document.body.classList.remove('risk-choosing');
  });
  change.addEventListener('click', showGate);
  window.addEventListener('risk-selection-required', showGate);
  let saved;
  try { saved = sessionStorage.getItem(key); } catch {}
  if (saved && Object.hasOwn(DKRisk.profiles, saved)) apply(saved);
  else showGate();
})();
