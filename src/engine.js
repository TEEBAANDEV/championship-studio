/**
 * Motor Matemático y Simulador de Probabilidades Monte Carlo para F1 Championship Studio
 * Calcula puntajes, desempates FIA, bolsa de puntos del campeonato, chances matemáticas
 * y proyecciones probabilísticas de posiciones finales.
 */

function sumArray(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((acc, val) => acc + (Number(val) || 0), 0);
}

function roundPts(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Calcula las estadísticas de puntos disponibles en el campeonato según el reglamento activo.
 */
function calculateChampionshipPool(state) {
  const ps = state.pointsSystem || {};
  const racePts = ps.racePoints || [];
  const sprintPts = ps.sprintPoints || [];
  const flPts = Number(ps.fastestLapPoints) || 0;
  const polePts = Number(ps.polePoints) || 0;
  const driverCount = (state.drivers || []).length;

  // Si hay menos pilotos inscritos que posiciones premiadas, solo se reparten hasta el número de pilotos
  const effectiveRaceSlice = driverCount > 0 ? racePts.slice(0, driverCount) : racePts;
  const effectiveSprintSlice = driverCount > 0 ? sprintPts.slice(0, driverCount) : sprintPts;

  const baseRaceSum = sumArray(effectiveRaceSlice);
  const baseSprintSum = sumArray(effectiveSprintSlice);

  const poolPerNormalRace = baseRaceSum + flPts + polePts;
  const poolPerSprintRace = poolPerNormalRace + baseSprintSum;

  const maxDriverNormalRace = (Number(racePts[0]) || 0) + flPts + polePts;
  const maxDriverSprintRace = maxDriverNormalRace + (Number(sprintPts[0]) || 0);

  const tracks = state.tracks || [];
  let totalChampionshipPool = 0;
  let distributedPool = 0;
  let remainingPool = 0;

  let maxPossibleEntireSeasonForOneDriver = 0;
  let maxRemainingForOneDriver = 0;

  let completedRacesCount = 0;
  let remainingRacesCount = 0;
  let remainingSprintsCount = 0;
  let totalSprintsCount = 0;

  for (const track of tracks) {
    const isSprint = Boolean(track.hasSprint);
    if (isSprint) totalSprintsCount++;

    const mult =
      track.pointsMultiplier !== undefined && track.pointsMultiplier !== null
        ? Number(track.pointsMultiplier)
        : 1;
    const bonusPool = mult > 0 ? flPts + polePts : 0;
    const trackPool = roundPts(baseRaceSum * mult + bonusPool + (isSprint ? baseSprintSum : 0));
    const trackMaxOne = roundPts(
      (Number(racePts[0]) || 0) * mult + bonusPool + (isSprint ? Number(sprintPts[0]) || 0 : 0)
    );

    totalChampionshipPool = roundPts(totalChampionshipPool + trackPool);
    maxPossibleEntireSeasonForOneDriver = roundPts(maxPossibleEntireSeasonForOneDriver + trackMaxOne);

    if (track.completed) {
      completedRacesCount++;
      distributedPool = roundPts(distributedPool + trackPool);
    } else {
      remainingRacesCount++;
      if (isSprint) remainingSprintsCount++;
      remainingPool = roundPts(remainingPool + trackPool);
      maxRemainingForOneDriver = roundPts(maxRemainingForOneDriver + trackMaxOne);
    }
  }

  // Puntos del próximo GP (para calcular qué necesita el líder para coronarse en la siguiente fecha)
  const nextTrack = tracks.find((t) => !t.completed) || null;
  const nextMult =
    nextTrack && nextTrack.pointsMultiplier !== undefined && nextTrack.pointsMultiplier !== null
      ? Number(nextTrack.pointsMultiplier)
      : 1;
  const nextTrackMaxOneDriver = nextTrack
    ? roundPts(
        (Number(racePts[0]) || 0) * nextMult +
          (nextMult > 0 ? flPts + polePts : 0) +
          (nextTrack.hasSprint ? Number(sprintPts[0]) || 0 : 0)
      )
    : 0;
  const maxRemainingAfterNextRace = roundPts(
    Math.max(0, maxRemainingForOneDriver - nextTrackMaxOneDriver)
  );

  return {
    poolPerNormalRace,
    poolPerSprintRace,
    maxDriverNormalRace,
    maxDriverSprintRace,
    totalChampionshipPool,
    distributedPool,
    remainingPool,
    maxPossibleEntireSeasonForOneDriver,
    maxRemainingForOneDriver,
    completedRacesCount,
    remainingRacesCount,
    totalRacesCount: tracks.length,
    totalSprintsCount,
    remainingSprintsCount,
    nextTrack,
    nextTrackMaxOneDriver,
    maxRemainingAfterNextRace
  };
}

/**
 * Calcula los puntos obtenidos en una fecha específica para cada piloto.
 * Soporta multiplicador de puntos (1 = 100%, 0.5 = mitad de puntos por suspensión, 2 = doble puntuación, 0 = sin puntos)
 * y estados especiales de piloto: DNF (No terminó), DNS (No empezó) y DSQ (Descalificado).
 */
function scoreSingleTrack(track, pointsSystem) {
  const scores = {};
  if (!track || !track.completed || !track.results) return scores;

  const racePts = pointsSystem.racePoints || [];
  const sprintPts = pointsSystem.sprintPoints || [];
  const flPts = Number(pointsSystem.fastestLapPoints) || 0;
  const flTopLimit = Number(pointsSystem.fastestLapTopLimit) || 10;
  const polePts = Number(pointsSystem.polePoints) || 0;
  const mult =
    track.pointsMultiplier !== undefined && track.pointsMultiplier !== null
      ? Number(track.pointsMultiplier)
      : 1;

  const res = track.results;
  const statusMap = res.driverStatuses || {};
  const dnfSet = new Set([
    ...(res.dnfDriverIds || []),
    ...Object.keys(statusMap).filter((k) => statusMap[k] === 'DNF' || statusMap[k] === 'DNS' || statusMap[k] === 'DSQ')
  ]);
  const raceOrder = res.raceOrder || [];
  const sprintOrder = res.sprintOrder || [];

  const ensureDriver = (id) => {
    if (!scores[id]) {
      scores[id] = {
        total: 0,
        racePoints: 0,
        sprintPoints: 0,
        flPoints: 0,
        polePoints: 0,
        position: null,
        sprintPosition: null,
        isDnf: false,
        status: 'FIN',
        gotPole: false,
        gotFastestLap: false
      };
    }
  };

  // Carrera principal
  raceOrder.forEach((driverId, index) => {
    if (!driverId) return;
    ensureDriver(driverId);
    const pos = index + 1;
    const isDnf = dnfSet.has(driverId);
    const st = statusMap[driverId] || (isDnf ? 'DNF' : 'FIN');
    scores[driverId].position = pos;
    scores[driverId].isDnf = isDnf;
    scores[driverId].status = st;

    if (!isDnf && index < racePts.length && mult > 0) {
      const pts = roundPts((Number(racePts[index]) || 0) * mult);
      scores[driverId].racePoints = roundPts(scores[driverId].racePoints + pts);
      scores[driverId].total = roundPts(scores[driverId].total + pts);
    }
  });

  // Sprint
  if (track.hasSprint) {
    sprintOrder.forEach((driverId, index) => {
      if (!driverId) return;
      ensureDriver(driverId);
      scores[driverId].sprintPosition = index + 1;
      if (index < sprintPts.length) {
        const pts = Number(sprintPts[index]) || 0;
        scores[driverId].sprintPoints = roundPts(scores[driverId].sprintPoints + pts);
        scores[driverId].total = roundPts(scores[driverId].total + pts);
      }
    });
  }

  // Pole Position
  if (res.poleDriverId) {
    ensureDriver(res.poleDriverId);
    scores[res.poleDriverId].gotPole = true;
    if (polePts > 0 && mult > 0) {
      scores[res.poleDriverId].polePoints = roundPts(scores[res.poleDriverId].polePoints + polePts);
      scores[res.poleDriverId].total = roundPts(scores[res.poleDriverId].total + polePts);
    }
  }

  // Vuelta Rápida
  if (res.fastestLapDriverId) {
    const flId = res.fastestLapDriverId;
    ensureDriver(flId);
    scores[flId].gotFastestLap = true;
    const finishPos = scores[flId].position;
    const isDnf = scores[flId].isDnf;
    if (flPts > 0 && mult > 0 && !isDnf && finishPos !== null && finishPos <= flTopLimit) {
      scores[flId].flPoints = roundPts(scores[flId].flPoints + flPts);
      scores[flId].total = roundPts(scores[flId].total + flPts);
    }
  }

  return scores;
}

/**
 * Comparador oficial estilo FIA: Puntos -> Victorias (P1) -> P2 -> P3 -> ... -> Mejor promedio
 */
function compareDriversFIA(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  const maxPosCheck = 20;
  for (let pos = 1; pos <= maxPosCheck; pos++) {
    const countA = a.positionCounts[pos] || 0;
    const countB = b.positionCounts[pos] || 0;
    if (countB !== countA) return countB - countA;
  }
  return (a.number || 99) - (b.number || 99);
}

/**
 * Calcula la tabla general de pilotos, constructores y el análisis matemático de cada piloto.
 */
function calculateStandings(state) {
  const pool = calculateChampionshipPool(state);
  const teamsMap = {};
  (state.teams || []).forEach((t) => {
    teamsMap[t.id] = t;
  });

  // Inicializar mapa de Constructores / Equipos antes de recorrer las fechas
  const teamStandingsMap = {};
  (state.teams || []).forEach((t) => {
    teamStandingsMap[t.id] = {
      ...t,
      points: 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      driversCount: 0,
      driverNames: [],
      driverSet: new Set(),
      driverContributions: {}
    };
  });

  const driverStats = (state.drivers || []).map((d) => {
    const team = teamsMap[d.teamId] || null;
    const secondaryIds = Array.isArray(d.secondaryTeamIds) ? d.secondaryTeamIds : [];
    const teamsRacedSet = new Set();
    if (d.teamId) teamsRacedSet.add(d.teamId);
    secondaryIds.forEach((tid) => {
      if (tid) teamsRacedSet.add(tid);
    });

    // Registrar al piloto en su equipo titular y secundarios
    teamsRacedSet.forEach((tid) => {
      if (teamStandingsMap[tid]) {
        teamStandingsMap[tid].driverSet.add(d.id);
        if (!teamStandingsMap[tid].driverContributions[d.id]) {
          teamStandingsMap[tid].driverContributions[d.id] = {
            id: d.id,
            name: d.name,
            code: d.code,
            points: 0,
            rounds: 0,
            isPrimary: tid === d.teamId
          };
        }
      }
    });

    return {
      ...d,
      secondaryTeamIds: secondaryIds,
      teamsRacedSet,
      teamName: team ? team.name : 'Sin Escudería',
      teamShort: team ? team.shortName : 'IND',
      teamColor: team ? team.color : '#64748b',
      teamImage: team ? team.image : '',
      points: 0,
      racePoints: 0,
      sprintPoints: 0,
      bonusPoints: 0,
      wins: 0,
      sprintWins: 0,
      podiums: 0,
      poles: 0,
      fastestLaps: 0,
      dnfs: 0,
      dnfOnlyCount: 0,
      dnsCount: 0,
      dsqCount: 0,
      racesEntered: 0,
      finishPositions: [],
      positionCounts: {},
      pointsByRound: [],
      cumulativePointsByRound: []
    };
  });

  const statsById = {};
  driverStats.forEach((ds) => {
    statsById[ds.id] = ds;
  });

  const sortedTracks = [...(state.tracks || [])].sort((a, b) => (a.round || 0) - (b.round || 0));

  for (const track of sortedTracks) {
    if (!track.completed) continue;
    const roundScores = scoreSingleTrack(track, state.pointsSystem);
    const roundDriverTeams = (track.results && track.results.driverTeams) || {};

    driverStats.forEach((ds) => {
      const sc = roundScores[ds.id];
      const earned = sc ? sc.total : 0;
      const roundTeamId = roundDriverTeams[ds.id] || ds.teamId;

      ds.points = roundPts(ds.points + earned);
      if (sc) {
        ds.racePoints = roundPts(ds.racePoints + sc.racePoints);
        ds.sprintPoints = roundPts(ds.sprintPoints + sc.sprintPoints);
        ds.bonusPoints = roundPts(ds.bonusPoints + sc.flPoints + sc.polePoints);
        if (sc.gotPole) ds.poles++;
        if (sc.gotFastestLap) ds.fastestLaps++;
        if (sc.sprintPosition === 1) ds.sprintWins++;

        if (sc.position !== null) {
          ds.racesEntered++;
          if (sc.isDnf) {
            ds.dnfs++;
            if (sc.status === 'DNS') ds.dnsCount++;
            else if (sc.status === 'DSQ') ds.dsqCount++;
            else ds.dnfOnlyCount++;
          } else {
            ds.finishPositions.push(sc.position);
            ds.positionCounts[sc.position] = (ds.positionCounts[sc.position] || 0) + 1;
            if (sc.position === 1) ds.wins++;
            if (sc.position <= 3) ds.podiums++;
          }
        }

        // Acreditar puntos y estadísticas de esta fecha a la escudería con la que corrió el piloto en esta carrera
        if (roundTeamId && teamStandingsMap[roundTeamId]) {
          const ts = teamStandingsMap[roundTeamId];
          ts.points = roundPts(ts.points + earned);
          if (!sc.isDnf && sc.position === 1) ts.wins++;
          if (!sc.isDnf && sc.position !== null && sc.position <= 3) ts.podiums++;
          if (sc.gotPole) ts.poles++;

          ds.teamsRacedSet.add(roundTeamId);
          ts.driverSet.add(ds.id);
          if (!ts.driverContributions[ds.id]) {
            ts.driverContributions[ds.id] = {
              id: ds.id,
              name: ds.name,
              code: ds.code,
              points: 0,
              rounds: 0,
              isPrimary: roundTeamId === ds.teamId
            };
          }
          ts.driverContributions[ds.id].points = roundPts(
            ts.driverContributions[ds.id].points + earned
          );
          if (sc.position !== null) {
            ts.driverContributions[ds.id].rounds++;
          }
        }
      }
      ds.pointsByRound.push({ round: track.round, trackName: track.name, points: earned, teamId: roundTeamId });
      ds.cumulativePointsByRound.push({ round: track.round, trackName: track.name, total: ds.points });
    });
  }

  // Generar etiqueta de historial de equipos para pilotos que corrieron en más de una escudería
  driverStats.forEach((ds) => {
    const allTeamShorts = Array.from(ds.teamsRacedSet)
      .map((tid) => (teamsMap[tid] ? teamsMap[tid].shortName : null))
      .filter(Boolean);
    ds.allTeamShorts = allTeamShorts;
    if (allTeamShorts.length > 1) {
      const others = allTeamShorts.filter((sh) => sh !== ds.teamShort);
      ds.teamDisplayLabel = `${ds.teamName} (también en ${others.join(', ')})`;
    } else {
      ds.teamDisplayLabel = ds.teamName;
    }
  });

  // Ordenar según criterios FIA
  driverStats.sort(compareDriversFIA);

  const leaderPoints = driverStats.length > 0 ? driverStats[0].points : 0;
  const secondMaxPoints =
    driverStats.length > 1
      ? driverStats[1].points + pool.maxRemainingForOneDriver
      : 0;

  // Calcular chances matemáticas para cada piloto
  driverStats.forEach((ds, idx) => {
    ds.rank = idx + 1;
    ds.gapToLeader = ds.points - leaderPoints; // 0 o negativo
    ds.maxPossiblePoints = ds.points + pool.maxRemainingForOneDriver;
    ds.avgFinish =
      ds.finishPositions.length > 0
        ? ds.finishPositions.reduce((a, b) => a + b, 0) / ds.finishPositions.length
        : null;

    // Mejor posición matemática posible:
    // ¿A cuántos rivales tiene por encima cuyo puntaje actual ya es inalcanzable (considerando desempate por victorias)?
    const rivalsUnreachable = driverStats.filter((other) => {
      if (other.id === ds.id) return false;
      if (other.points > ds.maxPossiblePoints) return true;
      if (other.points === ds.maxPossiblePoints && other.wins > ds.wins + pool.remainingRacesCount) {
        return true;
      }
      return false;
    }).length;
    ds.bestMathematicalRank = 1 + rivalsUnreachable;

    // Peor posición matemática posible (si saca 0 y un rival por debajo hace pleno, considerando desempate por victorias)
    const rivalsWhoCanPass = driverStats.filter((other) => {
      if (other.id === ds.id) return false;
      const otherMax = other.points + pool.maxRemainingForOneDriver;
      if (otherMax > ds.points) return true;
      if (otherMax === ds.points && other.wins + pool.remainingRacesCount >= ds.wins) {
        return true;
      }
      return false;
    }).length;
    ds.worstMathematicalRank = Math.min(driverStats.length, 1 + rivalsWhoCanPass);
  });

  // Calcular porcentaje escalonado hacia la Posición Máxima Posible (targetRank = bestMathematicalRank)
  driverStats.forEach((ds, idx) => {
    const targetRank = ds.bestMathematicalRank;
    const targetHolder = driverStats[targetRank - 1] || ds;
    const targetHolderPoints = targetHolder.points;
    const isRankLocked =
      pool.remainingRacesCount === 0 || ds.bestMathematicalRank === ds.worstMathematicalRank;

    let targetChancePct = 100;
    if (pool.completedRacesCount === 0) {
      targetChancePct = 100;
    } else if (isRankLocked || ds.points >= targetHolderPoints) {
      targetChancePct = 100;
    } else if (pool.maxRemainingForOneDriver > 0 && ds.maxPossiblePoints >= targetHolderPoints) {
      const margin = ds.maxPossiblePoints - targetHolderPoints;
      targetChancePct = Math.max(
        0.5,
        Math.min(99.9, ((margin + 1) / (pool.maxRemainingForOneDriver + 1)) * 100)
      );
    } else {
      targetChancePct = 0;
    }

    ds.targetRank = targetRank;
    ds.targetHolderPoints = targetHolderPoints;
    ds.gapToTargetRank = ds.points - targetHolderPoints;
    ds.isRankLocked = isRankLocked;
    ds.targetChancePct = Number(targetChancePct.toFixed(1));

    // Estado frente al título y posición máxima
    if (idx === 0 && (pool.remainingRacesCount === 0 || ds.points > secondMaxPoints)) {
      ds.titleStatus = 'champion';
      ds.titleStatusLabel = '¡Campeón Consagrado! (1° • 100%)';
      ds.pointsNeededToClinch = 0;
    } else if (ds.bestMathematicalRank === 1) {
      ds.titleStatus = 'contender';
      ds.titleStatusLabel =
        pool.completedRacesCount === 0
          ? 'Opción al Mundial (1°) • 100%'
          : idx === 0
          ? 'Líder del Mundial (1°) • 100%'
          : `Opción al Mundial (1°) • ${ds.targetChancePct.toFixed(1)}%`;
      const maxNeededAgainstAnyRival = driverStats
        .filter((other) => other.id !== ds.id)
        .reduce((maxNeed, other) => {
          const tieAdv = ds.wins > other.wins + pool.remainingRacesCount ? 0 : 1;
          const needed = other.points + pool.maxRemainingForOneDriver - ds.points + tieAdv;
          return Math.max(maxNeed, needed);
        }, 0);
      ds.pointsNeededToClinch = Math.max(0, maxNeededAgainstAnyRival);
    } else if (isRankLocked) {
      ds.titleStatus = 'locked';
      ds.titleStatusLabel = `${targetRank}° Puesto Asegurado • 100%`;
      ds.pointsNeededToClinch = 0;
    } else {
      ds.titleStatus = 'subtarget';
      ds.titleStatusLabel =
        ds.rank === targetRank
          ? `Máx. ${targetRank}° puesto (En ${targetRank}°) • 100%`
          : `Máx. ${targetRank}° puesto • ${ds.targetChancePct.toFixed(1)}%`;
      ds.pointsNeededToClinch = null;
    }

    // Escenario para la próxima carrera
    if (idx === 0 && pool.nextTrack && ds.titleStatus !== 'champion') {
      const secondDriver = driverStats[1];
      if (secondDriver) {
        const currentLead = ds.points - secondDriver.points;
        const tieAdv = ds.wins > secondDriver.wins + pool.remainingRacesCount ? 0 : 1;
        const neededLeadAfterNext = pool.maxRemainingAfterNextRace + tieAdv;
        const pointsToOutscoreNextRace = neededLeadAfterNext - currentLead;
        if (pointsToOutscoreNextRace <= pool.nextTrackMaxOneDriver) {
          ds.nextRaceClinchScenario =
            pointsToOutscoreNextRace <= 0
              ? `Se corona campeón en ${pool.nextTrack.name} sumando ${ Math.max(0, pool.nextTrackMaxOneDriver + pointsToOutscoreNextRace) } pts (o si no cede más de ${Math.abs(pointsToOutscoreNextRace)} pts ante ${secondDriver.name}).`
              : `Puede coronarse en ${pool.nextTrack.name} si le saca ${pointsToOutscoreNextRace} pts más a ${secondDriver.name}.`;
        } else {
          ds.nextRaceClinchScenario = `Aún no puede definir el título en ${pool.nextTrack.name} (quedan ${pool.maxRemainingAfterNextRace} pts después).`;
        }
      }
    }
  });

  // Consolidar lista de pilotos (titulares + rotaciones de mitad de temporada) por cada escudería
  Object.values(teamStandingsMap).forEach((ts) => {
    const contribs = Object.values(ts.driverContributions);
    contribs.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
    });
    ts.driversCount = contribs.length;
    ts.driverNames = contribs.map((c) =>
      contribs.length > 2 || !c.isPrimary ? `${c.name} (${c.points} pts)` : c.name
    );
  });

  const constructorStandings = Object.values(teamStandingsMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.podiums - a.podiums;
  });

  // Función auxiliar para calcular el máximo de puntos que un equipo puede sumar en lo que resta (máx 2 coches en pista por GP)
  const ps = state.pointsSystem || {};
  const racePts = ps.racePoints || [];
  const sprintPts = ps.sprintPoints || [];
  const flPts = Number(ps.fastestLapPoints) || 0;
  const polePts = Number(ps.polePoints) || 0;

  const calcMaxRemainingForTeam = (kDrivers) => {
    const activeCars = Math.min(2, Math.max(1, kDrivers || 2));
    const maxRaceK = sumArray(racePts.slice(0, activeCars)) + flPts + polePts;
    const maxSprintK = sumArray(sprintPts.slice(0, activeCars));
    return (
      pool.remainingRacesCount * maxRaceK +
      pool.remainingSprintsCount * maxSprintK
    );
  };

  const leaderTeamPoints = constructorStandings.length > 0 ? constructorStandings[0].points : 0;
  constructorStandings.forEach((ts) => {
    ts.maxRemainingTeam = calcMaxRemainingForTeam(ts.driversCount);
    ts.maxPossiblePoints = ts.points + ts.maxRemainingTeam;
  });

  const secondTeamMaxPoints =
    constructorStandings.length > 1 ? constructorStandings[1].maxPossiblePoints : 0;

  constructorStandings.forEach((ts, i) => {
    ts.rank = i + 1;
    ts.gapToLeader = ts.points - leaderTeamPoints;

    const teamsUnreachable = constructorStandings.filter(
      (other) => other.id !== ts.id && other.points > ts.maxPossiblePoints
    ).length;
    ts.bestMathematicalRank = 1 + teamsUnreachable;

    const teamsWhoCanPass = constructorStandings.filter(
      (other) => other.id !== ts.id && other.maxPossiblePoints >= ts.points
    ).length;
    ts.worstMathematicalRank = Math.min(constructorStandings.length, 1 + teamsWhoCanPass);
  });

  constructorStandings.forEach((ts, i) => {
    const targetRank = ts.bestMathematicalRank;
    const targetHolder = constructorStandings[targetRank - 1] || ts;
    const targetHolderPoints = targetHolder.points;
    const isRankLocked =
      pool.remainingRacesCount === 0 || ts.bestMathematicalRank === ts.worstMathematicalRank;

    let targetChancePct = 100;
    if (pool.completedRacesCount === 0) {
      targetChancePct = 100;
    } else if (isRankLocked || ts.points >= targetHolderPoints) {
      targetChancePct = 100;
    } else if (ts.maxRemainingTeam > 0 && ts.maxPossiblePoints >= targetHolderPoints) {
      const margin = ts.maxPossiblePoints - targetHolderPoints;
      targetChancePct = Math.max(
        0.5,
        Math.min(99.9, ((margin + 1) / (ts.maxRemainingTeam + 1)) * 100)
      );
    } else {
      targetChancePct = 0;
    }

    ts.targetRank = targetRank;
    ts.targetHolderPoints = targetHolderPoints;
    ts.gapToTargetRank = ts.points - targetHolderPoints;
    ts.isRankLocked = isRankLocked;
    ts.targetChancePct = Number(targetChancePct.toFixed(1));

    if (i === 0 && (pool.remainingRacesCount === 0 || ts.points > secondTeamMaxPoints)) {
      ts.titleStatus = 'champion';
      ts.titleStatusLabel = '¡Campeón Consagrado! (1° • 100%)';
    } else if (ts.bestMathematicalRank === 1) {
      ts.titleStatus = 'contender';
      ts.titleStatusLabel =
        pool.completedRacesCount === 0
          ? 'Opción al Mundial (1°) • 100%'
          : i === 0
          ? 'Líder de Constructores (1°) • 100%'
          : `Opción al Mundial (1°) • ${ts.targetChancePct.toFixed(1)}%`;
    } else if (isRankLocked) {
      ts.titleStatus = 'locked';
      ts.titleStatusLabel = `${targetRank}° Puesto Asegurado • 100%`;
    } else {
      ts.titleStatus = 'subtarget';
      ts.titleStatusLabel =
        ts.rank === targetRank
          ? `Máx. ${targetRank}° puesto (En ${targetRank}°) • 100%`
          : `Máx. ${targetRank}° puesto • ${ts.targetChancePct.toFixed(1)}%`;
    }
  });

  return {
    pool,
    driverStandings: driverStats,
    constructorStandings
  };
}

