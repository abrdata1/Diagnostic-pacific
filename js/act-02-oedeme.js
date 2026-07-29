// act-02-oedeme.js
// Acte 02 · Œdème - anomalies du niveau de la mer.
//
// MÉTHODOLOGIE (mise à jour) : le statut n'est plus déterminé par le seul
// taux de montée comparé à la moyenne mondiale, mais par un SCORE DE RISQUE
// combinant l'aléa (vitesse de montée) et l'exposition (part de la
// population vivant sous 10 m d'altitude - Low Elevation Coastal Zone) :
//
//   score de risque = (% population < 10 m ÷ 100) × taux de montée (mm/an)
//
// C'est le principe classique aléa × exposition utilisé en analyse de
// risque climatique. Les seuils modéré/aggravé/sévère sont ensuite calculés
// statistiquement (moyenne + écart-type) sur la distribution des 21 scores
// du Pacifique, comme pour les autres actes.
//
// Ce score reste un INDICE construit, pas une grandeur physique : il sert à
// classer les pays entre eux, pas à mesurer un risque réel de submersion en
// valeur absolue. Il ne capture pas non plus la capacité d'adaptation de
// chaque pays (digues, ressources, options de relocalisation) - le
// troisième terme classique du risque (aléa × exposition × vulnérabilité),
// qui manque ici faute de donnée disponible. Voir aussi le bloc "Comprendre
// la donnée" de la page pour le détail des réserves et des sources.
//
// Dépend de : d3 (CDN), data/sea-level-data.js (SEA_LEVEL_DATA),
// data/exposure-lecz-data.js (EXPOSURE_LECZ_DATA), js/patient-state.js
// (getCurrentPatient, setCurrentPatient), js/utils.js (linearRegression,
// getStatusKey, STATUS_COLORS).

