(function () {
  const invoke =
    window.__TAURI__?.core?.invoke ||
    window.__TAURI_INTERNALS__?.invoke;

  let season = null;
  let dashboard = null;
  let simOutput = null;
  let simView = 'drivers';
  let evoView = 'drivers';

  let customSeason = null;
  let customDashboard = null;
  let customSim = null;

  let activeTarget = { kind: 'driver', id: '' };
  let pendingApiRaces = null;
  let toastTimer = null;

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3500);
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach((btn) =>
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab)
    );
    document.querySelectorAll('.tab-panel').forEach((sec) =>
      sec.classList.toggle('active', sec.id === `tab-${tab}`)
    );
  }

  let activeSubtab = 'drivers';

  function switchSubtab(subtab) {
    activeSubtab = subtab;
    document.querySelectorAll('[data-subtab]').forEach((btn) =>
      btn.classList.toggle('active', btn.getAttribute('data-subtab') === subtab)
    );
    document.querySelectorAll('#tab-standings .subview').forEach((sec) =>
      sec.classList.toggle('active', sec.id === `subview-${subtab}`)
    );
    if (dashboard) renderSidebarAndKpis();
  }

  async function refreshAll(runSim = true) {
    dashboard = await invoke('compute_dashboard', { state: season });
    if (runSim) {
      const iterations = Number(document.getElementById('selectIterations')?.value || 15000);
      const formWeight = Number(document.getElementById('rangeForm').value) / 100;
      const chaos = Number(document.getElementById('rangeChaos').value) / 100;
      simOutput = await invoke('run_simulation', {
        state: season,
        iterations,
        formWeight,
        chaos
      });
    }
    renderSidebarAndKpis();
    renderTables();
    renderEvolutionChart();
    renderDetailedSimulator();
    renderCalendar();
  }

  function renderSidebarAndKpis() {
    const { pool, drivers, teams } = dashboard;
    const pct = pool.totalRaces > 0 ? Math.round((pool.completedRaces / pool.totalRaces) * 100) : 0;

    document.getElementById('sidebarSeasonTag').textContent =
      `TEMPORADA ${season.meta.seasonYear || '2026'}`;
    document.getElementById('sidebarChampName').textContent =
      season.meta.championshipName || 'Campeonato Mundial';
    document.getElementById('sidebarProgressText').textContent =
      `${pool.completedRaces} de ${pool.totalRaces} fechas disputadas`;
    document.getElementById('sidebarProgressPct').textContent = `${pct}%`;
    document.getElementById('sidebarProgressFill').style.width = `${pct}%`;

    document.getElementById('kpiRacesPill').textContent = `${pool.completedRaces}/${pool.totalRaces} Fechas`;
    document.getElementById('kpiTotalPool').textContent = `${Math.round(pool.totalPool)} pts`;
    document.getElementById('kpiRemainingSub').innerHTML =
      `${Math.round(pool.distributedPoints)} ya repartidos &bull; <strong>${Math.round(pool.remainingPoints)} pts en juego</strong>`;

    document.getElementById('kpiPendingPill').textContent = `${pool.pendingRaces} pendientes`;

    if (activeSubtab === 'teams' && teams.length > 0) {
      const teamRem = Math.max(0, Math.round(teams[0].maxPossible - teams[0].points));
      const teamContenders = teams.filter((t) => t.inContention).length;
      const leader = teams[0];
      const second = teams[1];
      const gap = second ? leader.points - second.points : 0;

      document.getElementById('kpiMaxLabel').textContent = 'MÁXIMO RESTANTE PARA 1 ESCUDERÍA';
      document.getElementById('kpiMaxDriver').textContent = `${teamRem} pts`;
      document.getElementById('kpiContendersPill').textContent = `${teamContenders} de ${teams.length}`;
      document.getElementById('kpiContenders').textContent =
        `${teamContenders} ${teamContenders === 1 ? 'escudería' : 'escuderías'}`;
      document.getElementById('kpiContendersSub').textContent =
        teamContenders === 1 ? 'Título de constructores definido' : 'Aún pueden alcanzar al líder';
      document.getElementById('kpiGapPill').textContent = second ? `+${gap} pts sobre ${second.shortName}` : 'Líder';
      document.getElementById('kpiLeader').textContent = `${leader.name} (${leader.points} pts)`;
      document.getElementById('kpiLeaderSub').textContent =
        teamContenders === 1
          ? `¡${leader.name} ya es Campeón de Constructores!`
          : second
            ? `Ventaja de ${gap} pts sobre ${second.name}`
            : 'Sin perseguidores';
    } else {
      document.getElementById('kpiMaxLabel').textContent = 'MÁXIMO RESTANTE PARA 1 PILOTO';
      document.getElementById('kpiMaxDriver').textContent = `${Math.round(pool.maxDriverRemaining)} pts`;
      document.getElementById('kpiContendersPill').textContent = `${pool.contendersCount} de ${drivers.length}`;
      document.getElementById('kpiContenders').textContent =
        `${pool.contendersCount} ${pool.contendersCount === 1 ? 'piloto' : 'pilotos'}`;
      document.getElementById('kpiContendersSub').textContent =
        pool.contendersCount === 1 ? 'Título ya definido matemáticamente' : 'Aún pueden alcanzar al líder';

      const leader = drivers[0];
      const second = drivers[1];
      if (leader) {
        const gap = second ? leader.points - second.points : 0;
        document.getElementById('kpiGapPill').textContent = second ? `+${gap} pts sobre ${second.code}` : 'Líder';
        document.getElementById('kpiLeader').textContent = `${leader.name} (${leader.points} pts)`;
        document.getElementById('kpiLeaderSub').textContent =
          pool.contendersCount === 1
            ? `¡${leader.name} ya es Campeón Matemático!`
            : second
              ? `Ventaja de ${gap} pts sobre ${second.name}`
              : 'Sin perseguidores';
      }
    }
  }

  function buildChanceButton(row, prob, kind) {
    const probs = prob?.positionProbs || [];
    let displayRank = row.rank;
    let displayPct = probs[Math.max(0, displayRank - 1)] ?? 0;

    if (probs.length > 0) {
      let bestVal = -1;
      for (let r = 1; r <= probs.length; r++) {
        if (probs[r - 1] > bestVal) {
          bestVal = probs[r - 1];
          displayRank = r;
          displayPct = bestVal;
        }
      }
    }

    const clamped = Math.max(0, Math.min(100, displayPct));
    const barColor =
      displayRank === 1 && clamped >= 99.9
        ? '#f59e0b'
        : clamped >= 65
          ? '#10b981'
          : clamped >= 30
            ? '#22d3ee'
            : '#e10600';

    let label;
    if (row.bestPossibleRank === 1 && clamped >= 99.9 && dashboard.pool.pendingRaces === 0) {
      label = '🏆 ¡Campeón!';
    } else if (
      row.bestPossibleRank === 1 &&
      row.rank === 1 &&
      dashboard.pool.contendersCount === 1 &&
      kind === 'driver'
    ) {
      label = '🏆 ¡Campeón Consagrado! (1° • 100%)';
    } else if (row.bestPossibleRank === displayRank) {
      label = `🎯 Puesto ${displayRank}° • ${clamped.toFixed(1)}%`;
    } else {
      label = `🎯 Proyección ${displayRank}° (${clamped.toFixed(1)}%) • Techo ${row.bestPossibleRank}°`;
    }

    return `
      <button type="button" class="chance-btn" data-target-kind="${kind}" data-target-id="${esc(row.id)}">
        <div class="chance-top">
          <span>${label}</span>
          <span>🔍</span>
        </div>
        <div class="chance-track">
          <div class="chance-fill" style="width:${clamped.toFixed(1)}%; background:${barColor}"></div>
        </div>
      </button>
    `;
  }

  function renderTables() {
    const dCount = dashboard.drivers.length;
    const dProb = simOutput?.drivers || {};
    document.getElementById('driversBody').innerHTML = dashboard.drivers
      .map((row) => {
        const posClass = row.rank <= 3 ? `pos-${row.rank}` : '';
        const range = row.bestPossibleRank === dCount ? `${row.bestPossibleRank}°` : `${row.bestPossibleRank}° – ${dCount}°`;
        return `
          <tr>
            <td>
              <div class="entity-cell">
                <span class="pos-badge ${posClass}">${row.rank}</span>
                <span class="team-bar" style="background:${esc(row.teamColor)}"></span>
                <div>
                  <div class="entity-name">${esc(row.name)}<span class="driver-num">#${row.number}</span><span class="driver-num">RAT ${Math.round(row.skillRating)}</span></div>
                  <div class="entity-sub">${esc(row.teamName)} • ${esc(row.code)}</div>
                </div>
              </div>
            </td>
            <td class="num"><span class="points-pill">${row.points} pts</span></td>
            <td class="num">${row.gapToLeader === 0 ? 'Líder' : `-${row.gapToLeader} pts`}</td>
            <td class="num"><strong>${row.maxPossible} pts</strong></td>
            <td class="num">${range}</td>
            <td class="num">${row.wins} 🏆 / ${row.podiums}</td>
            <td>${buildChanceButton(row, dProb[row.id], 'driver')}</td>
          </tr>
        `;
      })
      .join('');

    const tCount = dashboard.teams.length;
    const tProb = simOutput?.teams || {};
    document.getElementById('teamsBody').innerHTML = dashboard.teams
      .map((row) => {
        const posClass = row.rank <= 3 ? `pos-${row.rank}` : '';
        const range = `${row.bestPossibleRank}° – ${tCount}°`;
        return `
          <tr>
            <td>
              <div class="entity-cell">
                <span class="pos-badge ${posClass}">${row.rank}</span>
                <span class="team-bar" style="background:${esc(row.color)}"></span>
                <div>
                  <div class="entity-name">${esc(row.name)}</div>
                  <div class="entity-sub">${esc(row.shortName)}</div>
                </div>
              </div>
            </td>
            <td class="num"><span class="points-pill">${row.points} pts</span></td>
            <td class="num">${row.gapToLeader === 0 ? 'Líder' : `-${row.gapToLeader} pts`}</td>
            <td class="num"><strong>${row.maxPossible} pts</strong></td>
            <td class="num">${range}</td>
            <td class="num">${row.wins} 🏆 / ${row.podiums}</td>
            <td>${buildChanceButton(row, tProb[row.id], 'team')}</td>
          </tr>
        `;
      })
      .join('');
  }

  function renderEvolutionChart() {
    const container = document.getElementById('evolutionChart');
    const legend = document.getElementById('chartLegend');
    const labels = dashboard.roundLabels || [];
    const series =
      evoView === 'teams'
        ? (dashboard.teamProgression || [])
        : (dashboard.progression || []);

    if (!labels.length || !series.length) {
      legend.innerHTML = '';
      container.innerHTML = '<p class="hint">Aún no hay fechas disputadas para graficar.</p>';
      return;
    }

    legend.innerHTML = series
      .map(
        (s) =>
          `<span class="legend-item"><span class="legend-swatch" style="background:${esc(s.color)}"></span>${esc(s.code)}</span>`
      )
      .join('');

    const w = 960;
    const h = 280;
    const padL = 44;
    const padR = 20;
    const padT = 16;
    const padB = 28;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const maxPts = Math.max(10, ...series.flatMap((s) => s.pointsByRound || [0]));

    const xAt = (idx) =>
      labels.length === 1 ? padL + innerW / 2 : padL + (idx / (labels.length - 1)) * innerW;
    const yAt = (pts) => padT + innerH - (pts / maxPts) * innerH;

    const gridLines = [0, 0.25, 0.5, 0.75, 1]
      .map((frac) => {
        const val = Math.round(maxPts * frac);
        const y = yAt(val);
        return `
          <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#2b2b36" stroke-width="1" />
          <text x="${padL - 8}" y="${y + 4}" fill="#94a3b8" font-size="11" text-anchor="end">${val}</text>
        `;
      })
      .join('');

    const xLabels = labels
      .map((lbl, idx) => {
        if (labels.length > 14 && idx % 2 !== 0 && idx !== labels.length - 1) return '';
        return `<text x="${xAt(idx)}" y="${h - 6}" fill="#94a3b8" font-size="11" text-anchor="middle">${esc(lbl)}</text>`;
      })
      .join('');

    const lines = series
      .map((s) => {
        const pts = (s.pointsByRound || [])
          .map((v, idx) => `${xAt(idx).toFixed(1)},${yAt(v).toFixed(1)}`)
          .join(' ');
        const lastIdx = (s.pointsByRound || []).length - 1;
        const lastVal = s.pointsByRound?.[lastIdx] ?? 0;
        return `
          <polyline fill="none" stroke="${esc(s.color)}" stroke-width="2.5" points="${pts}" />
          <circle cx="${xAt(lastIdx).toFixed(1)}" cy="${yAt(lastVal).toFixed(1)}" r="3.5" fill="${esc(s.color)}" />
        `;
      })
      .join('');

    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución de puntos">${gridLines}${xLabels}${lines}</svg>`;
  }

  function renderDetailedSimulator() {
    if (!simOutput) return;
    const isDrivers = simView === 'drivers';
    const rows = isDrivers ? dashboard.drivers : dashboard.teams;
    const probMap = isDrivers ? simOutput.drivers : simOutput.teams;

    document.getElementById('simTableTitle').textContent = isDrivers
      ? 'Proyección Final de Puntos y Probabilidades por Piloto'
      : 'Proyección Final de Puntos y Probabilidades por Escudería';
    document.getElementById('simSubtitle').textContent =
      `Basado en ${simOutput.iterations.toLocaleString('es-CL')} escenarios de las ${dashboard.pool.pendingRaces} fecha(s) pendiente(s)`;

    const sorted = [...rows].sort(
      (a, b) => (probMap[b.id]?.titlePct || 0) - (probMap[a.id]?.titlePct || 0) || b.points - a.points
    );

    document.getElementById('candidatesGrid').innerHTML = sorted
      .slice(0, 4)
      .map((r) => {
        const p = probMap[r.id];
        const color = isDrivers ? r.teamColor : r.color;
        const bestIdx = Math.max(0, r.bestPossibleRank - 1);
        const bestPct = p?.positionProbs?.[bestIdx] ?? p?.titlePct ?? 0;
        return `
          <article class="candidate-card" style="border-top-color:${esc(color)}">
            <div class="candidate-top">
              <div>
                <strong>${esc(r.name)}</strong>
                <div class="candidate-meta">Actual: ${r.points} pts (${r.rank}°)</div>
              </div>
              <span class="candidate-pct">${bestPct.toFixed(1)}%</span>
            </div>
            <div class="chance-track">
              <div class="chance-fill" style="width:${Math.min(100, bestPct).toFixed(1)}%; background:${esc(color)}"></div>
            </div>
            <div class="candidate-meta">
              Proyección: ~${p ? Math.round(p.avgPoints) : r.points} pts &bull; Top 3: ${p ? p.podiumPct.toFixed(1) : '0.0'}%
            </div>
          </article>
        `;
      })
      .join('');

    const maxCols = Math.min(10, rows.length);
    document.getElementById('matrixHead').innerHTML = `
      <tr>
        <th>${isDrivers ? 'Piloto' : 'Escudería'}</th>
        <th class="num">Pts Actuales</th>
        <th class="num">Pts Esperados</th>
        <th class="num">Título %</th>
        ${Array.from({ length: maxCols }, (_, i) => `<th class="num">#${i + 1}</th>`).join('')}
      </tr>
    `;

    document.getElementById('matrixBody').innerHTML = sorted
      .map((r) => {
        const p = probMap[r.id];
        const probs = p?.positionProbs || [];
        const color = isDrivers ? r.teamColor : r.color;
        const cells = Array.from({ length: maxCols }, (_, i) => {
          const val = probs[i] || 0;
          const alpha = Math.min(0.65, val / 100);
          const bg = val >= 0.5 ? `rgba(225, 6, 0, ${alpha.toFixed(2)})` : 'transparent';
          return `<td class="heat" style="background:${bg}">${val >= 0.1 ? `${val.toFixed(1)}%` : '—'}</td>`;
        }).join('');

        return `
          <tr>
            <td>
              <div class="entity-cell">
                <span class="team-bar" style="background:${esc(color)}"></span>
                <span class="entity-name">${esc(r.name)}</span>
              </div>
            </td>
            <td class="num">${r.points} pts</td>
            <td class="num"><strong>${p ? Math.round(p.avgPoints) : r.points} pts</strong></td>
            <td class="num"><strong>${p ? p.titlePct.toFixed(1) : '0.0'}%</strong></td>
            ${cells}
          </tr>
        `;
      })
      .join('');
  }

  function renderCalendar() {
    const driverMap = new Map(season.drivers.map((d) => [d.id, d]));

    document.getElementById('calendarGrid').innerHTML = season.tracks
      .map((t) => {
        const order = t.results?.raceOrder || [];
        const p1 = order[0] ? driverMap.get(order[0]) : null;
        const p2 = order[1] ? driverMap.get(order[1]) : null;
        const p3 = order[2] ? driverMap.get(order[2]) : null;
        const fl = t.results?.fastestLapDriverId ? driverMap.get(t.results.fastestLapDriverId) : null;

        const statusBadge = t.completed
          ? '<span class="badge badge-live">Disputada</span>'
          : '<span class="badge">Pendiente</span>';
        const sprintTag = t.hasSprint ? '<span class="badge badge-sprint">Sprint</span>' : '';

        return `
          <article class="cal-card">
            <div class="cal-card-top">
              <span class="cal-round">FECHA ${t.round}</span>
              <div>${sprintTag} ${statusBadge}</div>
            </div>
            <div class="cal-name">${esc(t.name)}</div>
            <div class="cal-circuit">${esc(t.circuit || t.country)}</div>
            <div class="cal-podium">
              ${
                p1
                  ? `🥇 <strong>${esc(p1.name)}</strong><br/>🥈 ${esc(p2?.code || '—')} &bull; 🥉 ${esc(p3?.code || '—')}${fl ? `<br/>🟣 VR: ${esc(fl.code)} ${esc(t.results?.fastestLapTime || '')}` : ''}`
                  : 'Fecha pendiente por disputar'
              }
            </div>
            <div class="cal-footer">
              ${
                t.completed
                  ? `<button type="button" class="btn btn-primary btn-sm" data-view-race="${esc(t.id)}">Ver Resultados Detallados</button>`
                  : '<span class="badge">Por disputar</span>'
              }
            </div>
          </article>
        `;
      })
      .join('');
  }

  function openRaceDetailsModal(trackId) {
    const track = season.tracks.find((t) => t.id === trackId);
    if (!track || !track.completed) return;

    const driverMap = new Map(season.drivers.map((d) => [d.id, d]));
    const teamMap = new Map(season.teams.map((t) => [t.id, t]));
    const ps = season.pointsSystem;
    const mult = track.pointsMultiplier ?? 1;
    const order = track.results?.raceOrder || [];
    const times = track.results?.raceTimes || {};
    const statuses = track.results?.driverStatuses || {};
    const dnfSet = new Set(track.results?.dnfDriverIds || []);
    const flId = track.results?.fastestLapDriverId || '';
    const poleId = track.results?.poleDriverId || '';
    const sprintPtsByDriver = new Map();

    if (track.hasSprint && Array.isArray(track.results?.sprintOrder)) {
      track.results.sprintOrder.forEach((dId, idx) => {
        const sp = (ps.sprintPoints?.[idx] || 0) * mult;
        if (sp > 0) sprintPtsByDriver.set(dId, sp);
      });
    }

    const winner = order[0] ? driverMap.get(order[0]) : null;
    const poleDrv = poleId ? driverMap.get(poleId) : null;
    const flDrv = flId ? driverMap.get(flId) : null;

    document.getElementById('raceDetailMeta').textContent =
      `FECHA ${track.round} • ${track.circuit || track.country}`;
    document.getElementById('raceDetailTitle').textContent = track.name;

    const pills = [];
    if (winner) pills.push(`<div class="detail-pill">🏆 Ganador: <strong>${esc(winner.name)}</strong></div>`);
    if (poleDrv) pills.push(`<div class="detail-pill">⏱️ Pole: <strong>${esc(poleDrv.code)}</strong></div>`);
    if (flDrv) {
      pills.push(
        `<div class="detail-pill">🟣 Vuelta Rápida: <strong>${esc(flDrv.code)}</strong> ${esc(track.results?.fastestLapTime || '')}</div>`
      );
    }
    if (track.hasSprint && track.results?.sprintOrder?.[0]) {
      const spWin = driverMap.get(track.results.sprintOrder[0]);
      if (spWin) pills.push(`<div class="detail-pill">⚡ Sprint: <strong>${esc(spWin.code)}</strong></div>`);
    }
    document.getElementById('raceDetailHighlights').innerHTML = pills.join('');

    let posCounter = 0;
    document.getElementById('raceDetailBody').innerHTML = order
      .map((dId) => {
        const drv = driverMap.get(dId);
        if (!drv) return '';
        const tId = track.results?.driverTeams?.[dId] || drv.teamId;
        const tm = teamMap.get(tId);
        const status = statuses[dId];
        const isOut = status === 'DNF' || status === 'DNS' || status === 'DSQ' || dnfSet.has(dId);

        let pts = 0;
        let posLabel = status || 'DNF';
        if (!isOut) {
          pts += (ps.racePoints?.[posCounter] || 0) * mult;
          if (dId === flId && posCounter < (ps.fastestLapTopLimit || 10)) {
            pts += (ps.fastestLapPoints || 0) * mult;
          }
          posCounter++;
          posLabel = String(posCounter);
        }
        if (dId === poleId) pts += (ps.polePoints || 0) * mult;
        pts += sprintPtsByDriver.get(dId) || 0;

        const posClass = !isOut && posCounter <= 3 ? `pos-${posCounter}` : '';
        const delta = times[dId] || (isOut ? status || 'DNF' : '—');
        const flBadge = dId === flId ? '<span class="fl-tag">VR</span>' : '';

        return `
          <tr>
            <td><span class="pos-badge ${posClass}">${esc(posLabel)}</span></td>
            <td>
              <div class="entity-cell">
                <span class="team-bar" style="background:${esc(tm?.color || '#888')}"></span>
                <div>
                  <div class="entity-name">${esc(drv.name)}${flBadge}</div>
                  <div class="entity-sub">${esc(drv.code)} #${drv.number}</div>
                </div>
              </div>
            </td>
            <td>${esc(tm?.name || '—')}</td>
            <td class="num">${esc(delta)}</td>
            <td class="num"><span class="points-pill">${pts > 0 ? `+${pts}` : '0'}</span></td>
          </tr>
        `;
      })
      .join('');

    document.getElementById('dialogRaceDetails').showModal();
  }

  async function refreshCustom() {
    customDashboard = await invoke('compute_dashboard', { state: customSeason });
    customSim = await invoke('run_simulation', {
      state: customSeason,
      iterations: 8000,
      formWeight: 0.4,
      chaos: 0.35
    });
    renderCustomSection();
  }

  function renderCustomSection() {
    document.getElementById('customTitleHeading').textContent =
      customSeason.meta.championshipName || 'Liga Personalizada';
    document.getElementById('inputCustomName').value =
      customSeason.meta.championshipName || '';

    const teamMap = new Map(customSeason.teams.map((t) => [t.id, t]));
    document.getElementById('customDriversChips').innerHTML = customSeason.drivers
      .map((d) => {
        const tm = teamMap.get(d.teamId);
        return `
          <span class="driver-chip">
            <span class="team-bar" style="height:14px; background:${esc(tm?.color || '#e10600')}"></span>
            <strong>${esc(d.code)}</strong> ${esc(d.name)}
            <button type="button" data-del-custom-driver="${esc(d.id)}" title="Quitar piloto">✕</button>
          </span>
        `;
      })
      .join('');

    const selTrack = document.getElementById('selectCustomTrack');
    const prevTrack = selTrack.value;
    selTrack.innerHTML = customSeason.tracks
      .map(
        (t) =>
          `<option value="${esc(t.id)}">${t.round}. ${esc(t.name)} ${t.completed ? '(Disputada)' : '(Pendiente)'}</option>`
      )
      .join('');
    if (prevTrack && customSeason.tracks.some((t) => t.id === prevTrack)) {
      selTrack.value = prevTrack;
    }

    renderCustomTrackPositions();

    const probs = customSim?.drivers || {};
    document.getElementById('customStandingsMeta').textContent =
      `${customDashboard.pool.completedRaces} de ${customDashboard.pool.totalRaces} fechas disputadas • ${Math.round(customDashboard.pool.remainingPoints)} pts por repartir`;

    document.getElementById('customStandingsBody').innerHTML = customDashboard.drivers
      .map((row) => {
        const posClass = row.rank <= 3 ? `pos-${row.rank}` : '';
        const p = probs[row.id];
        return `
          <tr>
            <td>
              <div class="entity-cell">
                <span class="pos-badge ${posClass}">${row.rank}</span>
                <span class="team-bar" style="background:${esc(row.teamColor)}"></span>
                <div>
                  <div class="entity-name">${esc(row.name)}</div>
                  <div class="entity-sub">${esc(row.code)}</div>
                </div>
              </div>
            </td>
            <td class="num"><span class="points-pill">${row.points} pts</span></td>
            <td class="num">${row.gapToLeader === 0 ? 'Líder' : `-${row.gapToLeader} pts`}</td>
            <td class="num"><strong>${row.maxPossible} pts</strong></td>
            <td class="num">${row.wins} 🏆 / ${row.podiums}</td>
            <td class="num"><strong>${p ? p.titlePct.toFixed(1) : '0.0'}%</strong></td>
            <td><span class="badge ${row.inContention ? 'badge-live' : ''}">${esc(row.statusLabel)}</span></td>
          </tr>
        `;
      })
      .join('');
  }

  function renderCustomTrackPositions() {
    const trackId = document.getElementById('selectCustomTrack').value;
    const track = customSeason.tracks.find((t) => t.id === trackId);
    const container = document.getElementById('customPositions');
    const flSel = document.getElementById('selectCustomFl');

    if (!track) {
      container.innerHTML = '<p class="hint">Agrega una fecha para anotar resultados.</p>';
      flSel.innerHTML = '<option value="">Sin vuelta rápida</option>';
      return;
    }

    const opts = customSeason.drivers
      .map((d) => `<option value="${esc(d.id)}">${esc(d.code)} — ${esc(d.name)}</option>`)
      .join('');
    const existing = track.results?.raceOrder || [];

    container.innerHTML = customSeason.drivers
      .map(
        (_, idx) => `
          <div class="pos-row">
            <span class="pos-tag">P${idx + 1}</span>
            <select class="custom-pos-select" data-pos="${idx}">
              <option value="">— Elegir piloto —</option>
              ${opts}
            </select>
          </div>
        `
      )
      .join('');

    container.querySelectorAll('.custom-pos-select').forEach((sel, idx) => {
      if (existing[idx]) sel.value = existing[idx];
    });

    flSel.innerHTML = `<option value="">Vuelta rápida: Ninguna</option>${opts}`;
    if (track.results?.fastestLapDriverId) {
      flSel.value = track.results.fastestLapDriverId;
    }
  }

  async function openTargetDialog(kind, id, customRank = null) {
    activeTarget = { kind, id };
    const data = await invoke('analyze_target', {
      state: season,
      kind,
      entityId: id,
      targetRank: customRank
    });
    if (!data) return;

    document.getElementById('targetTitle').textContent =
      `${data.entityName} (Actual #${data.currentRank} • ${data.currentPoints} pts)`;
    document.getElementById('targetHeadline').textContent = data.headline;

    const totalEntities = kind === 'team' ? dashboard.teams.length : dashboard.drivers.length;
    const rankSel = document.getElementById('selectTargetRank');
    rankSel.innerHTML = '';
    for (let r = data.bestPossibleRank; r <= totalEntities; r++) {
      const opt = document.createElement('option');
      opt.value = String(r);
      opt.textContent = r === 1 ? '#1 (Campeón)' : `#${r}`;
      if (r === data.targetRank) opt.selected = true;
      rankSel.appendChild(opt);
    }

    document.getElementById('targetDetails').innerHTML = data.details
      .map((d) => `<li>${esc(d)}</li>`)
      .join('');

    document.getElementById('targetRivals').innerHTML = data.rivals
      .map(
        (r) => `
          <div class="rival-item">
            <strong>${esc(r.name)} (${r.points} pts &bull; máx ${r.maxPossible})</strong>
            <span>${esc(r.summary)}</span>
          </div>
        `
      )
      .join('');

    const dlg = document.getElementById('dialogTarget');
    if (!dlg.open) dlg.showModal();
  }

  async function fetchApiPaged(year, endpoint, listKey) {
    let offset = 0;
    let total = Infinity;
    const byRound = new Map();

    while (offset < total) {
      const url = `https://api.jolpi.ca/ergast/f1/${year}/${endpoint}.json?limit=100&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      total = Number(json?.MRData?.total || 0);
      const limit = Number(json?.MRData?.limit || 100);
      const races = json?.MRData?.RaceTable?.Races || [];

      for (const r of races) {
        const rnd = Number(r.round);
        const items = r[listKey] || [];
        if (!byRound.has(rnd)) {
          byRound.set(rnd, { ...r, [listKey]: [...items] });
        } else {
          byRound.get(rnd)[listKey].push(...items);
        }
      }

      offset += limit;
      if (!races.length) break;
    }

    return [...byRound.values()].sort((a, b) => Number(a.round) - Number(b.round));
  }

  async function fetchApiRaces() {
    const year = season.meta.seasonYear || '2026';
    const [races, sprints] = await Promise.all([
      fetchApiPaged(year, 'results', 'Results'),
      fetchApiPaged(year, 'sprint', 'SprintResults').catch(() => [])
    ]);
    const sprintByRound = new Map(sprints.map((s) => [Number(s.round), s.SprintResults || []]));
    return races.map((r) => ({
      ...r,
      SprintResults: sprintByRound.get(Number(r.round)) || []
    }));
  }

  async function applyApiRaces(races) {
    const driverByCode = new Map(season.drivers.map((d) => [d.code.toUpperCase(), d]));
    let updatedCount = 0;

    const mapOrder = (items) => {
      const order = [];
      const dnfs = [];
      const statuses = {};
      const times = {};
      let flId = '';
      let flTime = '';

      for (const item of items) {
        const code = String(item.Driver?.code || '').toUpperCase();
        const drv = driverByCode.get(code);
        if (!drv) continue;
        order.push(drv.id);
        times[drv.id] = item.Time?.time || item.status || '—';
        if (item.FastestLap?.rank === '1') {
          flId = drv.id;
          flTime = item.FastestLap?.Time?.time || '';
        }
        const posText = String(item.positionText || '');
        if (posText === 'R' || posText === 'W' || posText === 'D') {
          dnfs.push(drv.id);
          statuses[drv.id] = posText === 'W' ? 'DNS' : posText === 'D' ? 'DSQ' : 'DNF';
        }
      }
      return { order, dnfs, statuses, times, flId, flTime };
    };

    for (const r of races) {
      const round = Number(r.round);
      const track = season.tracks.find((t) => t.round === round);
      if (!track || !Array.isArray(r.Results) || r.Results.length === 0) continue;

      const main = mapOrder(r.Results);
      const sprint = Array.isArray(r.SprintResults) && r.SprintResults.length
        ? mapOrder(r.SprintResults)
        : null;

      if (main.order.length > 0) {
        track.completed = true;
        track.results = track.results || {};
        track.results.raceOrder = main.order;
        track.results.raceTimes = main.times;
        track.results.dnfDriverIds = main.dnfs;
        track.results.driverStatuses = main.statuses;
        if (main.flId) track.results.fastestLapDriverId = main.flId;
        if (main.flTime) track.results.fastestLapTime = main.flTime;
        if (sprint && sprint.order.length > 0) {
          track.hasSprint = true;
          track.results.sprintOrder = sprint.order;
        }
        updatedCount++;
      }
    }

    await invoke('save_season', { state: season });
    await refreshAll(true);
    document.getElementById('liveBanner').hidden = true;
    showToast(`Resultados sincronizados (${updatedCount} fechas actualizadas).`);
  }

  async function checkUpdatesOnStartup() {
    try {
      const races = await fetchApiRaces();
      const localCompleted = season.tracks.filter((t) => t.completed).length;
      if (races.length > localCompleted) {
        pendingApiRaces = races;
        const last = races[races.length - 1];
        document.getElementById('liveBannerText').textContent =
          `Hay resultados nuevos disponibles (${races.length} de ${season.tracks.length} fechas, último: ${last.raceName}).`;
        document.getElementById('liveBanner').hidden = false;
      }
    } catch {
      return;
    }
  }

  async function syncFromPublicApi() {
    showToast('Buscando resultados oficiales...');
    try {
      const races = await fetchApiRaces();
      if (!races.length) {
        showToast('No hay resultados nuevos disponibles todavía.');
        return;
      }
      await applyApiRaces(races);
    } catch {
      showToast('No se pudo conectar con el servicio de resultados.');
    }
  }

  async function init() {
    season = await invoke('load_season');
    customSeason = await invoke('load_custom_season');
    await refreshAll(true);
    await refreshCustom();
    setTimeout(checkUpdatesOnStartup, 1200);

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    document.querySelectorAll('[data-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => switchSubtab(btn.getAttribute('data-subtab')));
    });

    document.querySelectorAll('[data-sim-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        simView = btn.getAttribute('data-sim-view');
        document.querySelectorAll('[data-sim-view]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        renderDetailedSimulator();
      });
    });

    document.querySelectorAll('[data-evo-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        evoView = btn.getAttribute('data-evo-view');
        document.querySelectorAll('[data-evo-view]').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        renderEvolutionChart();
      });
    });

    document.getElementById('btnGoToSim').addEventListener('click', () => switchTab('simulator'));
    document.getElementById('btnGoToCalendar').addEventListener('click', () => switchTab('calendar'));

    document.getElementById('rangeForm').addEventListener('input', (e) => {
      document.getElementById('labelForm').textContent = `${e.target.value}%`;
    });
    document.getElementById('rangeForm').addEventListener('change', () => refreshAll(true));

    document.getElementById('rangeChaos').addEventListener('input', (e) => {
      document.getElementById('labelChaos').textContent = `${e.target.value}%`;
    });
    document.getElementById('rangeChaos').addEventListener('change', () => refreshAll(true));
    document.getElementById('selectIterations').addEventListener('change', () => refreshAll(true));

    document.getElementById('btnRunSim').addEventListener('click', async () => {
      await refreshAll(true);
      showToast('Probabilidades recalculadas.');
    });

    document.getElementById('btnSyncLive').addEventListener('click', syncFromPublicApi);
    document.getElementById('btnApplyLive').addEventListener('click', () => {
      if (pendingApiRaces) applyApiRaces(pendingApiRaces);
    });
    document.getElementById('btnDismissLive').addEventListener('click', () => {
      document.getElementById('liveBanner').hidden = true;
    });

    document.getElementById('btnReset').addEventListener('click', async () => {
      season = await invoke('reset_season');
      await refreshAll(true);
      showToast('Temporada oficial restablecida.');
    });

    document.getElementById('tab-standings').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-target-id]');
      if (!btn) return;
      openTargetDialog(
        btn.getAttribute('data-target-kind'),
        btn.getAttribute('data-target-id')
      );
    });

    document.getElementById('calendarGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view-race]');
      if (!btn) return;
      openRaceDetailsModal(btn.getAttribute('data-view-race'));
    });

    document.getElementById('selectTargetRank').addEventListener('change', (e) => {
      openTargetDialog(activeTarget.kind, activeTarget.id, Number(e.target.value));
    });

    document.getElementById('btnCloseTarget').addEventListener('click', () => {
      document.getElementById('dialogTarget').close();
    });

    document.getElementById('btnCloseRaceDetails').addEventListener('click', () => {
      document.getElementById('dialogRaceDetails').close();
    });

    document.getElementById('btnSaveCustomName').addEventListener('click', async () => {
      const name = document.getElementById('inputCustomName').value.trim();
      if (!name) return;
      customSeason.meta.championshipName = name;
      await invoke('save_custom_season', { state: customSeason });
      await refreshCustom();
      showToast('Nombre de liga guardado.');
    });

    document.getElementById('btnAddCustomDriver').addEventListener('click', async () => {
      const name = document.getElementById('inputCustomDriverName').value.trim();
      const code = (document.getElementById('inputCustomDriverCode').value.trim() || name.slice(0, 3)).toUpperCase();
      const color = document.getElementById('inputCustomDriverColor').value || '#e10600';
      if (!name) return;

      const teamId = `ct_${Date.now().toString(36)}`;
      customSeason.teams.push({ id: teamId, name, shortName: code, color });
      customSeason.drivers.push({
        id: `cd_${Date.now().toString(36)}`,
        name,
        code,
        number: customSeason.drivers.length + 1,
        teamId,
        country: '',
        baseRating: 85
      });
      document.getElementById('inputCustomDriverName').value = '';
      document.getElementById('inputCustomDriverCode').value = '';
      await invoke('save_custom_season', { state: customSeason });
      await refreshCustom();
    });

    document.getElementById('customDriversChips').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-del-custom-driver]');
      if (!btn) return;
      if (customSeason.drivers.length <= 2) {
        showToast('Debes mantener al menos 2 pilotos.');
        return;
      }
      const dId = btn.getAttribute('data-del-custom-driver');
      customSeason.drivers = customSeason.drivers.filter((d) => d.id !== dId);
      await invoke('save_custom_season', { state: customSeason });
      await refreshCustom();
    });

    document.getElementById('btnAddCustomTrack').addEventListener('click', async () => {
      const name = document.getElementById('inputCustomTrackName').value.trim();
      if (!name) return;
      const rnd = customSeason.tracks.length + 1;
      customSeason.tracks.push({
        id: `cr_${Date.now().toString(36)}`,
        round: rnd,
        name,
        country: '',
        circuit: '',
        hasSprint: false,
        completed: false,
        pointsMultiplier: 1,
        results: {}
      });
      document.getElementById('inputCustomTrackName').value = '';
      await invoke('save_custom_season', { state: customSeason });
      await refreshCustom();
    });

    document.getElementById('selectCustomTrack').addEventListener('change', renderCustomTrackPositions);

    document.getElementById('btnDeleteCustomTrack').addEventListener('click', async () => {
      const trackId = document.getElementById('selectCustomTrack').value;
      customSeason.tracks = customSeason.tracks
        .filter((t) => t.id !== trackId)
        .map((t, i) => ({ ...t, round: i + 1 }));
      await invoke('save_custom_season', { state: customSeason });
      await refreshCustom();
    });

    document.getElementById('btnApplyCustomRace').addEventListener('click', async () => {
      const track = customSeason.tracks.find(
        (t) => t.id === document.getElementById('selectCustomTrack').value
      );
      if (!track) return;
      const picks = [];
      const seen = new Set();
      document.querySelectorAll('.custom-pos-select').forEach((sel) => {
        if (sel.value && !seen.has(sel.value)) {
          seen.add(sel.value);
          picks.push(sel.value);
        }
      });
      if (!picks.length) {
        showToast('Elige al menos un piloto para guardar.');
        return;
      }
      for (const d of customSeason.drivers) {
        if (!seen.has(d.id)) picks.push(d.id);
      }
      track.completed = true;
      track.results = {
        poleDriverId: '',
        fastestLapDriverId: document.getElementById('selectCustomFl').value || '',
        fastestLapTime: '',
        raceOrder: picks,
        raceTimes: {},
        dnfDriverIds: [],
        driverStatuses: {},
        sprintOrder: [],
        driverTeams: {}
      };
      await invoke('save_custom_season', { state: customSeason });
      await refreshCustom();
      showToast(`Resultado guardado en ${track.name}.`);
    });

    document.getElementById('btnClearCustomRace').addEventListener('click', async () => {
      const track = customSeason.tracks.find(
        (t) => t.id === document.getElementById('selectCustomTrack').value
      );
      if (!track) return;
      track.completed = false;
      track.results = {};
      await invoke('save_custom_season', { state: customSeason });
      await refreshCustom();
      showToast(`${track.name} quedó pendiente.`);
    });

    document.getElementById('btnResetCustom').addEventListener('click', async () => {
      customSeason = await invoke('reset_custom_season');
      await refreshCustom();
      showToast('Liga personalizada reiniciada.');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