/**
 * Generador normal estándar (Box-Muller) para la simulación Monte Carlo
 */
function randomGaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Ejecuta una Simulación de Monte Carlo sobre las fechas restantes del campeonato.
 * @param {Object} state Estado actual del campeonato
 * @param {Object} options { iterations: 5000, formWeight: 0.7, chaosLevel: 0.35 }
 */
function runMonteCarloSimulation(state, options = {}) {
  const iterations = Number(options.iterations) || 5000;
  const formWeight = options.formWeight !== undefined ? Number(options.formWeight) : 0.7;
  const chaosLevel = options.chaosLevel !== undefined ? Number(options.chaosLevel) : 0.35;

  const { driverStandings, constructorStandings, pool } = calculateStandings(state);
  const nDrivers = driverStandings.length;
  const nTeams = constructorStandings.length;
  if (nDrivers === 0) {
    return { iterations: 0, results: [], teamResults: [], remainingRaces: 0 };
  }

  const remainingTracks = (state.tracks || []).filter((t) => !t.completed);
  const ps = state.pointsSystem || {};
  const racePts = ps.racePoints || [];
  const sprintPts = ps.sprintPoints || [];
  const flPts = Number(ps.fastestLapPoints) || 0;
  const flTopLimit = Number(ps.fastestLapTopLimit) || 10;
  const polePts = Number(ps.polePoints) || 0;

  // Mapa de id de equipo -> índice en constructorStandings
  const teamIndexById = {};
  constructorStandings.forEach((t, idx) => {
    teamIndexById[t.id] = idx;
  });

  // 1. Calcular el perfil de rendimiento (Pace Score + tasa de DNF) de cada piloto
  // Combinando resultados reales del campeonato actual + baseRating del piloto
  const driverProfiles = driverStandings.map((d) => {
    const baseSkill = Number(d.baseRating) || 85; // Escala 50 - 99

    // Si tiene carreras completadas, calculamos su rendimiento empírico en escala 50 - 99
    let empiricalSkill = baseSkill;
    if (d.finishPositions.length > 0 && nDrivers > 1) {
      const avgPos = d.avgFinish;
      // P1 -> ~97, último -> ~62
      const normalized = 1 - (avgPos - 1) / (nDrivers - 1);
      empiricalSkill = 62 + normalized * 35;
    }

    const effectiveWeight = d.racesEntered > 0 ? formWeight : 0;
    const blendedSkill = empiricalSkill * effectiveWeight + baseSkill * (1 - effectiveWeight);

    // Tasa de abandono (DNF) empírica suavizada con base del 5%
    const empiricalDnfRate = d.racesEntered > 0 ? d.dnfs / d.racesEntered : 0.05;
    const dnfProbability = Math.min(0.35, Math.max(0.02, empiricalDnfRate * 0.6 + 0.05 * 0.4) * (0.7 + chaosLevel));

    // Desviación estándar del rendimiento carrera a carrera (influenciada por el nivel de caos)
    const sigma = 3.5 + chaosLevel * 9.5;

    return {
      id: d.id,
      name: d.name,
      code: d.code,
      number: d.number,
      image: d.image,
      teamId: d.teamId,
      teamIdx: d.teamId !== undefined && teamIndexById[d.teamId] !== undefined ? teamIndexById[d.teamId] : -1,
      teamName: d.teamName,
      teamColor: d.teamColor,
      currentPoints: d.points,
      currentWins: d.wins,
      currentRank: d.rank,
      maxPossiblePoints: d.maxPossiblePoints,
      bestMathematicalRank: d.bestMathematicalRank,
      worstMathematicalRank: d.worstMathematicalRank,
      targetRank: d.targetRank,
      targetChancePct: d.targetChancePct,
      isRankLocked: d.isRankLocked,
      titleStatus: d.titleStatus,
      titleStatusLabel: d.titleStatusLabel,
      blendedSkill,
      dnfProbability,
      sigma
    };
  });

  // Contadores de resultados a lo largo de las N simulaciones (Pilotos y Constructores)
  const simTrackers = driverProfiles.map((p) => ({
    ...p,
    positionFinishCounts: new Array(nDrivers).fill(0), // cuántas veces terminó 1°, 2°, ..., N°
    totalSimulatedPoints: 0,
    pointsSamples: [],
    simulatedWinsTotal: 0
  }));

  const teamSimTrackers = constructorStandings.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    color: t.color,
    image: t.image,
    driverNames: t.driverNames,
    currentPoints: t.points,
    currentWins: t.wins,
    currentRank: t.rank,
    maxPossiblePoints: t.maxPossiblePoints,
    bestMathematicalRank: t.bestMathematicalRank,
    worstMathematicalRank: t.worstMathematicalRank,
    targetRank: t.targetRank,
    targetChancePct: t.targetChancePct,
    isRankLocked: t.isRankLocked,
    titleStatus: t.titleStatus,
    titleStatusLabel: t.titleStatusLabel,
    positionFinishCounts: new Array(nTeams).fill(0),
    totalSimulatedPoints: 0,
    pointsSamples: [],
    simulatedWinsTotal: 0
  }));

  // Si ya no quedan carreras por disputar, las posiciones actuales son 100% definitivas
  if (remainingTracks.length === 0) {
    const finalResults = simTrackers.map((st, idx) => {
      st.positionFinishCounts[idx] = 1;
      return {
        ...st,
        winProbability: idx === 0 ? 100 : 0,
        podiumProbability: idx < 3 ? 100 : 0,
        top5Probability: idx < 5 ? 100 : 0,
        targetSimProbability: 100,
        expectedPoints: st.currentPoints,
        minProjectedPoints: st.currentPoints,
        maxProjectedPoints: st.currentPoints,
        positionProbabilities: st.positionFinishCounts.map((c) => c * 100),
        mostLikelyPosition: idx + 1,
        mostLikelyPositionProb: 100
      };
    });
    const finalTeamResults = teamSimTrackers.map((tt, idx) => {
      tt.positionFinishCounts[idx] = 1;
      return {
        ...tt,
        winProbability: idx === 0 ? 100 : 0,
        podiumProbability: idx < 3 ? 100 : 0,
        top5Probability: idx < 5 ? 100 : 0,
        targetSimProbability: 100,
        expectedPoints: tt.currentPoints,
        minProjectedPoints: tt.currentPoints,
        maxProjectedPoints: tt.currentPoints,
        positionProbabilities: tt.positionFinishCounts.map((c) => c * 100),
        mostLikelyPosition: idx + 1,
        mostLikelyPositionProb: 100
      };
    });
    return {
      iterations: 1,
      remainingRaces: 0,
      pool,
      results: finalResults,
      teamResults: finalTeamResults
    };
  }

  // 2. Bucle principal Monte Carlo
  for (let iter = 0; iter < iterations; iter++) {
    const simPoints = new Float64Array(nDrivers);
    const simWins = new Int32Array(nDrivers);

    for (let i = 0; i < nDrivers; i++) {
      simPoints[i] = driverProfiles[i].currentPoints;
      simWins[i] = driverProfiles[i].currentWins;
    }

    for (let r = 0; r < remainingTracks.length; r++) {
      const track = remainingTracks[r];

      // Simular Sprint si la fecha tiene formato Sprint
      if (track.hasSprint && sprintPts.length > 0) {
        const sprintPerf = [];
        for (let i = 0; i < nDrivers; i++) {
          const prof = driverProfiles[i];
          const isDnf = Math.random() < prof.dnfProbability * 0.5;
          const score = isDnf ? -999 + Math.random() : prof.blendedSkill + randomGaussian() * prof.sigma;
          sprintPerf.push({ index: i, score, isDnf });
        }
        sprintPerf.sort((a, b) => b.score - a.score);
        for (let posIdx = 0; posIdx < sprintPts.length && posIdx < nDrivers; posIdx++) {
          if (!sprintPerf[posIdx].isDnf) {
            simPoints[sprintPerf[posIdx].index] += Number(sprintPts[posIdx]) || 0;
          }
        }
      }

      // Simular Clasificación (Pole Position)
      if (polePts > 0) {
        let bestQualyScore = -Infinity;
        let poleWinnerIdx = 0;
        for (let i = 0; i < nDrivers; i++) {
          const prof = driverProfiles[i];
          const qScore = prof.blendedSkill + randomGaussian() * (prof.sigma * 0.75);
          if (qScore > bestQualyScore) {
            bestQualyScore = qScore;
            poleWinnerIdx = i;
          }
        }
        simPoints[poleWinnerIdx] += polePts;
      }

      // Simular Carrera Principal
      const racePerf = [];
      for (let i = 0; i < nDrivers; i++) {
        const prof = driverProfiles[i];
        const isDnf = Math.random() < prof.dnfProbability;
        const score = isDnf ? -999 + Math.random() : prof.blendedSkill + randomGaussian() * prof.sigma;
        racePerf.push({ index: i, score, isDnf });
      }
      racePerf.sort((a, b) => b.score - a.score);

      // Asignar puntos de carrera y victoria
      if (racePerf.length > 0 && !racePerf[0].isDnf) {
        simWins[racePerf[0].index]++;
      }
      for (let posIdx = 0; posIdx < racePts.length && posIdx < nDrivers; posIdx++) {
        if (!racePerf[posIdx].isDnf) {
          simPoints[racePerf[posIdx].index] += Number(racePts[posIdx]) || 0;
        }
      }

      // Simular Vuelta Rápida entre los clasificados activos
      if (flPts > 0) {
        let bestFlScore = -Infinity;
        let flWinnerPos = -1;
        let flWinnerDriverIdx = -1;
        for (let posIdx = 0; posIdx < nDrivers; posIdx++) {
          const entry = racePerf[posIdx];
          if (entry.isDnf) continue;
          const prof = driverProfiles[entry.index];
          const flScore = prof.blendedSkill + randomGaussian() * (prof.sigma * 0.9);
          if (flScore > bestFlScore) {
            bestFlScore = flScore;
            flWinnerPos = posIdx + 1;
            flWinnerDriverIdx = entry.index;
          }
        }
        if (flWinnerDriverIdx !== -1 && flWinnerPos <= flTopLimit) {
          simPoints[flWinnerDriverIdx] += flPts;
        }
      }
    }

    // Ordenar la tabla final de esta iteración (Puntos -> Victorias -> Pequeño desempate aleatorio)
    const standingIndices = Array.from({ length: nDrivers }, (_, i) => i);
    standingIndices.sort((a, b) => {
      if (simPoints[b] !== simPoints[a]) return simPoints[b] - simPoints[a];
      if (simWins[b] !== simWins[a]) return simWins[b] - simWins[a];
      return Math.random() - 0.5;
    });

    for (let rankIdx = 0; rankIdx < nDrivers; rankIdx++) {
      const dIdx = standingIndices[rankIdx];
      simTrackers[dIdx].positionFinishCounts[rankIdx]++;
    }

    for (let i = 0; i < nDrivers; i++) {
      const pts = simPoints[i];
      simTrackers[i].totalSimulatedPoints += pts;
      simTrackers[i].simulatedWinsTotal += simWins[i];
      // Guardamos muestras para calcular percentiles P10 y P90
      if (iter < 1500) {
        simTrackers[i].pointsSamples.push(pts);
      }
    }

    // Calcular tabla de Constructores (Equipos) en esta iteración respetando puntos históricos por carrera
    if (nTeams > 0) {
      const simTeamPoints = new Float64Array(nTeams);
      const simTeamWins = new Int32Array(nTeams);

      for (let t = 0; t < nTeams; t++) {
        simTeamPoints[t] = teamSimTrackers[t].currentPoints;
        simTeamWins[t] = teamSimTrackers[t].currentWins;
      }

      for (let i = 0; i < nDrivers; i++) {
        const tIdx = driverProfiles[i].teamIdx;
        if (tIdx >= 0) {
          const addedPts = simPoints[i] - driverProfiles[i].currentPoints;
          const addedWins = simWins[i] - driverProfiles[i].currentWins;
          simTeamPoints[tIdx] += addedPts;
          simTeamWins[tIdx] += addedWins;
        }
      }

      const teamStandingIndices = Array.from({ length: nTeams }, (_, i) => i);
      teamStandingIndices.sort((a, b) => {
        if (simTeamPoints[b] !== simTeamPoints[a]) return simTeamPoints[b] - simTeamPoints[a];
        if (simTeamWins[b] !== simTeamWins[a]) return simTeamWins[b] - simTeamWins[a];
        return Math.random() - 0.5;
      });

      for (let rankIdx = 0; rankIdx < nTeams; rankIdx++) {
        const tIdx = teamStandingIndices[rankIdx];
        teamSimTrackers[tIdx].positionFinishCounts[rankIdx]++;
      }

      for (let t = 0; t < nTeams; t++) {
        const tPts = simTeamPoints[t];
        teamSimTrackers[t].totalSimulatedPoints += tPts;
        teamSimTrackers[t].simulatedWinsTotal += simTeamWins[t];
        if (iter < 1500) {
          teamSimTrackers[t].pointsSamples.push(tPts);
        }
      }
    }
  }

  // 3. Procesar estadísticas agregadas de Pilotos
  const results = simTrackers.map((st) => {
    st.pointsSamples.sort((a, b) => a - b);
    const sampleLen = st.pointsSamples.length;
    const p10 = sampleLen > 0 ? st.pointsSamples[Math.floor(sampleLen * 0.1)] : st.currentPoints;
    const p90 = sampleLen > 0 ? st.pointsSamples[Math.floor(sampleLen * 0.9)] : st.currentPoints;

    const positionProbabilities = st.positionFinishCounts.map((count) => (count / iterations) * 100);
    const winProbability = positionProbabilities[0] || 0;
    const podiumProbability = positionProbabilities.slice(0, 3).reduce((a, b) => a + b, 0);
    const top5Probability = positionProbabilities.slice(0, 5).reduce((a, b) => a + b, 0);

    let mostLikelyPosition = 1;
    let highestPosProb = -1;
    positionProbabilities.forEach((prob, idx) => {
      if (prob > highestPosProb) {
        highestPosProb = prob;
        mostLikelyPosition = idx + 1;
      }
    });

    return {
      id: st.id,
      name: st.name,
      code: st.code,
      number: st.number,
      image: st.image,
      teamName: st.teamName,
      teamColor: st.teamColor,
      currentPoints: st.currentPoints,
      currentRank: st.currentRank,
      maxPossiblePoints: st.maxPossiblePoints,
      bestMathematicalRank: st.bestMathematicalRank,
      worstMathematicalRank: st.worstMathematicalRank,
      targetRank: st.targetRank,
      targetChancePct: st.targetChancePct,
      isRankLocked: st.isRankLocked,
      titleStatus: st.titleStatus,
      titleStatusLabel: st.titleStatusLabel,
      blendedSkill: Math.round(st.blendedSkill),
      winProbability,
      podiumProbability,
      top5Probability,
      targetSimProbability:
        st.isRankLocked
          ? 100
          : positionProbabilities.slice(0, st.targetRank).reduce((a, b) => a + b, 0),
      expectedPoints: Math.round(st.totalSimulatedPoints / iterations),
      expectedWins: (st.simulatedWinsTotal / iterations).toFixed(1),
      minProjectedPoints: Math.round(p10),
      maxProjectedPoints: Math.round(p90),
      positionProbabilities,
      mostLikelyPosition,
      mostLikelyPositionProb: highestPosProb
    };
  });

  // Ordenar por posición máxima alcanzable -> % de opción hacia esa posición -> puntos proyectados
  results.sort((a, b) => {
    if (a.targetRank !== b.targetRank) {
      return a.targetRank - b.targetRank;
    }
    if (Math.abs(b.targetChancePct - a.targetChancePct) > 0.05) {
      return b.targetChancePct - a.targetChancePct;
    }
    if (Math.abs(b.winProbability - a.winProbability) > 0.05) {
      return b.winProbability - a.winProbability;
    }
    if (b.expectedPoints !== a.expectedPoints) {
      return b.expectedPoints - a.expectedPoints;
    }
    return b.currentPoints - a.currentPoints;
  });

  // 4. Procesar estadísticas agregadas de Constructores (Equipos)
  const teamResults = teamSimTrackers.map((tt) => {
    tt.pointsSamples.sort((a, b) => a - b);
    const sampleLen = tt.pointsSamples.length;
    const p10 = sampleLen > 0 ? tt.pointsSamples[Math.floor(sampleLen * 0.1)] : tt.currentPoints;
    const p90 = sampleLen > 0 ? tt.pointsSamples[Math.floor(sampleLen * 0.9)] : tt.currentPoints;

    const positionProbabilities = tt.positionFinishCounts.map((count) => (count / iterations) * 100);
    const winProbability = positionProbabilities[0] || 0;
    const podiumProbability = positionProbabilities.slice(0, 3).reduce((a, b) => a + b, 0);
    const top5Probability = positionProbabilities.slice(0, 5).reduce((a, b) => a + b, 0);

    let mostLikelyPosition = 1;
    let highestPosProb = -1;
    positionProbabilities.forEach((prob, idx) => {
      if (prob > highestPosProb) {
        highestPosProb = prob;
        mostLikelyPosition = idx + 1;
      }
    });

    return {
      id: tt.id,
      name: tt.name,
      shortName: tt.shortName,
      color: tt.color,
      image: tt.image,
      driverNames: tt.driverNames,
      currentPoints: tt.currentPoints,
      currentRank: tt.currentRank,
      maxPossiblePoints: tt.maxPossiblePoints,
      bestMathematicalRank: tt.bestMathematicalRank,
      worstMathematicalRank: tt.worstMathematicalRank,
      targetRank: tt.targetRank,
      targetChancePct: tt.targetChancePct,
      isRankLocked: tt.isRankLocked,
      titleStatus: tt.titleStatus,
      titleStatusLabel: tt.titleStatusLabel,
      winProbability,
      podiumProbability,
      top5Probability,
      targetSimProbability:
        tt.isRankLocked
          ? 100
          : positionProbabilities.slice(0, tt.targetRank).reduce((a, b) => a + b, 0),
      expectedPoints: Math.round(tt.totalSimulatedPoints / iterations),
      expectedWins: (tt.simulatedWinsTotal / iterations).toFixed(1),
      minProjectedPoints: Math.round(p10),
      maxProjectedPoints: Math.round(p90),
      positionProbabilities,
      mostLikelyPosition,
      mostLikelyPositionProb: highestPosProb
    };
  });

  teamResults.sort((a, b) => {
    if (a.targetRank !== b.targetRank) {
      return a.targetRank - b.targetRank;
    }
    if (Math.abs(b.targetChancePct - a.targetChancePct) > 0.05) {
      return b.targetChancePct - a.targetChancePct;
    }
    if (Math.abs(b.winProbability - a.winProbability) > 0.05) {
      return b.winProbability - a.winProbability;
    }
    if (b.expectedPoints !== a.expectedPoints) {
      return b.expectedPoints - a.expectedPoints;
    }
    return b.currentPoints - a.currentPoints;
  });

  return {
    iterations,
    remainingRaces: remainingTracks.length,
    pool,
    results,
    teamResults
  };
}

