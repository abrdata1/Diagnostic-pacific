// patient-state.js
(function () {
  const STORAGE_KEY = 'diagnostic-pacifique-patient';
  const countryNames = Object.keys(SST_DATA.countries);
  const DEFAULT_PATIENT = countryNames.includes('Papouasie-Nouvelle-Guinée')
    ? 'Papouasie-Nouvelle-Guinée' : countryNames[0];

  let currentPatient = localStorage.getItem(STORAGE_KEY);
  if (!currentPatient || !countryNames.includes(currentPatient)) {
    currentPatient = DEFAULT_PATIENT;
  }

  function getCurrentPatient() { return currentPatient; }

  function setCurrentPatient(name) {
    if (!countryNames.includes(name) || name === currentPatient) return;
    currentPatient = name;
    localStorage.setItem(STORAGE_KEY, name);
    syncControls();
    document.dispatchEvent(new CustomEvent('patientchange', { detail: { name } }));
  }

  function populateSelect(selectEl) {
    selectEl.innerHTML = '';
    countryNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
    selectEl.value = currentPatient;
  }

  function syncControls() {
    document.querySelectorAll('.patient-select').forEach(el => { el.value = currentPatient; });
    document.querySelectorAll('.patient-bar-name').forEach(el => { el.textContent = currentPatient; });
    document.querySelectorAll('.patient-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.patient === currentPatient);
    });
  }

  document.querySelectorAll('.patient-select').forEach(populateSelect);
  syncControls();
  document.querySelectorAll('.patient-select').forEach(el => {
    el.addEventListener('change', (e) => setCurrentPatient(e.target.value));
  });
  document.querySelectorAll('.patient-chip').forEach(btn => {
    btn.addEventListener('click', () => setCurrentPatient(btn.dataset.patient));
  });
  const startBtn = document.getElementById('patient-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      document.getElementById('act-01').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  window.getCurrentPatient = getCurrentPatient;
  window.setCurrentPatient = setCurrentPatient;
})();