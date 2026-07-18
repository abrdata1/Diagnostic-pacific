// utils.js
// Constantes et fonctions partagées entre les actes du "Diagnostic Pacifique".
// Chargé après D3 et avant les fichiers js/act-0X-*.js.

const STATUS_COLORS = {
  normal: { fill: '#0F6E56', bg: '#E1F5EE' },
  febrile: { fill: '#BA7517', bg: '#FAEEDA' },
  critique: { fill: '#A32D2D', bg: '#FCEBEB' }
};

const STATUS_LABELS = { normal: 'normal', febrile: 'fébrile', critique: 'critique' };

/**
 * Calcule la moyenne et l'écart-type d'une série sur une période de référence.
 * Sert de base à la méthode des seuils fébrile (+1σ) / critique (+2σ),
 * inspirée des vagues de chaleur marines (Hobday et al.), adaptée à des
 * données annuelles.
 *
 * @param {Array<number|null>} values - valeurs alignées sur le tableau `years`
 * @param {Array<number>} years - années correspondantes (même longueur que values)
 * @param {number} baselineStart - première année de la période de référence
 * @param {number} baselineEnd - dernière année de la période de référence
 * @returns {{mean: number, sd: number}}
 */
function computeStats(values, years, baselineStart, baselineEnd) {
  const startIdx = years.indexOf(baselineStart);
  const endIdx = years.indexOf(baselineEnd);
  const slice = values.slice(startIdx, endIdx + 1).filter(v => v !== null);
  const mean = d3.mean(slice);
  const sd = Math.sqrt(d3.mean(slice.map(v => (v - mean) ** 2)));
  return { mean, sd };
}

/**
 * Détermine le statut clinique d'une valeur par rapport à ses seuils.
 * @param {number} value
 * @param {number} seuil1 - seuil fébrile (typiquement mean + 1sd)
 * @param {number} seuil2 - seuil critique (typiquement mean + 2sd)
 * @returns {'normal'|'febrile'|'critique'}
 */
function getStatusKey(value, seuil1, seuil2) {
  if (value >= seuil2) return 'critique';
  if (value >= seuil1) return 'febrile';
  return 'normal';
}

/**
 * Régression linéaire simple (moindres carrés ordinaires).
 * Retourne la pente et l'ordonnée à l'origine de y = intercept + slope * x.
 * Utilisée pour les indicateurs qui ne "reviennent" jamais à une normale
 * (tendance monotone, ex: niveau de la mer) plutôt qu'un écart à une
 * moyenne de référence comme pour les anomalies de température.
 * @param {Array<number>} xs
 * @param {Array<number>} ys
 * @returns {{slope: number, intercept: number}}
 */
function linearRegression(xs, ys) {
  const n = xs.length;
  const meanX = d3.mean(xs);
  const meanY = d3.mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return { slope: num / den, intercept: meanY - (num / den) * meanX };
}