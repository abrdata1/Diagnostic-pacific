// act-05-traitement.js
// Acte 05 · Traitement - mesures préventives déjà en place.
//
// Contrairement aux actes précédents, celui-ci a un vrai seuil international
// pour l'une de ses deux composantes : la cible SDG 14.5 fixe un minimum de
// 10% de couverture d'aires marines protégées. L'autre composante (SDG
// 13.1.2, stratégie nationale de réduction des risques) est un simple
// oui/non. Le score combiné et le statut par pays sont précalculés dans
// data/protection-data.js (voir ce fichier pour le détail du calcul) plutôt
// que recalculés ici, puisqu'il n'y a pas de série temporelle à traiter.
//
// Dépend de : d3 (CDN), data/protection-data.js (PROTECTION_DATA),
// js/patient-state.js (getCurrentPatient, setCurrentPatient),
// js/utils.js (STATUS_COLORS).

(function () {
  const countryNames = Object.keys(PROTECTION_DATA);
  const STATUS_LABELS_TRAITEMENT = { normal: 'protégé', febrile: 'partiel', critique: 'non protégé' };
  const SEUIL_PROTEGE = 0.75, SEUIL_PARTIEL = 0.35;

  // --- Jauge circulaire : couverture d'aires marines protégées, avec un
  // repère à 10% (la cible officielle SDG 14.5) ---
  const mpaSvg = d3.select('#traitement-mpa-svg');
  const MPA_CX = 60, MPA_CY = 60, MPA_R = 46, MPA_STROKE = 11;
  const MPA_CIRC = 2 * Math.PI * MPA_R;

  mpaSvg.append('circle')
    .attr('cx', MPA_CX).attr('cy', MPA_CY).attr('r', MPA_R)
    .attr('fill', 'none').attr('stroke', '#DCE3E1').attr('stroke-width', MPA_STROKE);

  const mpaArc = mpaSvg.append('circle')
    .attr('cx', MPA_CX).attr('cy', MPA_CY).attr('r', MPA_R)
    .attr('fill', 'none').attr('stroke-width', MPA_STROKE).attr('stroke-linecap', 'round')
    .attr('transform', `rotate(-90 ${MPA_CX} ${MPA_CY})`);

  // Repère à 10% (cible SDG 14.5)
  const targetAngle = (10 / 100) * 360 - 90;
  const targetRad = targetAngle * Math.PI / 180;
  mpaSvg.append('line')
    .attr('x1', MPA_CX + Math.cos(targetRad) * (MPA_R - MPA_STROKE / 2 - 2))
    .attr('y1', MPA_CY + Math.sin(targetRad) * (MPA_R - MPA_STROKE / 2 - 2))
    .attr('x2', MPA_CX + Math.cos(targetRad) * (MPA_R + MPA_STROKE / 2 + 2))
    .attr('y2', MPA_CY + Math.sin(targetRad) * (MPA_R + MPA_STROKE / 2 + 2))
    .attr('stroke', '#1E2E2B').attr('stroke-width', 1.5);

  const mpaCenterText = mpaSvg.append('text')
    .attr('x', MPA_CX).attr('y', MPA_CY + 5).attr('text-anchor', 'middle')
    .style('font-size', '18px').style('font-family', 'monospace').style('font-weight', '600');

  function renderMpaGauge(pct, color) {
    const capped = Math.max(0, Math.min(100, pct));
    const offset = MPA_CIRC * (1 - capped / 100);
    mpaArc.attr('stroke', color)
      .transition().duration(500)
      .attr('stroke-dasharray', `${MPA_CIRC} ${MPA_CIRC}`)
      .attr('stroke-dashoffset', offset);
    mpaCenterText.text(pct.toFixed(1) + '%').style('fill', color);
  }

  // --- Vue d'ensemble : positionnée par score combiné, 0 (mauvais) à droite
  // et 1 (bon) à gauche - même convention que les autres actes, où "plus à
  // droite" signale toujours davantage de préoccupation. ---
  const overviewSvg = d3.select('#traitement-overview-svg');
  const OV_W = 600, OV_H = 110;
  overviewSvg.attr('viewBox', `0 0 ${OV_W} ${OV_H}`);
  const overviewScale = d3.scaleLinear().domain([0, 1]).range([550, 50]);
  const LINE_Y = 55;
  const SWARM_Y_MIN = 28, SWARM_Y_MAX = 82;

  overviewSvg.append('line')
    .attr('x1', 50).attr('x2', 550).attr('y1', LINE_Y).attr('y2', LINE_Y).attr('stroke', '#B4B2A9');

  [[SEUIL_PROTEGE, 'seuil protégé'], [SEUIL_PARTIEL, 'seuil partiel']].forEach(([val, label]) => {
    const x = overviewScale(val);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 30).attr('y2', LINE_Y + 30)
      .attr('stroke', '#B4B2A9').attr('stroke-dasharray', '2 2');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y - 34).attr('text-anchor', 'middle')
      .style('font-size', '9px').style('font-family', 'monospace').style('fill', '#8D9A96')
      .text(label);
  });

  [0, 0.25, 0.5, 0.75, 1].forEach(v => {
    const x = overviewScale(v);
    overviewSvg.append('line')
      .attr('x1', x).attr('x2', x).attr('y1', LINE_Y - 7).attr('y2', LINE_Y + 7)
      .attr('stroke', '#8D9A96');
    overviewSvg.append('text')
      .attr('x', x).attr('y', LINE_Y + 37).attr('text-anchor', 'middle')
      .style('font-size', '10px').style('font-family', 'monospace').style('fill', '#5B6C68')
      .text(v.toFixed(2));
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
      .force('x', d3.forceX(d => overviewScale(d.score)).strength(1))
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
    const rows = countryNames.map(name => ({ name, ...PROTECTION_DATA[name] }));

    const nProtege = rows.filter(d => d.status === 'normal').length;
    document.getElementById('traitement-overview-sub').textContent =
      `${nProtege} pays sur ${rows.length} atteignent la cible de protection. Survolez ou cliquez un point.`;

    const data = computeBeeswarm(rows.map(d => ({ ...d, x: overviewScale(d.score), y: LINE_Y })));
    const circles = pointsLayer.selectAll('circle').data(data, d => d.name);

    const circlesEnter = circles.enter().append('circle')
      .attr('r', 5).style('cursor', 'pointer')
      .on('click', (event, d) => { setCurrentPatient(d.name); });
    circlesEnter.append('title');

    const circlesMerged = circlesEnter.merge(circles);
    circlesMerged.select('title')
      .text(d => `${d.name} : ${d.mpaPct}% protégé, stratégie Sendai ${d.drr === true ? 'oui' : d.drr === false ? 'non' : 'n/a'}`);

    circlesMerged.transition().duration(300)
      .attr('cx', d => d.x).attr('cy', d => d.y)
      .attr('fill', d => STATUS_COLORS[d.status].fill)
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
    const patientNameEl = document.getElementById('traitement-patient-name');
    if (patientNameEl) patientNameEl.textContent = name;

    const d = PROTECTION_DATA[name];
    if (!d) return;

    const colors = STATUS_COLORS[d.status];

    renderMpaGauge(d.mpaPct, colors.fill);
    document.getElementById('traitement-mpa-label').textContent = d.mpaPct.toFixed(1) + '% de la ZEE';
    document.getElementById('traitement-mpa-label').style.color = colors.fill;

    const drrEl = document.getElementById('traitement-drr-label');
    if (d.drr === true) {
      drrEl.textContent = '✓ en place';
      drrEl.style.color = STATUS_COLORS.normal.fill;
    } else if (d.drr === false) {
      drrEl.textContent = '✗ absente';
      drrEl.style.color = STATUS_COLORS.critique.fill;
    } else {
      drrEl.textContent = 'non applicable (territoire non autonome)';
      drrEl.style.color = 'var(--clinic-ink2)';
    }

    const badge = document.getElementById('traitement-status-badge');
    badge.textContent = STATUS_LABELS_TRAITEMENT[d.status];
    badge.style.background = colors.bg;
    badge.style.color = colors.fill;

    document.getElementById('traitement-detail-label').textContent =
      `Score de protection combiné : ${d.score.toFixed(2)} sur 1 (seuil protégé ${SEUIL_PROTEGE} · seuil partiel ${SEUIL_PARTIEL})`;

    renderOverview();
  }

  document.addEventListener('patientchange', render);
  render();
})();
