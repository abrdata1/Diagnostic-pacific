// act-03-lesions.js
// Acte 03 · Lésions cutanées - évolution du trait de côte.
//
// MÉTHODOLOGIE : comme pour la Liste rouge, il n'existe pas de seuil
// international publié pour un taux de recul côtier critique. Le statut
// compare donc le taux médian de chaque pays à la distribution des 21 pays
// du Pacifique (moyenne ± écart-type), la médiane étant préférée à la
// moyenne car quelques points extrêmes (travaux portuaires, remblaiement)
// faussent fortement la moyenne sans refléter une tendance côtière réelle.
//
// Visuel : deux vues façon dermatoscope - la "peau" (le littoral encore
// intact) rétrécit si le pays est en érosion nette, ou grandit s'il est en
// accrétion nette, par rapport à un état de référence fixe. Le contour est
// volontairement irrégulier ("craquelé"), pas un cercle lisse. La vue "il y
// a ~25 ans" est une référence stylisée fixe (pas une reconstruction
// historique précise par pays) ; la vue "aujourd'hui" reflète le vrai taux
// médian DIRECTIONNEL du pays - pas seulement la part de points en recul,
// qui ne dit rien du sens global de l'évolution (voir renderAfterPanel).
//
// Dépend de : d3 (CDN), data/coastline-data.js (COASTLINE_DATA),
// js/patient-state.js (getCurrentPatient, setCurrentPatient),
// js/utils.js (getStatusKey, STATUS_COLORS).

