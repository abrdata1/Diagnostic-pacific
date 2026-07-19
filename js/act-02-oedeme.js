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
// Visuel : deux coupes de peau côte à côte, façon planche anatomique
// (épiderme / derme / hypoderme / muscle), avec le fluide interstitiel qui
// monte plus ou moins haut. Le panneau de gauche est une référence FIXE
// (calée sur la moyenne mondiale), le panneau de droite montre le patient
// courant - pour rendre l'écart visible sans avoir à lire les chiffres.
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

  // --- Jauge : deux coupes de peau côte à côte (référence / patient), avec
  // le fluide interstitiel qui monte entre les couches. C'est littéralement
  // ce qu'est un œdème, et la comparaison directe rend l'écart visible sans
  // avoir à lire les seuils.
  const gaugeSvg = d3.select('#oedeme-gauge-svg');
  const PANEL_W = 90, PANEL_GAP = 14, MARGIN_X = 13;
  const LEFT_X = MARGIN_X;
  const RIGHT_X = LEFT_X + PANEL_W + PANEL_GAP;
  const PANEL_TOP = 46, PANEL_H = 150;
  const PANEL_BOTTOM = PANEL_TOP + PANEL_H;
  const PANEL_LABEL_Y = 40;
  const BADGE_Y = PANEL_BOTTOM + 16;
  const CANVAS_W = RIGHT_X + PANEL_W + MARGIN_X;
  const CANVAS_H = BADGE_Y + 14;
  const FLUID_NEUTRAL_COLOR = '#3B82C4'; // bleu "eau" neutre, au départ de l'animation
  const WAVE_AMP = 3; // amplitude de la vague au repos
  const LEVEL_RISE_DURATION = 3000; // doit rester identique dans les fonctions de badge

  gaugeSvg.attr('width', CANVAS_W).attr('height', CANVAS_H).attr('viewBox', `0 0 ${CANVAS_W} ${CANVAS_H}`);

  function levelY(v) {
    return PANEL_TOP + PANEL_H * (1 - pct(v));
  }

  function waveD(x0, x1, yBase, amp) {
    const xm = (x0 + x1) / 2;
    return `M${x0},${yBase} Q${(x0 + xm) / 2},${yBase - amp} ${xm},${yBase} `
      + `T${x1},${yBase} L${x1},${PANEL_BOTTOM} L${x0},${PANEL_BOTTOM} Z`;
  }

  const defs = gaugeSvg.append('defs');

  gaugeSvg.append('line').attr('x1', 8).attr('x2', 22).attr('y1', 11).attr('y2', 11)
    .attr('stroke', '#BA7517').attr('stroke-width', 1.5).attr('stroke-dasharray', '3 3');
  gaugeSvg.append('text').attr('x', 26).attr('y', 14)
    .style('font-size', '8px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text('moy. mondiale (3,4)');

  gaugeSvg.append('line').attr('x1', 8).attr('x2', 22).attr('y1', 23).attr('y2', 23)
    .attr('stroke', '#A32D2D').attr('stroke-width', 1.5).attr('stroke-dasharray', '3 3');
  gaugeSvg.append('text').attr('x', 26).attr('y', 26)
    .style('font-size', '8px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text('rythme 2023 (4,5)');

  function drawPanel(x0, title) {
    const x1 = x0 + PANEL_W;
    const clipId = `oedeme-clip-${x0}`;
    defs.append('clipPath').attr('id', clipId)
      .append('rect').attr('x', x0).attr('y', PANEL_TOP).attr('width', PANEL_W).attr('height', PANEL_H).attr('rx', 4);

    gaugeSvg.append('text').attr('x', x0 + PANEL_W / 2).attr('y', PANEL_LABEL_Y).attr('text-anchor', 'middle')
      .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#5B6C68')
      .text(title);

    const tissueLayer = gaugeSvg.append('g').attr('clip-path', `url(#${clipId})`);

    const layers = [
      { y0: PANEL_TOP, y1: PANEL_TOP + 16, fill: '#F3DFCB' },
      { y0: PANEL_TOP + 16, y1: PANEL_TOP + 56, fill: '#F8E1E5' },
      { y0: PANEL_TOP + 56, y1: PANEL_TOP + 101, fill: '#FBF0C9' },
      { y0: PANEL_TOP + 101, y1: PANEL_BOTTOM, fill: '#B5504F' }
    ];
    layers.forEach(l => {
      tissueLayer.append('rect')
        .attr('x', x0).attr('y', l.y0).attr('width', PANEL_W).attr('height', l.y1 - l.y0)
        .attr('fill', l.fill);
    });

    d3.range(5).forEach(i => {
      tissueLayer.append('path')
        .attr('d', 'M0,0 Q3,-3 6,0 Q3,2 0,0 Z')
        .attr('fill', '#C9A87E').attr('opacity', 0.7)
        .attr('transform', `translate(${x0 + 8 + i * 16 + Math.random() * 3}, ${PANEL_TOP + 2})`);
    });

    d3.range(4).forEach(() => {
      tissueLayer.append('circle')
        .attr('cx', x0 + 8 + Math.random() * (PANEL_W - 16)).attr('cy', PANEL_TOP + 9 + Math.random() * 3).attr('r', 1.8)
        .attr('fill', '#D9B98F');
    });

    d3.range(8).forEach(() => {
      tissueLayer.append('circle')
        .attr('cx', x0 + 8 + Math.random() * (PANEL_W - 16)).attr('cy', PANEL_TOP + 24 + Math.random() * 28).attr('r', 2.2)
        .attr('fill', '#F3C9D1').attr('stroke', '#E3A7B3').attr('stroke-width', 0.6);
    });

    d3.range(5).forEach(() => {
      tissueLayer.append('circle')
        .attr('cx', x0 + 10 + Math.random() * (PANEL_W - 20)).attr('cy', PANEL_TOP + 68 + Math.random() * 24).attr('r', 5)
        .attr('fill', '#F2DE9E');
    });

    d3.range(3).forEach(i => {
      tissueLayer.append('line')
        .attr('x1', x0 + 4).attr('x2', x1 - 4)
        .attr('y1', PANEL_TOP + 112 + i * 12).attr('y2', PANEL_TOP + 112 + i * 12)
        .attr('stroke', '#C96A69').attr('stroke-width', 1).attr('opacity', 0.5);
    });

    const fluidLayer = gaugeSvg.append('g').attr('clip-path', `url(#${clipId})`);
    const fluidPath = fluidLayer.append('path').attr('d', waveD(x0, x1, PANEL_BOTTOM, WAVE_AMP));

    gaugeSvg.append('rect')
      .attr('x', x0).attr('y', PANEL_TOP).attr('width', PANEL_W).attr('height', PANEL_H).attr('rx', 4)
      .attr('fill', 'none').attr('stroke', '#1E2E2B').attr('stroke-width', 1.5);

    const badgeRect = gaugeSvg.append('rect')
      .attr('x', x0 + PANEL_W / 2 - 37).attr('y', BADGE_Y - 9).attr('width', 74).attr('height', 18).attr('rx', 9);
    const badgeText = gaugeSvg.append('text')
      .attr('x', x0 + PANEL_W / 2).attr('y', BADGE_Y + 1).attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .style('font-size', '9px').style('font-family', 'monospace').style('font-weight', '600');

    return { x0, x1, fluidPath, badgeRect, badgeText };
  }

  const refPanel = drawPanel(LEFT_X, 'référence');
  const patientPanel = drawPanel(RIGHT_X, 'patient');

  const yAvg = levelY(GLOBAL_RATE_AVERAGE);
  const yRecent = levelY(GLOBAL_RATE_RECENT);
  [[yAvg, '#BA7517'], [yRecent, '#A32D2D']].forEach(([y, color]) => {
    [refPanel, patientPanel].forEach(p => {
      gaugeSvg.append('line').attr('x1', p.x0).attr('x2', p.x1).attr('y1', y).attr('y2', y)
        .attr('stroke', '#FFFFFF').attr('stroke-width', 3).attr('opacity', 0.9);
      gaugeSvg.append('line').attr('x1', p.x0).attr('x2', p.x1).attr('y1', y).attr('y2', y)
        .attr('stroke', color).attr('stroke-width', 1.2).attr('stroke-dasharray', '3 3');
    });
  });

  function applyPanelVisual(panel, targetY, targetColor, animate) {
    panel.fluidPath.interrupt();

    if (!animate) {
      panel.fluidPath.attr('d', waveD(panel.x0, panel.x1, targetY, WAVE_AMP)).attr('fill', targetColor);
      return;
    }

    panel.fluidPath
      .attr('d', waveD(panel.x0, panel.x1, PANEL_BOTTOM, WAVE_AMP))
      .attr('fill', FLUID_NEUTRAL_COLOR)
      .transition().duration(LEVEL_RISE_DURATION).ease(d3.easeElasticOut.amplitude(1).period(0.6))
        .attrTween('d', () => {
          const interpY = d3.interpolateNumber(PANEL_BOTTOM, targetY);
          return t => {
            const y = interpY(t);
            const amp = WAVE_AMP + 6 * (1 - t) * Math.sin(t * Math.PI * 8);
            return waveD(panel.x0, panel.x1, y, amp);
          };
        })
      .transition().duration(350)
        .attr('fill', targetColor);
  }

  function makeBadgeApplier(textSel, rectSel) {
    let badgeTimer = null;
    return function apply(text, colors, animate) {
      if (badgeTimer) { clearTimeout(badgeTimer); badgeTimer = null; }

      const setContent = () => {
        textSel.text(text).style('fill', colors.fill);
        rectSel.attr('fill', colors.bg);
      };

      if (!animate) {
        textSel.style('opacity', 1);
        rectSel.style('opacity', 1);
        setContent();
        return;
      }

      textSel.style('opacity', 0);
      rectSel.style('opacity', 0);
      badgeTimer = setTimeout(() => {
        setContent();
        textSel.transition().duration(350).style('opacity', 1);
        rectSel.transition().duration(350).style('opacity', 1);
        badgeTimer = null;
      }, LEVEL_RISE_DURATION);
    };
  }

  const applyRefBadge = makeBadgeApplier(refPanel.badgeText, refPanel.badgeRect);
  const applyPatientBadge = makeBadgeApplier(patientPanel.badgeText, patientPanel.badgeRect);

  applyPanelVisual(refPanel, yAvg, STATUS_COLORS.normal.fill, false);
  applyRefBadge('référence', STATUS_COLORS.normal, false);

  let lastPatientLevelY = PANEL_BOTTOM;
  let lastPatientColor = FLUID_NEUTRAL_COLOR;
  let lastPatientStatusKey = 'normal';

  let readoutBadgeTimer = null;
  function applyReadoutBadge(animate) {
    const badge = document.getElementById('oedeme-status-badge');
    const colors = STATUS_COLORS[lastPatientStatusKey];
    if (readoutBadgeTimer) { clearTimeout(readoutBadgeTimer); readoutBadgeTimer = null; }

    const setBadgeContent = () => {
      badge.textContent = STATUS_LABELS_OEDEME[lastPatientStatusKey];
      badge.style.background = colors.bg;
      badge.style.color = colors.fill;
    };

    if (!animate) {
      badge.style.transition = 'none';
      badge.style.opacity = 1;
      setBadgeContent();
      return;
    }

    badge.style.transition = 'none';
    badge.style.opacity = 0;
    readoutBadgeTimer = setTimeout(() => {
      setBadgeContent();
      badge.style.transition = 'opacity 350ms ease';
      badge.style.opacity = 1;
      readoutBadgeTimer = null;
    }, LEVEL_RISE_DURATION);
  }

  const actSection = document.getElementById('act-02');
  if (actSection && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          applyPanelVisual(refPanel, yAvg, STATUS_COLORS.normal.fill, true);
          applyRefBadge('référence', STATUS_COLORS.normal, true);
          applyPanelVisual(patientPanel, lastPatientLevelY, lastPatientColor, true);
          applyPatientBadge(STATUS_LABELS_OEDEME[lastPatientStatusKey], STATUS_COLORS[lastPatientStatusKey], true);
          applyReadoutBadge(true);
        }
      });
    }, { threshold: 0.3 });
    sectionObserver.observe(actSection);
  }

  const chartSvg = d3.select('#oedeme-chart-svg');
  const CHART_W = 600, CHART_H = 140, CHART_PAD = { top: 10, right: 10, bottom: 24, left: 44 };
  const xScale = d3.scaleLinear().domain([years[0], years[years.length - 1]]).range([CHART_PAD.left, CHART_W - CHART_PAD.right]);
  let yScale = d3.scaleLinear().range([CHART_H - CHART_PAD.bottom, CHART_PAD.top]);

  const xAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(0,${CHART_H - CHART_PAD.bottom})`);
  const yAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(${CHART_PAD.left},0)`);
  const linePath = chartSvg.append('path').attr('fill', 'none').attr('stroke', '#B4B2A9').attr('stroke-width', 1.5);
  const trendPath = chartSvg.append('line').attr('stroke', '#1E2E2B').attr('stroke-width', 1.2).attr('stroke-dasharray', '4 3');

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
      .attr('fill-opacity', d => d.name === getCurrentPatient() ? 1 : 0.4);
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

    lastPatientLevelY = levelY(rateMmYear);
    lastPatientColor = colors.fill;
    applyPanelVisual(patientPanel, lastPatientLevelY, lastPatientColor, false);

    lastPatientStatusKey = statusKey;
    applyPatientBadge(STATUS_LABELS_OEDEME[statusKey], colors, false);

    document.getElementById('oedeme-value-label').textContent = (rateMmYear >= 0 ? '+' : '') + rateMmYear.toFixed(2) + ' mm/an';
    document.getElementById('oedeme-value-label').style.color = colors.fill;
    applyReadoutBadge(false);

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