/**
 * Calcula en detalle qué necesita un piloto o escudería (y qué necesita de sus rivales)
 * para alcanzar una posición objetivo en el campeonato (por defecto su máxima posición alcanzable).
 */
function calculateTargetRequirements(state, kind = 'driver', entityId = '', customTargetRank = null) {
  const { pool, driverStandings, constructorStandings } = calculateStandings(state);
  const isTeam = kind === 'team';
  const list = isTeam ? constructorStandings : driverStandings;
  const me = list.find((item) => item.id === entityId) || list[0];
  if (!me) return null;

  const ps = state.pointsSystem || {};
  const racePts = Array.isArray(ps.racePoints) && ps.racePoints.length > 0 ? ps.racePoints : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const sprintPts = Array.isArray(ps.sprintPoints) ? ps.sprintPoints : [];
  const flPts = Number(ps.fastestLapPoints) || 0;
  const polePts = Number(ps.polePoints) || 0;

  const pendingTracks = (state.tracks || [])
    .filter((t) => !t.completed)
    .sort((a, b) => (a.round || 0) - (b.round || 0));

  const R = pendingTracks.length;
  const maxRemaining = isTeam ? pool.maxRemainingForOneTeam : pool.maxRemainingForOneDriver;

  const bestRank = me.bestMathematicalRank || 1;
  const worstRank = me.worstMathematicalRank || list.length;
  const defaultTarget = me.targetRank || bestRank;
  const targetRank =
    customTargetRank !== null && customTargetRank !== undefined
      ? Math.min(worstRank, Math.max(bestRank, Number(customTargetRank)))
      : defaultTarget;

  const targetHolder = list[targetRank - 1] || me;
  const isDefending = me.rank <= targetRank; // Ya está en ese puesto o más arriba
  const gapToTarget = Math.max(0, targetHolder.points - me.points);

  // Función auxiliar: traduce un promedio de puntos por carrera al puesto equivalente en carrera principal
  const getEquivalentRacePosition = (ptsPerRace) => {
    if (ptsPerRace <= 0) {
      return {
        posLabel: `${racePts.length + 1}° o peor (fuera de los puntos)`,
        approxPos: racePts.length + 1
      };
    }
    if (isTeam) {
      // Para constructores (2 autos sumando)
      const maxTwoCars = (racePts[0] || 0) + (racePts[1] || 0);
      if (ptsPerRace >= maxTwoCars) {
        return { posLabel: 'Doblete 1° y 2° con ambos autos', approxPos: 1 };
      }
      for (let i = 0; i < racePts.length; i++) {
        const pairPts = (racePts[i] || 0) + (racePts[i + 1] || 0);
        if (ptsPerRace >= pairPts) {
          return {
            posLabel: `Ambos autos entre ${i + 1}° y ${i + 2}° (~${pairPts} pts/fecha)`,
            approxPos: i + 1
          };
        }
      }
      return { posLabel: `Sumar con al menos 1 auto en Top ${racePts.length}`, approxPos: racePts.length };
    }

    for (let i = 0; i < racePts.length; i++) {
      if (ptsPerRace >= racePts[i]) {
        return {
          posLabel: `${i + 1}° puesto (${racePts[i]} pts)`,
          approxPos: i + 1
        };
      }
    }
    return {
      posLabel: `${racePts.length}° puesto (${racePts[racePts.length - 1]} pt)`,
      approxPos: racePts.length
    };
  };

  // Función auxiliar: arma una combinación concreta carrera por carrera para sumar >= targetPointsNeeded
  const buildSuggestedFinishPlan = (pointsNeeded, frontLoadForClinch = false) => {
    if (R === 0 || pointsNeeded <= 0) {
      return {
        summaryText: 'No necesita sumar puntos adicionales (0 pts requeridos).',
        avgPtsRequired: 0,
        perRacePlan: pendingTracks.map((tr) => ({
          round: tr.round,
          name: tr.name,
          hasSprint: Boolean(tr.hasSprint),
          suggestedPos: `${racePts.length + 1}°+`,
          pointsEarned: 0
        }))
      };
    }

    const avgPts = pointsNeeded / R;
    let remainingToCover = pointsNeeded;
    const perRacePlan = [];
    const posCounts = {};

    pendingTracks.forEach((tr, idx) => {
      const racesLeftAfterThis = R - idx - 1;
      const maxOneFutureRace = isTeam
        ? (racePts[0] || 0) + (racePts[1] || 0) + flPts + polePts
        : (racePts[0] || 0) + flPts + polePts;

      // Si está defendiendo / por consagrarse (frontLoadForClinch), buscamos definirlo lo antes posible (ej. en la próxima fecha)
      const minNeededHere = Math.max(0, remainingToCover - racesLeftAfterThis * maxOneFutureRace);
      const idealTargetHere = frontLoadForClinch
        ? Math.min(maxOneFutureRace + (tr.hasSprint ? (sprintPts[0] || 0) : 0), remainingToCover)
        : Math.max(minNeededHere, Math.ceil(remainingToCover / (racesLeftAfterThis + 1)));

      let chosenLabel = `${racePts.length + 1}°+ (0 pts)`;
      let chosenPts = 0;

      if (isTeam) {
        // Opciones de resultados por equipo en esta fecha
        const sprintMax = tr.hasSprint ? (sprintPts[0] || 0) + (sprintPts[1] || 0) : 0;
        const teamOptions = [];
        for (let p1 = 0; p1 <= racePts.length; p1++) {
          const pts1 = p1 < racePts.length ? racePts[p1] : 0;
          const p2 = Math.min(racePts.length, p1 + 1);
          const pts2 = p2 < racePts.length ? racePts[p2] : 0;
          const total = pts1 + pts2 + (p1 === 0 ? sprintMax + flPts + polePts : 0);
          const lbl =
            p1 < racePts.length
              ? `Autos ${p1 + 1}° y ${p2 + 1}°${p1 === 0 && tr.hasSprint ? ' + Sprint' : ''}`
              : 'Cualquier puesto (0 pts)';
          teamOptions.push({ lbl, pts: total });
        }
        let bestOpt = teamOptions[0];
        for (let k = teamOptions.length - 1; k >= 0; k--) {
          if (teamOptions[k].pts >= idealTargetHere) {
            bestOpt = teamOptions[k];
            break;
          }
        }
        chosenLabel = bestOpt.lbl;
        chosenPts = bestOpt.pts;
      } else {
        // Opciones para un piloto individual
        const sprintBonus = tr.hasSprint ? (sprintPts[0] || 0) : 0;
        const maxWithBonuses = (racePts[0] || 0) + sprintBonus + flPts + polePts;
        if (idealTargetHere > (racePts[0] || 0)) {
          chosenPts = Math.min(maxWithBonuses, idealTargetHere <= (racePts[0] || 0) + flPts + polePts ? (racePts[0] || 0) + flPts + polePts : maxWithBonuses);
          chosenLabel = `1° puesto${sprintBonus > 0 && chosenPts > (racePts[0] || 0) + flPts ? ' + 1° Sprint' : ''}${flPts > 0 ? ' + VR' : ''}`;
        } else if (idealTargetHere <= 0) {
          chosenPts = 0;
          chosenLabel = frontLoadForClinch ? 'Ya consagrado (0 pts req.)' : `${racePts.length + 1}° o peor`;
        } else {
          let pickedPos = 1;
          let pickedPts = racePts[0] || 0;
          for (let p = racePts.length - 1; p >= 0; p--) {
            if (racePts[p] >= idealTargetHere) {
              pickedPos = p + 1;
              pickedPts = racePts[p];
              break;
            }
          }
          chosenPts = pickedPts;
          chosenLabel = `${pickedPos}° puesto o mejor (${pickedPts} pts)`;
        }
      }

      if (chosenPts > 0 || !frontLoadForClinch) {
        posCounts[chosenLabel] = (posCounts[chosenLabel] || 0) + 1;
      }
      remainingToCover = Math.max(0, remainingToCover - chosenPts);
      perRacePlan.push({
        round: tr.round,
        name: tr.name,
        circuit: tr.circuit,
        hasSprint: Boolean(tr.hasSprint),
        suggestedPos: chosenLabel,
        pointsEarned: chosenPts
      });
    });

    const parts = Object.entries(posCounts).map(([lbl, cnt]) => `${cnt}x ${lbl}`);
    const totalPlanPts = perRacePlan.reduce((acc, r) => acc + r.pointsEarned, 0);
    const activeRacesNeeded = perRacePlan.filter((r) => r.pointsEarned > 0);
    const earlyClinchNote =
      frontLoadForClinch && activeRacesNeeded.length === 1 && R > 1
        ? ` — ¡Se consagra en ${activeRacesNeeded[0].name} sin depender de nadie!`
        : ` (suma ${totalPlanPts} pts en ${R} fecha${R === 1 ? '' : 's'})`;

    return {
      summaryText: `${parts.join(' + ')}${earlyClinchNote}`,
      avgPtsRequired: Number(avgPts.toFixed(1)),
      avgPosEquivalent: getEquivalentRacePosition(avgPts).posLabel,
      perRacePlan
    };
  };

  // Calcular puntos mínimos indispensables y puntos para asegurar (clinch)
  let minPointsNeeded = 0;
  let clinchPointsNeeded = 0;
  let headlineSummary = '';

  // Identificar rivales relevantes
  const rivalsAnalysis = [];

  if (isDefending) {
    // Está defendiendo su puesto (ej. va 1° y quiere asegurar el 1°, o va 2° y quiere asegurar el 2°)
    const chasers = list.filter((item) => {
      if (item.rank <= targetRank || item.id === me.id) return false;
      const tieAdv = me.wins > item.wins + R ? 0 : 1;
      return item.maxPossiblePoints + (tieAdv === 1 ? 0 : -1) >= me.points;
    });

    if (R === 0 || chasers.length === 0) {
      clinchPointsNeeded = 0;
      headlineSummary = `🔒 ¡${me.name} ya tiene el ${targetRank}° puesto matemáticamente asegurado! Ningún perseguidor puede alcanzarlo.`;
    } else {
      clinchPointsNeeded = chasers.reduce((maxNeed, riv) => {
        // Si incluso ganando las R carreras restantes riv tiene menos victorias que me (me.wins > riv.wins + R),
        // me gana cualquier empate en puntos (tieAdv = 0).
        const tieAdv = me.wins > riv.wins + R ? 0 : 1;
        const needVsRiv = Math.max(0, riv.maxPossiblePoints - me.points + tieAdv);
        return Math.max(maxNeed, needVsRiv);
      }, 0);

      const firstPendingName = pendingTracks[0] ? pendingTracks[0].name : 'las fechas restantes';
      headlineSummary =
        clinchPointsNeeded <= (racePts[0] || 25)
          ? `¡Match Point en ${firstPendingName}! Sumando apenas ${clinchPointsNeeded} pto${clinchPointsNeeded === 1 ? '' : 's'} asegura matemáticamente el ${targetRank}° puesto sin importar que sus rivales ganen todo lo que resta.`
          : clinchPointsNeeded <= maxRemaining
          ? `Depende 100% de sí mismo: sumando ${clinchPointsNeeded} pts en las ${R} fecha(s) restantes asegura matemáticamente el ${targetRank}° puesto aunque sus perseguidores ganen todo.`
          : `Mantiene la ventaja en el ${targetRank}° puesto (${me.points} pts), pero necesita defender su diferencia en las ${R} fecha(s) restantes.`;
    }

    chasers.forEach((riv) => {
      const currentLead = me.points - riv.points;
      const tieAdvIfRivWinsAll = me.wins > riv.wins + R ? 0 : 1;
      const ptsToEliminateRival = Math.max(0, riv.maxPossiblePoints - me.points + tieAdvIfRivWinsAll);
      const minRivalNeeds = Math.max(0, currentLead + (riv.wins + R > me.wins ? 0 : 1));
      const rivalAvgNeeded = R > 0 ? minRivalNeeds / R : 0;
      const rivalMinPosEq = getEquivalentRacePosition(rivalAvgNeeded).posLabel;

      rivalsAnalysis.push({
        id: riv.id,
        rank: riv.rank,
        name: riv.name,
        code: riv.code || riv.shortName || '',
        teamName: riv.teamDisplayLabel || riv.teamName || riv.shortName || '',
        color: riv.teamColor || riv.color || '#38bdf8',
        image: riv.image,
        points: riv.points,
        maxPossiblePoints: riv.maxPossiblePoints,
        gapLabel: `-${currentLead} pts atrás (${riv.wins} PG vs ${me.wins} PG)`,
        roleLabel: 'Perseguidor Directo',
        maxAllowedPtsForRival: currentLead,
        conditionForMe:
          ptsToEliminateRival === 0
            ? 'Ya no puede superarte (ganas en desempate por victorias)'
            : `Sumar ${ptsToEliminateRival} pto${ptsToEliminateRival === 1 ? '' : 's'} lo deja sin opciones matemáticas (o que ${riv.name} pierda ${ptsToEliminateRival} pto${ptsToEliminateRival === 1 ? '' : 's'} del pleno).`,
        rivalPositionRequirement:
          minRivalNeeds > maxRemaining
            ? 'Eliminado'
            : `Tiene techo de ${riv.maxPossiblePoints} pts (${riv.wins + R} victorias máx. vs tus ${me.wins}): necesita sumar al menos ${minRivalNeeds} pts (~${rivalAvgNeeded.toFixed(1)} pts/fecha: ${rivalMinPosEq}).`
      });
    });
  } else {
    // Viene persiguiendo el targetRank desde atrás (me.rank > targetRank)
    const tieAdvHolder = me.wins > targetHolder.wins ? 0 : 1;
    minPointsNeeded = Math.max(0, targetHolder.points - me.points + tieAdvHolder);
    const maxHolderCanScoreIfMeMaxes = Math.max(0, me.maxPossiblePoints - targetHolder.points - tieAdvHolder);

    headlineSummary =
      R === 0
        ? `Temporada finalizada: ya no quedan carreras para descontar los ${gapToTarget} pts hacia el ${targetRank}° puesto.`
        : `Necesita descontarle al menos ${minPointsNeeded} pts a ${targetHolder.name} (${targetRank}°, ${targetHolder.points} pts) en las ${R} fecha(s) restantes y superar a ${me.rank - targetRank} rival(es) en la tabla.`;

    clinchPointsNeeded = maxRemaining; // Al venir desde atrás necesita maximizar su cosecha

    // Todos los rivales que hoy están entre el puesto objetivo (targetRank) y delante de me (rank < me.rank)
    // más cualquier otro contendiente directo pegado
    const aheadRivals = list.filter((item) => item.rank >= targetRank && item.rank < me.rank);
    // Si targetRank > 1 pero quiere ver también al de arriba o si está cerca
    aheadRivals.forEach((riv) => {
      const diff = riv.points - me.points;
      const tieAdv = me.wins > riv.wins ? 0 : 1;
      const minNeededVsRival = Math.max(0, diff + tieAdv);
      const maxRivalAllowedIfMePerfect = Math.max(0, me.maxPossiblePoints - riv.points - tieAdv);
      const maxRivalPerRace = R > 0 ? maxRivalAllowedIfMePerfect / R : 0;

      // ¿Qué posición máxima puede ocupar el rival si nosotros ganamos todo?
      let maxPosDesc = '';
      if (maxRivalAllowedIfMePerfect <= 0) {
        maxPosDesc = `Necesitas que NO sume puntos (${racePts.length + 1}° o peor / DNF) en todas las fechas restantes y tú ganar todo.`;
      } else if (maxRivalAllowedIfMePerfect >= maxRemaining) {
        maxPosDesc = `Dependes de ti mismo: ganando todo lo superas sin importar en qué puesto termine.`;
      } else {
        // Encontrar el mejor puesto en que NO supere maxRivalPerRace
        let worstAllowedPos = racePts.length + 1;
        for (let p = 0; p < racePts.length; p++) {
          if (racePts[p] <= maxRivalPerRace) {
            worstAllowedPos = p + 1;
            break;
          }
        }
        const posText =
          worstAllowedPos <= racePts.length
            ? `${worstAllowedPos}° puesto o peor en promedio (${racePts[worstAllowedPos - 1]} pts/fecha)`
            : `fuera de la zona de puntos (${racePts.length + 1}° o peor) en la mayoría de carreras`;
        maxPosDesc = `Incluso si tú logras el puntaje perfecto (${me.maxPossiblePoints} pts), ${riv.name} puede sumar como máximo ${maxRivalAllowedIfMePerfect} pts en total (~${maxRivalPerRace.toFixed(1)} pts/fecha) → necesita terminar ${posText}.`;
      }

      const swingPerRace = R > 0 ? (minNeededVsRival / R).toFixed(1) : minNeededVsRival;

      rivalsAnalysis.push({
        id: riv.id,
        rank: riv.rank,
        name: riv.name,
        code: riv.code || riv.shortName || '',
        teamName: riv.teamDisplayLabel || riv.teamName || riv.shortName || '',
        color: riv.teamColor || riv.color || '#f43f5e',
        image: riv.image,
        points: riv.points,
        maxPossiblePoints: riv.maxPossiblePoints,
        gapLabel: `+${diff} pts arriba`,
        roleLabel: riv.rank === targetRank ? `Ocupa el ${targetRank}° Puesto` : `Rival Intermedio (${riv.rank}°)`,
        maxAllowedPtsForRival: maxRivalAllowedIfMePerfect,
        conditionForMe: `Descontarle al menos ${minNeededVsRival} pts (${swingPerRace} pts más que él por carrera).`,
        rivalPositionRequirement: maxPosDesc
      });
    });
  }

  // =========================================================
  // ANÁLISIS EXACTO DE LA ÚLTIMA CARRERA (cara a cara con desempate FIA)
  // Cuando queda 1 sola fecha, recorremos todas las combinaciones de llegada
  // (propia vs rival, con y sin vuelta rápida) aplicando el desempate oficial
  // por victorias, segundos puestos, terceros, etc.
  // =========================================================
  let finalRaceDecider = null;
  if (!isTeam && R === 1) {
    const tr = pendingTracks[0];
    const mult =
      tr.pointsMultiplier !== undefined && tr.pointsMultiplier !== null ? Number(tr.pointsMultiplier) : 1;
    const K = racePts.length;
    const OUT = K + 1; // "Fuera de los puntos / DNF"
    const flLimit = Number(ps.fastestLapTopLimit) || 10;
    const flActive = flPts > 0 && mult > 0;

    const ptsFor = (pos, withFl) => {
      let p = pos <= K ? roundPts((Number(racePts[pos - 1]) || 0) * mult) : 0;
      if (withFl && flActive && pos <= flLimit) p += flPts;
      return roundPts(p);
    };
    const posLabel = (pos) => (pos >= OUT ? `fuera de los puntos / DNF` : `${pos}°`);
    const addFinish = (counts, pos, finished) => {
      const c = { ...(counts || {}) };
      if (finished) c[pos] = (c[pos] || 0) + 1;
      return c;
    };
    // Devuelve { result: 1 | -1 | 0, decidedAt } comparando A vs B con criterio FIA
    const compareFia = (aPts, aCounts, bPts, bCounts) => {
      if (aPts !== bPts) return { result: aPts > bPts ? 1 : -1, decidedAt: 0 };
      for (let p = 1; p <= 40; p++) {
        const ca = aCounts[p] || 0;
        const cb = bCounts[p] || 0;
        if (ca !== cb) return { result: ca > cb ? 1 : -1, decidedAt: p };
      }
      return { result: 0, decidedAt: -1 };
    };
    const tieLabel = (p) => (p === 1 ? 'victorias' : `veces ${p}°`);

    // ¿me queda delante de riv si me termina en pMe y riv en pRiv?
    // Peor caso para me: me sin VR (y DNF si queda fuera de puntos), riv con VR si es posible
    // (y contando su llegada aunque quede fuera de los puntos, porque eso le suma en el desempate).
    const evalDuel = (riv, pMe, pRiv, meTakesFl) => {
      const scenarios = [];
      const rivFlOptions = meTakesFl ? [false] : flActive && pRiv <= flLimit ? [true, false] : [false];
      rivFlOptions.forEach((rivFl) => {
        const mePts = roundPts(me.points + ptsFor(pMe, meTakesFl));
        const rivPts = roundPts(riv.points + ptsFor(pRiv, rivFl));
        const meCounts = addFinish(me.positionCounts, pMe, pMe < OUT);
        const rivCounts = addFinish(riv.positionCounts, pRiv, true);
        scenarios.push({ ...compareFia(mePts, meCounts, rivPts, rivCounts), mePts, rivPts });
      });
      // me debe ganar en todos los escenarios (peor caso)
      const worst = scenarios.reduce((acc, s) => (s.result < acc.result ? s : acc), scenarios[0]);
      return worst;
    };

    // Rivales a analizar: perseguidores (si defiende) o los que tiene delante (si persigue)
    const duelRivals = list.filter((item) => {
      if (item.id === me.id) return false;
      if (isDefending) {
        if (item.rank <= targetRank) return false;
        // ¿Puede el rival pasarme en el mejor escenario para él (gana con VR y yo DNF)?
        return evalDuel(item, OUT, 1, false).result <= 0;
      }
      return item.rank >= targetRank && item.rank < me.rank;
    });

    const duels = duelRivals.map((riv) => {
      const rows = [];
      for (let pMe = 1; pMe <= OUT; pMe++) {
        // Buscar la mejor posición del rival (q mínimo) tal que para todo q' >= q, me gane
        let qMin = null;
        for (let q = OUT; q >= 1; q--) {
          if (q === pMe && q < OUT) continue; // no pueden llegar en el mismo puesto
          const ev = evalDuel(riv, pMe, q, false);
          if (ev.result > 0) qMin = q;
          else break;
        }
        let qMinFl = null;
        if (flActive && pMe <= flLimit) {
          for (let q = OUT; q >= 1; q--) {
            if (q === pMe && q < OUT) continue;
            const ev = evalDuel(riv, pMe, q, true);
            if (ev.result > 0) qMinFl = q;
            else break;
          }
        }

        const alwaysWins = qMin !== null && (qMin === 1 || (pMe === 1 && qMin === 2));
        let tieNote = '';
        if (qMin !== null && !alwaysWins) {
          const evAtLimit = evalDuel(riv, pMe, qMin, false);
          if (evAtLimit.mePts === evAtLimit.rivPts && evAtLimit.decidedAt > 0) {
            const lbl = tieLabel(evAtLimit.decidedAt);
            const meC = (me.positionCounts[evAtLimit.decidedAt] || 0) + (pMe === evAtLimit.decidedAt ? 1 : 0);
            const rvC = (riv.positionCounts[evAtLimit.decidedAt] || 0) + (qMin === evAtLimit.decidedAt ? 1 : 0);
            tieNote = `Empatan en ${evAtLimit.mePts} pts y gana ${me.name} por desempate (${meC} vs ${rvC} ${lbl}).`;
          }
        }
        let lossNote = '';
        if (qMin === null) {
          const evBoth = evalDuel(riv, pMe, OUT, false);
          if (evBoth.mePts === evBoth.rivPts && evBoth.decidedAt > 0) {
            const lbl = tieLabel(evBoth.decidedAt);
            lossNote = `Aunque ${riv.name} tampoco sume, empatan en ${evBoth.mePts} pts y el desempate (${lbl}) favorece a ${riv.name}.`;
          } else {
            lossNote = `Ni con ${riv.name} fuera de los puntos le alcanza.`;
          }
        }

        let requirement;
        if (alwaysWins) {
          requirement = `✅ Queda delante de ${riv.name} pase lo que pase`;
        } else if (qMin === null) {
          requirement = `❌ No le alcanza`;
        } else if (qMin === pMe + 1 || (pMe === OUT - 1 && qMin >= OUT)) {
          requirement = `Le basta con terminar delante de ${riv.name}`;
        } else if (qMin >= OUT) {
          requirement = `${riv.name} debe quedar fuera de los puntos / DNF`;
        } else {
          requirement = `${riv.name} debe terminar ${posLabel(qMin)} o peor`;
        }
        if (qMinFl !== null && qMinFl !== qMin && !alwaysWins) {
          requirement += qMin === null
            ? ` — pero con Vuelta Rápida le basta con que ${riv.name} termine ${posLabel(qMinFl)} o peor`
            : ` (con Vuelta Rápida propia: ${riv.name} ${posLabel(qMinFl)} o peor)`;
        }

        rows.push({
          myPos: pMe,
          myPosLabel: pMe >= OUT ? 'Fuera de puntos / DNF' : `${pMe}°`,
          myPts: ptsFor(pMe, false),
          rivalWorstAllowedPos: qMin,
          alwaysWins,
          impossible: qMin === null,
          requirement,
          note: tieNote || lossNote
        });
      }

      // Agrupar filas consecutivas con el mismo patrón para que sea más legible
      const grouped = [];
      rows.forEach((row) => {
        const relKey = row.alwaysWins
          ? 'always'
          : row.impossible
          ? `imp|${row.note}`
          : row.rivalWorstAllowedPos === row.myPos + 1 && !row.note
          ? 'ahead'
          : `q${row.rivalWorstAllowedPos}|${row.requirement}|${row.note}`;
        const last = grouped[grouped.length - 1];
        if (last && last.key === relKey && row.myPos < OUT) {
          last.toPos = row.myPos;
          last.toPts = row.myPts;
        } else {
          grouped.push({ ...row, key: relKey, fromPos: row.myPos, toPos: row.myPos, fromPts: row.myPts, toPts: row.myPts });
        }
      });
      grouped.forEach((g) => {
        if (g.fromPos >= OUT) g.rangeLabel = 'Fuera de puntos / DNF';
        else if (g.fromPos === g.toPos) g.rangeLabel = `${g.fromPos}° (+${g.fromPts} pts)`;
        else g.rangeLabel = `${g.fromPos}° a ${g.toPos}°`;
      });

      // Patrones clave
      const selfClinchPos = rows.filter((r) => r.alwaysWins).reduce((m, r) => Math.max(m, r.myPos), 0);
      const justAheadEverywhere = rows
        .filter((r) => r.myPos < OUT && !r.alwaysWins)
        .every((r) => r.rivalWorstAllowedPos !== null && r.rivalWorstAllowedPos <= r.myPos + 1);
      const outRow = rows[rows.length - 1];
      const winsIfBothScoreless = outRow && outRow.rivalWorstAllowedPos === OUT;

      return {
        rivalId: riv.id,
        rivalName: riv.name,
        rivalCode: riv.code,
        rivalColor: riv.teamColor,
        rivalImage: riv.image,
        rivalPoints: riv.points,
        rivalWins: riv.wins,
        rows,
        grouped,
        selfClinchPos,
        justAheadEverywhere,
        winsIfBothScoreless,
        bothScorelessNote: outRow ? outRow.note : ''
      };
    });

    if (duels.length > 0) {
      const trName = tr.name;
      const parts = [];
      const globalClinch = duels.reduce((m, d) => Math.min(m, d.selfClinchPos), Infinity);
      if (globalClinch >= 1 && globalClinch !== Infinity) {
        parts.push(
          globalClinch === 1
            ? `Ganando ${trName} se queda con el ${targetRank}° puesto pase lo que pase.`
            : `Terminando ${globalClinch}° o mejor en ${trName} se asegura el ${targetRank}° puesto sin depender de nadie.`
        );
      }
      if (duels.length === 1) {
        const d = duels[0];
        const contestedRows = d.rows.filter((r) => r.myPos < OUT && !r.alwaysWins);
        const aheadRows = contestedRows.filter(
          (r) => r.rivalWorstAllowedPos !== null && r.rivalWorstAllowedPos <= r.myPos + 1
        );
        if (d.justAheadEverywhere) {
          parts.push(`Si no, le basta con terminar delante de ${d.rivalName}.`);
        } else if (aheadRows.length > 0 && aheadRows.length >= contestedRows.length / 2) {
          const exceptions = contestedRows
            .filter((r) => !aheadRows.includes(r))
            .map((r) => r.myPosLabel)
            .join(', ');
          parts.push(
            `Si no, en general le basta con terminar delante de ${d.rivalName}, salvo si termina ${exceptions} (ahí el desempate o la Vuelta Rápida le juegan en contra; revisa la tabla).`
          );
        }
        if (d.winsIfBothScoreless) {
          parts.push(`Y si ninguno de los dos suma (ej. doble DNF), ${d.bothScorelessNote ? d.bothScorelessNote.replace(/^Empatan/, 'empatan') : `también se lo lleva ${me.name}`}`);
        } else if (d.bothScorelessNote) {
          parts.push(`Ojo: ${d.bothScorelessNote}`);
        }
      } else {
        parts.push(
          `Debe ganarle el duelo a ${duels.length} rivales a la vez (${duels.map((d) => d.rivalName).join(', ')}). Revisa la tabla de cada uno abajo.`
        );
      }
      if (tr.hasSprint) {
        parts.push('(Ojo: es fin de semana Sprint; la tabla considera solo la carrera principal, súmale la diferencia que saquen en la Sprint.)');
      }

      const kpiValue =
        globalClinch === 1 && duels.length === 1 && duels[0].justAheadEverywhere
          ? `Terminar delante de ${duels[0].rivalCode || duels[0].rivalName}`
          : globalClinch === 1
          ? 'Ganar la carrera'
          : globalClinch >= 1 && globalClinch !== Infinity
          ? `${globalClinch}° o mejor`
          : 'Depende de rivales';

      finalRaceDecider = {
        trackName: trName,
        hasSprint: Boolean(tr.hasSprint),
        duels,
        headline: parts.join(' '),
        kpiValue,
        kpiSub:
          globalClinch >= 1 && globalClinch !== Infinity
            ? `Con ${globalClinch}° o mejor no depende de nadie`
            : 'Necesita combinaciones con sus rivales (ver tabla)'
      };

      headlineSummary = `🏁 Última fecha (${trName}): ${finalRaceDecider.headline}`;

      // Ajustar el texto de cada rival en la tabla general según el duelo exacto
      rivalsAnalysis.forEach((ra) => {
        const d = duels.find((x) => x.rivalId === ra.id);
        if (!d) return;
        const firstNonTrivial = d.rows.find((r) => !r.alwaysWins);
        ra.conditionForMe = d.justAheadEverywhere
          ? `Terminar delante de ${d.rivalName} en ${trName}${d.winsIfBothScoreless ? ' (si ambos quedan sin puntos, gana por desempate)' : ''}.`
          : firstNonTrivial
          ? firstNonTrivial.requirement
          : `Queda delante de ${d.rivalName} pase lo que pase.`;
        ra.rivalPositionRequirement = `Victorias: ${me.name} ${me.wins} vs ${d.rivalName} ${d.rivalWins}. Revisa la tabla de escenarios exactos para cada puesto posible.`;
      });
    }
  }

  // Planes propios:
  // 1) Plan mínimo (asumiendo que el rival en targetRank no suma más puntos, o para asegurar si va defendiendo)
  const requiredSelfPoints = isDefending ? clinchPointsNeeded : minPointsNeeded;
  const selfMinimumPlan = buildSuggestedFinishPlan(Math.min(maxRemaining, requiredSelfPoints), isDefending);

  // 2) Plan realista competitivo (sumando un colchón sobre lo que el rival pueda sumar, o asegurando el puesto)
  const realisticTargetPts = isDefending
    ? clinchPointsNeeded
    : Math.min(maxRemaining, Math.max(minPointsNeeded, Math.round((minPointsNeeded + maxRemaining) * 0.65)));
  const selfRealisticPlan = buildSuggestedFinishPlan(realisticTargetPts, isDefending);

  // 3) Simulación de Escenario Carrera por Carrera (Combinación Ejemplo para terminar en targetRank)
  const exampleRaceSimulation = [];
  if (R > 0) {
    let simMyPts = me.points;
    let simHolderPts = targetHolder.points;
    const myPlan = isDefending ? selfMinimumPlan.perRacePlan : buildSuggestedFinishPlan(Math.min(maxRemaining, Math.max(minPointsNeeded + Math.min(18, Math.floor((maxRemaining - minPointsNeeded) * 0.5)), minPointsNeeded))).perRacePlan;

    // Puntos totales que sumará me en esta combinación ejemplo
    const totalSimMyGain = myPlan.reduce((s, x) => s + x.pointsEarned, 0);
    const finalMyTotal = me.points + totalSimMyGain;
    const tieAdv = me.wins > targetHolder.wins ? 0 : 1;
    const totalHolderAllowed = isDefending
      ? maxRemaining
      : Math.max(0, finalMyTotal - targetHolder.points - tieAdv);

    let holderRemainingBudget = totalHolderAllowed;

    pendingTracks.forEach((tr, idx) => {
      const myRaceStep = myPlan[idx];
      simMyPts += myRaceStep.pointsEarned;

      let holderPosLabel = '—';
      let holderGain = 0;

      if (targetHolder.id !== me.id) {
        const racesLeft = R - idx;
        const budgetHere = isDefending
          ? (racePts[1] || 18)
          : Math.floor(holderRemainingBudget / racesLeft);

        // Elegir un puesto para el rival que no sea el mismo puesto exacto que me y que respete budgetHere
        let chosenP = racePts.length + 1;
        for (let p = 0; p < racePts.length; p++) {
          const pLbl = `${p + 1}° puesto`;
          if (racePts[p] <= budgetHere && !myRaceStep.suggestedPos.startsWith(`${p + 1}°`)) {
            chosenP = p + 1;
            holderGain = racePts[p];
            break;
          }
        }
        holderPosLabel = chosenP <= racePts.length ? `${chosenP}° puesto` : `${racePts.length + 1}°+ (Fuera de pts)`;
        holderRemainingBudget = Math.max(0, holderRemainingBudget - holderGain);
        simHolderPts += holderGain;
      }

      exampleRaceSimulation.push({
        round: tr.round,
        name: tr.name,
        hasSprint: Boolean(tr.hasSprint),
        myFinish: myRaceStep.suggestedPos,
        myGain: myRaceStep.pointsEarned,
        myCumulative: simMyPts,
        rivalName: targetHolder.id !== me.id ? targetHolder.name : 'Perseguidor Directo',
        rivalFinish: holderPosLabel,
        rivalGain: holderGain,
        rivalCumulative: simHolderPts
      });
    });
  }

  return {
    kind,
    isTeam,
    me,
    targetRank,
    bestRank,
    worstRank,
    targetHolder,
    isDefending,
    remainingRacesCount: R,
    maxRemaining,
    gapToTarget,
    minPointsNeeded,
    clinchPointsNeeded,
    headlineSummary,
    selfMinimumPlan,
    selfRealisticPlan,
    rivalsAnalysis,
    exampleRaceSimulation,
    finalRaceDecider
  };
}

window.ChampionshipEngine = {
  calculateChampionshipPool,
  scoreSingleTrack,
  calculateStandings,
  runMonteCarloSimulation,
  calculateTargetRequirements
};
