// act-01-fievre.js
// Acte 01 · Fièvre - anomalies de température de surface de la mer.
// Dépend de : d3 (CDN), data/sst-data.js (SST_DATA), js/utils.js

(function () {
  const BASELINE_START = 1990;
  const BASELINE_END = 2020;
  const SCALE_MIN = -2.0;
  const SCALE_MAX = 1.5;
  const PLAY_INTERVAL_MS = 500;

  const years = SST_DATA.years;
  const countryNames = Object.keys(SST_DATA.countries);

  const select = document.getElementById('country-select');
  countryNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  select.value = countryNames.includes('Papouasie-Nouvelle-Guinée') ? 'Papouasie-Nouvelle-Guinée' : countryNames[0];

  const slider = document.getElementById('year-slider');
  slider.min = years[0];
  slider.max = years[years.length - 1];
  slider.value = years[years.length - 1];
  document.getElementById('year-min').textContent = years[0];
  document.getElementById('year-max').textContent = years[years.length - 1];

  // Vital du masthead : anomalie moyenne du Pacifique pour la dernière année disponible
  const lastYearIdx = years.length - 1;
  const pacificMean = d3.mean(countryNames.map(n => SST_DATA.countries[n][lastYearIdx]));
  const headerTemp = document.getElementById('header-temp');
  if (headerTemp) headerTemp.textContent = (pacificMean >= 0 ? '+' : '') + pacificMean.toFixed(1) + '°C';

  function pct(v) {
    return Math.max(0, Math.min(1, (v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)));
  }

  // --- Thermomètre ---
  const thermoSvg = d3.select('#thermo-svg');
  const TUBE_X = 20, TUBE_W = 26, TUBE_TOP = 8, TUBE_H = 190, BULB_CY = TUBE_TOP + TUBE_H + 18, BULB_R = 20;
  thermoSvg.attr('width', 64).attr('height', BULB_CY + BULB_R + 6);

  const defs = thermoSvg.append('defs');

  // Dégradés "liquide" par statut - clair en haut, saturé en bas
  const gradients = {
    normal: ['#6FD9B8', '#0F6E56'],
    febrile: ['#F2C879', '#BA7517'],
    critique: ['#E8938A', '#A32D2D']
  };
  Object.entries(gradients).forEach(([key, [light, dark]]) => {
    const grad = defs.append('linearGradient')
      .attr('id', `grad-${key}`).attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', light);
    grad.append('stop').attr('offset', '100%').attr('stop-color', dark);
  });

  // Ombre douce pour donner du relief au bulbe
  const shadow = defs.append('filter').attr('id', 'thermo-shadow').attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%');
  shadow.append('feDropShadow').attr('dx', 0).attr('dy', 1).attr('stdDeviation', 1.4).attr('flood-color', '#1E2E2B').attr('flood-opacity', 0.18);

  // Graduations le long du tube, tous les 0,5°C (plus longues tous les 1°C)
  const tickValues = d3.range(Math.ceil(SCALE_MIN * 2) / 2, SCALE_MAX + 0.01, 0.5);
  tickValues.forEach(val => {
    const y = TUBE_TOP + TUBE_H * (1 - pct(val));
    const isMajor = Math.abs(Math.round(val) - val) < 0.01;
    thermoSvg.append('line')
      .attr('x1', TUBE_X - 4 - (isMajor ? 4 : 0)).attr('x2', TUBE_X - 4)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', '#C7D0CD').attr('stroke-width', 1);
  });

  // Tube en verre : contour + contenu clippé pour un rendu propre
  defs.append('clipPath').attr('id', 'thermo-clip').append('rect')
    .attr('x', TUBE_X).attr('y', TUBE_TOP).attr('width', TUBE_W).attr('height', TUBE_H).attr('rx', TUBE_W / 2);

  thermoSvg.append('rect')
    .attr('x', TUBE_X).attr('y', TUBE_TOP).attr('width', TUBE_W).attr('height', TUBE_H)
    .attr('rx', TUBE_W / 2).attr('fill', '#FAFCFB').attr('stroke', '#DCE3E1').attr('stroke-width', 1.5);

  const tubeContent = thermoSvg.append('g').attr('clip-path', 'url(#thermo-clip)');
  const zoneNormal = tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W).attr('fill', '#E1F5EE');
  const zoneFebrile = tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W).attr('fill', '#FAEEDA');
  const zoneCritique = tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W).attr('fill', '#FCEBEB');
  const mercury = tubeContent.append('rect').attr('x', TUBE_X).attr('width', TUBE_W);

  // Reflet "verre", purement décoratif, au-dessus du liquide
  thermoSvg.append('rect')
    .attr('x', TUBE_X + 4).attr('y', TUBE_TOP + 5).attr('width', 4).attr('height', TUBE_H - 10)
    .attr('rx', 2).attr('fill', '#FFFFFF').attr('opacity', 0.4);

  const bulb = thermoSvg.append('circle')
    .attr('cx', TUBE_X + TUBE_W / 2).attr('cy', BULB_CY).attr('r', BULB_R)
    .attr('stroke', '#DCE3E1').attr('stroke-width', 1.5).attr('filter', 'url(#thermo-shadow)');

  // Curseurs de seuils, repositionnés à chaque render()
  const seuil1Marker = thermoSvg.append('path').attr('d', 'M8,-5 L0,0 L8,5 Z').attr('fill', '#BA7517');
  const seuil2Marker = thermoSvg.append('path').attr('d', 'M8,-5 L0,0 L8,5 Z').attr('fill', '#A32D2D');

  // --- Courbe de série temporelle ---
  const chartSvg = d3.select('#chart-svg');
  const CHART_W = 600, CHART_H = 140, CHART_PAD = { top: 10, right: 10, bottom: 24, left: 40 };
  const xScale = d3.scaleLinear().domain([years[0], years[years.length - 1]]).range([CHART_PAD.left, CHART_W - CHART_PAD.right]);
  let yScale = d3.scaleLinear().range([CHART_H - CHART_PAD.bottom, CHART_PAD.top]);

  const xAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(0,${CHART_H - CHART_PAD.bottom})`);
  const yAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(${CHART_PAD.left},0)`);
  const linePath = chartSvg.append('path').attr('fill', 'none').attr('stroke', '#B4B2A9').attr('stroke-width', 1.5);
  const markerLine = chartSvg.append('line').attr('y1', CHART_PAD.top).attr('y2', CHART_H - CHART_PAD.bottom).attr('stroke', '#DCE3E1');
  const markerPoint = chartSvg.append('circle').attr('r', 4);

  // --- Vue d'ensemble (tous les pays, année courante) ---
  const overviewSvg = d3.select('#overview-svg');
  const OV_W = 600;
  const OV_LABEL_W = 180;
  const OV_PAD = { top: 6, right: 46, bottom: 6, left: OV_LABEL_W };
  const OV_ROW_H = 18;
  const OV_GAP = 4;
  const OV_HEIGHT = OV_PAD.top + OV_PAD.bottom + countryNames.length * (OV_ROW_H + OV_GAP);
  overviewSvg.attr('viewBox', `0 0 ${OV_W} ${OV_HEIGHT}`);

  const ovBarScale = d3.scaleLinear().domain([SCALE_MIN, SCALE_MAX]).range([0, OV_W - OV_PAD.left - OV_PAD.right]);
  const ovZeroX = OV_PAD.left + ovBarScale(0);
  overviewSvg.append('line')
    .attr('x1', ovZeroX).attr('x2', ovZeroX)
    .attr('y1', OV_PAD.top).attr('y2', OV_HEIGHT - OV_PAD.bottom)
    .attr('stroke', '#DCE3E1');

  function renderOverview(year) {
    const idx = years.indexOf(year);
    const rows = countryNames.map(name => {
      const values = SST_DATA.countries[name];
      const v = values[idx];
      const { mean, sd } = computeStats(values, years, BASELINE_START, BASELINE_END);
      const seuil1 = mean + sd, seuil2 = mean + 2 * sd;
      return { name, v, statusKey: getStatusKey(v, seuil1, seuil2) };
    }).sort((a, b) => b.v - a.v);

    document.getElementById('overview-title').textContent = `Vue d'ensemble - le Pacifique en ${year}`;
    const nFievre = rows.filter(r => r.statusKey !== 'normal').length;
    document.getElementById('overview-sub').textContent =
      `${nFievre} pays sur ${rows.length} au-dessus de leur seuil fébrile en ${year}. Cliquez un pays pour l'ouvrir ci-dessus.`;

    const rowSel = overviewSvg.selectAll('g.ov-row').data(rows, d => d.name);

    const rowEnter = rowSel.enter().append('g').attr('class', 'ov-row');
    rowEnter.append('text').attr('class', 'ov-label')
      .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .style('font-size', '11px').style('fill', '#5B6C68');
    rowEnter.append('rect').attr('class', 'ov-bar').attr('rx', 3).attr('ry', 3);
    rowEnter.append('text').attr('class', 'ov-value')
      .attr('dominant-baseline', 'central')
      .style('font-size', '11px').style('font-family', 'monospace').style('fill', '#1E2E2B');

    const rowAll = rowEnter.merge(rowSel);
    rowAll
      .attr('transform', (d, i) => `translate(0, ${OV_PAD.top + i * (OV_ROW_H + OV_GAP)})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        select.value = d.name;
        stopPlaying();
        render();
      });

    rowAll.select('text.ov-label')
      .attr('x', OV_PAD.left - 8).attr('y', OV_ROW_H / 2)
      .text(d => d.name);

    rowAll.select('rect.ov-bar')
      .attr('y', 2).attr('height', OV_ROW_H - 4)
      .attr('x', d => OV_PAD.left + Math.min(ovBarScale(d.v), ovBarScale(0)))
      .attr('width', d => Math.abs(ovBarScale(d.v) - ovBarScale(0)))
      .attr('fill', d => STATUS_COLORS[d.statusKey].fill)
      .attr('stroke', d => d.name === select.value ? '#1E2E2B' : 'none')
      .attr('stroke-width', d => d.name === select.value ? 1.5 : 0);

    rowAll.select('text.ov-value')
      .attr('x', d => OV_PAD.left + ovBarScale(d.v) + (d.v >= 0 ? 6 : -6))
      .attr('y', OV_ROW_H / 2)
      .attr('text-anchor', d => d.v >= 0 ? 'start' : 'end')
      .text(d => (d.v >= 0 ? '+' : '') + d.v.toFixed(1) + '°');

    rowSel.exit().remove();
  }

  function render() {
    const name = select.value;
    const values = SST_DATA.countries[name];
    const year = parseInt(slider.value, 10);
    const idx = years.indexOf(year);
    const v = values[idx];
    const { mean, sd } = computeStats(values, years, BASELINE_START, BASELINE_END);
    const seuil1 = mean + sd;
    const seuil2 = mean + 2 * sd;
    const statusKey = getStatusKey(v, seuil1, seuil2);
    const colors = STATUS_COLORS[statusKey];

    const p1 = pct(seuil1), p2 = pct(seuil2);
    const y1 = TUBE_TOP + TUBE_H * (1 - p1);
    const y2 = TUBE_TOP + TUBE_H * (1 - p2);

    zoneNormal.attr('y', y1).attr('height', TUBE_TOP + TUBE_H - y1);
    zoneFebrile.attr('y', y2).attr('height', y1 - y2);
    zoneCritique.attr('y', TUBE_TOP).attr('height', y2 - TUBE_TOP);

    const mercuryY = TUBE_TOP + TUBE_H * (1 - pct(v));
    mercury.transition().duration(250)
      .attr('y', mercuryY).attr('height', TUBE_TOP + TUBE_H - mercuryY)
      .attr('fill', `url(#grad-${statusKey})`);
    bulb.transition().duration(250).attr('fill', `url(#grad-${statusKey})`);
    bulb.classed('pulse', statusKey === 'critique');

    seuil1Marker.transition().duration(250).attr('transform', `translate(${TUBE_X + TUBE_W + 2}, ${y1})`);
    seuil2Marker.transition().duration(250).attr('transform', `translate(${TUBE_X + TUBE_W + 2}, ${y2})`);
    document.getElementById('year-label').textContent = year;
    document.getElementById('value-label').textContent = (v >= 0 ? '+' : '') + v.toFixed(1) + '°C';
    document.getElementById('value-label').style.color = colors.fill;
    const badge = document.getElementById('status-badge');
    badge.textContent = STATUS_LABELS[statusKey];
    badge.style.background = colors.bg;
    badge.style.color = colors.fill;

    document.getElementById('seuils-label').textContent =
      `Référence ${BASELINE_START}-${BASELINE_END} : ${mean.toFixed(2)}°C · seuil fébrile ${seuil1.toFixed(2)}°C · seuil critique ${seuil2.toFixed(2)}°C`;

    const validValues = values.filter(x => x !== null);
    yScale.domain([d3.min(validValues), d3.max(validValues)]).nice();

    const lineGen = d3.line()
      .defined((d, i) => values[i] !== null)
      .x((d, i) => xScale(years[i]))
      .y(d => yScale(d))
      .curve(d3.curveCatmullRom.alpha(0.5));
    linePath.datum(values).attr('d', lineGen);

    xAxisG.call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('d')));
    yAxisG.call(d3.axisLeft(yScale).ticks(4).tickFormat(d => (d >= 0 ? '+' : '') + d + '°'));

    markerLine.attr('x1', xScale(year)).attr('x2', xScale(year));
    markerPoint.attr('cx', xScale(year)).attr('cy', yScale(v)).attr('fill', colors.fill);

    renderOverview(year);
  }

  // --- Lecture automatique ---
  let playTimer = null;
  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');

  function stopPlaying() {
    clearInterval(playTimer);
    playTimer = null;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }

  function startPlaying() {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    playTimer = setInterval(() => {
      let next = parseInt(slider.value, 10) + 1;
      if (next > parseInt(slider.max, 10)) next = parseInt(slider.min, 10);
      slider.value = next;
      render();
    }, PLAY_INTERVAL_MS);
  }

  playBtn.addEventListener('click', () => {
    if (playTimer) stopPlaying();
    else startPlaying();
  });

  select.addEventListener('change', () => { stopPlaying(); render(); });
  slider.addEventListener('input', () => { stopPlaying(); render(); });

  render();
})();
