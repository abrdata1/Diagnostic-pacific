// act-04-organes.js
// Acte 04 · Organes vitaux - indice de la Liste rouge (SDG 15.5.1).
//
// Contrairement au niveau de la mer (référence mondiale documentée), il
// n'existe pas de seuil international tout fait pour cet indice. On compare
// donc chaque pays à la distribution des 21 pays du Pacifique à l'année la
// plus récente (2024) - même logique statistique que la fièvre (moyenne +
// écart-type), mais appliquée entre pays plutôt que dans le temps, puisque
// l'indice décline en tendance plutôt que d'osciller :
//   - stable   : niveau ≥ moyenne - 1σ
//   - affaibli : niveau < moyenne - 1σ
//   - critique : niveau < moyenne - 2σ
//
// Visuel : un électrocardiogramme dont l'amplitude de chaque battement suit
// la vraie valeur de l'indice cette année-là - le pouls qui s'aplatit à
// mesure que la biodiversité décline.
//
// Dépend de : d3 (CDN), data/red-list-data.js (RED_LIST_DATA),
// js/patient-state.js (getCurrentPatient, setCurrentPatient),
// js/utils.js (getStatusKey, STATUS_COLORS).

(function () {
  const years = RED_LIST_DATA.years;
  const countryNames = Object.keys(RED_LIST_DATA.countries);
  const STATUS_LABELS_ORGANES = { normal: 'stable', febrile: 'affaibli', critique: 'critique' };

  // Moyenne et écart-type inter-pays sur la dernière année disponible
  const lastYearIdx = years.length - 1;
  const currentValues = countryNames.map(n => RED_LIST_DATA.countries[n][lastYearIdx]);
  const crossMean = d3.mean(currentValues);
  const crossSd = d3.deviation(currentValues);
  const SEUIL_AFFAIBLI = crossMean - crossSd;
  const SEUIL_CRITIQUE = crossMean - 2 * crossSd;

  function computeTrend(name) {
    const values = RED_LIST_DATA.countries[name];
    const { slope, intercept } = linearRegression(years, values);
    return { slope, intercept, values, current: values[lastYearIdx] };
  }

  // Le déclin va du "bon" (moyenne+2σ, rare) au pire observé - on encadre un
  // peu plus large pour que même Guam (le cas le plus sévère) reste lisible.
  const SCALE_MIN = Math.max(0, Math.min(...currentValues) - 0.05);
  const SCALE_MAX = Math.min(1, Math.max(...currentValues) + 0.05);
  function pct(v) {
    return Math.max(0, Math.min(1, (v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)));
  }

  // Vital du masthead : indice du patient courant, mis à jour dans render()
  const headerRedList = document.getElementById('header-redlist');

  // --- ECG : l'amplitude de chaque battement suit la valeur réelle de
  // l'indice cette année-là. Reconstruit entièrement à chaque render(),
  // puisque la forme change avec le pays sélectionné. ---
  const ecgSvg = d3.select('#organes-ecg-svg');
  const ECG_W = 600, ECG_H = 140, ECG_PAD = { top: 16, right: 68, bottom: 24, left: 10 };
  const BASELINE_Y = ECG_PAD.top + (ECG_H - ECG_PAD.top - ECG_PAD.bottom) * 0.6;
  const AMPLITUDE_MAX = BASELINE_Y - ECG_PAD.top - 6; // marge pour ne jamais dépasser le haut du cadre
  const N_BEATS = 11; // nombre de battements affichés, pas une par année (32 serait illisible)

  ecgSvg.attr('viewBox', `0 0 ${ECG_W} ${ECG_H}`);

  const seuilAffaibliLine = ecgSvg.append('line')
    .attr('x1', ECG_PAD.left).attr('x2', ECG_W - ECG_PAD.right)
    .attr('stroke', '#BA7517').attr('stroke-width', 1).attr('stroke-dasharray', '4 3');
  const seuilCritiqueLine = ecgSvg.append('line')
    .attr('x1', ECG_PAD.left).attr('x2', ECG_W - ECG_PAD.right)
    .attr('stroke', '#A32D2D').attr('stroke-width', 1).attr('stroke-dasharray', '4 3');

  const seuilAffaibliLabel = ecgSvg.append('text')
    .attr('x', ECG_W - ECG_PAD.right + 6).style('font-size', '9px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text('affaibli');
  const seuilCritiqueLabel = ecgSvg.append('text')
    .attr('x', ECG_W - ECG_PAD.right + 6).style('font-size', '9px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text('critique');

  const ecgPath = ecgSvg.append('path').attr('fill', 'none').attr('stroke-width', 1.5);
  const pulseDot = ecgSvg.append('circle').attr('r', 4);
  const hoverLayer = ecgSvg.append('g');

  ecgSvg.append('text')
    .attr('x', ECG_PAD.left).attr('y', ECG_H - 6)
    .style('font-size', '10px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text(years[0]);
  ecgSvg.append('text')
    .attr('x', ECG_W - ECG_PAD.right).attr('y', ECG_H - 6).attr('text-anchor', 'end')
    .style('font-size', '10px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text(years[years.length - 1]);

  /**
   * Construit le tracé ECG à partir d'un échantillon de N_BEATS années
   * réparties sur toute la période (pas une par année - avec 32 ans, un
   * battement par année produit un mur de dents de scie illisible).
   * Chaque battement garde sa hauteur proportionnelle à la vraie valeur
   * de l'indice cette année-là.
   */
  function sampleIndices() {
    const n = years.length;
    const idxs = [];
    for (let i = 0; i < N_BEATS; i++) {
      idxs.push(Math.round((i * (n - 1)) / (N_BEATS - 1)));
    }
    return idxs;
  }

  function buildEcgPath(values) {
    const idxs = sampleIndices();
    const plotWidth = ECG_W - ECG_PAD.left - ECG_PAD.right;
    const stepX = plotWidth / (idxs.length - 1);
    const dipDepth = AMPLITUDE_MAX * 0.18; // petite redescente sous la ligne de base, façon complexe QRS
    let d = `M${ECG_PAD.left},${BASELINE_Y}`;
    let lastPeakX = ECG_PAD.left, lastPeakY = BASELINE_Y;
    const points = [];

    idxs.forEach((yearIdx, i) => {
      const isLast = i === idxs.length - 1;
      const xCenter = ECG_PAD.left + i * stepX;
      const peakHeight = pct(values[yearIdx]) * AMPLITUDE_MAX;
      const xPeak = xCenter + stepX * 0.4;
      const yPeak = BASELINE_Y - peakHeight;

      d += ` L${xCenter + stepX * 0.15},${BASELINE_Y}`;
      d += ` L${xPeak},${yPeak}`;
      lastPeakX = xPeak;
      lastPeakY = yPeak;
      points.push({ year: years[yearIdx], value: values[yearIdx], x: xPeak, y: yPeak });

      if (!isLast) {
        d += ` L${xCenter + stepX * 0.5},${BASELINE_Y + dipDepth}`;
        d += ` L${xCenter + stepX * 0.65},${BASELINE_Y}`;
        d += ` L${xCenter + stepX},${BASELINE_Y}`;
      } else {
        // Dernier battement : une petite redescente, sans dépasser le cadre
        const xDip = Math.min(xPeak + stepX * 0.15, ECG_W - ECG_PAD.right);
        d += ` L${xDip},${BASELINE_Y + dipDepth * 0.6}`;
      }
    });

    return { d, lastPeakX, lastPeakY, points };
  }

  // --- Vue d'ensemble : même grammaire que les actes 01/02 (ligne graduée,
  // essaim de points), seuils fixes calculés sur la distribution 2024. ---
  const overviewSvg = d3.select('#organes-overview-svg');
  const OV_W = 600, OV_H = 110;
  overviewSvg.attr('viewBox', `0 0 ${OV_W} ${OV_H}`);
  const overviewScale = d3.scaleLinear().domain([SCALE_MIN, SCALE_MAX]).range([550, 50]); // inversé : indice faible = plus grave, à gauche
  const LINE_Y = 55;
  const SWARM_Y_MIN = 28, SWARM_Y_MAX = 82;

  overviewSvg.append('line')
    .attr('x1', overviewScale(SCALE_MIN)).attr('x2', overviewScale(SCALE_MAX))
    .attr('y1', LINE_Y).attr('y2', LINE_Y).attr('stroke', '#B4B2A9');

  [[SEUIL_AFFAIBLI, 'affaibli'], [SEUIL_CRITIQUE, 'critique']].forEach(([val, label]) => {
    const x = overviewScale(val);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 30).attr('y2', LINE_Y + 30)
      .attr('stroke', '#B4B2A9').attr('stroke-dasharray', '2 2');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y - 34).attr('text-anchor', 'middle')
      .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#8D9A96')
      .text(label);
  });

  const overviewTicks = d3.range(Math.ceil(SCALE_MIN * 10) / 10, SCALE_MAX + 0.01, 0.1);
  overviewTicks.forEach(v => {
    const x = overviewScale(v);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 7).attr('y2', LINE_Y + 7)
      .attr('stroke', '#8D9A96');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y + 37).attr('text-anchor', 'middle')
      .style('font-size', '10px').style('font-family', 'monospace').style('fill', '#5B6C68')
      .text(v.toFixed(1));
  });

  const pointsLayer = overviewSvg.append('g');
  const selectedLabelGroup = overviewSvg.append('g').style('pointer-events', 'none');
  const selectedLabelBg = selectedLabelGroup.append('rect')
    .attr('rx', 4).attr('ry', 4).attr('fill', '#FFFFFF').attr('stroke', '#DCE3E1').attr('stroke-width', 1);
  const selectedLabel = selectedLabelGroup.append('text')
    .attr('text-anchor', 'middle')
    .style('font-size', '11px').style('font-family', 'monospace').style('font-weight', '600').style('fill', '#1E2E2B');

  function computeBeeswarm(points) {
    const simulation = d3.forceSimulation(points)
      .force('x', d3.forceX(d => overviewScale(d.current)).strength(1))
      .force('y', d3.forceY(LINE_Y).strength(0.4))
      .force('collision', d3.forceCollide(6.5))
      .stop();
    for (let i = 0; i < 150; i++) simulation.tick();
    points.forEach(d => {
      d.x = Math.max(50, Math.min(550, d.x));
      d.y = Math.max(SWARM_Y_MIN, Math.min(SWARM_Y_MAX, d.y));
    });
    return points;
  }

  function renderOverview() {
    const rows = countryNames.map(name => {
      const { current } = computeTrend(name);
      return { name, current, statusKey: getStatusKey(-current, -SEUIL_AFFAIBLI, -SEUIL_CRITIQUE) };
    });

    const nFaible = rows.filter(d => d.statusKey !== 'normal').length;
    document.getElementById('organes-overview-sub').textContent =
      `${nFaible} pays sur ${rows.length} en dessous du seuil affaibli. Survolez ou cliquez un point.`;

    const data = computeBeeswarm(rows.map(d => ({ ...d, x: overviewScale(d.current), y: LINE_Y })));
    const circles = pointsLayer.selectAll('circle').data(data, d => d.name);

    const circlesEnter = circles.enter().append('circle')
      .attr('r', 5).style('cursor', 'pointer')
      .on('click', (event, d) => { setCurrentPatient(d.name); });
    circlesEnter.append('title');

    const circlesMerged = circlesEnter.merge(circles);
    circlesMerged.select('title').text(d => `${d.name} : ${d.current.toFixed(2)}`);

    circlesMerged.transition().duration(300)
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('fill', d => STATUS_COLORS[d.statusKey].fill)
      .attr('fill-opacity', d => d.name === getCurrentPatient() ? 1 : 0.4)
      .attr('stroke', d => d.name === getCurrentPatient() ? '#1E2E2B' : 'none')
      .attr('stroke-width', d => d.name === getCurrentPatient() ? 2 : 0);

    circles.exit().remove();

    const selected = data.find(d => d.name === getCurrentPatient());
    if (selected) {
      const labelX = Math.max(60, Math.min(540, selected.x));
      const labelY = selected.y - 14;
      selectedLabel.text(selected.name);
      const bbox = selectedLabel.node().getBBox();
      const paddingX = 5, paddingY = 2;
      selectedLabelGroup.style('display', null);
      selectedLabelGroup.transition().duration(300).attr('transform', `translate(${labelX}, ${labelY})`);
      selectedLabelBg
        .attr('x', bbox.x - paddingX).attr('y', bbox.y - paddingY)
        .attr('width', bbox.width + paddingX * 2).attr('height', bbox.height + paddingY * 2);
    } else {
      selectedLabelGroup.style('display', 'none');
    }
  }

  function render() {
    const name = getCurrentPatient();
    const patientNameEl = document.getElementById('organes-patient-name');
    if (patientNameEl) patientNameEl.textContent = name;

    const { slope, values, current } = computeTrend(name);
    // getStatusKey suppose des seuils croissants ; on inverse le signe
    // puisqu'ici c'est un niveau BAS qui est grave, pas un niveau haut.
    const statusKey = getStatusKey(-current, -SEUIL_AFFAIBLI, -SEUIL_CRITIQUE);
    const colors = STATUS_COLORS[statusKey];

    if (headerRedList) headerRedList.textContent = current.toFixed(2);

    document.getElementById('organes-value-label').textContent = current.toFixed(2);
    document.getElementById('organes-value-label').style.color = colors.fill;
    document.getElementById('organes-trend-label').textContent = (slope * 10 >= 0 ? '+' : '') + (slope * 10).toFixed(2) + ' /décennie';

    const badge = document.getElementById('organes-status-badge');
    badge.textContent = STATUS_LABELS_ORGANES[statusKey];
    badge.style.background = colors.bg;
    badge.style.color = colors.fill;

    document.getElementById('organes-seuils-label').textContent =
      `Référence Pacifique 2024 : moyenne ${crossMean.toFixed(2)} · seuil affaibli ${SEUIL_AFFAIBLI.toFixed(2)} · seuil critique ${SEUIL_CRITIQUE.toFixed(2)}`;

    const ecgResult = buildEcgPath(values);
    ecgPath.datum(values).attr('d', ecgResult.d).attr('stroke', colors.fill);

    pulseDot.attr('cx', ecgResult.lastPeakX).attr('cy', ecgResult.lastPeakY).attr('fill', colors.fill);

    const hoverPoints = hoverLayer.selectAll('circle').data(ecgResult.points, d => d.year);
    const hoverEnter = hoverPoints.enter().append('circle')
      .attr('r', 8).attr('fill', 'transparent');
    hoverEnter.append('title');
    const hoverMerged = hoverEnter.merge(hoverPoints);
    hoverMerged.attr('cx', d => d.x).attr('cy', d => d.y);
    hoverMerged.select('title').text(d => `${d.year} : ${d.value.toFixed(2)}`);
    hoverPoints.exit().remove();

    lastStatusKey = statusKey;
    applyEcgVisual(false);
    applyBadgeReveal(false);

    const yAffaibli = BASELINE_Y - pct(SEUIL_AFFAIBLI) * AMPLITUDE_MAX;
    const yCritique = BASELINE_Y - pct(SEUIL_CRITIQUE) * AMPLITUDE_MAX;
    seuilAffaibliLine.attr('y1', yAffaibli).attr('y2', yAffaibli);
    seuilCritiqueLine.attr('y1', yCritique).attr('y2', yCritique);
    seuilAffaibliLabel.attr('y', yAffaibli + 3);
    seuilCritiqueLabel.attr('y', yCritique + 3);

    renderOverview();
  }

  // --- Animation d'entrée : le tracé se dessine de gauche à droite, puis
  // le point final fait un battement "lub-dub" une fois le dessin terminé. ---
  const DRAW_DURATION = 1400;
  let lastStatusKey = 'normal';

  function applyEcgVisual(animate) {
    ecgPath.interrupt();
    pulseDot.interrupt().classed('heartbeat', false);

    if (!animate) {
      ecgPath.attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
      pulseDot.style('opacity', 1);
      return;
    }

    const totalLength = ecgPath.node().getTotalLength();
    ecgPath
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength);
    pulseDot.style('opacity', 0);

    ecgPath.transition().duration(DRAW_DURATION).ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0)
      .on('end', () => {
        pulseDot.style('opacity', 1).classed('heartbeat', true);
      });
  }

  let badgeTimer = null;
  function applyBadgeReveal(animate) {
    const badge = document.getElementById('organes-status-badge');
    if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; }

    if (!animate) {
      badge.style.transition = 'none';
      badge.style.opacity = 1;
      return;
    }

    badge.style.transition = 'none';
    badge.style.opacity = 0;
    badgeTimer = setTimeout(() => {
      badge.style.transition = 'opacity 350ms ease';
      badge.style.opacity = 1;
      badgeTimer = null;
    }, DRAW_DURATION);
  }

  // Rejoue l'animation à chaque fois que l'acte 04 entre dans le viewport
  const actSection = document.getElementById('act-04');
  if (actSection && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          applyEcgVisual(true);
          applyBadgeReveal(true);
        }
      });
    }, { threshold: 0.3 });
    sectionObserver.observe(actSection);
  }

  document.addEventListener('patientchange', render);
  render();
})();