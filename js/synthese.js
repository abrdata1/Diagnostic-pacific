// synthese.js
// Épilogue : synthèse des quatre examens diagnostiques (fièvre, œdème,
// lésions, organes vitaux) et de l'examen de traitement, pour le patient
// actuellement examiné.
//
// Recalcule chaque statut de façon indépendante, avec exactement la même
// méthode que dans l'acte correspondant. Les seuils ne sont pas exposés
// globalement par les actes (isolés dans leur propre IIFE) : plutôt que de
// coupler ce script à leur implémentation interne, on refait le calcul ici
// à partir des mêmes données et des mêmes fonctions partagées (utils.js).
// Pour l'acte 05 (traitement), le statut est déjà précalculé dans
// data/protection-data.js et simplement relu ici.
//
// Dépend de : d3 (CDN), data/sst-data.js, data/sea-level-data.js,
// data/exposure-lecz-data.js, data/coastline-data.js, data/red-list-data.js,
// data/protection-data.js, js/patient-state.js (getCurrentPatient),
// js/utils.js (computeStats, linearRegression, getStatusKey, STATUS_COLORS).

(function () {
  const FIEVRE_LABELS = { normal: 'normal', febrile: 'fébrile', critique: 'critique' };
  const OEDEME_LABELS = { normal: 'modéré', febrile: 'aggravé', critique: 'sévère' };
  const LESIONS_LABELS = { normal: 'modéré', febrile: 'aggravé', critique: 'sévère' };
  const ORGANES_LABELS = { normal: 'stable', febrile: 'affaibli', critique: 'critique' };
  const TRAITEMENT_LABELS = { normal: 'protégé', febrile: 'partiel', critique: 'non protégé' };

  // Acte 01 : écart à la propre moyenne du pays (1990-2020), dernière année disponible
  function computeFievreStatus(name) {
    const years = SST_DATA.years;
    const values = SST_DATA.countries[name];
    const v = values[years.length - 1];
    const { mean, sd } = computeStats(values, years, 1990, 2020);
    return getStatusKey(v, mean + sd, mean + 2 * sd);
  }

  // Acte 02 : score de risque (taux de montée × exposition de la
  // population sous 10m), comparé à la distribution des 21 pays du
  // Pacifique - même méthode que dans act-02-oedeme.js.
  function computeOedemeStatus(name) {
    const years = SEA_LEVEL_DATA.years;
    const countryNames = Object.keys(SEA_LEVEL_DATA.countries);
    const riskScores = countryNames.map(n => {
      const { slope } = linearRegression(years, SEA_LEVEL_DATA.countries[n]);
      const exposurePct = EXPOSURE_LECZ_DATA[n] != null ? EXPOSURE_LECZ_DATA[n] : 0;
      return (exposurePct / 100) * slope;
    });
    const mean = d3.mean(riskScores);
    const sd = d3.deviation(riskScores);

    const { slope } = linearRegression(years, SEA_LEVEL_DATA.countries[name]);
    const exposurePct = EXPOSURE_LECZ_DATA[name] != null ? EXPOSURE_LECZ_DATA[name] : 0;
    const risk = (exposurePct / 100) * slope;
    return getStatusKey(risk, mean + sd, mean + 2 * sd);
  }

  // Acte 03 : taux médian d'évolution du trait de côte comparé à la
  // distribution des 21 pays. Taux BAS (recul) est grave, seuils inversés.
  function computeLesionsStatus(name) {
    const allRates = Object.keys(COASTLINE_DATA).map(n => COASTLINE_DATA[n].rateMedianMYear);
    const mean = d3.mean(allRates);
    const sd = d3.deviation(allRates);
    const rate = COASTLINE_DATA[name].rateMedianMYear;
    return getStatusKey(-rate, -(mean - sd), -(mean - 2 * sd));
  }

  // Acte 04 : niveau actuel comparé à la distribution des 21 pays en 2024.
  // Seuils inversés : un niveau BAS est grave pour cet indice, pas un niveau haut.
  function computeOrganesStatus(name) {
    const years = RED_LIST_DATA.years;
    const lastIdx = years.length - 1;
    const countryNames = Object.keys(RED_LIST_DATA.countries);
    const currentValues = countryNames.map(n => RED_LIST_DATA.countries[n][lastIdx]);
    const mean = d3.mean(currentValues);
    const sd = d3.deviation(currentValues);
    const current = RED_LIST_DATA.countries[name][lastIdx];
    return getStatusKey(-current, -(mean - sd), -(mean - 2 * sd));
  }

  function applyBadge(id, statusKey, labels) {
    const el = document.getElementById(id);
    if (!el) return;
    const colors = STATUS_COLORS[statusKey];
    el.textContent = labels[statusKey];
    el.style.background = colors.bg;
    el.style.color = colors.fill;
  }

  function render() {
    const name = getCurrentPatient();
    const nameEl = document.getElementById('epilogue-patient-name');
    if (nameEl) nameEl.textContent = name;

    const fievreKey = computeFievreStatus(name);
    const oedemeKey = computeOedemeStatus(name);
    const lesionsKey = computeLesionsStatus(name);
    const organesKey = computeOrganesStatus(name);
    const traitementKey = PROTECTION_DATA[name] ? PROTECTION_DATA[name].status : 'normal';

    applyBadge('epilogue-badge-fievre', fievreKey, FIEVRE_LABELS);
    applyBadge('epilogue-badge-oedeme', oedemeKey, OEDEME_LABELS);
    applyBadge('epilogue-badge-lesions', lesionsKey, LESIONS_LABELS);
    applyBadge('epilogue-badge-organes', organesKey, ORGANES_LABELS);
    applyBadge('epilogue-badge-traitement', traitementKey, TRAITEMENT_LABELS);

    const symptomKeys = [fievreKey, oedemeKey, lesionsKey, organesKey];
    const abnormalCount = symptomKeys.filter(k => k !== 'normal').length;

    const summaryEl = document.getElementById('epilogue-summary-line');
    if (summaryEl) {
      let phrase;
      if (abnormalCount === 0) {
        phrase = `Sur les 4 examens diagnostiques, aucun ne ressort anormal pour ${name} — un cas rare dans le Pacifique.`;
      } else if (abnormalCount === symptomKeys.length) {
        phrase = `Les 4 examens diagnostiques ressortent tous anormaux pour ${name} : un tableau clinique complet.`;
      } else if (abnormalCount === 1) {
        phrase = `1 examen sur 4 ressort anormal pour ${name}.`;
      } else {
        phrase = `${abnormalCount} examens sur 4 ressortent anormaux pour ${name}.`;
      }
      summaryEl.textContent = phrase;
    }

    const treatmentEl = document.getElementById('epilogue-treatment-line');
    if (treatmentEl) {
      const treatmentPhrase = {
        normal: `Le pays dispose d'une protection déjà en place face à ces risques.`,
        febrile: `Le pays ne dispose que d'une protection partielle face à ces risques.`,
        critique: `Le pays ne dispose d'aucune protection significative face à ces risques.`
      }[traitementKey];
      treatmentEl.textContent = treatmentPhrase;
    }
  }

  document.addEventListener('patientchange', render);
  render();
})();