(function () {
  const GLOBAL_RATE_AVERAGE = 3.4; // mm/an - moyenne satellite 1993-2023 (repère textuel uniquement)
  const GLOBAL_RATE_RECENT = 4.5;  // mm/an - rythme mondial le plus récent, 2023 (repère textuel uniquement)

  const years = SEA_LEVEL_DATA.years;
  const countryNames = Object.keys(SEA_LEVEL_DATA.countries);
  const STATUS_LABELS_OEDEME = { normal: 'modéré', febrile: 'aggravé', critique: 'sévère' };

  function computeTrend(name) {
    const values = SEA_LEVEL_DATA.countries[name];
    const { slope, intercept } = linearRegression(years, values);
    const cumulMm = values[values.length - 1] - values[0];
    return { rateMmYear: slope, intercept, cumulMm, values };
  }

  function computeExposurePct(name) {
    return EXPOSURE_LECZ_DATA[name] != null ? EXPOSURE_LECZ_DATA[name] : 0;
  }

  function computeRiskScore(name) {
    const { rateMmYear } = computeTrend(name);
    const exposurePct = computeExposurePct(name);
    return (exposurePct / 100) * rateMmYear;
  }

  // Seuils du score de risque : moyenne + écart-type sur la distribution
  // des 21 pays du Pacifique (même logique statistique que la fièvre,
  // appliquée ici à un indice composite plutôt qu'à une mesure directe).
  const allRiskScores = countryNames.map(n => computeRiskScore(n));
  const RISK_MEAN = d3.mean(allRiskScores);
  const RISK_SD = d3.deviation(allRiskScores);
  const SEUIL_AGGRAVE = RISK_MEAN + RISK_SD;
  const SEUIL_SEVERE = RISK_MEAN + 2 * RISK_SD;
  const RISK_SCALE_MAX = Math.max(...allRiskScores) * 1.15;
  const globalCumulMm = GLOBAL_RATE_AVERAGE * (years[years.length - 1] - years[0]);

  // Vital du masthead : taux de montée du patient courant, mis à jour dans render()
  const headerSeaLevel = document.getElementById('header-sealevel');

  // --- Jauge : une seule coupe de peau (le patient), avec le fluide
  // interstitiel qui monte entre les couches. HAUTEUR, COULEUR et SEUILS
  // affichés partagent la même échelle physique (mm/an) ; le score de
  // risque (aléa × exposition), lui, gouverne le badge et l'indicateur
  // secondaire sous la jauge (voir plus bas).
  const gaugeSvg = d3.select('#oedeme-gauge-svg');
  const PANEL_W = 100, MARGIN_X = 13;
  const PANEL_TOP = 46, PANEL_H = 150;
  const PANEL_BOTTOM = PANEL_TOP + PANEL_H;
  const PANEL_LABEL_Y = 40;
  const BADGE_Y = PANEL_BOTTOM + 16;
  const CANVAS_W = 200;
  const PATIENT_X = (CANVAS_W - PANEL_W) / 2;
  const CANVAS_H = BADGE_Y + 14;
  const FLUID_NEUTRAL_COLOR = '#3B82C4'; // bleu "eau" neutre, au départ de l'animation
  const WAVE_AMP = 3; // amplitude de la vague au repos
  const LEVEL_RISE_DURATION = 2000; // doit rester identique dans les fonctions de badge

  // Palette de l'EAU elle-même, distincte de STATUS_COLORS (utilisée pour
  // les badges). Le fluide reste toujours reconnaissable comme de l'eau -
  // plus sombre et trouble quand c'est sévère, jamais rouge (qui se
  // lirait comme du sang dans une coupe de peau).
  const WATER_COLORS = {
    normal: '#7EC8E3',
    febrile: '#2E86AB',
    critique: '#0B4F6C'
  };
  const WATER_FOAM = '#EAF6FC'; // liseré d'écume sur la crête de la vague

  gaugeSvg.attr('width', CANVAS_W).attr('height', CANVAS_H).attr('viewBox', `0 0 ${CANVAS_W} ${CANVAS_H}`);

  // Le niveau du fluide représente le TAUX DE MONTÉE réel (mm/an), une
  // grandeur physique - c'est le visuel principal, le plus parlant. Le
  // score de risque (aléa × exposition) reste le critère du statut/badge,
  // mais n'est plus ce qui fait monter le niveau : il est montré séparément,
  // sous la jauge (voir plus bas, indicateur de risque).
  const RATE_SCALE_MIN = 2.0, RATE_SCALE_MAX = 6.0; // mm/an - encadre les repères + les 21 pays

  function pctRate(v) {
    return Math.max(0, Math.min(1, (v - RATE_SCALE_MIN) / (RATE_SCALE_MAX - RATE_SCALE_MIN)));
  }

  function levelY(v) {
    return PANEL_TOP + PANEL_H * (1 - pctRate(v));
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
    .text(`moy. mondiale (${GLOBAL_RATE_AVERAGE})`);

  gaugeSvg.append('line').attr('x1', 8).attr('x2', 22).attr('y1', 23).attr('y2', 23)
    .attr('stroke', '#A32D2D').attr('stroke-width', 1.5).attr('stroke-dasharray', '3 3');
  gaugeSvg.append('text').attr('x', 26).attr('y', 26)
    .style('font-size', '8px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text(`rythme 2023 (${GLOBAL_RATE_RECENT})`);

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
    const fluidPath = fluidLayer.append('path')
      .attr('d', waveD(x0, x1, PANEL_BOTTOM, WAVE_AMP))
      .attr('stroke', WATER_FOAM).attr('stroke-width', 1.5);

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

  const patientPanel = drawPanel(PATIENT_X, null);

  const yAvg = levelY(GLOBAL_RATE_AVERAGE);
  const yRecent = levelY(GLOBAL_RATE_RECENT);
  [[yAvg, '#BA7517'], [yRecent, '#A32D2D']].forEach(([y, color]) => {
    gaugeSvg.append('line').attr('x1', patientPanel.x0).attr('x2', patientPanel.x1).attr('y1', y).attr('y2', y)
      .attr('stroke', '#FFFFFF').attr('stroke-width', 3).attr('opacity', 0.9);
    gaugeSvg.append('line').attr('x1', patientPanel.x0).attr('x2', patientPanel.x1).attr('y1', y).attr('y2', y)
      .attr('stroke', color).attr('stroke-width', 1.2).attr('stroke-dasharray', '3 3');
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

  const applyPatientBadge = makeBadgeApplier(patientPanel.badgeText, patientPanel.badgeRect);

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
          applyPanelVisual(patientPanel, lastPatientLevelY, lastPatientColor, true);
          applyPatientBadge(STATUS_LABELS_OEDEME[lastPatientStatusKey], STATUS_COLORS[lastPatientStatusKey], true);
          applyReadoutBadge(true);
        }
      });
    }, { threshold: 0.3 });
    sectionObserver.observe(actSection);
  }

  // --- Indicateur de risque : une ligne graduée simple, secondaire, sous
  // la jauge principale. La jauge montre la vitesse physique (mm/an) ; ce
  // repère montre où se situe le SCORE DE RISQUE du patient par rapport
  // aux seuils qui déterminent le badge - même grammaire visuelle que les
  // vues d'ensemble des autres actes, à une échelle réduite à un seul point. ---
  const riskSvg = d3.select('#oedeme-risk-indicator-svg');
  const RISK_IND_W = 600, RISK_IND_H = 60, RISK_IND_PAD_L = 12, RISK_IND_PAD_R = 12;
  riskSvg.attr('viewBox', `0 0 ${RISK_IND_W} ${RISK_IND_H}`);

  const riskIndScale = d3.scaleLinear().domain([0, RISK_SCALE_MAX]).range([RISK_IND_PAD_L, RISK_IND_W - RISK_IND_PAD_R]);
  const RISK_IND_LINE_Y = 28;

  riskSvg.append('text').attr('x', RISK_IND_PAD_L).attr('y', 10)
    .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#5B6C68')
    .text('score de risque (aléa × exposition)');

  riskSvg.append('line')
    .attr('x1', riskIndScale(0)).attr('x2', riskIndScale(RISK_SCALE_MAX))
    .attr('y1', RISK_IND_LINE_Y).attr('y2', RISK_IND_LINE_Y).attr('stroke', '#DCE3E1');

  [[SEUIL_AGGRAVE, 'aggravé', '#BA7517'], [SEUIL_SEVERE, 'sévère', '#A32D2D']].forEach(([val, label, color]) => {
    const x = riskIndScale(val);
    riskSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', RISK_IND_LINE_Y - 8).attr('y2', RISK_IND_LINE_Y + 8)
      .attr('stroke', color).attr('stroke-dasharray', '2 2');
    riskSvg.append('text')
      .attr('x', x).attr('y', RISK_IND_LINE_Y + 22).attr('text-anchor', 'middle')
      .style('font-size', '8px').style('font-family', 'monospace').style('fill', '#5B6C68')
      .text(`${label} ${val.toFixed(1)}`);
  });

  const riskDot = riskSvg.append('circle').attr('cy', RISK_IND_LINE_Y).attr('r', 5).attr('stroke', '#1E2E2B').attr('stroke-width', 1);
  const riskDotLabel = riskSvg.append('text')
    .attr('y', RISK_IND_LINE_Y - 12).attr('text-anchor', 'middle')
    .style('font-size', '10px').style('font-family', 'monospace').style('font-weight', '600');

  function renderRiskIndicator(riskScore, color) {
    const x = Math.max(riskIndScale(0), Math.min(riskIndScale(RISK_SCALE_MAX), riskIndScale(riskScore)));
    riskDot.transition().duration(400).attr('cx', x).attr('fill', color);
    riskDotLabel.transition().duration(400).attr('x', x).style('fill', color);
    riskDotLabel.text(riskScore.toFixed(2));
  }

  const chartSvg = d3.select('#oedeme-chart-svg');
  const CHART_W = 600, CHART_H = 140, CHART_PAD = { top: 10, right: 10, bottom: 24, left: 44 };
  const xScale = d3.scaleLinear().domain([years[0], years[years.length - 1]]).range([CHART_PAD.left, CHART_W - CHART_PAD.right]);
  let yScale = d3.scaleLinear().range([CHART_H - CHART_PAD.bottom, CHART_PAD.top]);

  const xAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(0,${CHART_H - CHART_PAD.bottom})`);
  const yAxisG = chartSvg.append('g').attr('class', 'axis').attr('transform', `translate(${CHART_PAD.left},0)`);
  const linePath = chartSvg.append('path').attr('fill', 'none').attr('stroke', '#B4B2A9').attr('stroke-width', 1.5);
  const trendPath = chartSvg.append('line').attr('stroke', '#1E2E2B').attr('stroke-width', 1.2).attr('stroke-dasharray', '4 3');

  // --- Vue d'ensemble : positionnée par SCORE DE RISQUE (pas par le taux
  // brut), pour que la position horizontale et la couleur racontent la
  // même histoire. ---
  const overviewSvg = d3.select('#oedeme-overview-svg');
  const OV_W = 600, OV_H = 110;
  overviewSvg.attr('viewBox', `0 0 ${OV_W} ${OV_H}`);
  const overviewScale = d3.scaleLinear().domain([0, RISK_SCALE_MAX]).range([50, 550]);
  const LINE_Y = 55;
  const SWARM_Y_MIN = 28, SWARM_Y_MAX = 82;

  overviewSvg.append('line')
    .attr('x1', overviewScale(0)).attr('x2', overviewScale(RISK_SCALE_MAX))
    .attr('y1', LINE_Y).attr('y2', LINE_Y).attr('stroke', '#B4B2A9');

  [[SEUIL_AGGRAVE, 'aggravé'], [SEUIL_SEVERE, 'sévère']].forEach(([val, label]) => {
    const x = overviewScale(val);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 30).attr('y2', LINE_Y + 30)
      .attr('stroke', '#B4B2A9').attr('stroke-dasharray', '2 2');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y - 34).attr('text-anchor', 'middle')
      .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#8D9A96')
      .text(`seuil ${label}`);
  });

  const overviewTicks = d3.range(0, RISK_SCALE_MAX + 0.01, RISK_SCALE_MAX / 5);
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
  overviewSvg.append('text')
    .attr('x', 550).attr('y', LINE_Y + 50).attr('text-anchor', 'end')
    .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#8D9A96')
    .text('indice de risque (aléa × exposition) →');

  const pointsLayer = overviewSvg.append('g');
  const selectedLabelGroup = overviewSvg.append('g').style('pointer-events', 'none');
  const selectedLabelBg = selectedLabelGroup.append('rect')
    .attr('rx', 4).attr('ry', 4).attr('fill', '#FFFFFF').attr('stroke', '#DCE3E1').attr('stroke-width', 1);
  const selectedLabel = selectedLabelGroup.append('text')
    .attr('text-anchor', 'middle')
    .style('font-size', '11px').style('font-family', 'monospace').style('font-weight', '600').style('fill', '#1E2E2B');

  function computeBeeswarm(points) {
    const simulation = d3.forceSimulation(points)
      .force('x', d3.forceX(d => overviewScale(d.risk)).strength(1))
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
      const exposurePct = computeExposurePct(name);
      const risk = computeRiskScore(name);
      return { name, rate: rateMmYear, exposurePct, risk, statusKey: getStatusKey(risk, SEUIL_AGGRAVE, SEUIL_SEVERE) };
    });

    const nAggrave = rows.filter(d => d.statusKey !== 'normal').length;
    document.getElementById('oedeme-overview-sub').textContent =
      `${nAggrave} pays sur ${rows.length} au-dessus du seuil de risque "aggravé" (vitesse × exposition de la population). Survolez ou cliquez un point.`;

    const data = computeBeeswarm(rows.map(d => ({ ...d, x: overviewScale(d.risk), y: LINE_Y })));
    const circles = pointsLayer.selectAll('circle').data(data, d => d.name);

    const circlesEnter = circles.enter().append('circle')
      .attr('r', 5).style('cursor', 'pointer')
      .on('click', (event, d) => { setCurrentPatient(d.name); });
    circlesEnter.append('title');

    const circlesMerged = circlesEnter.merge(circles);
    circlesMerged.select('title')
      .text(d => `${d.name} : ${d.rate.toFixed(2)} mm/an × ${d.exposurePct}% de la population < 10m = risque ${d.risk.toFixed(2)}`);

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
    const exposurePct = computeExposurePct(name);
    const riskScore = computeRiskScore(name);
    const statusKey = getStatusKey(riskScore, SEUIL_AGGRAVE, SEUIL_SEVERE);
    const colors = STATUS_COLORS[statusKey];

    if (headerSeaLevel) {
      headerSeaLevel.textContent = (rateMmYear >= 0 ? '+' : '') + rateMmYear.toFixed(1) + ' mm/an';
    }

    lastPatientLevelY = levelY(rateMmYear);
    lastPatientColor = WATER_COLORS[statusKey];
    applyPanelVisual(patientPanel, lastPatientLevelY, lastPatientColor, false);

    lastPatientStatusKey = statusKey;
    applyPatientBadge(STATUS_LABELS_OEDEME[statusKey], colors, false);

    document.getElementById('oedeme-value-label').textContent = (rateMmYear >= 0 ? '+' : '') + rateMmYear.toFixed(2) + ' mm/an';
    document.getElementById('oedeme-value-label').style.color = colors.fill;
    applyReadoutBadge(false);

    document.getElementById('oedeme-seuils-label').textContent =
      `${exposurePct}% de la population vit sous 10 m d'altitude · score de risque ${riskScore.toFixed(2)} (seuil aggravé ${SEUIL_AGGRAVE.toFixed(2)} · seuil sévère ${SEUIL_SEVERE.toFixed(2)})`;
    document.getElementById('oedeme-cumul-label').textContent =
      `Depuis 1993, la mer a déjà gagné ${cumulMm >= 0 ? '+' : ''}${(cumulMm / 10).toFixed(1)} cm à cet endroit, contre ${(globalCumulMm / 10).toFixed(1)} cm en moyenne dans le monde sur la même période.`;

    renderRiskIndicator(riskScore, colors.fill);

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
    yAxisG.call(d3.axisLeft(yScale).ticks(4).tickFormat(d => (d >= 0 ? '+' : '') + (d / 10).toFixed(0) + 'cm'));

    renderOverview();
  }

  document.addEventListener('patientchange', render);
  render();
})();
