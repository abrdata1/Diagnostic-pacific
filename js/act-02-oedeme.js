// act-02-oedeme.js
// Acte 02 · Œdème - anomalies du niveau de la mer.
//
// Contrairement à la fièvre (comparaison à sa propre histoire), le niveau
// de la mer ne redescend quasiment jamais : c'est une tendance monotone,
// pas une oscillation. On compare donc le RYTHME de montée de chaque pays
// à une référence MONDIALE documentée, plutôt qu'à sa propre histoire :
//   - modéré  : taux ≤ 3.4 mm/an (moyenne satellite 1993-2023, Nerem et al./NASA)
//   - aggravé : taux > 3.4 mm/an
//   - sévère  : taux > 4.5 mm/an (rythme mondial le plus récent, 2023)
//
// Dépend de : d3 (CDN), data/sea-level-data.js (SEA_LEVEL_DATA),
// js/patient-state.js (getCurrentPatient, setCurrentPatient),
// js/utils.js (linearRegression, getStatusKey, STATUS_COLORS).

(function () {
  const GLOBAL_RATE_AVERAGE = 3.4; // mm/an - moyenne satellite 1993-2023
  const GLOBAL_RATE_RECENT = 4.5;  // mm/an - rythme mondial le plus récent (2023)
  const SCALE_MIN = 2.0, SCALE_MAX = 6.0; // mm/an - encadre les 2 repères + les 21 pays

  const years = SEA_LEVEL_DATA.years;
  const countryNames = Object.keys(SEA_LEVEL_DATA.countries);
  const STATUS_LABELS_OEDEME = { normal: 'modéré', febrile: 'aggravé', critique: 'sévère' };

  function pct(v) {
    return Math.max(0, Math.min(1, (v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)));
  }

  function computeTrend(name) {
    const values = SEA_LEVEL_DATA.countries[name];
    const { slope, intercept } = linearRegression(years, values);
    const cumulMm = values[values.length - 1] - values[0];
    return { rateMmYear: slope, intercept, cumulMm, values };
  }

  // --- Jauge : même grammaire visuelle que le thermomètre de l'acte 01,
  // mais les seuils sont FIXES (référence mondiale), pas propres au pays. ---
  const gaugeSvg = d3.select('#oedeme-gauge-svg');
  const TUBE_X = 20, TUBE_W = 26, TUBE_TOP = 8, TUBE_H = 190;
  gaugeSvg.attr('width', 64).attr('height', TUBE_TOP + TUBE_H + 8);

  const defs = gaugeSvg.append('defs');
  const gradients = {
    normal: ['#6FD9B8', '#0F6E56'],
    febrile: ['#F2C879', '#BA7517'],
    critique: ['#E8938A', '#A32D2D']
  };
  Object.entries(gradients).forEach(([key, [light, dark]]) => {
    const grad = defs.append('linearGradient')
      .attr('id', `grad-oedeme-${key}`).attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', light);
    grad.append('stop').attr('offset', '100%').attr('stop-color', dark);
  });

  const shadow = defs.append('filter').attr('id', 'oedeme-shadow').attr('x', '-40%').attr('y', '-15%').attr('width', '180%').attr('height', '130%');
  shadow.append('feDropShadow').attr('dx', 0).attr('dy', 1).attr('stdDeviation', 1.2).attr('flood-color', '#1E2E2B').attr('flood-opacity', 0.15);

  const tickValues = d3.range(SCALE_MIN, SCALE_MAX + 0.01, 0.5);
  tickValues.forEach(val => {
    const y = TUBE_TOP + TUBE_H * (1 - pct(val));
    const isMajor = Math.abs(Math.round(val) - val) < 0.01;
    gaugeSvg.append('line')
      .attr('x1', TUBE_X - 4 - (isMajor ? 4 : 0)).attr('x2', TUBE_X - 4)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', '#C7D0CD').attr('stroke-width', 1);
  });

  defs.append('clipPath').attr('id', 'oedeme-clip').append('rect')
    .attr('x', TUBE_X).attr('y', TUBE_TOP).attr('width', TUBE_W).attr('height', TUBE_H).attr('rx', TUBE_W / 2);

  gaugeSvg.append('rect')
    .attr('x', TUBE_X).attr('y', TUBE_TOP).attr('width', TUBE_W).attr('height', TUBE_H)
    .attr('rx', TUBE_W / 2).attr('fill', '#FAFCFB').attr('stroke', '#DCE3E1').attr('stroke-width', 1.5)
    .attr('filter', 'url(#oedeme-shadow)');

  const tubeContent = gaugeSvg.append('g').attr('clip-path', 'url(#oedeme-clip)');

  // Zones fixes : les seuils sont mondiaux, donc identiques quel que soit le
  // pays affiché (contrairement à l'acte 01 où elles bougent par pays).
  const pAvg = pct(GLOBAL_RATE_AVERAGE), pRecent = pct(GLOBAL_RATE_RECENT);
  const yAvg = TUBE_TOP + TUBE_H * (1 - pAvg);
  const yRecent = TUBE_TOP + TUBE_H * (1 - pRecent);
  tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W).attr('fill', '#E1F5EE')
    .attr('y', yAvg).attr('height', TUBE_TOP + TUBE_H - yAvg);
  tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W).attr('fill', '#FAEEDA')
    .attr('y', yRecent).attr('height', yAvg - yRecent);
  tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W).attr('fill', '#FCEBEB')
    .attr('y', TUBE_TOP).attr('height', yRecent - TUBE_TOP);

  const fill = tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W);

  gaugeSvg.append('rect')
    .attr('x', TUBE_X + 4).attr('y', TUBE_TOP + 5).attr('width', 4).attr('height', TUBE_H - 10)
    .attr('rx', 2).attr('fill', '#FFFFFF').attr('opacity', 0.4);

  gaugeSvg.append('path').attr('d', 'M8,-5 L0,0 L8,5 Z').attr('fill', '#BA7517')
    .attr('transform', `translate(${TUBE_X + TUBE_W + 2}, ${yAvg})`);
  gaugeSvg.append('path').attr('d', 'M8,-5 L0,0 L8,5 Z').attr('fill', '#A32D2D')
    .attr('transform', `translate(${TUBE_X + TUBE_W + 2}, ${yRecent})`);

  // --- Courbe temporelle + droite de tendance ---
  const chartSvg = d3.select('#oedeme-chart-svg');
  const CHART_W = 600, CHART_H = 140, CHART_PAD = { top: 10, right: 10, bottom: 24, left: 44 };
  const xScale = d3.scaleLinear().domain([years[0], years[years.length - 1]]).range([CHART_PAD.left, CHART_W - CHART_PAD.right]);
  let yScale = d3.scaleLinear().range([CHART_H - CHART_PAD.bottom, CHART_PAD.top]);

  const xAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(0,${CHART_H - CHART_PAD.bottom})`);
  const yAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(${CHART_PAD.left},0)`);
  const linePath = chartSvg.append('path').attr('fill', 'none').attr('stroke', '#B4B2A9').attr('stroke-width', 1.5);
  const trendPath = chartSvg.append('line').attr('stroke', '#1E2E2B').attr('stroke-width', 1.2).attr('stroke-dasharray', '4 3');

  // --- Vue d'ensemble : même grammaire que l'acte 01 (ligne graduée,
  // essaim de points), avec repères mondiaux fixes plutôt que des zones
  // propres à chaque pays. ---
  const overviewSvg = d3.select('#oedeme-overview-svg');
  const OV_W = 600, OV_H = 110;
  overviewSvg.attr('viewBox', `0 0 ${OV_W} ${OV_H}`);
  const overviewScale = d3.scaleLinear().domain([SCALE_MIN, SCALE_MAX]).range([50, 550]);
  const LINE_Y = 55;
  const SWARM_Y_MIN = 28, SWARM_Y_MAX = 82;

  overviewSvg.append('line')
    .attr('x1', overviewScale(SCALE_MIN)).attr('x2', overviewScale(SCALE_MAX))
    .attr('y1', LINE_Y).attr('y2', LINE_Y).attr('stroke', '#B4B2A9');

  [[GLOBAL_RATE_AVERAGE, 'moy. mondiale'], [GLOBAL_RATE_RECENT, 'rythme 2023']].forEach(([val, label]) => {
    const x = overviewScale(val);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 30).attr('y2', LINE_Y + 30)
      .attr('stroke', '#B4B2A9').attr('stroke-dasharray', '2 2');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y - 34).attr('text-anchor', 'middle')
      .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#8D9A96')
      .text(label);
  });

  [2, 3, 4, 5, 6].forEach(v => {
    const x = overviewScale(v);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 7).attr('y2', LINE_Y + 7)
      .attr('stroke', '#8D9A96');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y + 37).attr('text-anchor', 'middle')
      .style('font-size', '10px').style('font-family', 'monospace').style('fill', '#5B6C68')
      .text(v + ' mm/an');
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
      .force('x', d3.forceX(d => overviewScale(d.rate)).strength(1))
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
      const { rateMmYear } = computeTrend(name);
      return { name, rate: rateMmYear, statusKey: getStatusKey(rateMmYear, GLOBAL_RATE_AVERAGE, GLOBAL_RATE_RECENT) };
    });

    const nAggrave = rows.filter(d => d.statusKey !== 'normal').length;
    document.getElementById('oedeme-overview-sub').textContent =
      `${nAggrave} pays sur ${rows.length} montent plus vite que la moyenne mondiale (${GLOBAL_RATE_AVERAGE} mm/an). Survolez ou cliquez un point.`;

    const data = computeBeeswarm(rows.map(d => ({ ...d, x: overviewScale(d.rate), y: LINE_Y })));
    const circles = pointsLayer.selectAll('circle').data(data, d => d.name);

    const circlesEnter = circles.enter().append('circle')
      .attr('r', 5).style('cursor', 'pointer')
      .on('click', (event, d) => { setCurrentPatient(d.name); });
    circlesEnter.append('title');

    const circlesMerged = circlesEnter.merge(circles);
    circlesMerged.select('title').text(d => `${d.name} : ${d.rate.toFixed(2)} mm/an`);

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
    const patientNameEl = document.getElementById('oedeme-patient-name');
    if (patientNameEl) patientNameEl.textContent = name;

    const { rateMmYear, intercept, cumulMm, values } = computeTrend(name);
    const statusKey = getStatusKey(rateMmYear, GLOBAL_RATE_AVERAGE, GLOBAL_RATE_RECENT);
    const colors = STATUS_COLORS[statusKey];

    const fillY = TUBE_TOP + TUBE_H * (1 - pct(rateMmYear));
    fill.transition().duration(250)
      .attr('y', fillY).attr('height', TUBE_TOP + TUBE_H - fillY)
      .attr('fill', `url(#grad-oedeme-${statusKey})`);

    document.getElementById('oedeme-value-label').textContent = (rateMmYear >= 0 ? '+' : '') + rateMmYear.toFixed(2) + ' mm/an';
    document.getElementById('oedeme-value-label').style.color = colors.fill;
    const badge = document.getElementById('oedeme-status-badge');
    badge.textContent = STATUS_LABELS_OEDEME[statusKey];
    badge.style.background = colors.bg;
    badge.style.color = colors.fill;

    document.getElementById('oedeme-seuils-label').textContent =
      `Référence mondiale : ${GLOBAL_RATE_AVERAGE} mm/an (moy. satellite 1993-2023) · ${GLOBAL_RATE_RECENT} mm/an (rythme 2023)`;
    document.getElementById('oedeme-cumul-label').textContent =
      `Depuis 1993, la mer a déjà gagné ${cumulMm >= 0 ? '+' : ''}${cumulMm.toFixed(0)} mm à cet endroit.`;

    yScale.domain([d3.min(values), d3.max(values)]).nice();
    const lineGen = d3.line()
      .x((d, i) => xScale(years[i]))
      .y(d => yScale(d))
      .curve(d3.curveCatmullRom.alpha(0.5));
    linePath.datum(values).attr('d', lineGen);

    const yFirst = intercept + rateMmYear * years[0];
    const yLast = intercept + rateMmYear * years[years.length - 1];
    trendPath
      .attr('x1', xScale(years[0])).attr('y1', yScale(yFirst))
      .attr('x2', xScale(years[years.length - 1])).attr('y2', yScale(yLast));

    xAxisG.call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('d')));
    yAxisG.call(d3.axisLeft(yScale).ticks(4).tickFormat(d => (d >= 0 ? '+' : '') + d + 'mm'));

    renderOverview();
  }

  document.addEventListener('patientchange', render);
  render();
})();