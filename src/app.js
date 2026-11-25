/**
 * Controlador Principal de Interfaz — F1 Championship Studio
 */

(function () {
  let appState = null;
  let lastSimulationOutput = null;

  // Estado temporal de imágenes y puntos mientras se editan en modales/formularios
  let currentDriverModalImage = '';
  let currentTeamModalImage = '';
  let currentTrackModalImage = '';
  let editableRacePoints = [];
  let editableSprintPoints = [];

  // Utilidad para escapar texto seguro en HTML
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Mostrar notificación amigable (Toast)
  let toastTimer = null;
  function showToast(message) {
    const banner = document.getElementById('toastBanner');
    if (!banner) return;
    banner.textContent = message;
    banner.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      banner.hidden = true;
    }, 3600);
  }

  // Fallback para <dialog closedby="any"> según Modern Web Guidance
  function setupDialogsModernGuidance() {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener('pointerup', (e) => {
          if (pressedOutside && outside(e, dialog)) dialog.close();
        });
      }
    }

    // Limpiar returnValue al cerrar cualquier diálogo para evitar valores obsoletos
    document.querySelectorAll('dialog').forEach((dlg) => {
      dlg.addEventListener('close', () => {
        dlg.returnValue = '';
      });
    });

    // Botones de cierre explícito dentro de los modales
    document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close-dialog');
        const dlg = document.getElementById(targetId);
        if (dlg && dlg.open) dlg.close();
      });
    });
  }

  // Cambiar de pestaña principal
  function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-view').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${tabId}`);
    });

    if (tabId === 'probabilities') {
      runAndRenderSimulation();
    } else if (tabId === 'points') {
      syncPointsEditorFromState();
    } else if (tabId === 'history') {
      renderHistoryView();
    }
  }

  // Renderizado global de toda la aplicación
  async function persistAndRender(toastMsg) {
    await window.ChampionshipData.saveStateToStorage(appState);
    renderSidebar();
    renderDashboard();
    renderCalendar();
    renderRosters();
    syncPointsEditorFromState();
    if (document.getElementById('view-probabilities').classList.contains('active')) {
      runAndRenderSimulation();
    }
    if (toastMsg) showToast(toastMsg);
  }

  // =========================================================
  // 1. SIDEBAR Y METADATOS DEL CAMPEONATO
  // =========================================================
  function renderSidebar() {
    const pool = window.ChampionshipEngine.calculateChampionshipPool(appState);
    document.getElementById('sidebarChampName').textContent =
      appState.meta.championshipName || 'Campeonato de Fórmula 1';
    document.getElementById('sidebarSeasonTag').textContent =
      `TEMPORADA ${appState.meta.seasonYear || '2026'}`;

    const total = pool.totalRacesCount;
    const comp = pool.completedRacesCount;
    const pct = total > 0 ? Math.round((comp / total) * 100) : 0;

    document.getElementById('sidebarProgressText').textContent = `${comp} de ${total} fechas disputadas`;
    document.getElementById('sidebarProgressPct').textContent = `${pct}%`;
    document.getElementById('sidebarProgressFill').style.width = `${pct}%`;
  }

  // =========================================================
  // 2. VISTA DASHBOARD: BOLSA DE PUNTOS, TABLAS Y CURVA
  // =========================================================
  function renderDashboard() {
    const { pool, driverStandings, constructorStandings } =
      window.ChampionshipEngine.calculateStandings(appState);

    // KPI 1: Bolsa Total del Campeonato
    document.getElementById('kpiTotalRacesPill').textContent =
      `${pool.completedRacesCount}/${pool.totalRacesCount} Fechas`;
    document.getElementById('kpiTotalPool').textContent = `${pool.totalChampionshipPool} pts`;
    document.getElementById('kpiPoolBreakdown').innerHTML =
      `${pool.distributedPool} pts ya repartidos &bull; <strong>${pool.remainingPool} pts en juego</strong> en total`;

    // KPI 2: Máximo Restante para 1 Piloto
    document.getElementById('kpiRemainingSprintsPill').textContent =
      `${pool.remainingSprintsCount} Sprint${pool.remainingSprintsCount === 1 ? '' : 's'} rest.`;
    document.getElementById('kpiMaxSingleRemaining').textContent = `${pool.maxRemainingForOneDriver} pts`;
    document.getElementById('kpiMaxSingleDetail').textContent =
      pool.remainingRacesCount > 0
        ? `En ${pool.remainingRacesCount} carrera(s) pendiente(s) (máx. ${pool.maxDriverNormalRace} pts en GP normal, ${pool.maxDriverSprintRace} en GP Sprint)`
        : 'Temporada finalizada: no quedan puntos adicionales por disputar.';

    // KPI 3: Contendientes Matemáticos
    const contenders = driverStandings.filter(
      (d) => d.titleStatus === 'contender' || d.titleStatus === 'champion'
    );
    const totalDrivers = driverStandings.length;
    const alivePct = totalDrivers > 0 ? Math.round((contenders.length / totalDrivers) * 100) : 0;
    document.getElementById('kpiAlivePctPill').textContent =
      totalDrivers > 0 ? `${contenders.length} de ${totalDrivers} vivos (${alivePct}%)` : 'Sin pilotos';
    document.getElementById('kpiContendersCount').textContent =
      `${contenders.length} ${contenders.length === 1 ? 'piloto' : 'pilotos'}`;
    document.getElementById('kpiContendersSub').textContent =
      pool.remainingRacesCount === 0 && totalDrivers > 0
        ? '¡El campeonato ya quedó definido matemáticamente!'
        : 'Aún pueden alcanzar o superar matemáticamente el puntaje del líder.';

    // KPI 4: Líder y Escenario de Definición
    if (driverStandings.length > 0) {
      const leader = driverStandings[0];
      const second = driverStandings[1] || null;
      const leadDiff = second ? leader.points - second.points : leader.points;
      document.getElementById('kpiLeaderName').textContent = `${leader.name} (${leader.points} pts)`;
      document.getElementById('kpiLeaderGapPill').textContent =
        second ? `+${leadDiff} pts sobre ${second.code}` : 'Líder único';

      if (leader.titleStatus === 'champion') {
        document.getElementById('kpiClinchScenario').textContent =
          `🏆 ¡${leader.name} ya es Campeón Matemático del torneo! Nadie puede darle alcance.`;
      } else if (leader.nextRaceClinchScenario) {
        document.getElementById('kpiClinchScenario').textContent = leader.nextRaceClinchScenario;
      } else {
        document.getElementById('kpiClinchScenario').textContent =
          `Techo máximo del líder: ${leader.maxPossiblePoints} pts.`;
      }
    } else {
      document.getElementById('kpiLeaderName').textContent = 'Sin pilotos';
      document.getElementById('kpiLeaderGapPill').textContent = '—';
      document.getElementById('kpiClinchScenario').textContent =
        'Agrega pilotos y fechas para calcular los escenarios matemáticos.';
    }

    renderDriversStandingsTable(driverStandings);
    renderConstructorsStandingsTable(constructorStandings);
    renderProgressionChart(driverStandings);
  }

  function renderDriversStandingsTable(driverStandings) {
    const container = document.getElementById('driversStandingsContainer');
    if (!driverStandings || driverStandings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏎️</div>
          <h3>Todavía no hay pilotos inscritos en la parrilla</h3>
          <p>Inscribe a tus pilotos con sus fotos y escuderías para empezar a calcular puntos y probabilidades.</p>
          <button type="button" class="btn btn-primary" data-action="go-rosters">Ir a Pilotos y Escuderías</button>
        </div>
      `;
      return;
    }

    const rowsHtml = driverStandings
      .map((d) => {
        const posClass = d.rank <= 3 ? `pos-${d.rank}` : '';
        const gapStr = d.rank === 1 ? 'Líder' : `${d.gapToLeader} pts`;
        const chancePct = d.targetChancePct !== undefined ? Number(d.targetChancePct) : 100;
        let statusClass = 'status-eliminated';
        let statusIcon = '🎯';
        let barColor = d.teamColor || '#38bdf8';
        if (d.titleStatus === 'champion') {
          statusClass = 'status-champion';
          statusIcon = '🏆';
          barColor = '#fbbf24';
        } else if (d.titleStatus === 'contender') {
          statusClass = 'status-contender';
          statusIcon = '🔥';
          barColor = '#10b981';
        } else if (d.titleStatus === 'locked') {
          statusClass = 'status-champion';
          statusIcon = '🔒';
          barColor = '#38bdf8';
        }

        const statusPills = [];
        if (d.dnfOnlyCount > 0) {
          statusPills.push(`<span class="mini-status-pill pill-dnf" title="${d.dnfOnlyCount} abandono(s) — No terminó carrera (DNF)">💥 ${d.dnfOnlyCount} DNF</span>`);
        }
        if (d.dnsCount > 0) {
          statusPills.push(`<span class="mini-status-pill pill-dns" title="${d.dnsCount} carrera(s) sin largar — No empezó (DNS)">🚫 ${d.dnsCount} DNS</span>`);
        }
        if (d.dsqCount > 0) {
          statusPills.push(`<span class="mini-status-pill pill-dsq" title="${d.dsqCount} descalificación(es) (DSQ)">🏴 ${d.dsqCount} DSQ</span>`);
        }
        const statusPillsHtml = statusPills.length > 0 ? `<div class="driver-status-pills-row">${statusPills.join('')}</div>` : '';

        return `
          <tr>
            <th scope="row">
              <div class="driver-cell">
                <span class="pos-badge ${posClass}">${d.rank}</span>
                <span class="team-color-bar" style="background:${escapeHtml(d.teamColor)}"></span>
                <img src="${escapeHtml(d.image)}" alt="" class="avatar-sm" />
                <div class="driver-info-stack">
                  <span class="driver-name-line">
                    ${escapeHtml(d.name)}
                    <span class="driver-number-tag">#${escapeHtml(d.number)}</span>
                  </span>
                  <span class="driver-sub-line">${escapeHtml(d.teamDisplayLabel || d.teamName)} &bull; ${escapeHtml(d.code)}</span>
                </div>
              </div>
            </th>
            <td><span class="points-pill">${d.points} pts</span></td>
            <td>${escapeHtml(gapStr)}</td>
            <td><strong>${d.maxPossiblePoints} pts</strong></td>
            <td>${d.bestMathematicalRank}° – ${d.worstMathematicalRank}°</td>
            <td>${d.wins} 🏆 / ${d.podiums} 🍾</td>
            <td>
              <div>${d.poles} Pole / ${d.fastestLaps} VR</div>
              ${statusPillsHtml}
            </td>
            <td>
              <button
                type="button"
                class="target-chance-stack clickable-prob-zone"
                data-open-target-req="driver"
                data-entity-id="${escapeHtml(d.id)}"
                title="Haz clic para ver qué posiciones necesita ${escapeHtml(d.name)} y sus rivales para lograr el ${d.targetRank || d.bestMathematicalRank}° puesto"
              >
                <span class="status-badge ${statusClass}">
                  ${statusIcon} ${escapeHtml(d.titleStatusLabel)} <span class="prob-zone-hint">🔍</span>
                </span>
                <div class="mini-chance-track">
                  <div class="mini-chance-fill" style="width:${Math.min(100, Math.max(2, chancePct))}%; background:${escapeHtml(barColor)}"></div>
                </div>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="drivers-table-caption" class="table-wrapper">
        <table style="
          --label-2: 'Puntos Actuales';
          --label-3: 'Diferencia';
          --label-4: 'Techo Máximo';
          --label-5: 'Rango Matemático';
          --label-6: 'Victorias / Podios';
          --label-7: 'Poles / VR';
          --label-8: 'Posición Máx. y %';
        ">
          <caption id="drivers-table-caption">Tabla general del campeonato de pilotos y techo matemático</caption>
          <thead>
            <tr>
              <th>Posición / Piloto</th>
              <th>Puntos</th>
              <th>Dif. Líder</th>
              <th>Máx. Posible</th>
              <th>Rango Posible</th>
              <th>PG / Podios</th>
              <th>Poles / VR</th>
              <th>Posición Máxima y % Opción</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderConstructorsStandingsTable(constructorStandings) {
    const container = document.getElementById('constructorsStandingsContainer');
    if (!constructorStandings || constructorStandings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛡️</div>
          <h3>Aún no hay escuderías registradas</h3>
          <p>Crea las escuderías con sus colores e insignias para ver el Campeonato Mundial de Constructores.</p>
        </div>
      `;
      return;
    }

    const rowsHtml = constructorStandings
      .map((t) => {
        const posClass = t.rank <= 3 ? `pos-${t.rank}` : '';
        const gapStr = t.rank === 1 ? 'Líder' : `${t.gapToLeader} pts`;
        const driversList = t.driverNames.length > 0 ? t.driverNames.join(', ') : 'Sin pilotos asignados';
        const chancePct = t.targetChancePct !== undefined ? Number(t.targetChancePct) : 100;

        let statusClass = 'status-eliminated';
        let statusIcon = '🎯';
        let barColor = t.color || '#38bdf8';
        if (t.titleStatus === 'champion') {
          statusClass = 'status-champion';
          statusIcon = '🏆';
          barColor = '#fbbf24';
        } else if (t.titleStatus === 'contender') {
          statusClass = 'status-contender';
          statusIcon = '🔥';
          barColor = '#10b981';
        } else if (t.titleStatus === 'locked') {
          statusClass = 'status-champion';
          statusIcon = '🔒';
          barColor = '#38bdf8';
        }

        return `
          <tr>
            <th scope="row">
              <div class="driver-cell">
                <span class="pos-badge ${posClass}">${t.rank}</span>
                <span class="team-color-bar" style="background:${escapeHtml(t.color)}"></span>
                <img src="${escapeHtml(t.image)}" alt="" class="avatar-sm" />
                <div class="driver-info-stack">
                  <span class="driver-name-line">${escapeHtml(t.name)}</span>
                  <span class="driver-sub-line">${escapeHtml(t.shortName)} &bull; ${escapeHtml(driversList)}</span>
                </div>
              </div>
            </th>
            <td><span class="points-pill">${t.points} pts</span></td>
            <td>${escapeHtml(gapStr)}</td>
            <td><strong>${t.maxPossiblePoints} pts</strong></td>
            <td>${t.bestMathematicalRank}° – ${t.worstMathematicalRank}°</td>
            <td>${t.wins} 🏆 / ${t.podiums} 🍾</td>
            <td>${t.poles}</td>
            <td>
              <button
                type="button"
                class="target-chance-stack clickable-prob-zone"
                data-open-target-req="team"
                data-entity-id="${escapeHtml(t.id)}"
                title="Haz clic para ver qué necesita ${escapeHtml(t.name)} y sus rivales para lograr el ${t.targetRank || t.bestMathematicalRank}° puesto"
              >
                <span class="status-badge ${statusClass}">
                  ${statusIcon} ${escapeHtml(t.titleStatusLabel || '')} <span class="prob-zone-hint">🔍</span>
                </span>
                <div class="mini-chance-track">
                  <div class="mini-chance-fill" style="width:${Math.min(100, Math.max(2, chancePct))}%; background:${escapeHtml(barColor)}"></div>
                </div>
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="constructors-table-caption" class="table-wrapper">
        <table style="
          --label-2: 'Puntos';
          --label-3: 'Diferencia';
          --label-4: 'Techo Máximo';
          --label-5: 'Rango Matemático';
          --label-6: 'Victorias / Podios';
          --label-7: 'Poles';
          --label-8: 'Posición Máx. y %';
        ">
          <caption id="constructors-table-caption">Tabla del campeonato mundial de constructores</caption>
          <thead>
            <tr>
              <th>Posición / Escudería</th>
              <th>Puntos</th>
              <th>Dif. Líder</th>
              <th>Máx. Posible</th>
              <th>Rango Posible</th>
              <th>PG / Podios</th>
              <th>Poles</th>
              <th>Posición Máxima y % Opción</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderProgressionChart(driverStandings) {
    const container = document.getElementById('progressionChartContainer');
    const completedTracks = (appState.tracks || [])
      .filter((t) => t.completed)
      .sort((a, b) => (a.round || 0) - (b.round || 0));

    if (completedTracks.length === 0 || driverStandings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📈</div>
          <h3>Aún no hay carreras finalizadas para graficar</h3>
          <p>Apenas registres los resultados de la primera fecha, verás aquí la curva de evolución de puntos.</p>
        </div>
      `;
      return;
    }

    const topDrivers = driverStandings.slice(0, 6);
    const maxPts = Math.max(10, ...topDrivers.map((d) => d.points));
    const width = 860;
    const height = 340;
    const padLeft = 52;
    const padRight = 130;
    const padTop = 26;
    const padBottom = 44;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const xForStep = (stepIdx) => {
      if (completedTracks.length === 1) return padLeft + plotW / 2;
      return padLeft + (stepIdx / completedTracks.length) * plotW;
    };
    const yForPts = (pts) => padTop + plotH - (pts / maxPts) * plotH;

    let gridLines = '';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxPts * i) / 4);
      const y = yForPts(val);
      gridLines += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#262f45" stroke-dasharray="4 4" />
        <text x="${padLeft - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11">${val}</text>
      `;
    }

    let xLabels = `<text x="${xForStep(0)}" y="${height - 14}" text-anchor="middle" fill="#94a3b8" font-size="11">Inicio</text>`;
    completedTracks.forEach((tr, idx) => {
      const x = xForStep(idx + 1);
      xLabels += `<text x="${x}" y="${height - 14}" text-anchor="middle" fill="#cbd5e1" font-size="11">R${tr.round}</text>`;
    });

    let pathsHtml = '';
    topDrivers.forEach((d) => {
      const pointsCoords = [{ x: xForStep(0), y: yForPts(0) }];
      d.cumulativePointsByRound.forEach((item, idx) => {
        pointsCoords.push({ x: xForStep(idx + 1), y: yForPts(item.total) });
      });
      const dAttr = pointsCoords.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
      const lastPt = pointsCoords[pointsCoords.length - 1];

      const circles = pointsCoords
        .map(
          (pt) =>
            `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4" fill="${escapeHtml(d.teamColor)}" stroke="#0b0d13" stroke-width="1.5" />`
        )
        .join('');

      pathsHtml += `
        <path d="${dAttr}" fill="none" stroke="${escapeHtml(d.teamColor)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${circles}
        <text x="${(lastPt.x + 10).toFixed(1)}" y="${(lastPt.y + 4).toFixed(1)}" fill="#f8fafc" font-size="11.5" font-weight="700">
          ${escapeHtml(d.code)} (${d.points})
        </text>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="340" role="img" aria-label="Gráfico de evolución de puntos de los pilotos líderes">
        ${gridLines}
        ${xLabels}
        ${pathsHtml}
      </svg>
    `;
  }

  // =========================================================
  // 3. VISTA SIMULADOR DE PROBABILIDADES (MONTE CARLO)
  // =========================================================
  async function runAndRenderSimulation() {
    const iterations = Number(document.getElementById('simIterationsSelect').value) || 25000;
    const formWeightPct = Number(document.getElementById('simFormWeightRange').value) || 70;
    const chaosPct = Number(document.getElementById('simChaosRange').value) || 35;
    const badgeEl = document.getElementById('engineStatusBadge');

    if (window.desktopAPI && typeof window.desktopAPI.runMonteCarloNative === 'function') {
      try {
        lastSimulationOutput = await window.desktopAPI.runMonteCarloNative(appState, {
          iterations,
          formWeight: formWeightPct / 100,
          chaosLevel: chaosPct / 100
        });
        if (badgeEl && lastSimulationOutput && lastSimulationOutput.engineBadge) {
          badgeEl.textContent = lastSimulationOutput.engineBadge;
          badgeEl.hidden = false;
        }
        renderSimulationResults(lastSimulationOutput);
        return;
      } catch (err) {
        console.warn('Fallback a motor JS:', err);
      }
    }

    const t0 = performance.now();
    lastSimulationOutput = window.ChampionshipEngine.runMonteCarloSimulation(appState, {
      iterations,
      formWeight: formWeightPct / 100,
      chaosLevel: chaosPct / 100
    });
    const elapsed = (performance.now() - t0).toFixed(1);
    if (badgeEl) {
      badgeEl.textContent = `⚡ Motor Local • ${elapsed} ms`;
    }

    renderSimulationResults(lastSimulationOutput);
  }

  function renderSimulationResults(sim) {
    const topGrid = document.getElementById('simTopContendersGrid');
    const tableContainer = document.getElementById('simProbabilitiesTableContainer');
    const matrixContainer = document.getElementById('simMatrixTableContainer');
    const subtitle = document.getElementById('simSummarySubtitle');

    if (!sim || !sim.results || sim.results.length === 0) {
      topGrid.innerHTML = '';
      tableContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎲</div>
          <h3>No hay pilotos para simular</h3>
          <p>Agrega pilotos y pistas en el calendario para proyectar las probabilidades finales del campeonato.</p>
        </div>
      `;
      matrixContainer.innerHTML = '';
      return;
    }

    subtitle.textContent =
      sim.remainingRaces > 0
        ? `Basado en ${sim.iterations.toLocaleString('es-CL')} simulaciones de las ${sim.remainingRaces} fecha(s) pendiente(s) (${sim.pool.maxRemainingForOneDriver} pts máx. en juego por piloto).`
        : 'Todas las fechas del calendario están completadas: los resultados mostrados son definitivos (100%).';

    // Tarjetas de los 4 principales candidatos según su Posición Máxima Posible
    const top4 = sim.results.slice(0, 4);
    topGrid.innerHTML = top4
      .map((r) => {
        const targetRank = r.targetRank || r.bestMathematicalRank || 1;
        const targetChancePct = r.targetChancePct !== undefined ? Number(r.targetChancePct) : r.winProbability;
        const targetSimProb = r.targetSimProbability !== undefined ? Number(r.targetSimProbability) : r.winProbability;
        const mainPctStr = targetChancePct.toFixed(1);
        const targetSimStr = targetSimProb.toFixed(1);
        const targetBadgeLabel =
          r.titleStatus === 'champion'
            ? '🏆 ¡Campeón Consagrado! (1°)'
            : targetRank === 1
            ? '🔥 Opción al Mundial (1°)'
            : r.isRankLocked
            ? `🔒 ${targetRank}° Puesto Asegurado`
            : `🎯 Aspira a Máx. ${targetRank}° puesto`;

        return `
          <article class="contender-prob-card clickable-prob-card" data-open-target-req="driver" data-entity-id="${escapeHtml(r.id)}" title="Haz clic para ver qué posiciones necesita ${escapeHtml(r.name)} y sus rivales para el ${targetRank}° puesto">
            <div class="driver-cell">
              <img src="${escapeHtml(r.image)}" alt="" class="avatar-sm" />
              <div class="driver-info-stack" style="flex:1">
                <span class="driver-name-line">
                  ${escapeHtml(r.name)}
                  <span class="driver-number-tag">#${escapeHtml(r.number)}</span>
                </span>
                <span class="driver-sub-line">${escapeHtml(r.teamName)} &bull; Actual: ${r.currentPoints} pts (${r.currentRank}°)</span>
              </div>
              <div style="text-align:right">
                <strong style="font-size:1.35rem; color:#ffffff; display:block; line-height:1.1">${mainPctStr}%</strong>
                <span style="font-size:0.7rem; color:var(--text-secondary)">${escapeHtml(targetBadgeLabel)} 🔍</span>
              </div>
            </div>
            <div class="prob-bar-track">
              <div class="prob-bar-fill" style="width:${Math.min(100, Math.max(2, targetChancePct))}%; background:${escapeHtml(r.teamColor)}"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-secondary)">
              <span>Sim. ${targetRank}° puesto: <strong>${targetSimStr}%</strong></span>
              <span>Proyección: <strong>~${r.expectedPoints} pts</strong> (${r.minProjectedPoints}–${r.maxProjectedPoints})</span>
            </div>
          </article>
        `;
      })
      .join('');

    // Tabla de Proyección de Puntos y Probabilidades Escalonadas
    const rowsHtml = sim.results
      .map((r, idx) => {
        const targetRank = r.targetRank || r.bestMathematicalRank || 1;
        const targetChancePct = r.targetChancePct !== undefined ? Number(r.targetChancePct) : r.winProbability;
        const targetSimProb = r.targetSimProbability !== undefined ? Number(r.targetSimProbability) : r.winProbability;
        const podStr = `${r.podiumProbability.toFixed(1)}%`;
        const targetSimStr = `${targetSimProb.toFixed(1)}% (${targetRank}°)`;
        const statusLabel =
          r.titleStatusLabel ||
          (targetRank === 1
            ? `Opción al Mundial (1°) • ${targetChancePct.toFixed(1)}%`
            : `Máx. ${targetRank}° puesto • ${targetChancePct.toFixed(1)}%`);

        let statusClass = 'status-eliminated';
        let statusIcon = '🎯';
        if (r.titleStatus === 'champion') {
          statusClass = 'status-champion';
          statusIcon = '🏆';
        } else if (r.titleStatus === 'contender') {
          statusClass = 'status-contender';
          statusIcon = '🔥';
        } else if (r.titleStatus === 'locked') {
          statusClass = 'status-champion';
          statusIcon = '🔒';
        }

        return `
          <tr>
            <th scope="row">
              <div class="driver-cell">
                <span class="pos-badge ${idx < 3 ? `pos-${idx + 1}` : ''}">${idx + 1}</span>
                <span class="team-color-bar" style="background:${escapeHtml(r.teamColor)}"></span>
                <img src="${escapeHtml(r.image)}" alt="" class="avatar-sm" />
                <div class="driver-info-stack">
                  <span class="driver-name-line">${escapeHtml(r.name)}</span>
                  <span class="driver-sub-line">${escapeHtml(r.teamName)}</span>
                </div>
              </div>
            </th>
            <td>${r.currentPoints} pts (${r.currentRank}°)</td>
            <td><span class="points-pill">${r.expectedPoints} pts</span></td>
            <td>${r.minProjectedPoints} – ${r.maxProjectedPoints} pts</td>
            <td>
              <button
                type="button"
                class="target-chance-stack clickable-prob-zone"
                data-open-target-req="driver"
                data-entity-id="${escapeHtml(r.id)}"
                title="Haz clic para ver qué necesita ${escapeHtml(r.name)} y sus rivales para el ${targetRank}° puesto"
              >
                <span class="status-badge ${statusClass}">
                  ${statusIcon} ${escapeHtml(statusLabel)} <span class="prob-zone-hint">🔍</span>
                </span>
                <div class="mini-chance-track">
                  <div class="mini-chance-fill" style="width:${Math.min(100, Math.max(2, targetChancePct))}%; background:${escapeHtml(r.teamColor)}"></div>
                </div>
              </button>
            </td>
            <td><strong>${targetSimStr}</strong></td>
            <td>${podStr}</td>
            <td><strong>${r.mostLikelyPosition}° puesto</strong> (${r.mostLikelyPositionProb.toFixed(0)}%)</td>
          </tr>
        `;
      })
      .join('');

    tableContainer.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="sim-prob-caption" class="table-wrapper">
        <table style="
          --label-2: 'Puntos Actuales';
          --label-3: 'Puntos Proyectados';
          --label-4: 'Rango Esperado (P10-P90)';
          --label-5: 'Posición Máx. y % Opción';
          --label-6: 'Prob. Sim. en su Máx.';
          --label-7: 'Prob. Podio (Top 3)';
          --label-8: 'Posición Más Probable';
        ">
          <caption id="sim-prob-caption">Proyección estadística de puntos finales y probabilidades escalonadas por posición máxima</caption>
          <thead>
            <tr>
              <th>Piloto</th>
              <th>Pts Actuales</th>
              <th>Pts Esperados</th>
              <th>Rango Probable</th>
              <th>Posición Máxima y % Opción</th>
              <th>Prob. Sim. (Máx.)</th>
              <th>Prob. Top 3</th>
              <th>Puesto Más Probable</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    // Matriz de Distribución de Posiciones (1° a N°, máx 12 columnas para legibilidad)
    const maxCols = Math.min(sim.results.length, 12);
    let posHeaders = '';
    for (let p = 1; p <= maxCols; p++) {
      posHeaders += `<th style="text-align:center">${p}°</th>`;
    }

    const matrixRows = sim.results
      .map((r) => {
        let cells = '';
        for (let p = 0; p < maxCols; p++) {
          const prob = r.positionProbabilities[p] || 0;
          const alpha = Math.min(0.85, prob / 100);
          const bg =
            prob >= 0.5
              ? `rgba(225, 6, 0, ${(0.12 + alpha * 0.75).toFixed(2)})`
              : 'transparent';
          const textCol = prob >= 25 ? '#ffffff' : prob >= 1 ? '#cbd5e1' : '#475569';
          cells += `
            <td style="text-align:center">
              <span class="heat-cell" style="background:${bg}; color:${textCol}">
                ${prob >= 0.1 ? `${prob.toFixed(1)}%` : '—'}
              </span>
            </td>
          `;
        }
        return `
          <tr>
            <th scope="row">
              <div class="driver-cell">
                <span class="team-color-bar" style="background:${escapeHtml(r.teamColor)}; height:24px"></span>
                <span>${escapeHtml(r.name)}</span>
              </div>
            </th>
            ${cells}
          </tr>
        `;
      })
      .join('');

    matrixContainer.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="sim-matrix-caption" class="table-wrapper">
        <table>
          <caption id="sim-matrix-caption">Matriz de probabilidades por posición final en el campeonato</caption>
          <thead>
            <tr>
              <th>Piloto</th>
              ${posHeaders}
            </tr>
          </thead>
          <tbody>
            ${matrixRows}
          </tbody>
        </table>
      </div>
    `;

    renderTeamSimulationResults(sim);
  }

  function renderTeamSimulationResults(sim) {
    const topGrid = document.getElementById('simTeamsTopContendersGrid');
    const tableContainer = document.getElementById('simTeamsProbabilitiesTableContainer');
    const matrixContainer = document.getElementById('simTeamsMatrixTableContainer');
    const subtitle = document.getElementById('simTeamsSummarySubtitle');

    if (!topGrid || !tableContainer || !matrixContainer) return;

    const teamResults = (sim && sim.teamResults) || [];
    if (teamResults.length === 0) {
      topGrid.innerHTML = '';
      tableContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛡️</div>
          <h3>No hay escuderías para simular</h3>
          <p>Agrega escuderías y asigna pilotos para proyectar el Campeonato Mundial de Constructores.</p>
        </div>
      `;
      matrixContainer.innerHTML = '';
      return;
    }

    if (subtitle) {
      subtitle.textContent =
        sim.remainingRaces > 0
          ? `Basado en ${sim.iterations.toLocaleString('es-CL')} simulaciones combinadas de ambos pilotos por equipo en las ${sim.remainingRaces} fecha(s) pendiente(s).`
          : 'Todas las fechas del calendario están completadas: las posiciones de Constructores son definitivas (100%).';
    }

    const top4Teams = teamResults.slice(0, 4);
    topGrid.innerHTML = top4Teams
      .map((t) => {
        const targetRank = t.targetRank || t.bestMathematicalRank || 1;
        const targetChancePct = t.targetChancePct !== undefined ? Number(t.targetChancePct) : t.winProbability;
        const targetSimProb = t.targetSimProbability !== undefined ? Number(t.targetSimProbability) : t.winProbability;
        const mainPctStr = targetChancePct.toFixed(1);
        const targetSimStr = targetSimProb.toFixed(1);
        const driversLabel = t.driverNames && t.driverNames.length > 0 ? t.driverNames.join(' / ') : t.shortName;
        const targetBadgeLabel =
          t.titleStatus === 'champion'
            ? '🏆 ¡Campeón Consagrado! (1°)'
            : targetRank === 1
            ? '🔥 Opción al Mundial (1°)'
            : t.isRankLocked
            ? `🔒 ${targetRank}° Puesto Asegurado`
            : `🎯 Aspira a Máx. ${targetRank}° puesto`;

        return `
          <article class="contender-prob-card clickable-prob-card" data-open-target-req="team" data-entity-id="${escapeHtml(t.id)}" title="Haz clic para ver qué necesita ${escapeHtml(t.name)} y sus rivales para el ${targetRank}° puesto">
            <div class="driver-cell">
              <img src="${escapeHtml(t.image)}" alt="" class="avatar-sm" />
              <div class="driver-info-stack" style="flex:1">
                <span class="driver-name-line">
                  ${escapeHtml(t.name)}
                  <span class="driver-number-tag">${escapeHtml(t.shortName)}</span>
                </span>
                <span class="driver-sub-line">${escapeHtml(driversLabel)} &bull; Actual: ${t.currentPoints} pts (${t.currentRank}°)</span>
              </div>
              <div style="text-align:right">
                <strong style="font-size:1.35rem; color:#ffffff; display:block; line-height:1.1">${mainPctStr}%</strong>
                <span style="font-size:0.7rem; color:var(--text-secondary)">${escapeHtml(targetBadgeLabel)} 🔍</span>
              </div>
            </div>
            <div class="prob-bar-track">
              <div class="prob-bar-fill" style="width:${Math.min(100, Math.max(2, targetChancePct))}%; background:${escapeHtml(t.color)}"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-secondary)">
              <span>Sim. ${targetRank}° puesto: <strong>${targetSimStr}%</strong></span>
              <span>Proyección: <strong>~${t.expectedPoints} pts</strong> (${t.minProjectedPoints}–${t.maxProjectedPoints})</span>
            </div>
          </article>
        `;
      })
      .join('');

    const rowsHtml = teamResults
      .map((t, idx) => {
        const targetRank = t.targetRank || t.bestMathematicalRank || 1;
        const targetChancePct = t.targetChancePct !== undefined ? Number(t.targetChancePct) : t.winProbability;
        const targetSimProb = t.targetSimProbability !== undefined ? Number(t.targetSimProbability) : t.winProbability;
        const podStr = `${t.podiumProbability.toFixed(1)}%`;
        const targetSimStr = `${targetSimProb.toFixed(1)}% (${targetRank}°)`;
        const driversLabel = t.driverNames && t.driverNames.length > 0 ? t.driverNames.join(', ') : 'Sin pilotos';
        const statusLabel =
          t.titleStatusLabel ||
          (targetRank === 1
            ? `Opción al Mundial (1°) • ${targetChancePct.toFixed(1)}%`
            : `Máx. ${targetRank}° puesto • ${targetChancePct.toFixed(1)}%`);

        let statusClass = 'status-eliminated';
        let statusIcon = '🎯';
        if (t.titleStatus === 'champion') {
          statusClass = 'status-champion';
          statusIcon = '🏆';
        } else if (t.titleStatus === 'contender') {
          statusClass = 'status-contender';
          statusIcon = '🔥';
        } else if (t.titleStatus === 'locked') {
          statusClass = 'status-champion';
          statusIcon = '🔒';
        }

        return `
          <tr>
            <th scope="row">
              <div class="driver-cell">
                <span class="pos-badge ${idx < 3 ? `pos-${idx + 1}` : ''}">${idx + 1}</span>
                <span class="team-color-bar" style="background:${escapeHtml(t.color)}"></span>
                <img src="${escapeHtml(t.image)}" alt="" class="avatar-sm" />
                <div class="driver-info-stack">
                  <span class="driver-name-line">${escapeHtml(t.name)}</span>
                  <span class="driver-sub-line">${escapeHtml(driversLabel)}</span>
                </div>
              </div>
            </th>
            <td>${t.currentPoints} pts (${t.currentRank}°)</td>
            <td><span class="points-pill">${t.expectedPoints} pts</span></td>
            <td>${t.minProjectedPoints} – ${t.maxProjectedPoints} pts</td>
            <td>
              <button
                type="button"
                class="target-chance-stack clickable-prob-zone"
                data-open-target-req="team"
                data-entity-id="${escapeHtml(t.id)}"
                title="Haz clic para ver qué necesita ${escapeHtml(t.name)} y sus rivales para el ${targetRank}° puesto"
              >
                <span class="status-badge ${statusClass}">
                  ${statusIcon} ${escapeHtml(statusLabel)} <span class="prob-zone-hint">🔍</span>
                </span>
                <div class="mini-chance-track">
                  <div class="mini-chance-fill" style="width:${Math.min(100, Math.max(2, targetChancePct))}%; background:${escapeHtml(t.color)}"></div>
                </div>
              </button>
            </td>
            <td><strong>${targetSimStr}</strong></td>
            <td>${podStr}</td>
            <td><strong>${t.mostLikelyPosition}° puesto</strong> (${t.mostLikelyPositionProb.toFixed(0)}%)</td>
          </tr>
        `;
      })
      .join('');

    tableContainer.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="sim-teams-prob-caption" class="table-wrapper">
        <table style="
          --label-2: 'Puntos Actuales';
          --label-3: 'Puntos Proyectados';
          --label-4: 'Rango Esperado (P10-P90)';
          --label-5: 'Posición Máx. y % Opción';
          --label-6: 'Prob. Sim. en su Máx.';
          --label-7: 'Prob. Podio (Top 3)';
          --label-8: 'Posición Más Probable';
        ">
          <caption id="sim-teams-prob-caption">Proyección estadística de puntos finales y probabilidades escalonadas de constructores</caption>
          <thead>
            <tr>
              <th>Escudería</th>
              <th>Pts Actuales</th>
              <th>Pts Esperados</th>
              <th>Rango Probable</th>
              <th>Posición Máxima y % Opción</th>
              <th>Prob. Sim. (Máx.)</th>
              <th>Prob. Top 3</th>
              <th>Puesto Más Probable</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    const maxCols = teamResults.length;
    let posHeaders = '';
    for (let p = 1; p <= maxCols; p++) {
      posHeaders += `<th style="text-align:center">${p}°</th>`;
    }

    const matrixRows = teamResults
      .map((t) => {
        let cells = '';
        for (let p = 0; p < maxCols; p++) {
          const prob = t.positionProbabilities[p] || 0;
          const alpha = Math.min(0.85, prob / 100);
          const bg =
            prob >= 0.5
              ? `rgba(34, 211, 238, ${(0.12 + alpha * 0.75).toFixed(2)})`
              : 'transparent';
          const textCol = prob >= 25 ? '#ffffff' : prob >= 1 ? '#cbd5e1' : '#475569';
          cells += `
            <td style="text-align:center">
              <span class="heat-cell" style="background:${bg}; color:${textCol}">
                ${prob >= 0.1 ? `${prob.toFixed(1)}%` : '—'}
              </span>
            </td>
          `;
        }
        return `
          <tr>
            <th scope="row">
              <div class="driver-cell">
                <span class="team-color-bar" style="background:${escapeHtml(t.color)}; height:24px"></span>
                <span>${escapeHtml(t.name)}</span>
              </div>
            </th>
            ${cells}
          </tr>
        `;
      })
      .join('');

    matrixContainer.innerHTML = `
      <div tabindex="0" role="region" aria-labelledby="sim-teams-matrix-caption" class="table-wrapper">
        <table>
          <caption id="sim-teams-matrix-caption">Matriz de probabilidades por posición final de constructores</caption>
          <thead>
            <tr>
              <th>Escudería</th>
              ${posHeaders}
            </tr>
          </thead>
          <tbody>
            ${matrixRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // =========================================================
  // 4. VISTA CALENDARIO DE PISTAS Y RESULTADOS
  // =========================================================
  function renderCalendar() {
    const grid = document.getElementById('calendarTracksGrid');
    const sortedTracks = [...(appState.tracks || [])].sort((a, b) => (a.round || 0) - (b.round || 0));

    if (sortedTracks.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <div class="empty-state-icon">🗓️</div>
          <h3>El calendario aún no tiene pistas cargadas</h3>
          <p>Agrega las fechas de tu campeonato con la imagen de cada circuito y define cuáles tienen formato Sprint.</p>
          <button type="button" class="btn btn-primary" id="btnEmptyAddTrack">➕ Agregar Primera Pista</button>
        </div>
      `;
      const emptyBtn = document.getElementById('btnEmptyAddTrack');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openTrackModal(null));
      return;
    }

    const driversMap = {};
    (appState.drivers || []).forEach((d) => {
      driversMap[d.id] = d;
    });

    const pool = window.ChampionshipEngine.calculateChampionshipPool(appState);

    grid.innerHTML = sortedTracks
      .map((tr) => {
        const mult =
          tr.pointsMultiplier !== undefined && tr.pointsMultiplier !== null
            ? Number(tr.pointsMultiplier)
            : 1;
        const maxDriverPts = Math.round(((tr.hasSprint ? pool.maxDriverSprintRace : pool.maxDriverNormalRace) * (mult === 1 ? 1 : mult)) * 100) / 100;
        const totalTrackPool = Math.round(((tr.hasSprint ? pool.poolPerSprintRace : pool.poolPerNormalRace) * (mult === 1 ? 1 : mult)) * 100) / 100;

        let multBadgeHtml = '';
        if (mult === 0.5) {
          multBadgeHtml = `<span class="track-mult-badge mult-half" title="${escapeHtml(tr.suspensionNote || 'Mitad de puntos (50%)')}">🌧️ 50% PUNTOS</span>`;
        } else if (mult === 2) {
          multBadgeHtml = `<span class="track-mult-badge mult-double" title="${escapeHtml(tr.suspensionNote || 'Puntuación doble (200%)')}">⚡ 2X PUNTOS</span>`;
        } else if (mult === 0) {
          multBadgeHtml = `<span class="track-mult-badge mult-zero" title="${escapeHtml(tr.suspensionNote || 'Carrera suspendida sin puntos')}">🚫 SIN PUNTOS</span>`;
        } else if (tr.suspensionNote) {
          multBadgeHtml = `<span class="track-mult-badge mult-short" title="${escapeHtml(tr.suspensionNote)}">🚩 ACORTADA</span>`;
        }

        const suspensionBannerHtml = tr.suspensionNote
          ? `<div class="track-suspension-banner">${escapeHtml(tr.suspensionNote)}</div>`
          : '';

        let summaryHtml = '';
        if (tr.completed && tr.results && tr.results.raceOrder && tr.results.raceOrder.length > 0) {
          const p1 = driversMap[tr.results.raceOrder[0]];
          const p2 = driversMap[tr.results.raceOrder[1]];
          const p3 = driversMap[tr.results.raceOrder[2]];
          const pole = driversMap[tr.results.poleDriverId];
          const fl = driversMap[tr.results.fastestLapDriverId];

          const stMap = tr.results.driverStatuses || {};
          const allNonClassified = new Set([
            ...(tr.results.dnfDriverIds || []),
            ...Object.keys(stMap)
          ]);
          const dnfCodes = [];
          const dnsCodes = [];
          const dsqCodes = [];
          allNonClassified.forEach((dId) => {
            const st = stMap[dId] || 'DNF';
            const code = driversMap[dId] ? driversMap[dId].code : dId;
            if (st === 'DNS') dnsCodes.push(code);
            else if (st === 'DSQ') dsqCodes.push(code);
            else dnfCodes.push(code);
          });

          const incParts = [];
          if (dnfCodes.length > 0) {
            incParts.push(`<span class="mini-status-pill pill-dnf" title="No terminó (DNF): ${escapeHtml(dnfCodes.join(', '))}">💥 ${dnfCodes.length} DNF</span>`);
          }
          if (dnsCodes.length > 0) {
            incParts.push(`<span class="mini-status-pill pill-dns" title="No empezó (DNS): ${escapeHtml(dnsCodes.join(', '))}">🚫 ${dnsCodes.length} DNS</span>`);
          }
          if (dsqCodes.length > 0) {
            incParts.push(`<span class="mini-status-pill pill-dsq" title="Descalificado (DSQ): ${escapeHtml(dsqCodes.join(', '))}">🏴 ${dsqCodes.length} DSQ</span>`);
          }
          const incidentsRowHtml =
            incParts.length > 0
              ? `<div class="track-incidents-row">${incParts.join('')}</div>`
              : '';

          summaryHtml = `
            <div class="track-podium-box">
              ${suspensionBannerHtml}
              <div>🥇 <strong>1°:</strong> ${p1 ? escapeHtml(p1.name) : '—'}</div>
              <div>🥈 <strong>2°:</strong> ${p2 ? escapeHtml(p2.name) : '—'} &bull; 🥉 <strong>3°:</strong> ${p3 ? escapeHtml(p3.name) : '—'}</div>
              <div style="margin-top:4px; color:var(--text-muted); font-size:0.76rem">
                ⏱️ Pole: ${pole ? escapeHtml(pole.code) : '—'} &bull; 🟣 VR: ${fl ? escapeHtml(fl.code) : '—'}
              </div>
              ${incidentsRowHtml}
            </div>
          `;
        } else {
          summaryHtml = `
            <div class="track-podium-box" style="color:var(--text-muted)">
              ${suspensionBannerHtml}
              ⏳ <strong>Fecha pendiente por correr</strong><br/>
              Reparte ${totalTrackPool} pts en total (máx. ${maxDriverPts} pts para un piloto).
            </div>
          `;
        }

        return `
          <article class="track-card">
            <div class="track-card-banner">
              <span class="track-round-badge">FECHA ${tr.round}</span>
              <div class="track-banner-right-badges">
                ${multBadgeHtml}
                ${tr.hasSprint ? '<span class="track-sprint-badge">⚡ SPRINT</span>' : ''}
              </div>
              <img src="${escapeHtml(tr.image)}" alt="Circuito ${escapeHtml(tr.name)}" class="track-card-img" />
            </div>
            <div class="track-card-body">
              <div style="display:flex; justify-content:space-between; align-items:center">
                <span class="status-badge ${tr.completed ? 'status-contender' : 'status-eliminated'}">
                  ${tr.completed ? '✅ Disputada' : '⏳ Pendiente'}
                </span>
                <span style="font-size:0.76rem; color:var(--text-muted)">${escapeHtml(tr.country || '')}</span>
              </div>
              <h3 class="track-title">${escapeHtml(tr.name)}</h3>
              <p class="track-sub">${escapeHtml(tr.circuit || 'Circuito oficial')}</p>
              ${summaryHtml}
              <div class="track-card-actions">
                <button type="button" class="btn btn-primary btn-sm" style="flex:1" data-action="edit-results" data-track-id="${escapeHtml(tr.id)}">
                  🏁 ${tr.completed ? 'Editar Resultados' : 'Anotar Resultados'}
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="edit-track" data-track-id="${escapeHtml(tr.id)}" title="Editar nombre, formato Sprint o imagen de la pista">
                  ✎ Pista
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // =========================================================
  // 5. VISTA PILOTOS Y ESCUDERÍAS (ROSTERS CON IMÁGENES)
  // =========================================================
  function renderRosters() {
    const teamsGrid = document.getElementById('teamsRosterGrid');
    const driversGrid = document.getElementById('driversRosterGrid');

    const teams = appState.teams || [];
    const drivers = appState.drivers || [];
    const teamsMap = {};
    teams.forEach((t) => {
      teamsMap[t.id] = t;
    });

    if (teams.length === 0) {
      teamsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <div class="empty-state-icon">🛡️</div>
          <h3>Sin escuderías registradas</h3>
          <p>Crea al menos una escudería con su color e imagen para asignarla a tus pilotos.</p>
        </div>
      `;
    } else {
      teamsGrid.innerHTML = teams
        .map((t) => {
          const linkedDrivers = drivers.filter(
            (d) =>
              d.teamId === t.id ||
              (Array.isArray(d.secondaryTeamIds) && d.secondaryTeamIds.includes(t.id))
          );
          const driverCodes =
            linkedDrivers.length > 0
              ? linkedDrivers
                  .map((d) => (d.teamId === t.id ? d.code : `${d.code}*`))
                  .join(', ')
              : 'Sin pilotos';
          return `
            <article class="roster-card" data-team-id="${escapeHtml(t.id)}" style="border-left: 4px solid ${escapeHtml(t.color)}" title="Puedes arrastrar una imagen desde tu PC y soltarla sobre esta tarjeta">
              <img src="${escapeHtml(t.image)}" alt="Logo ${escapeHtml(t.name)}" class="roster-avatar" />
              <div class="roster-info">
                <h3 class="roster-title">${escapeHtml(t.name)}</h3>
                <div class="roster-meta">Sigla: <strong>${escapeHtml(t.shortName)}</strong> &bull; ${linkedDrivers.length} piloto(s)</div>
                <div class="roster-meta" style="color:var(--text-muted)">Pilotos: ${escapeHtml(driverCodes)}</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-action="edit-team" data-team-id="${escapeHtml(t.id)}">
                ✎ Editar
              </button>
            </article>
          `;
        })
        .join('');
    }

    if (drivers.length === 0) {
      driversGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <div class="empty-state-icon">🏎️</div>
          <h3>La parrilla de pilotos está vacía</h3>
          <p>Agrega manualmente a los pilotos del campeonato con su foto o casco personalizado.</p>
        </div>
      `;
    } else {
      driversGrid.innerHTML = drivers
        .map((d) => {
          const team = teamsMap[d.teamId];
          const color = team ? team.color : '#64748b';
          const primaryName = team ? team.name : 'Sin Escudería';
          const extraTeams = (d.secondaryTeamIds || [])
            .filter((tid) => tid && tid !== d.teamId && teamsMap[tid])
            .map((tid) => teamsMap[tid].shortName);
          const teamLabel =
            extraTeams.length > 0
              ? `${primaryName} (+ ${extraTeams.join(', ')})`
              : primaryName;
          return `
            <article class="roster-card" data-driver-id="${escapeHtml(d.id)}" style="border-left: 4px solid ${escapeHtml(color)}" title="Puedes arrastrar una foto desde tu PC y soltarla sobre esta tarjeta">
              <img src="${escapeHtml(d.image)}" alt="Foto ${escapeHtml(d.name)}" class="roster-avatar" />
              <div class="roster-info">
                <h3 class="roster-title">
                  #${escapeHtml(d.number)} ${escapeHtml(d.name)}
                </h3>
                <div class="roster-meta">${escapeHtml(teamLabel)}</div>
                <div class="roster-meta" style="color:var(--text-muted)">
                  Sigla: <strong>${escapeHtml(d.code)}</strong> &bull; Ritmo base: ${d.baseRating || 85}
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-action="edit-driver" data-driver-id="${escapeHtml(d.id)}">
                ✎ Editar
              </button>
            </article>
          `;
        })
        .join('');
    }
  }

  // =========================================================
  // 6. VISTA SISTEMA DE PUNTOS ADAPTABLE
  // =========================================================
  function renderPointsPresetsBar() {
    const bar = document.getElementById('pointsPresetsBar');
    const presets = window.ChampionshipData.POINTS_PRESETS;
    bar.innerHTML = Object.keys(presets)
      .map(
        (key) => `
          <button type="button" class="btn btn-secondary btn-sm" data-preset-key="${escapeHtml(key)}">
            ⚙️ ${escapeHtml(presets[key].name)}
          </button>
        `
      )
      .join('');
  }

  function syncPointsEditorFromState() {
    const ps = appState.pointsSystem;
    editableRacePoints = [...(ps.racePoints || [])];
    editableSprintPoints = [...(ps.sprintPoints || [])];

    document.getElementById('inputFastestLapPoints').value = Number(ps.fastestLapPoints) || 0;
    document.getElementById('inputFastestLapLimit').value = Number(ps.fastestLapTopLimit) || 10;
    document.getElementById('inputPolePoints').value = Number(ps.polePoints) || 0;

    renderPointsInputsGrids();
  }

  function renderPointsInputsGrids() {
    const raceGrid = document.getElementById('racePointsInputsGrid');
    const sprintGrid = document.getElementById('sprintPointsInputsGrid');

    raceGrid.innerHTML = editableRacePoints
      .map(
        (pts, idx) => `
          <div class="point-pos-box">
            <label for="racePtPos_${idx}">${idx + 1}° Puesto</label>
            <input type="number" id="racePtPos_${idx}" min="0" max="500" class="form-control race-pt-input" data-idx="${idx}" value="${Number(pts) || 0}" />
          </div>
        `
      )
      .join('');

    if (editableSprintPoints.length === 0) {
      sprintGrid.innerHTML = `<p class="field-hint" style="grid-column: 1 / -1">Las carreras Sprint están con 0 puestos premiados. Usa "+ Puesto Sprint" si quieres activarlas.</p>`;
    } else {
      sprintGrid.innerHTML = editableSprintPoints
        .map(
          (pts, idx) => `
            <div class="point-pos-box">
              <label for="sprintPtPos_${idx}">${idx + 1}° Sprint</label>
              <input type="number" id="sprintPtPos_${idx}" min="0" max="500" class="form-control sprint-pt-input" data-idx="${idx}" value="${Number(pts) || 0}" />
            </div>
          `
        )
        .join('');
    }

    updatePointsLivePreviewBanner();
  }

  function readPointsInputsFromDom() {
    document.querySelectorAll('.race-pt-input').forEach((inp) => {
      const idx = Number(inp.getAttribute('data-idx'));
      editableRacePoints[idx] = Math.max(0, Number(inp.value) || 0);
    });
    document.querySelectorAll('.sprint-pt-input').forEach((inp) => {
      const idx = Number(inp.getAttribute('data-idx'));
      editableSprintPoints[idx] = Math.max(0, Number(inp.value) || 0);
    });
  }

  function updatePointsLivePreviewBanner() {
    readPointsInputsFromDom();
    const fl = Math.max(0, Number(document.getElementById('inputFastestLapPoints').value) || 0);
    const pole = Math.max(0, Number(document.getElementById('inputPolePoints').value) || 0);
    const raceSum = editableRacePoints.reduce((a, b) => a + b, 0);
    const sprintSum = editableSprintPoints.reduce((a, b) => a + b, 0);

    const maxOneNormal = (editableRacePoints[0] || 0) + fl + pole;
    const maxOneSprint = maxOneNormal + (editableSprintPoints[0] || 0);

    const banner = document.getElementById('pointsLivePreviewBanner');
    banner.innerHTML = `
      <strong>Vista previa en vivo de tu reglamento:</strong><br/>
      &bull; Un fin de semana <strong>Normal</strong> reparte <strong>${raceSum + fl + pole} pts</strong> en total (máx. <strong>${maxOneNormal} pts</strong> para 1 piloto).<br/>
      &bull; Un fin de semana <strong>Sprint</strong> reparte <strong>${raceSum + sprintSum + fl + pole} pts</strong> en total (máx. <strong>${maxOneSprint} pts</strong> para 1 piloto).
    `;
  }

  // =========================================================
  // 7. MODALES DE CREACIÓN / EDICIÓN (PILOTOS, EQUIPOS, PISTAS, RESULTADOS)
  // =========================================================

  // Modal: Piloto
  async function openDriverModal(driverId) {
    const dlg = document.getElementById('dialogDriver');
    const title = document.getElementById('dialogDriverTitle');
    const deleteBtn = document.getElementById('btnDeleteDriver');
    const teamSelect = document.getElementById('driverTeamSelect');
    const secondaryBox = document.getElementById('driverSecondaryTeamsBox');
    const localSelect = document.getElementById('driverLocalFolderSelect');

    // Poblar selector de escuderías
    const teams = appState.teams || [];
    teamSelect.innerHTML =
      `<option value="">— Sin escudería / Independiente —</option>` +
      teams.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');

    const existing = driverId ? (appState.drivers || []).find((d) => d.id === driverId) : null;
    const secondaryIds = new Set((existing && existing.secondaryTeamIds) || []);

    if (existing) {
      title.textContent = `Editar Piloto: ${existing.name}`;
      document.getElementById('driverIdInput').value = existing.id;
      document.getElementById('driverNameInput').value = existing.name;
      document.getElementById('driverCodeInput').value = existing.code;
      document.getElementById('driverNumberInput').value = existing.number;
      document.getElementById('driverCountryInput').value = existing.country || '';
      document.getElementById('driverRatingInput').value = existing.baseRating || 88;
      teamSelect.value = existing.teamId || '';
      currentDriverModalImage = existing.image;
      deleteBtn.hidden = false;
    } else {
      title.textContent = 'Inscribir Nuevo Piloto';
      document.getElementById('driverIdInput').value = '';
      document.getElementById('driverNameInput').value = '';
      document.getElementById('driverCodeInput').value = '';
      const randNum = Math.floor(2 + Math.random() * 97);
      document.getElementById('driverNumberInput').value = randNum;
      document.getElementById('driverCountryInput').value = '';
      document.getElementById('driverRatingInput').value = 88;
      teamSelect.value = teams[0] ? teams[0].id : '';
      const defaultColor = teams[0] ? teams[0].color : '#e10600';
      currentDriverModalImage = window.ChampionshipData.createHelmetSvg(defaultColor, '#ffffff', String(randNum));
      deleteBtn.hidden = true;
    }

    if (secondaryBox) {
      secondaryBox.innerHTML = teams
        .map(
          (t) => `
            <label class="multi-check-item">
              <input type="checkbox" class="driver-sec-team-chk" value="${escapeHtml(t.id)}" ${secondaryIds.has(t.id) ? 'checked' : ''} />
              <span class="team-color-bar" style="background:${escapeHtml(t.color)}; height:14px"></span>
              <span>${escapeHtml(t.name)} (${escapeHtml(t.shortName)})</span>
            </label>
          `
        )
        .join('');
    }

    if (localSelect) {
      localSelect.innerHTML = `<option value="">📂 Elegir de la carpeta imagenes/pilotos/...</option>`;
      if (window.desktopAPI && window.desktopAPI.listLocalImages) {
        try {
          const res = await window.desktopAPI.listLocalImages();
          if (res && res.ok && Array.isArray(res.drivers)) {
            localSelect.innerHTML =
              `<option value="">📂 Elegir de la carpeta imagenes/pilotos/ (${res.drivers.length} archivo(s))...</option>` +
              res.drivers
                .map(
                  (f, i) =>
                    `<option value="${i}" data-uri="${escapeHtml(f.dataUri)}">🖼️ ${escapeHtml(f.fileName)}</option>`
                )
                .join('');
          }
        } catch (_e) {
          // Ignorar error silenciosamente
        }
      }
    }

    document.getElementById('driverImagePreview').src = currentDriverModalImage;
    document.getElementById('driverImageFile').value = '';
    dlg.showModal();
  }

  // Modal: Escudería
  async function openTeamModal(teamId) {
    const dlg = document.getElementById('dialogTeam');
    const title = document.getElementById('dialogTeamTitle');
    const deleteBtn = document.getElementById('btnDeleteTeam');
    const driversBox = document.getElementById('teamDriversAssignBox');
    const localSelect = document.getElementById('teamLocalFolderSelect');

    const existing = teamId ? (appState.teams || []).find((t) => t.id === teamId) : null;
    if (existing) {
      title.textContent = `Editar Escudería: ${existing.name}`;
      document.getElementById('teamIdInput').value = existing.id;
      document.getElementById('teamNameInput').value = existing.name;
      document.getElementById('teamShortInput').value = existing.shortName;
      document.getElementById('teamColorInput').value = existing.color || '#e10600';
      document.getElementById('teamColorHexText').textContent = existing.color || '#e10600';
      currentTeamModalImage = existing.image;
      deleteBtn.hidden = false;
    } else {
      title.textContent = 'Nueva Escudería';
      document.getElementById('teamIdInput').value = '';
      document.getElementById('teamNameInput').value = '';
      document.getElementById('teamShortInput').value = '';
      document.getElementById('teamColorInput').value = '#e10600';
      document.getElementById('teamColorHexText').textContent = '#e10600';
      currentTeamModalImage = window.ChampionshipData.createTeamSvg('#e10600', 'F1');
      deleteBtn.hidden = true;
    }

    if (driversBox) {
      const drivers = appState.drivers || [];
      driversBox.innerHTML = drivers
        .map((d) => {
          const isLinked =
            existing &&
            (d.teamId === existing.id ||
              (Array.isArray(d.secondaryTeamIds) && d.secondaryTeamIds.includes(existing.id)));
          const roleBadge = existing && d.teamId === existing.id ? ' (Titular)' : '';
          return `
            <label class="multi-check-item">
              <input type="checkbox" class="team-driver-assign-chk" value="${escapeHtml(d.id)}" ${isLinked ? 'checked' : ''} />
              <span>#${escapeHtml(d.number)} ${escapeHtml(d.name)} (${escapeHtml(d.code)})${escapeHtml(roleBadge)}</span>
            </label>
          `;
        })
        .join('');
    }

    if (localSelect) {
      localSelect.innerHTML = `<option value="">📂 Elegir de la carpeta imagenes/equipos/...</option>`;
      if (window.desktopAPI && window.desktopAPI.listLocalImages) {
        try {
          const res = await window.desktopAPI.listLocalImages();
          if (res && res.ok && Array.isArray(res.teams)) {
            localSelect.innerHTML =
              `<option value="">📂 Elegir de la carpeta imagenes/equipos/ (${res.teams.length} archivo(s))...</option>` +
              res.teams
                .map(
                  (f, i) =>
                    `<option value="${i}" data-uri="${escapeHtml(f.dataUri)}">🛡️ ${escapeHtml(f.fileName)}</option>`
                )
                .join('');
          }
        } catch (_e) {
          // Ignorar error silenciosamente
        }
      }
    }

    document.getElementById('teamImagePreview').src = currentTeamModalImage;
    document.getElementById('teamImageFile').value = '';
    dlg.showModal();
  }

  // Modal: Pista / Fecha
  function openTrackModal(trackId) {
    const dlg = document.getElementById('dialogTrack');
    const title = document.getElementById('dialogTrackTitle');
    const deleteBtn = document.getElementById('btnDeleteTrack');

    const existing = trackId ? (appState.tracks || []).find((t) => t.id === trackId) : null;
    if (existing) {
      title.textContent = `Editar Fecha: ${existing.name}`;
      document.getElementById('trackIdInput').value = existing.id;
      document.getElementById('trackRoundInput').value = existing.round;
      document.getElementById('trackCountryInput').value = existing.country || '';
      document.getElementById('trackNameInput').value = existing.name;
      document.getElementById('trackCircuitInput').value = existing.circuit || '';
      document.getElementById('trackHasSprintInput').checked = Boolean(existing.hasSprint);
      currentTrackModalImage = existing.image;
      deleteBtn.hidden = false;
    } else {
      const nextRound = (appState.tracks || []).length + 1;
      title.textContent = 'Agregar Nueva Pista / Fecha';
      document.getElementById('trackIdInput').value = '';
      document.getElementById('trackRoundInput').value = nextRound;
      document.getElementById('trackCountryInput').value = '';
      document.getElementById('trackNameInput').value = '';
      document.getElementById('trackCircuitInput').value = '';
      document.getElementById('trackHasSprintInput').checked = false;
      currentTrackModalImage = window.ChampionshipData.createTrackSvg('#22d3ee', nextRound);
      deleteBtn.hidden = true;
    }

    const catalogSelect = document.getElementById('trackCatalogSelect');
    if (catalogSelect && Array.isArray(window.F1TracksCatalog)) {
      catalogSelect.innerHTML =
        `<option value="">🗺️ Elegir de la biblioteca de 30 trazados reales F1...</option>` +
        window.F1TracksCatalog.map(
          (c) => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.label)}</option>`
        ).join('');
      catalogSelect.value = '';
    }

    document.getElementById('trackImagePreview').src = currentTrackModalImage;
    document.getElementById('trackImageFile').value = '';
    dlg.showModal();
  }

  // Modal: Resultados de Carrera (Tablero Drag & Drop)
  let activeResultsSession = 'race'; // 'race' | 'sprint'
  let modalRaceSlots = [];
  let modalSprintSlots = [];
  let modalDnfSet = new Set();
  let modalDriverTeams = {};
  let draggedDriverState = null; // { driverId, sourceSlot }

  function openRaceResultsModal(trackId) {
    const track = (appState.tracks || []).find((t) => t.id === trackId);
    if (!track) return;

    const drivers = appState.drivers || [];
    if (drivers.length === 0) {
      showToast('Primero agrega pilotos en la pestaña "Pilotos y Escuderías" para poder anotar resultados.');
      return;
    }

    const dlg = document.getElementById('dialogRaceResults');
    document.getElementById('resultsTrackIdInput').value = track.id;
    document.getElementById('resultsModalRoundLabel').textContent =
      `FECHA ${track.round} ${track.hasSprint ? '• FORMATO SPRINT' : '• FORMATO ESTÁNDAR'}`;
    document.getElementById('dialogRaceResultsTitle').textContent = `Resultados: ${track.name}`;

    const nDrivers = drivers.length;
    const allDriverIds = drivers.map((d) => d.id);

    // Si la carrera ya estaba completada, cargamos los casilleros; si está pendiente, dejamos todos en el Paddock para arrastrar
    const savedRaceOrder = (track.results && track.results.raceOrder) || [];
    if (track.completed && savedRaceOrder.length > 0) {
      const validSaved = savedRaceOrder.filter((id) => allDriverIds.includes(id));
      modalRaceSlots = Array.from({ length: nDrivers }, (_, i) => validSaved[i] || null);
    } else {
      modalRaceSlots = new Array(nDrivers).fill(null);
    }

    const savedSprintOrder = (track.results && track.results.sprintOrder) || [];
    if (track.completed && savedSprintOrder.length > 0) {
      const validSprint = savedSprintOrder.filter((id) => allDriverIds.includes(id));
      modalSprintSlots = Array.from({ length: nDrivers }, (_, i) => validSprint[i] || null);
    } else {
      modalSprintSlots = new Array(nDrivers).fill(null);
    }

    modalDriverStatuses = { ...((track.results && track.results.driverStatuses) || {}) };
    ((track.results && track.results.dnfDriverIds) || []).forEach((id) => {
      if (!modalDriverStatuses[id]) modalDriverStatuses[id] = 'DNF';
    });
    syncDnfSetFromStatuses();
    const multSel = document.getElementById('resultsPointsMultiplierSelect');
    if (multSel) {
      multSel.value = String(
        track.pointsMultiplier !== undefined && track.pointsMultiplier !== null ? track.pointsMultiplier : 1
      );
    }
    modalDriverTeams = { ...((track.results && track.results.driverTeams) || {}) };
    drivers.forEach((d) => {
      if (!modalDriverTeams[d.id] && d.teamId) {
        modalDriverTeams[d.id] = d.teamId;
      }
    });

    const optionsHtml =
      `<option value="">— Sin asignar —</option>` +
      drivers
        .map((d) => `<option value="${escapeHtml(d.id)}">#${escapeHtml(d.number)} ${escapeHtml(d.name)} (${escapeHtml(d.code)})</option>`)
        .join('');

    const poleSel = document.getElementById('resultsPoleSelect');
    const flSel = document.getElementById('resultsFastestLapSelect');
    poleSel.innerHTML = optionsHtml;
    flSel.innerHTML = optionsHtml;
    poleSel.value = (track.results && track.results.poleDriverId) || modalRaceSlots[0] || '';
    flSel.value = (track.results && track.results.fastestLapDriverId) || modalRaceSlots[0] || '';

    const btnSprintTab = document.getElementById('btnTabSprintSession');
    if (btnSprintTab) {
      btnSprintTab.hidden = !track.hasSprint;
    }
    setActiveResultsSession('race');

    dlg.showModal();
  }

  function setActiveResultsSession(session) {
    activeResultsSession = session === 'sprint' ? 'sprint' : 'race';
    document.querySelectorAll('[data-results-session]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-results-session') === activeResultsSession);
    });
    const titleEl = document.getElementById('dndPositionsPanelTitle');
    if (titleEl) {
      titleEl.textContent =
        activeResultsSession === 'sprint'
          ? '⚡ Posiciones de Llegada — Carrera Sprint'
          : '🏁 Posiciones de Llegada — Carrera Principal';
    }
    renderDndBoard();
  }

  function getActiveSlotsArray() {
    return activeResultsSession === 'sprint' ? modalSprintSlots : modalRaceSlots;
  }

  function renderDndBoard() {
    const paddockZone = document.getElementById('dndPaddockZone');
    const positionsList = document.getElementById('dndPositionsList');
    const paddockCountEl = document.getElementById('dndPaddockCount');
    if (!paddockZone || !positionsList) return;

    const drivers = appState.drivers || [];
    const teamsMap = {};
    (appState.teams || []).forEach((t) => {
      teamsMap[t.id] = t;
    });
    const driversMap = {};
    drivers.forEach((d) => {
      driversMap[d.id] = d;
    });

    const slots = getActiveSlotsArray();
    const assignedSet = new Set(slots.filter(Boolean));
    const unassignedDrivers = drivers.filter((d) => !assignedSet.has(d.id));

    if (paddockCountEl) {
      paddockCountEl.textContent = String(unassignedDrivers.length);
    }

    // 1. Renderizar Paddock (Pilotos disponibles para arrastrar o hacer clic)
    if (unassignedDrivers.length === 0) {
      paddockZone.innerHTML = `
        <div class="field-hint" style="grid-column: 1 / -1; text-align: center; padding: 26px 10px;">
          ✅ Todos los pilotos ya están ubicados en una posición.<br/>
          Puedes arrastrar pilotos entre puestos para reordenarlos o soltarlos aquí para sacarlos.
        </div>
      `;
    } else {
      paddockZone.innerHTML = unassignedDrivers
        .map((d) => {
          const team = teamsMap[d.teamId];
          const color = team ? team.color : '#64748b';
          return `
            <div class="dnd-driver-chip" draggable="true" data-driver-id="${escapeHtml(d.id)}" data-source-slot="-1" title="Arrastra a una posición o haz clic para enviar al primer puesto vacío">
              <span class="team-color-bar" style="background:${escapeHtml(color)}; height:26px"></span>
              <img src="${escapeHtml(d.image)}" alt="" class="chip-avatar" />
              <div class="chip-text">
                <span class="chip-code-line">
                  ${escapeHtml(d.code)}
                  <span class="driver-number-tag">#${escapeHtml(d.number)}</span>
                </span>
                <span class="chip-name-sub">${escapeHtml(d.name)}</span>
              </div>
            </div>
          `;
        })
        .join('');
    }

    // 2. Renderizar Casilleros de Posiciones (1° a N°)
    const ptsTable =
      activeResultsSession === 'sprint'
        ? appState.pointsSystem.sprintPoints || []
        : appState.pointsSystem.racePoints || [];
    const poleId = document.getElementById('resultsPoleSelect').value;
    const flId = document.getElementById('resultsFastestLapSelect').value;
    const isMainRace = activeResultsSession === 'race';
    const raceMult = isMainRace ? getResultsMultiplier() : 1;
    const fmtPts = (v) => Math.round(v * 100) / 100;

    positionsList.innerHTML = slots
      .map((driverId, idx) => {
        const pos = idx + 1;
        const pts = fmtPts((ptsTable[idx] || 0) * raceMult);
        const posBadgeClass = pos <= 3 ? `pos-${pos}` : '';
        const driver = driverId ? driversMap[driverId] : null;

        if (!driver) {
          return `
            <div class="dnd-slot-row" data-slot-idx="${idx}">
              <div class="slot-pos-col">
                <span class="pos-badge ${posBadgeClass}">${pos}°</span>
                ${pts > 0 ? `<span class="slot-pts-tag">+${pts} pts</span>` : ''}
              </div>
              <div class="slot-empty-placeholder">
                <span>Soltar piloto para el ${pos}° puesto...</span>
                ${pts > 0 ? `<span>Zona de puntos</span>` : ''}
              </div>
            </div>
          `;
        }

        const activeTeamId = modalDriverTeams[driver.id] || driver.teamId || '';
        const team = teamsMap[activeTeamId] || teamsMap[driver.teamId];
        const color = team ? team.color : '#64748b';
        const driverStatus = isMainRace ? modalDriverStatuses[driver.id] || '' : '';
        const isDnf = Boolean(driverStatus);
        const isPole = isMainRace && poleId === driver.id;
        const isFl = isMainRace && flId === driver.id;

        const teamOptionsHtml = (appState.teams || [])
          .map(
            (t) =>
              `<option value="${escapeHtml(t.id)}" ${t.id === activeTeamId ? 'selected' : ''}>🛡️ ${escapeHtml(t.shortName)}</option>`
          )
          .join('');

        const mainRaceBadges = isMainRace
          ? `
            <select class="slot-team-select" data-slot-team-driver="${escapeHtml(driver.id)}" title="Escudería con la que el piloto sumó puntos en esta fecha (útil si cambió de equipo)">
              <option value="">IND</option>
              ${teamOptionsHtml}
            </select>
            <button type="button" class="chip-toggle-btn ${isPole ? 'active-pole' : ''}" data-slot-action="toggle-pole" data-driver-id="${escapeHtml(driver.id)}" title="Marcar Pole Position">
              ⏱️ Pole
            </button>
            <button type="button" class="chip-toggle-btn ${isFl ? 'active-fl' : ''}" data-slot-action="toggle-fl" data-driver-id="${escapeHtml(driver.id)}" title="Marcar Vuelta Rápida">
              🟣 VR
            </button>
            <button type="button" class="chip-toggle-btn status-btn ${driverStatus === 'DNF' ? 'active-dnf' : ''}" data-slot-action="toggle-status" data-status="DNF" data-driver-id="${escapeHtml(driver.id)}" title="No terminó la carrera (Abandono)">
              DNF
            </button>
            <button type="button" class="chip-toggle-btn status-btn ${driverStatus === 'DNS' ? 'active-dns' : ''}" data-slot-action="toggle-status" data-status="DNS" data-driver-id="${escapeHtml(driver.id)}" title="No empezó la carrera (No largó)">
              DNS
            </button>
            <button type="button" class="chip-toggle-btn status-btn ${driverStatus === 'DSQ' ? 'active-dsq' : ''}" data-slot-action="toggle-status" data-status="DSQ" data-driver-id="${escapeHtml(driver.id)}" title="Descalificado">
              DSQ
            </button>
          `
          : '';

        const statusLabels = { DNF: '💥 DNF', DNS: '🚫 DNS', DSQ: '🏴 DSQ' };
        const slotTagHtml = driverStatus
          ? `<span class="slot-pts-tag slot-status-tag status-${driverStatus.toLowerCase()}">${statusLabels[driverStatus]}</span>`
          : pts > 0
          ? `<span class="slot-pts-tag">+${pts} pts</span>`
          : '';

        return `
          <div class="dnd-slot-row" data-slot-idx="${idx}">
            <div class="slot-pos-col">
              <span class="pos-badge ${posBadgeClass}">${pos}°</span>
              ${slotTagHtml}
            </div>
            <div class="slot-filled-card ${isDnf ? `is-dnf is-${driverStatus.toLowerCase()}` : ''}" draggable="true" data-driver-id="${escapeHtml(driver.id)}" data-source-slot="${idx}">
              <div class="driver-cell" style="min-width: 0">
                <span class="drag-handle" tabindex="0" data-slot-idx="${idx}" aria-label="Mover a ${escapeHtml(driver.name)} con arrastrar o flechas arriba y abajo" title="Arrastra o usa las flechas Arriba/Abajo">⠿</span>
                <span class="team-color-bar" style="background:${escapeHtml(color)}; height:28px"></span>
                <img src="${escapeHtml(driver.image)}" alt="" class="chip-avatar" />
                <div class="driver-info-stack" style="min-width:0">
                  <span class="driver-name-line" style="font-size:0.86rem">
                    ${escapeHtml(driver.name)}
                    <span class="driver-number-tag">#${escapeHtml(driver.number)}</span>
                  </span>
                  <span class="driver-sub-line">${escapeHtml(team ? team.shortName : 'IND')} &bull; ${escapeHtml(driver.code)}</span>
                </div>
              </div>
              <div class="slot-actions-group">
                ${mainRaceBadges}
                <button type="button" class="chip-icon-btn" data-slot-action="move-up" data-slot-idx="${idx}" title="Subir un puesto" ${idx === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="chip-icon-btn" data-slot-action="move-down" data-slot-idx="${idx}" title="Bajar un puesto" ${idx === slots.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="chip-icon-btn" data-slot-action="remove-slot" data-slot-idx="${idx}" title="Quitar y devolver al Paddock">✕</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // =========================================================
  // 8. ARCHIVO HISTÓRICO F1 (1950–2026)
  // =========================================================
  let histActiveSubtab = 'seasons'; // 'seasons' | 'drivers' | 'constructors' | 'circuits'
  let histSearchQuery = '';
  let histFilterValue = 'all';
  let histRenderLimit = 48;
  let cachedHistCatalog = null;

  async function getHistoricalCatalogData() {
    if (cachedHistCatalog) return cachedHistCatalog;
    if (window.F1HistoricalCatalog && Array.isArray(window.F1HistoricalCatalog.seasons)) {
      cachedHistCatalog = window.F1HistoricalCatalog;
      return cachedHistCatalog;
    }
    if (window.desktopAPI && typeof window.desktopAPI.getHistoricalCatalog === 'function') {
      try {
        const raw = await window.desktopAPI.getHistoricalCatalog();
        if (raw) {
          cachedHistCatalog = JSON.parse(raw);
          return cachedHistCatalog;
        }
      } catch (_err) {
        // Fallback silencioso
      }
    }
    return null;
  }

  async function fetchHistoricalSeasonRaw(year) {
    const yStr = String(year);
    if (window.F1HistoricalSeasons && window.F1HistoricalSeasons[yStr]) {
      return JSON.parse(JSON.stringify(window.F1HistoricalSeasons[yStr]));
    }
    if (window.desktopAPI && typeof window.desktopAPI.loadHistoricalSeason === 'function') {
      try {
        const raw = await window.desktopAPI.loadHistoricalSeason(Number(year));
        if (raw) return JSON.parse(raw);
      } catch (_err) {
        // Fallback
      }
    }
    return null;
  }

  async function loadHistoricalSeasonIntoApp(year, mode = 'full', maxRound = 0) {
    const rawSeason = await fetchHistoricalSeasonRaw(year);
    if (!rawSeason) {
      showToast(`No encontramos los datos de la temporada ${year}.`);
      return;
    }

    if (mode === 'zero') {
      (rawSeason.tracks || []).forEach((tr) => {
        tr.completed = false;
        tr.results = {
          poleDriverId: '',
          fastestLapDriverId: '',
          raceOrder: [],
          dnfDriverIds: [],
          sprintOrder: [],
          driverTeams: {}
        };
      });
    } else if (mode === 'mid') {
      const cutoff = Math.max(0, Number(maxRound) || 0);
      (rawSeason.tracks || []).forEach((tr) => {
        if (tr.round > cutoff) {
          tr.completed = false;
          tr.results = {
            poleDriverId: '',
            fastestLapDriverId: '',
            raceOrder: [],
            dnfDriverIds: [],
            sprintOrder: [],
            driverTeams: {}
          };
        }
      });
    }

    if (window.ChampionshipData && typeof window.ChampionshipData.hydrateSeasonStateVisuals === 'function') {
      window.ChampionshipData.hydrateSeasonStateVisuals(rawSeason);
    }

    appState = rawSeason;
    const totalRaces = (appState.tracks || []).length;
    const compRaces = (appState.tracks || []).filter((t) => t.completed).length;

    let msg = `🏁 Temporada F1 ${year} cargada (${compRaces}/${totalRaces} fechas disputadas).`;
    if (mode === 'zero') {
      msg = `🎲 Temporada F1 ${year} lista desde la Fecha 1 (0 pts — ¡Todos al 100% para simular!).`;
    } else if (mode === 'mid') {
      msg = `⏱️ Temporada F1 ${year} cargada hasta la Fecha ${compRaces} de ${totalRaces}. ¡Prueba las predicciones!`;
    }

    await persistAndRender(msg);
    switchTab('dashboard');
  }

  async function openHistMidSeasonModal(year) {
    const rawSeason = await fetchHistoricalSeasonRaw(year);
    if (!rawSeason || !Array.isArray(rawSeason.tracks) || rawSeason.tracks.length === 0) return;

    const dlg = document.getElementById('dialogHistMidSeason');
    document.getElementById('histMidYearInput').value = String(year);
    document.getElementById('dialogHistMidTitle').textContent =
      `⏱️ Cargar Temporada ${year} a Mitad de Camino`;

    const sel = document.getElementById('histMidRoundSelect');
    const tracks = rawSeason.tracks;
    const defaultMid = Math.max(1, Math.floor(tracks.length / 2));

    sel.innerHTML =
      `<option value="0">Fecha 0 — Antes de iniciar la temporada (Todos en 0 pts y 100%)</option>` +
      tracks
        .map(
          (tr) =>
            `<option value="${tr.round}" ${tr.round === defaultMid ? 'selected' : ''}>Hasta Fecha ${tr.round} de ${tracks.length}: ${escapeHtml(tr.name)} (${escapeHtml(tr.circuit)})</option>`
        )
        .join('');

    dlg.showModal();
  }

  function updateHistFilterDropdown(cat) {
    const sel = document.getElementById('histFilterSelect');
    if (!sel) return;

    if (histActiveSubtab === 'seasons') {
      sel.innerHTML = `
        <option value="all">Todas las décadas (1950–2026)</option>
        <option value="2020s">Década 2020s (2020–2026)</option>
        <option value="2010s">Década 2010s (2010–2019)</option>
        <option value="2000s">Década 2000s (2000–2009)</option>
        <option value="1990s">Década 1990s (1990–1999)</option>
        <option value="1980s">Década 1980s (1980–1989)</option>
        <option value="1970s">Década 1970s (1970–1979)</option>
        <option value="1960s">Década 1960s (1960–1969)</option>
        <option value="1950s">Década 1950s (1950–1959)</option>
      `;
    } else if (histActiveSubtab === 'drivers') {
      sel.innerHTML = `
        <option value="all">Todos los pilotos (${cat ? cat.drivers.length : 920})</option>
        <option value="champions">🏆 Campeones del Mundo</option>
        <option value="winners">🥇 Ganadores de Gran Premio</option>
        <option value="podiums">🍾 Pilotos con Podios</option>
        <option value="points">✨ Pilotos con Puntos en F1</option>
      `;
    } else if (histActiveSubtab === 'constructors') {
      sel.innerHTML = `
        <option value="all">Todas las escuderías (${cat ? cat.constructors.length : 187})</option>
        <option value="champions">🏆 Campeonas de Constructores</option>
        <option value="winners">🥇 Ganadoras de Gran Premio</option>
        <option value="podiums">🍾 Escuderías con Podios</option>
      `;
    } else {
      sel.innerHTML = `
        <option value="all">Todos los circuitos (${cat ? cat.circuits.length : 78})</option>
        <option value="RACE">🏟️ Autódromos Permanentes</option>
        <option value="STREET">🏙️ Circuitos Callejeros</option>
        <option value="ROAD">🛣️ Circuitos Ruteros Clásicos</option>
      `;
    }
    sel.value = histFilterValue;
    if (sel.value !== histFilterValue) {
      histFilterValue = 'all';
      sel.value = 'all';
    }
  }

  async function renderHistoryView() {
    const cat = await getHistoricalCatalogData();
    const container = document.getElementById('histContentContainer');
    const summaryEl = document.getElementById('histResultsSummary');
    const loadMoreWrap = document.getElementById('histLoadMoreWrap');
    if (!container || !cat) return;

    // Poblar selector rápido de año en el header si está vacío
    const quickYearSel = document.getElementById('histQuickYearSelect');
    if (quickYearSel && quickYearSel.options.length === 0) {
      quickYearSel.innerHTML = cat.seasons
        .map(
          (s) =>
            `<option value="${s.year}">Temporada ${s.year} (${s.raceCount} GPs — ${escapeHtml(s.championDriver.name)})</option>`
        )
        .join('');
    }

    // Actualizar KPIs
    const kpiSeasons = document.getElementById('histKpiSeasons');
    const kpiDrivers = document.getElementById('histKpiDrivers');
    const kpiTeamsTracks = document.getElementById('histKpiTeamsAndTracks');
    if (kpiSeasons) kpiSeasons.textContent = `${cat.stats.totalSeasons} Temporadas`;
    if (kpiDrivers) kpiDrivers.textContent = `${cat.stats.totalDrivers} Pilotos`;
    if (kpiTeamsTracks) {
      kpiTeamsTracks.textContent = `${cat.stats.totalConstructors} Equipos • ${cat.stats.totalCircuits} Pistas`;
    }

    const q = histSearchQuery
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const norm = (str) =>
      String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (histActiveSubtab === 'seasons') {
      const filtered = cat.seasons.filter((s) => {
        if (histFilterValue !== 'all' && s.decade !== histFilterValue) return false;
        if (!q) return true;
        return (
          String(s.year).includes(q) ||
          norm(s.championDriver.name).includes(q) ||
          norm(s.championTeam.name).includes(q) ||
          norm(s.pointsSystemLabel).includes(q)
        );
      });

      summaryEl.innerHTML = `<span>Mostrando <strong>${filtered.length}</strong> de ${cat.seasons.length} temporadas oficiales (1950–2026)</span><span>💡 Elige cargar la temporada completa, desde cero (todos al 100%) o a mitad de camino</span>`;
      loadMoreWrap.hidden = true;

      container.innerHTML = filtered
        .map((s) => {
          const isCurrentLoaded = String(appState.meta.seasonYear) === String(s.year);
          return `
            <article class="hist-card" style="border-top: 3px solid ${escapeHtml(s.championTeam.color || '#e10600')}">
              <div>
                <div class="hist-card-header">
                  <div class="hist-year-badge">
                    <span>${s.year}</span>
                    <span class="hist-decade-pill">${escapeHtml(s.decade)}</span>
                    ${isCurrentLoaded ? `<span class="status-pill status-champion" style="font-size:0.68rem">ACTIVA</span>` : ''}
                  </div>
                  <span class="hist-points-tag" title="Reglamento de puntos de la temporada ${s.year}">⚖️ ${escapeHtml(s.pointsSystemLabel)}</span>
                </div>

                <div class="hist-champions-box" style="margin-top: 12px">
                  <div class="hist-champ-row">
                    <span class="hist-champ-label">🏆 Campeón Pilotos</span>
                    <span class="hist-champ-val">${escapeHtml(s.championDriver.name)} ${s.championDriver.points ? `<span style="color:var(--accent-amber)">(${s.championDriver.points} pts)</span>` : ''}</span>
                  </div>
                  <div class="hist-champ-row">
                    <span class="hist-champ-label">🛡️ Campeón Equipos</span>
                    <span class="hist-champ-val" style="color:${escapeHtml(s.championTeam.color || '#fff')}">${escapeHtml(s.championTeam.name)}</span>
                  </div>
                </div>

                <div class="hist-stats-row" style="margin-top: 10px">
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${s.raceCount}</span>
                    <span class="hist-stat-lbl">Fechas GP</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${s.driverCount}</span>
                    <span class="hist-stat-lbl">Pilotos</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${s.teamCount}</span>
                    <span class="hist-stat-lbl">Equipos</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${s.completedCount}/${s.raceCount}</span>
                    <span class="hist-stat-lbl">Completadas</span>
                  </div>
                </div>
              </div>

              <div class="hist-actions-row">
                <button type="button" class="btn btn-primary btn-sm" data-hist-action="load-full" data-year="${s.year}" title="Cargar la temporada ${s.year} con todos sus resultados históricos reales">
                  🏁 Completa
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-hist-action="load-zero" data-year="${s.year}" title="Cargar parrilla y calendario de ${s.year} en 0 puntos (todos con 100% de chance) para simular">
                  🎲 Desde Cero
                </button>
                <button type="button" class="btn btn-ghost btn-sm" data-hist-action="load-mid" data-year="${s.year}" title="Elegir hasta qué fecha de ${s.year} dejar completada para probar predicciones">
                  ⏱️ Hasta Fecha...
                </button>
              </div>
            </article>
          `;
        })
        .join('');
      return;
    }

    if (histActiveSubtab === 'drivers') {
      const filtered = cat.drivers.filter((d) => {
        if (histFilterValue === 'champions' && d.titles < 1) return false;
        if (histFilterValue === 'winners' && d.wins < 1) return false;
        if (histFilterValue === 'podiums' && d.podiums < 1) return false;
        if (histFilterValue === 'points' && d.points <= 0) return false;
        if (!q) return true;
        return (
          norm(d.name).includes(q) ||
          norm(d.code).includes(q) ||
          norm(d.countryName).includes(q) ||
          norm(d.country).includes(q) ||
          norm(d.primaryTeamName).includes(q) ||
          String(d.firstYear).includes(q) ||
          String(d.lastYear).includes(q)
        );
      });

      const visible = filtered.slice(0, histRenderLimit);
      summaryEl.innerHTML = `<span>Mostrando <strong>${visible.length}</strong> de <strong>${filtered.length}</strong> pilotos históricos encontrados (Total: ${cat.drivers.length})</span><span>💡 Puedes inscribir a cualquier leyenda en tu campeonato actual con 1 clic</span>`;
      loadMoreWrap.hidden = visible.length >= filtered.length;

      container.innerHTML = visible
        .map((d) => {
          const helmetImg = window.ChampionshipData.createHelmetSvg(
            d.primaryColor || '#e10600',
            '#ffffff',
            String(d.number || 1)
          );
          const alreadyInChamp = (appState.drivers || []).some(
            (existing) => existing.id === d.id || norm(existing.name) === norm(d.name)
          );
          return `
            <article class="hist-card" style="border-left: 4px solid ${escapeHtml(d.primaryColor || '#e10600')}">
              <div>
                <div class="hist-entity-top">
                  <img src="${helmetImg}" alt="${escapeHtml(d.name)}" class="hist-entity-avatar" />
                  <div style="flex:1; min-width:0">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px">
                      <h3 class="roster-title">${escapeHtml(d.name)}</h3>
                      <span class="driver-code-tag">#${escapeHtml(d.number)} ${escapeHtml(d.code)}</span>
                    </div>
                    <div class="roster-meta">
                      🌍 ${escapeHtml(d.countryName)} (${escapeHtml(d.country)}) &bull; 📅 ${d.firstYear}–${d.lastYear}
                    </div>
                    <div class="roster-meta" style="color:${escapeHtml(d.primaryColor)}; font-weight:700">
                      🛡️ ${escapeHtml(d.primaryTeamName)} &bull; ⚡ Nivel ${d.baseRating}
                    </div>
                  </div>
                </div>

                <div class="hist-stats-row" style="margin-top: 12px">
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num" style="color:${d.titles > 0 ? 'var(--accent-amber)' : '#fff'}">${d.titles}</span>
                    <span class="hist-stat-lbl">Títulos</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${d.wins}</span>
                    <span class="hist-stat-lbl">Victorias</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${d.podiums}</span>
                    <span class="hist-stat-lbl">Podios</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${d.starts}</span>
                    <span class="hist-stat-lbl">GPs (${d.poles} Poles)</span>
                  </div>
                </div>
              </div>

              <div class="hist-actions-row">
                <button
                  type="button"
                  class="btn ${alreadyInChamp ? 'btn-ghost' : 'btn-secondary'} btn-sm"
                  data-hist-action="import-driver"
                  data-f1db-id="${escapeHtml(d.f1dbId)}"
                >
                  ${alreadyInChamp ? '✓ Ya inscrito en tu torneo (Clonar)' : '➕ Inscribir Piloto a mi Torneo Actual'}
                </button>
              </div>
            </article>
          `;
        })
        .join('');
      return;
    }

    if (histActiveSubtab === 'constructors') {
      const filtered = cat.constructors.filter((c) => {
        if (histFilterValue === 'champions' && c.titles < 1) return false;
        if (histFilterValue === 'winners' && c.wins < 1) return false;
        if (histFilterValue === 'podiums' && c.podiums < 1) return false;
        if (!q) return true;
        return (
          norm(c.name).includes(q) ||
          norm(c.shortName).includes(q) ||
          norm(c.countryName).includes(q) ||
          String(c.firstYear).includes(q) ||
          String(c.lastYear).includes(q)
        );
      });

      const visible = filtered.slice(0, histRenderLimit);
      summaryEl.innerHTML = `<span>Mostrando <strong>${visible.length}</strong> de <strong>${filtered.length}</strong> escuderías históricas (Total: ${cat.constructors.length})</span><span>💡 Agrega cualquier constructor clásico o moderno a tu campeonato</span>`;
      loadMoreWrap.hidden = visible.length >= filtered.length;

      container.innerHTML = visible
        .map((c) => {
          const logoImg = window.ChampionshipData.createTeamSvg(c.color || '#3b82f6', c.shortName || 'F1');
          const alreadyInChamp = (appState.teams || []).some(
            (existing) => existing.id === c.id || norm(existing.name) === norm(c.name)
          );
          return `
            <article class="hist-card" style="border-left: 4px solid ${escapeHtml(c.color)}">
              <div>
                <div class="hist-entity-top">
                  <img src="${logoImg}" alt="${escapeHtml(c.name)}" class="hist-entity-avatar" style="object-fit:contain; padding:4px" />
                  <div style="flex:1; min-width:0">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px">
                      <h3 class="roster-title">${escapeHtml(c.name)}</h3>
                      <span class="driver-code-tag" style="border-color:${escapeHtml(c.color)}">${escapeHtml(c.shortName)}</span>
                    </div>
                    <div class="roster-meta">
                      🌍 ${escapeHtml(c.countryName)} (${escapeHtml(c.country)}) &bull; 📅 ${c.firstYear}–${c.lastYear}
                    </div>
                  </div>
                </div>

                <div class="hist-stats-row" style="margin-top: 12px">
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num" style="color:${c.titles > 0 ? 'var(--accent-amber)' : '#fff'}">${c.titles}</span>
                    <span class="hist-stat-lbl">Mundiales</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${c.wins}</span>
                    <span class="hist-stat-lbl">Victorias</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${c.podiums}</span>
                    <span class="hist-stat-lbl">Podios</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${c.starts}</span>
                    <span class="hist-stat-lbl">GPs (${c.poles} Poles)</span>
                  </div>
                </div>
              </div>

              <div class="hist-actions-row">
                <button
                  type="button"
                  class="btn ${alreadyInChamp ? 'btn-ghost' : 'btn-secondary'} btn-sm"
                  data-hist-action="import-constructor"
                  data-f1db-id="${escapeHtml(c.f1dbId)}"
                >
                  ${alreadyInChamp ? '✓ Ya está en tu torneo' : '➕ Sumar Escudería a mi Torneo'}
                </button>
              </div>
            </article>
          `;
        })
        .join('');
      return;
    }

    if (histActiveSubtab === 'circuits') {
      const filtered = cat.circuits.filter((c) => {
        if (histFilterValue !== 'all' && c.type !== histFilterValue) return false;
        if (!q) return true;
        return (
          norm(c.name).includes(q) ||
          norm(c.shortName).includes(q) ||
          norm(c.placeName).includes(q) ||
          norm(c.country).includes(q)
        );
      });

      const visible = filtered.slice(0, histRenderLimit);
      summaryEl.innerHTML = `<span>Mostrando <strong>${visible.length}</strong> de <strong>${filtered.length}</strong> circuitos históricos (1950–2026)</span><span>💡 Añade cualquier trazado clásico o actual como nueva fecha de tu calendario</span>`;
      loadMoreWrap.hidden = visible.length >= filtered.length;

      container.innerHTML = visible
        .map((c, idx) => {
          const catMatch =
            Array.isArray(window.F1TracksCatalog) &&
            window.F1TracksCatalog.find((tc) => tc.key === c.catKey);
          const trackSvg = catMatch
            ? catMatch.dataUri
            : window.ChampionshipData.createTrackSvg(c.color || '#22d3ee', idx + 1);
          const typeLabel =
            c.type === 'STREET' ? '🏙️ Callejero' : c.type === 'ROAD' ? '🛣️ Rutero' : '🏟️ Autódromo';

          return `
            <article class="hist-card" style="border-top: 3px solid ${escapeHtml(c.color || '#22d3ee')}">
              <div>
                <div class="hist-entity-top">
                  <img src="${trackSvg}" alt="${escapeHtml(c.name)}" class="hist-entity-avatar" style="width:68px; height:52px; object-fit:contain; padding:3px" />
                  <div style="flex:1; min-width:0">
                    <h3 class="roster-title" title="${escapeHtml(c.name)}">${escapeHtml(c.shortName || c.name)}</h3>
                    <div class="roster-meta">
                      📍 ${escapeHtml(c.placeName ? `${c.placeName}, ${c.country}` : c.country)}
                    </div>
                    <div class="roster-meta">
                      ${typeLabel} &bull; 📅 ${c.firstYear}–${c.lastYear}
                    </div>
                  </div>
                </div>

                <div class="hist-stats-row" style="margin-top: 12px">
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${c.totalRacesHeld}</span>
                    <span class="hist-stat-lbl">GPs F1</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${c.lengthKm ? `${c.lengthKm} km` : '—'}</span>
                    <span class="hist-stat-lbl">Longitud</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${c.turns || '—'}</span>
                    <span class="hist-stat-lbl">Curvas</span>
                  </div>
                  <div class="hist-stat-cell">
                    <span class="hist-stat-num">${c.direction === 'ANTI_CLOCKWISE' ? '↺ Antihor.' : '↻ Horario'}</span>
                    <span class="hist-stat-lbl">Sentido</span>
                  </div>
                </div>
              </div>

              <div class="hist-actions-row">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-hist-action="import-circuit"
                  data-f1db-id="${escapeHtml(c.f1dbId)}"
                >
                  ➕ Agregar Fecha al Calendario Actual
                </button>
              </div>
            </article>
          `;
        })
        .join('');
    }
  }

  // =========================================================
  // 8B. MODAL DE ANÁLISIS: ¿QUÉ NECESITA PARA SU MEJOR RESULTADO?
  // =========================================================
  function openTargetRequirementsModal(kind = 'driver', entityId = '', customTargetRank = null) {
    if (!window.ChampionshipEngine || typeof window.ChampionshipEngine.calculateTargetRequirements !== 'function') {
      return;
    }
    const req = window.ChampionshipEngine.calculateTargetRequirements(
      appState,
      kind,
      entityId,
      customTargetRank
    );
    if (!req) return;

    const dlg = document.getElementById('dialogTargetRequirements');
    const titleEl = document.getElementById('dialogTargetReqTitle');
    const eyebrowEl = document.getElementById('targetReqEyebrow');
    const bodyEl = document.getElementById('targetReqBodyContent');
    if (!dlg || !bodyEl) return;

    const {
      isTeam,
      me,
      targetRank,
      bestRank,
      worstRank,
      targetHolder,
      isDefending,
      remainingRacesCount,
      maxRemaining,
      gapToTarget,
      minPointsNeeded,
      clinchPointsNeeded,
      headlineSummary,
      selfMinimumPlan,
      rivalsAnalysis,
      exampleRaceSimulation,
      finalRaceDecider
    } = req;

    // Bloque de escenarios exactos para la última carrera (duelo cara a cara con desempate FIA)
    let finalDeciderHtml = '';
    if (finalRaceDecider && Array.isArray(finalRaceDecider.duels) && finalRaceDecider.duels.length > 0) {
      finalDeciderHtml = finalRaceDecider.duels
        .map(
          (d) => `
          <div class="req-section-card final-duel-card" style="margin-top: 16px; border-left: 4px solid ${escapeHtml(d.rivalColor || '#38bdf8')}">
            <div class="req-section-header">
              <h3>🧮 Escenarios exactos en ${escapeHtml(finalRaceDecider.trackName)}: ${escapeHtml(me.name)} vs ${escapeHtml(d.rivalName)}</h3>
              <span class="field-hint">
                ${me.points} pts vs ${d.rivalPoints} pts &bull; Victorias: ${me.wins} vs ${d.rivalWins}.
                Considera el peor caso (el rival puede hacer la Vuelta Rápida) y el desempate oficial FIA (victorias, 2° puestos, 3° puestos…).
              </span>
            </div>
            <div class="table-wrapper" style="margin-top: 10px">
              <table class="final-duel-table">
                <thead>
                  <tr>
                    <th>Si ${escapeHtml(me.name)} termina…</th>
                    <th>¿Qué necesita de ${escapeHtml(d.rivalName)}?</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.grouped
                    .map(
                      (g) => `
                    <tr class="${g.alwaysWins ? 'duel-row-win' : g.impossible ? 'duel-row-lose' : ''}">
                      <td><strong>${escapeHtml(g.rangeLabel)}</strong></td>
                      <td>
                        <div style="font-weight:600">${escapeHtml(g.requirement)}</div>
                        ${g.note ? `<div class="duel-tie-note">⚖️ ${escapeHtml(g.note)}</div>` : ''}
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        `
        )
        .join('');
    }

    const entityColor = me.teamColor || me.color || '#e10600';
    const rankTitleLabel =
      targetRank === 1
        ? '1° Puesto (Campeón Mundial 🏆)'
        : targetRank === 2
        ? '2° Puesto (Subcampeón 🥈)'
        : targetRank === 3
        ? '3° Puesto (Podio Mundial 🥉)'
        : `${targetRank}° Puesto del Campeonato`;

    if (eyebrowEl) {
      eyebrowEl.textContent = isTeam
        ? `CAMPEONATO DE CONSTRUCTORES • RANGO POSIBLE: ${bestRank}° AL ${worstRank}°`
        : `CAMPEONATO DE PILOTOS • RANGO POSIBLE: ${bestRank}° AL ${worstRank}°`;
    }
    if (titleEl) {
      titleEl.textContent = `🎯 ¿Qué necesita ${me.name} para terminar en el ${rankTitleLabel}?`;
    }

    // Selector de puestos alcanzables (entre bestRank y worstRank)
    let rankPillsHtml = '';
    for (let r = bestRank; r <= Math.min(worstRank, bestRank + 9); r++) {
      const isSelected = r === targetRank;
      const isBest = r === bestRank;
      rankPillsHtml += `
        <button
          type="button"
          class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm"
          data-switch-target-rank="${r}"
          data-req-kind="${escapeHtml(kind)}"
          data-req-entity="${escapeHtml(me.id)}"
        >
          ${r === 1 ? '🏆 1° Mundial' : `${r}° Puesto`}${isBest ? ' (Su Máx.)' : ''}
        </button>
      `;
    }

    // Bloque de rivales directos
    let rivalsHtml = '';
    if (rivalsAnalysis.length === 0) {
      rivalsHtml = `
        <div class="req-empty-notice">
          ✅ <strong>No depende de ningún rival:</strong> Ya tiene asegurado este puesto o no hay competidores que puedan disputárselo matemáticamente.
        </div>
      `;
    } else {
      rivalsHtml = `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>${isTeam ? 'Escudería Rival' : 'Piloto Rival'}</th>
                <th>Pts Actuales</th>
                <th>Diferencia</th>
                <th>Tope Máx. del Rival</th>
                <th>¿Qué posiciones necesita que haga este rival?</th>
              </tr>
            </thead>
            <tbody>
              ${rivalsAnalysis
                .map(
                  (riv) => `
                  <tr>
                    <th scope="row">
                      <div class="driver-cell">
                        <span class="pos-badge ${riv.rank <= 3 ? `pos-${riv.rank}` : ''}">${riv.rank}</span>
                        <span class="team-color-bar" style="background:${escapeHtml(riv.color)}"></span>
                        <img src="${escapeHtml(riv.image)}" alt="" class="avatar-sm" />
                        <div class="driver-info-stack">
                          <span class="driver-name-line">${escapeHtml(riv.name)}</span>
                          <span class="driver-sub-line">${escapeHtml(riv.roleLabel)} &bull; ${escapeHtml(riv.teamName)}</span>
                        </div>
                      </div>
                    </th>
                    <td><strong>${riv.points} pts</strong> <span style="color:var(--text-muted); font-size:0.75rem">(Techo: ${riv.maxPossiblePoints})</span></td>
                    <td><span class="points-pill">${escapeHtml(riv.gapLabel)}</span></td>
                    <td><strong>Máx. +${riv.maxAllowedPtsForRival} pts</strong></td>
                    <td style="max-width:380px; line-height:1.35">
                      <div style="color:#f8fafc; font-weight:700; margin-bottom:2px">${escapeHtml(riv.conditionForMe)}</div>
                      <div style="color:var(--text-secondary); font-size:0.78rem">${escapeHtml(riv.rivalPositionRequirement)}</div>
                    </td>
                  </tr>
                `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Bloque de Simulación Carrera por Carrera
    let raceSimHtml = '';
    if (!finalRaceDecider && remainingRacesCount > 0 && exampleRaceSimulation.length > 0) {
      raceSimHtml = `
        <div class="req-section-card" style="margin-top: 16px">
          <div class="req-section-header">
            <h3>🏁 Combinación Ejemplo Carrera por Carrera (${remainingRacesCount} fecha${remainingRacesCount === 1 ? '' : 's'} restante${remainingRacesCount === 1 ? '' : 's'})</h3>
            <span class="field-hint">Un ejemplo concreto de resultados en pista que le dan el ${targetRank}° puesto a ${escapeHtml(me.name)}</span>
          </div>
          <div class="table-wrapper" style="margin-top: 10px">
            <table>
              <thead>
                <tr>
                  <th>Fecha Pendiente</th>
                  <th>Resultado requerido de ${escapeHtml(me.name)}</th>
                  <th>Acumulado ${escapeHtml(me.code || me.shortName || '')}</th>
                  <th>Resultado máximo de ${escapeHtml(exampleRaceSimulation[0].rivalName)}</th>
                  <th>Acumulado Rival</th>
                </tr>
              </thead>
              <tbody>
                ${exampleRaceSimulation
                  .map(
                    (step) => `
                    <tr>
                      <td>
                        <strong>Fecha ${step.round}: ${escapeHtml(step.name)}</strong>
                        ${step.hasSprint ? `<span class="sprint-tag" style="margin-left:6px">⚡ SPRINT</span>` : ''}
                      </td>
                      <td>
                        <span class="status-badge status-contender">🏁 ${escapeHtml(step.myFinish)} (+${step.myGain} pts)</span>
                      </td>
                      <td><strong>${step.myCumulative} pts</strong></td>
                      <td>
                        <span class="status-badge status-eliminated">${escapeHtml(step.rivalFinish)} (+${step.rivalGain} pts)</span>
                      </td>
                      <td>${step.rivalCumulative} pts</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <!-- Selector de Puesto Objetivo -->
      <div class="req-target-selector-bar">
        <span class="field-hint" style="font-weight:700; color:var(--text-secondary)">Explorar requisitos para el puesto:</span>
        <div style="display:flex; flex-wrap:wrap; gap:6px">
          ${rankPillsHtml}
        </div>
      </div>

      <!-- Banner Resumen Principal -->
      <div class="req-hero-banner" style="border-left: 4px solid ${escapeHtml(entityColor)}">
        <div class="driver-cell">
          <img src="${escapeHtml(me.image)}" alt="" class="avatar-preview-lg" style="width:64px; height:64px" />
          <div style="flex:1">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap">
              <h3 style="margin:0; font-size:1.18rem">${escapeHtml(me.name)}</h3>
              <span class="points-pill">Actual: ${me.rank}° puesto (${me.points} pts)</span>
              <span class="status-badge status-contender">Objetivo consultado: ${rankTitleLabel}</span>
            </div>
            <p style="margin:6px 0 0; color:var(--text-primary); font-size:0.9rem; line-height:1.4">
              ${escapeHtml(headlineSummary)}
            </p>
          </div>
        </div>
      </div>

      <!-- Tarjetas KPI del Objetivo -->
      <div class="kpi-grid" style="margin-top: 14px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
        <article class="kpi-card kpi-accent-red" style="padding: 12px 14px">
          <span class="kpi-label">${isDefending ? 'VENTAJA ACTUAL' : `DIFERENCIA CON EL ${targetRank}° PUESTO`}</span>
          <div class="kpi-value" style="font-size:1.4rem">
            ${isDefending ? `En posición (${me.rank}°)` : `-${gapToTarget} pts`}
          </div>
          <p class="kpi-sub">
            Ocupante actual del ${targetRank}°: <strong>${escapeHtml(targetHolder.name)} (${targetHolder.points} pts)</strong>
          </p>
        </article>

        <article class="kpi-card kpi-accent-cyan" style="padding: 12px 14px">
          <span class="kpi-label">PUNTOS EN JUEGO (${remainingRacesCount} FECHAS)</span>
          <div class="kpi-value" style="font-size:1.4rem">+${maxRemaining} pts máx.</div>
          <p class="kpi-sub">
            Techo máximo de ${escapeHtml(me.name)}: <strong>${me.maxPossiblePoints} pts</strong>
          </p>
        </article>

        <article class="kpi-card kpi-accent-emerald" style="padding: 12px 14px">
          <span class="kpi-label">${finalRaceDecider ? 'CLAVE PARA LA ÚLTIMA FECHA' : isDefending ? 'PUNTOS PARA ASEGURAR (CLINCH)' : 'MÍNIMO INDISPENSABLE A SUMAR'}</span>
          <div class="kpi-value" style="font-size:1.4rem">
            ${finalRaceDecider ? escapeHtml(finalRaceDecider.kpiValue) : `+${isDefending ? clinchPointsNeeded : minPointsNeeded} pts`}
          </div>
          <p class="kpi-sub">
            ${
              finalRaceDecider
                ? escapeHtml(finalRaceDecider.kpiSub)
                : isDefending
                ? 'Sumando esto nadie puede quitarle el puesto aunque ganen todo'
                : `Lo mínimo que debe sumar aunque ${escapeHtml(targetHolder.name)} sume 0 pts`
            }
          </p>
        </article>
      </div>

      <!-- Bloque 1: ¿Qué necesita hacer él mismo en pista? -->
      ${finalDeciderHtml ? finalDeciderHtml : `
      <div class="req-section-card" style="margin-top: 16px">
        <div class="req-section-header">
          <h3>🏎️ 1. ¿Qué posiciones necesita obtener ${escapeHtml(me.name)} en las carreras restantes?</h3>
        </div>
        <div class="req-self-boxes">
          <div class="req-self-box">
            <span class="req-box-tag">${isDefending ? '🔒 Escenario para Asegurar por Cuenta Propia' : '⚡ Escenario Mínimo Requerido (Si el rival falla)'}</span>
            <div class="req-box-main">${escapeHtml(selfMinimumPlan.summaryText)}</div>
            <div class="req-box-sub">
              Promedio necesario: <strong>${selfMinimumPlan.avgPtsRequired} pts/fecha</strong>
              ${selfMinimumPlan.avgPosEquivalent ? ` &bull; Equivale a terminar <strong>${escapeHtml(selfMinimumPlan.avgPosEquivalent)}</strong> por carrera.` : ''}
            </div>
          </div>
        </div>
      </div>`}

      <!-- Bloque 2: ¿Qué necesita de los demás pilotos / escuderías? -->
      <div class="req-section-card" style="margin-top: 16px">
        <div class="req-section-header">
          <h3>⚔️ 2. ¿Qué posiciones necesita de los demás ${isTeam ? 'equipos rivales' : 'pilotos rivales'}?</h3>
          <span class="field-hint">Resultados máximos que pueden obtener sus rivales directos para que ${escapeHtml(me.name)} logre el ${targetRank}° lugar</span>
        </div>
        <div style="margin-top: 10px">
          ${rivalsHtml}
        </div>
      </div>

      ${raceSimHtml}
    `;

    if (!dlg.open) {
      dlg.showModal();
    }
  }

  // =========================================================
  // 8B. RESULTADOS NUEVOS (ACTUALIZACIÓN AUTOMÁTICA)
  // =========================================================
  const LIVE_CACHE_KEY = 'championship_live_cache_v1';
  const LIVE_APPLIED_KEY = 'championship_live_applied_version';
  let pendingLiveUpdate = null;

  function readLiveCache() {
    try {
      const raw = localStorage.getItem(LIVE_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function stripImagesForCache(season) {
    const copy = JSON.parse(JSON.stringify(season));
    (copy.teams || []).forEach((t) => (t.image = ''));
    (copy.drivers || []).forEach((d) => (d.image = ''));
    (copy.tracks || []).forEach((tr) => (tr.image = ''));
    return copy;
  }

  function writeLiveCache(season, manifest) {
    try {
      localStorage.setItem(
        LIVE_CACHE_KEY,
        JSON.stringify({ season: stripImagesForCache(season), manifest, savedAt: Date.now() })
      );
    } catch (_e) {
      // Sin espacio o sin permiso: simplemente no guardamos el caché
    }
  }

  function countCompleted(state) {
    return (state.tracks || []).filter((t) => t.completed).length;
  }

  /** Busca los resultados más recientes: primero en el archivo publicado, y si no hay, directo en la API. */
  async function fetchLiveSeason() {
    const cfg = window.LIVE_DATA_CONFIG || {};
    const cache = readLiveCache();

    if (cfg.baseUrl) {
      const base = String(cfg.baseUrl).replace(/\/+$/, '');
      const manifestRes = await fetch(`${base}/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!manifestRes.ok) throw new Error('manifest no disponible');
      const manifest = await manifestRes.json();
      if (cache && cache.manifest && cache.manifest.version === manifest.version) {
        return { season: cache.season, manifest };
      }
      const seasonRes = await fetch(`${base}/season_current.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!seasonRes.ok) throw new Error('temporada no disponible');
      return { season: await seasonRes.json(), manifest };
    }

    if (!window.LiveSync) throw new Error('sincronizador no disponible');
    const baseSeason =
      cache && cache.season ? cache.season : window.ChampionshipData.createDemoChampionship(false);
    const api = await window.LiveSync.fetchSeasonData(window.fetch.bind(window), cfg.season || 2026);
    if (!api.results || api.results.length === 0) return null;
    const season = window.LiveSync.buildLiveSeason(baseSeason, api);
    const completed = (season.tracks || []).filter((t) => t.completed);
    const last = completed[completed.length - 1];
    return {
      season,
      manifest: {
        version: window.LiveSync.computeVersion(season),
        completedRounds: completed.length,
        totalRounds: season.tracks.length,
        lastRaceName: last ? last.name : ''
      }
    };
  }

  function hideLiveBanner() {
    const banner = document.getElementById('liveUpdateBanner');
    if (banner) banner.hidden = true;
  }

  function showLiveBanner(live) {
    const banner = document.getElementById('liveUpdateBanner');
    const text = document.getElementById('liveUpdateText');
    if (!banner || !text) return;
    pendingLiveUpdate = live;
    const m = live.manifest || {};
    text.innerHTML = `<strong>Hay resultados nuevos</strong> — ${m.completedRounds || '?'} de ${m.totalRounds || '?'} fechas disputadas${
      m.lastRaceName ? ` (última: ${escapeHtml(m.lastRaceName)})` : ''
    }. Al actualizar se reemplaza el campeonato que tienes abierto.`;
    banner.hidden = false;
  }

  async function applyLiveUpdate() {
    if (!pendingLiveUpdate) return;
    const fresh = JSON.parse(JSON.stringify(pendingLiveUpdate.season));
    if (window.ChampionshipData && typeof window.ChampionshipData.hydrateSeasonStateVisuals === 'function') {
      window.ChampionshipData.hydrateSeasonStateVisuals(fresh);
    }
    appState = fresh;
    try {
      localStorage.setItem(LIVE_APPLIED_KEY, pendingLiveUpdate.manifest.version);
    } catch (_e) {
      // no pasa nada si no se puede recordar
    }
    pendingLiveUpdate = null;
    hideLiveBanner();
    await persistAndRender('🏁 ¡Listo! Cargamos los últimos resultados oficiales.');
  }

  async function checkLiveUpdates(manual) {
    const btn = document.getElementById('btnCheckLive');
    if (manual && btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Buscando…';
    }
    try {
      const live = await fetchLiveSeason();
      if (!live) {
        if (manual) showToast('Todavía no hay resultados publicados para esta temporada.');
        return;
      }
      writeLiveCache(live.season, live.manifest);
      const applied = localStorage.getItem(LIVE_APPLIED_KEY);
      const liveDone = countCompleted(live.season);
      const onSameSeason = String((appState.meta && appState.meta.seasonYear) || '') === String(live.season.meta.seasonYear || '');
      const hasNewer = onSameSeason && liveDone > countCompleted(appState);
      if (applied !== live.manifest.version && (manual || hasNewer)) {
        showLiveBanner(live);
        if (manual) showToast('Encontramos resultados más recientes. Revisa el aviso de arriba.');
      } else if (manual) {
        showToast('✅ Ya tienes los últimos resultados.');
      }
    } catch (_err) {
      if (manual) {
        showToast('No pudimos conectarnos para buscar resultados. Revisa tu internet e inténtalo de nuevo.');
      }
    } finally {
      if (manual && btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Buscar resultados nuevos';
      }
    }
  }

  // =========================================================
  // 9. INICIALIZACIÓN Y EVENTOS
  // =========================================================
  async function initApp() {
    appState = await window.ChampionshipData.loadStateFromStorage();
    setupDialogsModernGuidance();
    renderPointsPresetsBar();
    await persistAndRender();

    const btnCheckLive = document.getElementById('btnCheckLive');
    if (btnCheckLive) btnCheckLive.addEventListener('click', () => checkLiveUpdates(true));
    const btnApplyLive = document.getElementById('btnApplyLiveUpdate');
    if (btnApplyLive) btnApplyLive.addEventListener('click', () => applyLiveUpdate());
    const btnDismissLive = document.getElementById('btnDismissLiveUpdate');
    if (btnDismissLive) btnDismissLive.addEventListener('click', () => hideLiveBanner());
    setTimeout(() => checkLiveUpdates(false), 1800);

    // Navegación lateral
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // Subtabs del Dashboard
    document.querySelectorAll('[data-dash-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-dash-subtab');
        document.querySelectorAll('[data-dash-subtab]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-dash-subtab') === sub)
        );
        document.querySelectorAll('#view-dashboard .dash-subview').forEach((v) =>
          v.classList.toggle('active', v.id === `dash-subview-${sub}`)
        );
      });
    });

    // Subtabs del Simulador Monte Carlo (Pilotos vs Escuderías)
    document.querySelectorAll('[data-sim-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-sim-subtab');
        document.querySelectorAll('[data-sim-subtab]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-sim-subtab') === sub)
        );
        document.querySelectorAll('#view-probabilities .dash-subview').forEach((v) =>
          v.classList.toggle('active', v.id === `sim-subview-${sub}`)
        );
      });
    });

    // Acciones rápidas del Header Dashboard
    document.getElementById('btnQuickSimFromDash').addEventListener('click', () => {
      switchTab('probabilities');
    });

    document.getElementById('btnGoToNextRace').addEventListener('click', () => {
      const nextTrack = (appState.tracks || []).find((t) => !t.completed) || (appState.tracks || [])[0];
      if (nextTrack) {
        openRaceResultsModal(nextTrack.id);
      } else {
        switchTab('calendar');
      }
    });

    // Editar nombre y año del campeonato
    document.getElementById('btnEditChampMeta').addEventListener('click', () => {
      document.getElementById('inputChampName').value = appState.meta.championshipName || '';
      document.getElementById('inputChampYear').value = appState.meta.seasonYear || '';
      document.getElementById('dialogChampMeta').showModal();
    });

    document.getElementById('formChampMeta').addEventListener('submit', async () => {
      appState.meta.championshipName = document.getElementById('inputChampName').value.trim() || 'Campeonato F1';
      appState.meta.seasonYear = document.getElementById('inputChampYear').value.trim() || '2026';
      await persistAndRender('¡Listo! Actualizamos el nombre y temporada del campeonato.');
    });

    // Controles del Simulador Monte Carlo
    document.getElementById('btnRunMonteCarlo').addEventListener('click', () => {
      runAndRenderSimulation();
      showToast('⚡ ¡Simulación Monte Carlo completada con éxito!');
    });

    document.getElementById('simFormWeightRange').addEventListener('input', (e) => {
      document.getElementById('simFormWeightLabel').textContent = `${e.target.value}% Actual`;
    });
    document.getElementById('simFormWeightRange').addEventListener('change', () => runAndRenderSimulation());

    document.getElementById('simChaosRange').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      const tag = v < 25 ? 'Predecible' : v <= 45 ? 'Realista' : 'Caótico / Lluvia';
      document.getElementById('simChaosLabel').textContent = `${v}% ${tag}`;
    });
    document.getElementById('simChaosRange').addEventListener('change', () => runAndRenderSimulation());
    document.getElementById('simIterationsSelect').addEventListener('change', () => runAndRenderSimulation());

    // Botones para abrir modales de creación
    document.getElementById('btnAddDriver').addEventListener('click', () => openDriverModal(null));
    document.getElementById('btnAddTeam').addEventListener('click', () => openTeamModal(null));
    document.getElementById('btnAddTrack').addEventListener('click', () => openTrackModal(null));

    // =========================================================
    // APARTADO DE IMÁGENES LOCALES (CARPETAS Y ARRASTRAR A TARJETAS)
    // =========================================================
    const btnOpenDriversFolder = document.getElementById('btnOpenDriversImgFolder');
    if (btnOpenDriversFolder) {
      btnOpenDriversFolder.addEventListener('click', async () => {
        if (window.desktopAPI && window.desktopAPI.openImagesFolder) {
          await window.desktopAPI.openImagesFolder('drivers');
        } else {
          showToast('Carpeta local disponible en la versión de escritorio: imagenes/pilotos');
        }
      });
    }

    const btnOpenTeamsFolder = document.getElementById('btnOpenTeamsImgFolder');
    if (btnOpenTeamsFolder) {
      btnOpenTeamsFolder.addEventListener('click', async () => {
        if (window.desktopAPI && window.desktopAPI.openImagesFolder) {
          await window.desktopAPI.openImagesFolder('teams');
        } else {
          showToast('Carpeta local disponible en la versión de escritorio: imagenes/equipos');
        }
      });
    }

    const btnSyncImgs = document.getElementById('btnSyncLocalImages');
    if (btnSyncImgs) {
      btnSyncImgs.addEventListener('click', async () => {
        if (!window.desktopAPI || !window.desktopAPI.listLocalImages) {
          showToast('La sincronización de carpetas requiere la app de escritorio.');
          return;
        }
        const res = await window.desktopAPI.listLocalImages();
        if (!res || !res.ok) {
          showToast('No pudimos leer las carpetas de imágenes.');
          return;
        }

        const norm = (s) =>
          String(s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');

        let updatedDrivers = 0;
        let updatedTeams = 0;

        (appState.drivers || []).forEach((d) => {
          const codeKey = norm(d.code);
          const numKey = String(d.number);
          const nameKey = norm(d.name);
          const lastKey = norm((d.name || '').split(' ').slice(-1)[0]);

          const match = (res.drivers || []).find((f) => {
            const fk = norm(f.baseName);
            return fk === codeKey || fk === numKey || fk === nameKey || (lastKey && fk === lastKey);
          });
          if (match && match.dataUri) {
            d.image = match.dataUri;
            updatedDrivers++;
          }
        });

        (appState.teams || []).forEach((t) => {
          const shortKey = norm(t.shortName);
          const nameKey = norm(t.name);
          const match = (res.teams || []).find((f) => {
            const fk = norm(f.baseName);
            return fk === shortKey || fk === nameKey || (nameKey && fk.includes(shortKey));
          });
          if (match && match.dataUri) {
            t.image = match.dataUri;
            updatedTeams++;
          }
        });

        await persistAndRender(
          `🔄 Sincronizadas ${updatedDrivers} foto(s) de pilotos y ${updatedTeams} logo(s) de escuderías desde tus carpetas.`
        );
      });
    }

    // Arrastrar archivos de imagen desde la PC directamente sobre tarjetas de Pilotos o Escuderías
    const rostersView = document.getElementById('view-rosters');
    if (rostersView) {
      rostersView.addEventListener('dragover', (e) => {
        const card = e.target.closest('.roster-card[data-driver-id], .roster-card[data-team-id]');
        if (!card) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        rostersView.querySelectorAll('.roster-card.is-drag-over').forEach((el) => {
          if (el !== card) el.classList.remove('is-drag-over');
        });
        card.classList.add('is-drag-over');
      });

      rostersView.addEventListener('dragleave', (e) => {
        const card = e.target.closest('.roster-card');
        if (card && !card.contains(e.relatedTarget)) {
          card.classList.remove('is-drag-over');
        }
      });

      rostersView.addEventListener('drop', async (e) => {
        const card = e.target.closest('.roster-card[data-driver-id], .roster-card[data-team-id]');
        if (!card) return;
        e.preventDefault();
        card.classList.remove('is-drag-over');

        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;

        try {
          const dataUri = await window.ChampionshipData.processImageFile(file, 360, 360);
          const driverId = card.getAttribute('data-driver-id');
          const teamId = card.getAttribute('data-team-id');

          if (driverId) {
            const drv = (appState.drivers || []).find((d) => d.id === driverId);
            if (drv) {
              drv.image = dataUri;
              if (window.desktopAPI && window.desktopAPI.saveImageToLocal) {
                await window.desktopAPI.saveImageToLocal('drivers', drv.code || drv.name, dataUri);
              }
              await persistAndRender(`📸 Foto actualizada para ${drv.name} (guardada en imagenes/pilotos).`);
            }
          } else if (teamId) {
            const tm = (appState.teams || []).find((t) => t.id === teamId);
            if (tm) {
              tm.image = dataUri;
              if (window.desktopAPI && window.desktopAPI.saveImageToLocal) {
                await window.desktopAPI.saveImageToLocal('teams', tm.shortName || tm.name, dataUri);
              }
              await persistAndRender(`🛡️ Logo actualizado para ${tm.name} (guardado en imagenes/equipos).`);
            }
          }
        } catch (err) {
          showToast(err.message || 'No se pudo cargar la imagen arrastrada.');
        }
      });
    }

    // Delegación de clics en contenedores dinámicos
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action], [data-preset-key]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const presetKey = target.getAttribute('data-preset-key');

      if (action === 'go-rosters') {
        switchTab('rosters');
      } else if (action === 'edit-driver') {
        openDriverModal(target.getAttribute('data-driver-id'));
      } else if (action === 'edit-team') {
        openTeamModal(target.getAttribute('data-team-id'));
      } else if (action === 'edit-track') {
        openTrackModal(target.getAttribute('data-track-id'));
      } else if (action === 'edit-results') {
        openRaceResultsModal(target.getAttribute('data-track-id'));
      } else if (presetKey) {
        const preset = window.ChampionshipData.POINTS_PRESETS[presetKey];
        if (preset) {
          editableRacePoints = [...preset.racePoints];
          editableSprintPoints = [...preset.sprintPoints];
          document.getElementById('inputFastestLapPoints').value = preset.fastestLapPoints;
          document.getElementById('inputFastestLapLimit').value = preset.fastestLapTopLimit;
          document.getElementById('inputPolePoints').value = preset.polePoints;
          renderPointsInputsGrids();
          showToast(`Plantilla "${preset.name}" cargada. Haz clic en "Guardar Sistema de Puntos" para aplicarla.`);
        }
      }
    });

    // Subida de imágenes en Modal Piloto
    document.getElementById('driverImageFile').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        currentDriverModalImage = await window.ChampionshipData.processImageFile(file, 360, 360);
        document.getElementById('driverImagePreview').src = currentDriverModalImage;
      } catch (err) {
        showToast(err.message);
      }
    });

    const driverLocalSelect = document.getElementById('driverLocalFolderSelect');
    if (driverLocalSelect) {
      driverLocalSelect.addEventListener('change', (e) => {
        const opt = e.target.selectedOptions && e.target.selectedOptions[0];
        const uri = opt ? opt.getAttribute('data-uri') : '';
        if (uri) {
          currentDriverModalImage = uri;
          document.getElementById('driverImagePreview').src = currentDriverModalImage;
        }
      });
    }

    document.getElementById('btnGenerateHelmet').addEventListener('click', () => {
      const num = document.getElementById('driverNumberInput').value || '1';
      const teamId = document.getElementById('driverTeamSelect').value;
      const team = (appState.teams || []).find((t) => t.id === teamId);
      const col = team ? team.color : '#e10600';
      currentDriverModalImage = window.ChampionshipData.createHelmetSvg(col, '#ffffff', num);
      document.getElementById('driverImagePreview').src = currentDriverModalImage;
    });

    // Guardar Piloto
    document.getElementById('formDriver').addEventListener('submit', async () => {
      const id = document.getElementById('driverIdInput').value || `d_${Date.now()}`;
      const name = document.getElementById('driverNameInput').value.trim();
      const code = document.getElementById('driverCodeInput').value.trim().toUpperCase();
      const number = Number(document.getElementById('driverNumberInput').value) || 0;
      const country = document.getElementById('driverCountryInput').value.trim().toUpperCase();
      const baseRating = Math.min(99, Math.max(50, Number(document.getElementById('driverRatingInput').value) || 85));
      const teamId = document.getElementById('driverTeamSelect').value;
      const secondaryTeamIds = Array.from(document.querySelectorAll('.driver-sec-team-chk:checked'))
        .map((chk) => chk.value)
        .filter((tid) => tid && tid !== teamId);

      const driverObj = {
        id,
        name,
        code,
        number,
        country,
        baseRating,
        teamId,
        secondaryTeamIds,
        image: currentDriverModalImage
      };

      const idx = (appState.drivers || []).findIndex((d) => d.id === id);
      if (idx >= 0) {
        appState.drivers[idx] = driverObj;
      } else {
        appState.drivers.push(driverObj);
      }

      if (window.desktopAPI && window.desktopAPI.saveImageToLocal && currentDriverModalImage) {
        await window.desktopAPI.saveImageToLocal('drivers', code || name, currentDriverModalImage);
      }

      await persistAndRender(`🏎️ Piloto ${name} guardado en la parrilla.`);
    });

    // Eliminar Piloto
    document.getElementById('btnDeleteDriver').addEventListener('click', async () => {
      const id = document.getElementById('driverIdInput').value;
      if (!id) return;
      appState.drivers = (appState.drivers || []).filter((d) => d.id !== id);
      document.getElementById('dialogDriver').close();
      await persistAndRender('Piloto eliminado de la parrilla.');
    });

    // Subida de imágenes y color en Modal Escudería
    document.getElementById('teamColorInput').addEventListener('input', (e) => {
      document.getElementById('teamColorHexText').textContent = e.target.value;
    });

    document.getElementById('teamImageFile').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        currentTeamModalImage = await window.ChampionshipData.processImageFile(file, 360, 360);
        document.getElementById('teamImagePreview').src = currentTeamModalImage;
      } catch (err) {
        showToast(err.message);
      }
    });

    const teamLocalSelect = document.getElementById('teamLocalFolderSelect');
    if (teamLocalSelect) {
      teamLocalSelect.addEventListener('change', (e) => {
        const opt = e.target.selectedOptions && e.target.selectedOptions[0];
        const uri = opt ? opt.getAttribute('data-uri') : '';
        if (uri) {
          currentTeamModalImage = uri;
          document.getElementById('teamImagePreview').src = currentTeamModalImage;
        }
      });
    }

    document.getElementById('btnGenerateTeamCrest').addEventListener('click', () => {
      const col = document.getElementById('teamColorInput').value || '#e10600';
      const short = (document.getElementById('teamShortInput').value || 'F1').toUpperCase();
      currentTeamModalImage = window.ChampionshipData.createTeamSvg(col, short);
      document.getElementById('teamImagePreview').src = currentTeamModalImage;
    });

    // Guardar Escudería (y vincular n pilotos: 2, 3, 4+ sin límite)
    document.getElementById('formTeam').addEventListener('submit', async () => {
      const id = document.getElementById('teamIdInput').value || `t_${Date.now()}`;
      const name = document.getElementById('teamNameInput').value.trim();
      const shortName = document.getElementById('teamShortInput').value.trim().toUpperCase();
      const color = document.getElementById('teamColorInput').value || '#e10600';

      const teamObj = { id, name, shortName, color, image: currentTeamModalImage };
      const idx = (appState.teams || []).findIndex((t) => t.id === id);
      if (idx >= 0) {
        appState.teams[idx] = teamObj;
      } else {
        appState.teams.push(teamObj);
      }

      // Actualizar vinculación de pilotos marcados en el checklist (soporta 2, 3, 4+ pilotos)
      const checkedDriverIds = new Set(
        Array.from(document.querySelectorAll('.team-driver-assign-chk:checked')).map((c) => c.value)
      );
      (appState.drivers || []).forEach((d) => {
        const secSet = new Set(Array.isArray(d.secondaryTeamIds) ? d.secondaryTeamIds : []);
        if (checkedDriverIds.has(d.id)) {
          if (!d.teamId) {
            d.teamId = id;
          } else if (d.teamId !== id) {
            secSet.add(id);
          }
        } else {
          secSet.delete(id);
          if (d.teamId === id) {
            const fallback = Array.from(secSet)[0] || '';
            d.teamId = fallback;
            if (fallback) secSet.delete(fallback);
          }
        }
        d.secondaryTeamIds = Array.from(secSet);
      });

      if (window.desktopAPI && window.desktopAPI.saveImageToLocal && currentTeamModalImage) {
        await window.desktopAPI.saveImageToLocal('teams', shortName || name, currentTeamModalImage);
      }

      await persistAndRender(`🛡️ Escudería ${name} guardada correctamente (${checkedDriverIds.size} piloto(s) vinculados).`);
    });

    // Eliminar Escudería
    document.getElementById('btnDeleteTeam').addEventListener('click', async () => {
      const id = document.getElementById('teamIdInput').value;
      if (!id) return;
      appState.teams = (appState.teams || []).filter((t) => t.id !== id);
      document.getElementById('dialogTeam').close();
      await persistAndRender('Escudería eliminada.');
    });

    // Subida de imagen en Modal Pista
    document.getElementById('trackImageFile').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        currentTrackModalImage = await window.ChampionshipData.processImageFile(file, 480, 360);
        document.getElementById('trackImagePreview').src = currentTrackModalImage;
      } catch (err) {
        showToast(err.message);
      }
    });

    const trackCatSelect = document.getElementById('trackCatalogSelect');
    if (trackCatSelect) {
      trackCatSelect.addEventListener('change', (e) => {
        const key = e.target.value;
        if (!key || !Array.isArray(window.F1TracksCatalog)) return;
        const found = window.F1TracksCatalog.find((c) => c.key === key);
        if (found && found.dataUri) {
          currentTrackModalImage = found.dataUri;
          document.getElementById('trackImagePreview').src = currentTrackModalImage;
        }
      });
    }

    document.getElementById('btnGenerateTrackSvg').addEventListener('click', () => {
      const variant = Math.floor(1 + Math.random() * 4);
      const colors = ['#e10600', '#22d3ee', '#ff8000', '#10b981'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      currentTrackModalImage = window.ChampionshipData.createTrackSvg(color, variant);
      document.getElementById('trackImagePreview').src = currentTrackModalImage;
    });

    // Guardar Pista
    document.getElementById('formTrack').addEventListener('submit', async () => {
      const id = document.getElementById('trackIdInput').value || `r_${Date.now()}`;
      const round = Number(document.getElementById('trackRoundInput').value) || 1;
      const country = document.getElementById('trackCountryInput').value.trim();
      const name = document.getElementById('trackNameInput').value.trim();
      const circuit = document.getElementById('trackCircuitInput').value.trim();
      const hasSprint = document.getElementById('trackHasSprintInput').checked;
      const pointsMultiplier = Number(document.getElementById('trackPointsMultiplierSelect').value);
      const safeMult = Number.isFinite(pointsMultiplier) ? pointsMultiplier : 1;

      const idx = (appState.tracks || []).findIndex((t) => t.id === id);
      if (idx >= 0) {
        appState.tracks[idx] = {
          ...appState.tracks[idx],
          round,
          country,
          name,
          circuit,
          hasSprint,
          pointsMultiplier: safeMult,
          image: currentTrackModalImage
        };
      } else {
        appState.tracks.push({
          id,
          round,
          country,
          name,
          circuit,
          hasSprint,
          pointsMultiplier: safeMult,
          completed: false,
          image: currentTrackModalImage,
          results: { poleDriverId: '', fastestLapDriverId: '', raceOrder: [], dnfDriverIds: [], sprintOrder: [] }
        });
      }
      await persistAndRender(`🗓️ Fecha "${name}" guardada en el calendario.`);
    });

    // Eliminar Pista
    document.getElementById('btnDeleteTrack').addEventListener('click', async () => {
      const id = document.getElementById('trackIdInput').value;
      if (!id) return;
      appState.tracks = (appState.tracks || []).filter((t) => t.id !== id);
      document.getElementById('dialogTrack').close();
      await persistAndRender('Fecha eliminada del calendario.');
    });

    // Conmutador de sesión dentro del Modal de Resultados (Carrera Principal vs Sprint)
    document.querySelectorAll('[data-results-session]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setActiveResultsSession(btn.getAttribute('data-results-session'));
      });
    });

    // Sincronizar cambios en selectores de Pole y Vuelta Rápida con las insignias del tablero
    document.getElementById('resultsPoleSelect').addEventListener('change', () => renderDndBoard());
    document.getElementById('resultsFastestLapSelect').addEventListener('change', () => renderDndBoard());
    document.getElementById('resultsPointsMultiplierSelect').addEventListener('change', () => renderDndBoard());

    // Vaciar casilleros de la sesión activa (enviar todos al Paddock)
    document.getElementById('btnClearSlotsToPaddock').addEventListener('click', () => {
      const nDrivers = (appState.drivers || []).length;
      if (activeResultsSession === 'sprint') {
        modalSprintSlots = new Array(nDrivers).fill(null);
      } else {
        modalRaceSlots = new Array(nDrivers).fill(null);
        modalDriverStatuses = {};
        modalDnfSet.clear();
      }
      renderDndBoard();
    });

    // Rellenar automáticamente los casilleros que sigan vacíos
    document.getElementById('btnFillRemainingSlots').addEventListener('click', () => {
      const slots = getActiveSlotsArray();
      const assigned = new Set(slots.filter(Boolean));
      const remaining = (appState.drivers || []).map((d) => d.id).filter((id) => !assigned.has(id));
      let remIdx = 0;
      for (let i = 0; i < slots.length; i++) {
        if (!slots[i] && remIdx < remaining.length) {
          slots[i] = remaining[remIdx++];
        }
      }
      renderDndBoard();
    });

    // Autocompletar / Simular resultados de una fecha en el modal de Resultados
    document.getElementById('btnAutoFillRaceResults').addEventListener('click', () => {
      const drivers = [...(appState.drivers || [])];
      if (drivers.length === 0) return;

      const shuffleBySkill = () =>
        drivers
          .map((d) => ({
            id: d.id,
            score: (Number(d.baseRating) || 85) + (Math.random() - 0.5) * 18
          }))
          .sort((a, b) => b.score - a.score)
          .map((x) => x.id);

      modalRaceSlots = shuffleBySkill();
      modalSprintSlots = shuffleBySkill();
      modalDriverStatuses = {};
      if (modalRaceSlots.length > 3 && Math.random() < 0.65) {
        modalDriverStatuses[modalRaceSlots[modalRaceSlots.length - 1]] = 'DNF';
      }
      syncDnfSetFromStatuses();

      document.getElementById('resultsPoleSelect').value = modalRaceSlots[0] || '';
      document.getElementById('resultsFastestLapSelect').value =
        modalRaceSlots[Math.min(1, modalRaceSlots.length - 1)] || '';

      renderDndBoard();
    });

    // Eventos Drag & Drop y Clic Rápido en el Tablero de Resultados
    const resultsModal = document.getElementById('dialogRaceResults');

    resultsModal.addEventListener('dragstart', (e) => {
      const card = e.target.closest('[draggable="true"][data-driver-id]');
      if (!card) return;
      const driverId = card.getAttribute('data-driver-id');
      const sourceSlot = Number(card.getAttribute('data-source-slot'));
      draggedDriverState = { driverId, sourceSlot };
      card.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', driverId);
      }
    });

    resultsModal.addEventListener('dragend', (e) => {
      const card = e.target.closest('[draggable="true"][data-driver-id]');
      if (card) card.classList.remove('is-dragging');
      resultsModal.querySelectorAll('.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      draggedDriverState = null;
    });

    resultsModal.addEventListener('dragover', (e) => {
      const slotRow = e.target.closest('.dnd-slot-row');
      const paddock = e.target.closest('#dndPaddockZone');
      if (slotRow || paddock) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        resultsModal.querySelectorAll('.is-drag-over').forEach((el) => {
          if (el !== slotRow && el !== paddock) el.classList.remove('is-drag-over');
        });
        if (slotRow) slotRow.classList.add('is-drag-over');
        else if (paddock) paddock.classList.add('is-drag-over');
      }
    });

    resultsModal.addEventListener('dragleave', (e) => {
      const slotRow = e.target.closest('.dnd-slot-row');
      if (slotRow && !slotRow.contains(e.relatedTarget)) {
        slotRow.classList.remove('is-drag-over');
      }
    });

    resultsModal.addEventListener('drop', (e) => {
      const slotRow = e.target.closest('.dnd-slot-row');
      const paddock = e.target.closest('#dndPaddockZone');
      if (!slotRow && !paddock) return;
      e.preventDefault();
      resultsModal.querySelectorAll('.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));

      if (!draggedDriverState || !draggedDriverState.driverId) return;
      const { driverId, sourceSlot } = draggedDriverState;
      const slots = getActiveSlotsArray();

      if (slotRow) {
        const targetIdx = Number(slotRow.getAttribute('data-slot-idx'));
        if (Number.isNaN(targetIdx)) return;

        if (sourceSlot >= 0 && sourceSlot < slots.length) {
          // Intercambiar entre dos casilleros de posición
          const existingTargetDriver = slots[targetIdx];
          slots[targetIdx] = driverId;
          slots[sourceSlot] = existingTargetDriver || null;
        } else {
          // Viene desde el Paddock: asegurarnos de que no esté duplicado y asignarlo al casillero
          const prevIdx = slots.indexOf(driverId);
          if (prevIdx !== -1) slots[prevIdx] = null;
          slots[targetIdx] = driverId;
        }

        // Si se colocó al 1° puesto y aún no había Pole seleccionada, sugerirla
        if (activeResultsSession === 'race' && targetIdx === 0 && !document.getElementById('resultsPoleSelect').value) {
          document.getElementById('resultsPoleSelect').value = driverId;
        }
        renderDndBoard();
      } else if (paddock) {
        if (sourceSlot >= 0 && sourceSlot < slots.length) {
          slots[sourceSlot] = null;
          renderDndBoard();
        }
      }
      draggedDriverState = null;
    });

    // Clic rápido sobre un piloto del Paddock (lo envía al primer casillero vacío) y botones de cada fila
    resultsModal.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-slot-action]');
      if (actionBtn) {
        const slotAction = actionBtn.getAttribute('data-slot-action');
        const slots = getActiveSlotsArray();
        const slotIdx = Number(actionBtn.getAttribute('data-slot-idx'));
        const driverId = actionBtn.getAttribute('data-driver-id');

        if (slotAction === 'remove-slot' && slotIdx >= 0) {
          slots[slotIdx] = null;
          renderDndBoard();
        } else if (slotAction === 'move-up' && slotIdx > 0) {
          const tmp = slots[slotIdx - 1];
          slots[slotIdx - 1] = slots[slotIdx];
          slots[slotIdx] = tmp;
          renderDndBoard();
        } else if (slotAction === 'move-down' && slotIdx < slots.length - 1) {
          const tmp = slots[slotIdx + 1];
          slots[slotIdx + 1] = slots[slotIdx];
          slots[slotIdx] = tmp;
          renderDndBoard();
        } else if (slotAction === 'toggle-pole' && driverId) {
          const poleSel = document.getElementById('resultsPoleSelect');
          poleSel.value = poleSel.value === driverId ? '' : driverId;
          renderDndBoard();
        } else if (slotAction === 'toggle-fl' && driverId) {
          const flSel = document.getElementById('resultsFastestLapSelect');
          flSel.value = flSel.value === driverId ? '' : driverId;
          renderDndBoard();
        } else if (slotAction === 'toggle-status' && driverId) {
          const st = actionBtn.getAttribute('data-status');
          if (modalDriverStatuses[driverId] === st) delete modalDriverStatuses[driverId];
          else modalDriverStatuses[driverId] = st;
          syncDnfSetFromStatuses();
          renderDndBoard();
        }
        return;
      }

      // Clic en ficha de piloto dentro del Paddock -> asignar al primer puesto libre
      const paddockChip = e.target.closest('#dndPaddockZone .dnd-driver-chip');
      if (paddockChip) {
        const driverId = paddockChip.getAttribute('data-driver-id');
        const slots = getActiveSlotsArray();
        const emptyIdx = slots.findIndex((s) => !s);
        if (emptyIdx !== -1 && driverId) {
          slots[emptyIdx] = driverId;
          if (activeResultsSession === 'race' && emptyIdx === 0 && !document.getElementById('resultsPoleSelect').value) {
            document.getElementById('resultsPoleSelect').value = driverId;
          }
          renderDndBoard();
        }
      }
    });

    // Movimiento por teclado (Flechas Arriba / Abajo) en el handle de arrastre
    resultsModal.addEventListener('keydown', (e) => {
      const handle = e.target.closest('.drag-handle[data-slot-idx]');
      if (!handle) return;
      const slotIdx = Number(handle.getAttribute('data-slot-idx'));
      const slots = getActiveSlotsArray();

      if (e.key === 'ArrowUp' && slotIdx > 0) {
        e.preventDefault();
        const tmp = slots[slotIdx - 1];
        slots[slotIdx - 1] = slots[slotIdx];
        slots[slotIdx] = tmp;
        renderDndBoard();
        const nextHandle = resultsModal.querySelector(`.drag-handle[data-slot-idx="${slotIdx - 1}"]`);
        if (nextHandle) nextHandle.focus();
      } else if (e.key === 'ArrowDown' && slotIdx < slots.length - 1) {
        e.preventDefault();
        const tmp = slots[slotIdx + 1];
        slots[slotIdx + 1] = slots[slotIdx];
        slots[slotIdx] = tmp;
        renderDndBoard();
        const nextHandle = resultsModal.querySelector(`.drag-handle[data-slot-idx="${slotIdx + 1}"]`);
        if (nextHandle) nextHandle.focus();
      }
    });

    // Cambiar la escudería con la que puntuó un piloto en esta fecha específica
    resultsModal.addEventListener('change', (e) => {
      const teamSel = e.target.closest('.slot-team-select[data-slot-team-driver]');
      if (!teamSel) return;
      const driverId = teamSel.getAttribute('data-slot-team-driver');
      if (driverId) {
        modalDriverTeams[driverId] = teamSel.value;
        renderDndBoard();
      }
    });

    // Dejar fecha como pendiente
    document.getElementById('btnMarkTrackPending').addEventListener('click', async () => {
      const trackId = document.getElementById('resultsTrackIdInput').value;
      const track = (appState.tracks || []).find((t) => t.id === trackId);
      if (track) {
        track.completed = false;
        track.results = {
          poleDriverId: '',
          fastestLapDriverId: '',
          raceOrder: [],
          dnfDriverIds: [],
          sprintOrder: [],
          driverTeams: {}
        };
        document.getElementById('dialogRaceResults').close();
        await persistAndRender(`⏳ "${track.name}" quedó marcada como fecha pendiente.`);
      }
    });

    // Guardar Resultados de Carrera (completando automáticamente cualquier puesto vacío al final)
    document.getElementById('formRaceResults').addEventListener('submit', async () => {
      const trackId = document.getElementById('resultsTrackIdInput').value;
      const track = (appState.tracks || []).find((t) => t.id === trackId);
      if (!track) return;

      const allIds = (appState.drivers || []).map((d) => d.id);

      const finalizeOrder = (slotsArray) => {
        const placed = slotsArray.filter(Boolean);
        const placedSet = new Set(placed);
        const remaining = allIds.filter((id) => !placedSet.has(id));
        const finalOrder = [];
        let remIdx = 0;
        for (let i = 0; i < allIds.length; i++) {
          if (slotsArray[i]) {
            finalOrder.push(slotsArray[i]);
          } else if (remIdx < remaining.length) {
            finalOrder.push(remaining[remIdx++]);
          }
        }
        return finalOrder;
      };

      const raceOrder = finalizeOrder(modalRaceSlots);
      const sprintOrder = track.hasSprint ? finalizeOrder(modalSprintSlots) : [];
      const dnfDriverIds = Object.keys(modalDriverStatuses);
      const driverStatuses = { ...modalDriverStatuses };

      // Si algún piloto corrió con otra escudería en esta fecha, vincularla automáticamente a su historial
      (appState.drivers || []).forEach((d) => {
        const racedTeamId = modalDriverTeams[d.id];
        if (racedTeamId && racedTeamId !== d.teamId) {
          const secSet = new Set(Array.isArray(d.secondaryTeamIds) ? d.secondaryTeamIds : []);
          secSet.add(racedTeamId);
          d.secondaryTeamIds = Array.from(secSet);
        }
      });

      track.completed = true;
      track.pointsMultiplier = getResultsMultiplier();
      track.results = {
        poleDriverId: document.getElementById('resultsPoleSelect').value || raceOrder[0] || '',
        fastestLapDriverId: document.getElementById('resultsFastestLapSelect').value || raceOrder[0] || '',
        raceOrder,
        dnfDriverIds,
        driverStatuses,
        sprintOrder,
        driverTeams: { ...modalDriverTeams }
      };

      await persistAndRender(`🏁 ¡Resultados de ${track.name} guardados! Puntos y chances actualizados.`);
    });

    // Editor de Sistema de Puntos
    document.getElementById('btnAddRacePointPos').addEventListener('click', () => {
      readPointsInputsFromDom();
      editableRacePoints.push(1);
      renderPointsInputsGrids();
    });

    document.getElementById('btnRemoveRacePointPos').addEventListener('click', () => {
      readPointsInputsFromDom();
      if (editableRacePoints.length > 1) {
        editableRacePoints.pop();
        renderPointsInputsGrids();
      }
    });

    document.getElementById('btnAddSprintPointPos').addEventListener('click', () => {
      readPointsInputsFromDom();
      editableSprintPoints.push(1);
      renderPointsInputsGrids();
    });

    document.getElementById('btnRemoveSprintPointPos').addEventListener('click', () => {
      readPointsInputsFromDom();
      if (editableSprintPoints.length > 0) {
        editableSprintPoints.pop();
        renderPointsInputsGrids();
      }
    });

    document.getElementById('view-points').addEventListener('input', () => {
      updatePointsLivePreviewBanner();
    });

    document.getElementById('btnSavePointsSystem').addEventListener('click', async () => {
      readPointsInputsFromDom();
      appState.pointsSystem = {
        racePoints: [...editableRacePoints],
        sprintPoints: [...editableSprintPoints],
        fastestLapPoints: Math.max(0, Number(document.getElementById('inputFastestLapPoints').value) || 0),
        fastestLapTopLimit: Math.max(1, Number(document.getElementById('inputFastestLapLimit').value) || 10),
        polePoints: Math.max(0, Number(document.getElementById('inputPolePoints').value) || 0)
      };
      await persistAndRender('⚙️ ¡Sistema de puntos actualizado! Toda la tabla y bolsa de puntos fueron recalculadas.');
    });

    // Exportar / Importar JSON y Presets de Campeonato
    document.getElementById('btnExportJson').addEventListener('click', async () => {
      const jsonStr = JSON.stringify(appState, null, 2);
      const safeName = `${(appState.meta.championshipName || 'campeonato-f1').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;

      if (window.desktopAPI && window.desktopAPI.exportChampionship) {
        const res = await window.desktopAPI.exportChampionship(jsonStr, safeName);
        if (res && res.ok) {
          showToast('💾 Campeonato exportado correctamente a tu PC.');
        }
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        a.click();
        URL.revokeObjectURL(url);
        showToast('💾 Archivo JSON descargado.');
      }
    });

    document.getElementById('btnImportJson').addEventListener('click', async () => {
      if (window.desktopAPI && window.desktopAPI.importChampionship) {
        const res = await window.desktopAPI.importChampionship();
        if (res && res.ok && res.content) {
          try {
            const parsed = JSON.parse(res.content);
            if (parsed && parsed.pointsSystem && Array.isArray(parsed.drivers)) {
              appState = parsed;
              await persistAndRender('📂 ¡Campeonato cargado con éxito desde tu archivo!');
            } else {
              showToast('El archivo seleccionado no tiene el formato de un campeonato válido.');
            }
          } catch (_e) {
            showToast('No pudimos leer el archivo JSON seleccionado.');
          }
        }
      }
    });

    document.getElementById('btnLoadDemo').addEventListener('click', async () => {
      const cache = readLiveCache();
      if (cache && cache.season) {
        const fresh = JSON.parse(JSON.stringify(cache.season));
        if (window.ChampionshipData && typeof window.ChampionshipData.hydrateSeasonStateVisuals === 'function') {
          window.ChampionshipData.hydrateSeasonStateVisuals(fresh);
        }
        appState = fresh;
        await persistAndRender(`🔄 Temporada 2026 cargada con los últimos resultados (${countCompleted(fresh)} de ${fresh.tracks.length} fechas disputadas).`);
        return;
      }
      appState = window.ChampionshipData.createDemoChampionship(false);
      await persistAndRender('🔄 Temporada 2026 cargada (20 de 23 fechas disputadas hasta el GP de São Paulo).');
    });

    const btn2026Zero = document.getElementById('btnLoad2026Zero');
    if (btn2026Zero) {
      btn2026Zero.addEventListener('click', async () => {
        appState = window.ChampionshipData.createDemoChampionship(true);
        await persistAndRender('🏁 Parrilla y calendario F1 2026 listos desde la Fecha 1 (0 puntos).');
      });
    }

    document.getElementById('btnNewBlank').addEventListener('click', async () => {
      appState = window.ChampionshipData.createEmptyChampionship();
      await persistAndRender('✨ Torneo en blanco creado. ¡Agrega tus escuderías, pilotos y pistas!');
    });

    // =========================================================
    // EVENTOS DEL ARCHIVO HISTÓRICO F1 (1950–2026)
    // =========================================================
    const btnOpenHistDash = document.getElementById('btnOpenHistoryFromDash');
    if (btnOpenHistDash) {
      btnOpenHistDash.addEventListener('click', () => switchTab('history'));
    }

    document.querySelectorAll('[data-hist-tab]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        histActiveSubtab = btn.getAttribute('data-hist-tab') || 'seasons';
        histFilterValue = 'all';
        histRenderLimit = 48;
        document.querySelectorAll('[data-hist-tab]').forEach((b) =>
          b.classList.toggle('active', b.getAttribute('data-hist-tab') === histActiveSubtab)
        );
        const cat = await getHistoricalCatalogData();
        updateHistFilterDropdown(cat);
        renderHistoryView();
      });
    });

    const histSearchEl = document.getElementById('histSearchInput');
    if (histSearchEl) {
      histSearchEl.addEventListener('input', () => {
        histSearchQuery = histSearchEl.value || '';
        histRenderLimit = 48;
        renderHistoryView();
      });
    }

    const histFilterEl = document.getElementById('histFilterSelect');
    if (histFilterEl) {
      histFilterEl.addEventListener('change', () => {
        histFilterValue = histFilterEl.value || 'all';
        histRenderLimit = 48;
        renderHistoryView();
      });
    }

    const btnHistMore = document.getElementById('btnHistLoadMore');
    if (btnHistMore) {
      btnHistMore.addEventListener('click', () => {
        histRenderLimit += 48;
        renderHistoryView();
      });
    }

    const btnQuickFull = document.getElementById('btnHistQuickLoadFull');
    if (btnQuickFull) {
      btnQuickFull.addEventListener('click', async () => {
        const y = document.getElementById('histQuickYearSelect').value || 2026;
        await loadHistoricalSeasonIntoApp(y, 'full');
      });
    }

    const btnQuickZero = document.getElementById('btnHistQuickLoadZero');
    if (btnQuickZero) {
      btnQuickZero.addEventListener('click', async () => {
        const y = document.getElementById('histQuickYearSelect').value || 2026;
        await loadHistoricalSeasonIntoApp(y, 'zero');
      });
    }

    const formHistMid = document.getElementById('formHistMidSeason');
    if (formHistMid) {
      formHistMid.addEventListener('submit', async () => {
        const y = document.getElementById('histMidYearInput').value || 2021;
        const r = Number(document.getElementById('histMidRoundSelect').value) || 0;
        if (r <= 0) {
          await loadHistoricalSeasonIntoApp(y, 'zero');
        } else {
          await loadHistoricalSeasonIntoApp(y, 'mid', r);
        }
      });
    }

    const histContainer = document.getElementById('histContentContainer');
    if (histContainer) {
      histContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-hist-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-hist-action');

        if (action === 'load-full') {
          await loadHistoricalSeasonIntoApp(btn.getAttribute('data-year'), 'full');
          return;
        }
        if (action === 'load-zero') {
          await loadHistoricalSeasonIntoApp(btn.getAttribute('data-year'), 'zero');
          return;
        }
        if (action === 'load-mid') {
          await openHistMidSeasonModal(btn.getAttribute('data-year'));
          return;
        }

        const cat = await getHistoricalCatalogData();
        if (!cat) return;

        if (action === 'import-driver') {
          const f1dbId = btn.getAttribute('data-f1db-id');
          const dItem = cat.drivers.find((d) => d.f1dbId === f1dbId);
          if (!dItem) return;

          // Verificar si su escudería icónica ya existe en el torneo actual; si no, crearla automáticamente
          let targetTeam = (appState.teams || []).find(
            (t) => t.id === dItem.primaryTeamId || t.name.toLowerCase() === dItem.primaryTeamName.toLowerCase()
          );
          if (!targetTeam) {
            const cItem = cat.constructors.find((c) => `t_${c.f1dbId}` === dItem.primaryTeamId);
            const shortCode = cItem ? cItem.shortName : dItem.primaryTeamName.slice(0, 3).toUpperCase();
            const color = dItem.primaryColor || '#e10600';
            targetTeam = {
              id: dItem.primaryTeamId,
              name: dItem.primaryTeamName,
              shortName: shortCode,
              color,
              image: window.ChampionshipData.createTeamSvg(color, shortCode)
            };
            appState.teams.push(targetTeam);
          }

          const newDriverId = (appState.drivers || []).some((x) => x.id === dItem.id)
            ? `${dItem.id}_${Date.now().toString(36).slice(-3)}`
            : dItem.id;

          const newDriver = {
            id: newDriverId,
            name: dItem.name,
            code: dItem.code,
            number: dItem.number,
            teamId: targetTeam.id,
            secondaryTeamIds: [],
            country: dItem.country,
            baseRating: dItem.baseRating,
            image: window.ChampionshipData.createHelmetSvg(
              targetTeam.color || '#e10600',
              '#ffffff',
              String(dItem.number)
            )
          };
          appState.drivers.push(newDriver);
          window.ChampionshipData.hydrateSeasonStateVisuals(appState);
          await persistAndRender(`🏎️ ¡${dItem.name} (${targetTeam.name}) fue inscrito en tu campeonato actual!`);
          renderHistoryView();
          return;
        }

        if (action === 'import-constructor') {
          const f1dbId = btn.getAttribute('data-f1db-id');
          const cItem = cat.constructors.find((c) => c.f1dbId === f1dbId);
          if (!cItem) return;

          if ((appState.teams || []).some((t) => t.id === cItem.id)) {
            showToast(`La escudería ${cItem.name} ya forma parte de tu campeonato actual.`);
            return;
          }

          appState.teams.push({
            id: cItem.id,
            name: cItem.name,
            shortName: cItem.shortName,
            color: cItem.color,
            image: window.ChampionshipData.createTeamSvg(cItem.color, cItem.shortName)
          });
          window.ChampionshipData.hydrateSeasonStateVisuals(appState);
          await persistAndRender(`🛡️ ¡Escudería ${cItem.name} agregada a tu campeonato!`);
          renderHistoryView();
          return;
        }

        if (action === 'import-circuit') {
          const f1dbId = btn.getAttribute('data-f1db-id');
          const cir = cat.circuits.find((c) => c.f1dbId === f1dbId);
          if (!cir) return;

          const nextRound = (appState.tracks || []).length + 1;
          const catMatch =
            Array.isArray(window.F1TracksCatalog) &&
            window.F1TracksCatalog.find((tc) => tc.key === cir.catKey);
          const svgImg = catMatch
            ? catMatch.dataUri
            : window.ChampionshipData.createTrackSvg(cir.color || '#22d3ee', nextRound);

          appState.tracks.push({
            id: `r_${nextRound}_${Date.now().toString(36).slice(-3)}`,
            round: nextRound,
            name: `GP de ${cir.country} (${cir.shortName})`,
            country: cir.country,
            circuit: `${cir.name}${cir.placeName ? `, ${cir.placeName}` : ''}`,
            catKey: cir.catKey,
            color: cir.color || '#22d3ee',
            hasSprint: false,
            completed: false,
            image: svgImg,
            results: {
              poleDriverId: '',
              fastestLapDriverId: '',
              raceOrder: [],
              dnfDriverIds: [],
              sprintOrder: [],
              driverTeams: {}
            }
          });
          await persistAndRender(
            `🗺️ ¡${cir.name} agregado como Fecha #${nextRound} de tu calendario!`
          );
        }
      });
    }

    // Delegación global para abrir el menú de "¿Qué necesita para lograr su Mejor Posición?" al presionar cualquier zona de probabilidades
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('[data-open-target-req]');
      if (openBtn) {
        const kind = openBtn.getAttribute('data-open-target-req') || 'driver';
        const entityId = openBtn.getAttribute('data-entity-id') || '';
        openTargetRequirementsModal(kind, entityId, null);
        return;
      }

      const switchRankBtn = e.target.closest('[data-switch-target-rank]');
      if (switchRankBtn) {
        const rank = Number(switchRankBtn.getAttribute('data-switch-target-rank')) || 1;
        const kind = switchRankBtn.getAttribute('data-req-kind') || 'driver';
        const entityId = switchRankBtn.getAttribute('data-req-entity') || '';
        openTargetRequirementsModal(kind, entityId, rank);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
