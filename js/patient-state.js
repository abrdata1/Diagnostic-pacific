// patient-state.js
// État partagé du "patient" (pays) actuellement examiné, utilisé par tous
// les actes. Gère le sélecteur dans la barre patient, et la mémorisation
// du choix d'une visite à l'autre.
//
// Tout élément marqué de la classe "patient-select" reste synchronisé
// automatiquement. Les autres scripts (act-0X) lisent le patient courant
// via getCurrentPatient() et écoutent l'événement "patientchange" pour se
// re-rendre quand il change.
//
// Chargé après data/sst-data.js, avant js/utils.js et js/act-0X-*.js.

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
  }

  document.querySelectorAll('.patient-select').forEach(populateSelect);
  syncControls();
  document.querySelectorAll('.patient-select').forEach(el => {
    el.addEventListener('change', (e) => setCurrentPatient(e.target.value));
  });

  window.getCurrentPatient = getCurrentPatient;
  window.setCurrentPatient = setCurrentPatient;
})();