(function () {
  const countryNames = Object.keys(COASTLINE_DATA);
  const STATUS_LABELS_LESIONS = { normal: 'modéré', febrile: 'aggravé', critique: 'sévère' };

  // Seuils : moyenne - écart-type / moyenne - 2 écarts-types sur le taux
  // médian des 21 pays. Un taux BAS (recul) est grave, pas un taux haut -
  // même inversion de signe que pour l'acte 04.
  const allRates = countryNames.map(n => COASTLINE_DATA[n].rateMedianMYear);
  const RATE_MEAN = d3.mean(allRates);
  const RATE_SD = d3.deviation(allRates);
  const SEUIL_AGGRAVE = RATE_MEAN - RATE_SD;
  const SEUIL_SEVERE = RATE_MEAN - 2 * RATE_SD;

  function getLesionStatus(rate) {
    return getStatusKey(-rate, -SEUIL_AGGRAVE, -SEUIL_SEVERE);
  }

  // --- Vues dermatoscope : peau qui rétrécit, marge abîmée qui s'élargit ---
  const FRAME_R = 60, CX = 70, CY = 70;
  const BEFORE_SKIN_R = 52, BEFORE_JAG = 6, BEFORE_CRACKS = 3;

  // Échelle DIRECTIONNELLE : un taux à 0 garde la peau à sa taille de
  // référence, un taux négatif (érosion) la fait rétrécir, un taux positif
  // (accrétion) la fait grandir - contrairement à une échelle basée sur le
  // % de points en recul, qui rétrécissait la peau même pour un pays en
  // accrétion nette (bug corrigé ici).
  const rateExtentForRadius = d3.extent(allRates);
  const afterRadiusScale = d3.scaleLinear()
    .domain([rateExtentForRadius[0], 0, rateExtentForRadius[1]])
    .range([18, BEFORE_SKIN_R, FRAME_R - 2])
    .clamp(true);
  const maxAbsRate = Math.max(Math.abs(rateExtentForRadius[0]), Math.abs(rateExtentForRadius[1]));

  function jaggedPath(cx, cy, baseR, jag, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = baseR + (Math.random() - 0.5) * jag;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let j = 1; j < pts.length; j++) d += ` L${pts[j][0].toFixed(1)},${pts[j][1].toFixed(1)}`;
    d += ' Z';
    return { d, pts };
  }

  function crackLinesD(cx, cy, pts, count) {
    let d = '';
    for (let k = 0; k < count; k++) {
      const p = pts[Math.floor(Math.random() * pts.length)];
      const midx = cx + (p[0] - cx) * 0.55;
      const midy = cy + (p[1] - cy) * 0.55;
      d += `M${p[0].toFixed(1)},${p[1].toFixed(1)} L${midx.toFixed(1)},${midy.toFixed(1)} `;
    }
    return d;
  }

  function drawFrame(svgId) {
    const svg = d3.select(`#${svgId}`);
    svg.selectAll('*').remove();
    const ring = svg.append('circle').attr('cx', CX).attr('cy', CY).attr('r', FRAME_R);
    const skin = svg.append('path').attr('fill', '#F3DFCB');
    const cracks = svg.append('path').attr('stroke', '#C9A87E').attr('stroke-width', 1).attr('fill', 'none').attr('opacity', 0.65);
    svg.append('circle').attr('cx', CX).attr('cy', CY).attr('r', FRAME_R)
      .attr('fill', 'none').attr('stroke', '#1E2E2B').attr('stroke-width', 2.5);
    return { ring, skin, cracks };
  }

  function renderPanel(panel, skinR, jag, crackCount, ringColor) {
    panel.ring.attr('fill', ringColor).attr('opacity', 0.85);
    const shape = jaggedPath(CX, CY, skinR, jag, 22);
    panel.skin.attr('d', shape.d);
    panel.cracks.attr('d', crackLinesD(CX, CY, shape.pts, crackCount));
  }

  const beforePanel = drawFrame('lesions-before-svg');
  const afterPanel = drawFrame('lesions-after-svg');
  // Petit manche de dermatoscope, uniquement sur la vue "aujourd'hui"
  d3.select('#lesions-after-svg').append('rect')
    .attr('x', 112).attr('y', 18).attr('width', 14).attr('height', 4)
    .attr('fill', '#1E2E2B').attr('transform', 'rotate(45 119 20)');

  renderPanel(beforePanel, BEFORE_SKIN_R, BEFORE_JAG, BEFORE_CRACKS, STATUS_COLORS.normal.fill);

  // --- Vue d'ensemble ---
  const overviewSvg = d3.select('#lesions-overview-svg');
  const OV_W = 600, OV_H = 110;
  overviewSvg.attr('viewBox', `0 0 ${OV_W} ${OV_H}`);
  const rateExtent = d3.extent(allRates);
  const SCALE_PAD = (rateExtent[1] - rateExtent[0]) * 0.15;
  const overviewScale = d3.scaleLinear()
    .domain([rateExtent[0] - SCALE_PAD, rateExtent[1] + SCALE_PAD]).range([50, 550]);
  const LINE_Y = 55;
  const SWARM_Y_MIN = 28, SWARM_Y_MAX = 82;

  overviewSvg.append('line')
    .attr('x1', 50).attr('x2', 550).attr('y1', LINE_Y).attr('y2', LINE_Y).attr('stroke', '#B4B2A9');

  [[SEUIL_AGGRAVE, 'seuil aggravé'], [SEUIL_SEVERE, 'seuil sévère']].forEach(([val, label]) => {
    const x = overviewScale(val);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 30).attr('y2', LINE_Y + 30)
      .attr('stroke', '#B4B2A9').attr('stroke-dasharray', '2 2');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y - 34).attr('text-anchor', 'middle')
      .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#8D9A96')
      .text(label);
  });

  const overviewTicks = d3.scaleLinear().domain(overviewScale.domain()).ticks(5);
  overviewTicks.forEach(v => {
    const x = overviewScale(v);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 7).attr('y2', LINE_Y + 7)
      .attr('stroke', '#8D9A96');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y + 37).attr('text-anchor', 'middle')
      .style('font-size', '10px').style('font-family', 'monospace').style('fill', '#5B6C68')
      .text((v >= 0 ? '+' : '') + v.toFixed(2));
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
      const rate = COASTLINE_DATA[name].rateMedianMYear;
      return { name, rate, statusKey: getLesionStatus(rate) };
    });

    const nAggrave = rows.filter(d => d.statusKey !== 'normal').length;
    document.getElementById('lesions-overview-sub').textContent =
      `${nAggrave} pays sur ${rows.length} sous le seuil "aggravé". Survolez ou cliquez un point.`;

    const data = computeBeeswarm(rows.map(d => ({ ...d, x: overviewScale(d.rate), y: LINE_Y })));
    const circles = pointsLayer.selectAll('circle').data(data, d => d.name);

    const circlesEnter = circles.enter().append('circle')
      .attr('r', 5).style('cursor', 'pointer')
      .on('click', (event, d) => { setCurrentPatient(d.name); });
    circlesEnter.append('title');

    const circlesMerged = circlesEnter.merge(circles);
    circlesMerged.select('title')
      .text(d => `${d.name} : ${d.rate >= 0 ? '+' : ''}${d.rate.toFixed(2)} m/an`);

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
    const patientNameEl = document.getElementById('lesions-patient-name');
    if (patientNameEl) patientNameEl.textContent = name;

    const d = COASTLINE_DATA[name];
    if (!d) return;

    const statusKey = getLesionStatus(d.rateMedianMYear);
    const colors = STATUS_COLORS[statusKey];

    document.getElementById('lesions-before-label').textContent = `il y a ~${d.typicalSpanYears} ans`;

    const afterSkinR = afterRadiusScale(d.rateMedianMYear);
    const changeIntensity = Math.min(1, Math.abs(d.rateMedianMYear) / maxAbsRate);
    const afterJag = 6 + changeIntensity * 14;
    const afterCracks = 3 + Math.round(changeIntensity * 10);
    renderPanel(afterPanel, afterSkinR, afterJag, afterCracks, colors.fill);

    if (d.nsmMedianM !== null) {
      document.getElementById('lesions-value-label').textContent =
        (d.nsmMedianM >= 0 ? '+' : '') + d.nsmMedianM.toFixed(2) + ' m';
      document.getElementById('lesions-value-label').style.color = colors.fill;
      document.getElementById('lesions-detail-label').textContent =
        `Mouvement net du trait de côte depuis le premier relevé (~${d.typicalSpanYears} ans) · taux médian ${(d.rateMedianMYear >= 0 ? '+' : '')}${d.rateMedianMYear.toFixed(3)} m/an · ${d.pctErosion}% des points en recul · ${d.n.toLocaleString('fr-FR')} points mesurés`;
    } else {
      document.getElementById('lesions-value-label').textContent =
        (d.rateMedianMYear >= 0 ? '+' : '') + d.rateMedianMYear.toFixed(3) + ' m/an';
      document.getElementById('lesions-value-label').style.color = colors.fill;
      document.getElementById('lesions-detail-label').textContent =
        `Mouvement net (NSM) non disponible pour ce pays dans les données sources · ${d.pctErosion}% des points en recul · ${d.n.toLocaleString('fr-FR')} points mesurés`;
    }

    const badge = document.getElementById('lesions-status-badge');
    badge.textContent = STATUS_LABELS_LESIONS[statusKey];
    badge.style.background = colors.bg;
    badge.style.color = colors.fill;

    renderOverview();
  }

  document.addEventListener('patientchange', render);
  render();
})();
