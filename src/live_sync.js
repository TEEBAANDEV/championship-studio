/**
 * Sincronización de resultados en vivo.
 * Convierte los resultados publicados por la API pública Jolpica-F1 (compatible con Ergast)
 * al formato interno de la app. Se usa tanto en el navegador/app como en Node (GitHub Actions).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiveSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const API_BASE = 'https://api.jolpi.ca/ergast/f1';

  const TEAM_MAP = {
    mercedes: 't_mer',
    ferrari: 't_fer',
    red_bull: 't_rbr',
    mclaren: 't_mcl',
    rb: 't_vrb',
    alpine: 't_alp',
    haas: 't_haa',
    audi: 't_aud',
    sauber: 't_aud',
    williams: 't_wil',
    aston_martin: 't_amr',
    cadillac: 't_cad'
  };

  const NATIONALITY_CODES = {
    British: 'GBR', Dutch: 'NED', Italian: 'ITA', Monegasque: 'MON', Australian: 'AUS',
    Spanish: 'ESP', French: 'FRA', German: 'GER', Finnish: 'FIN', Thai: 'THA',
    Japanese: 'JPN', Canadian: 'CAN', Mexican: 'MEX', Argentine: 'ARG', Brazilian: 'BRA',
    Danish: 'DEN', Chinese: 'CHN', American: 'USA', 'New Zealander': 'NZL'
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Descarga todas las páginas de un endpoint y agrupa las carreras por ronda. */
  async function fetchAllPages(fetchFn, season, endpoint, listKey, sleepMs) {
    const byRound = new Map();
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const res = await fetchFn(`${API_BASE}/${season}/${endpoint}.json?limit=100&offset=${offset}`);
      if (!res.ok) throw new Error(`La API respondió ${res.status} en ${endpoint}`);
      const json = await res.json();
      total = Number(json.MRData.total) || 0;
      const races = (json.MRData.RaceTable && json.MRData.RaceTable.Races) || [];
      races.forEach((race) => {
        const existing = byRound.get(race.round);
        if (existing) existing[listKey] = (existing[listKey] || []).concat(race[listKey] || []);
        else byRound.set(race.round, race);
      });
      offset += 100;
      if (races.length === 0) break;
      if (sleepMs) await sleep(sleepMs);
    }
    return Array.from(byRound.values());
  }

  async function fetchSeasonData(fetchFn, season, options) {
    const sleepMs = (options && options.sleepMs) || 0;
    const results = await fetchAllPages(fetchFn, season, 'results', 'Results', sleepMs);
    const sprint = await fetchAllPages(fetchFn, season, 'sprint', 'SprintResults', sleepMs);
    const qualifying = await fetchAllPages(fetchFn, season, 'qualifying', 'QualifyingResults', sleepMs);
    return { results, sprint, qualifying };
  }

  function classifyRow(row) {
    const st = String(row.status || '');
    const finished = st === 'Finished' || st === 'Lapped' || /^\+\d+ Laps?$/.test(st);
    if (finished) return 'FIN';
    // Clasificado con puntos aunque no haya visto la bandera: cuenta como llegada normal
    if (Number(row.points) > 0) return 'FIN';
    if (/disqualif/i.test(st)) return 'DSQ';
    if (/did not (start|qualify)|withdr/i.test(st)) return 'DNS';
    return 'DNF';
  }

  function computeVersion(season) {
    const text = JSON.stringify(
      (season.tracks || []).map((t) => [t.round, t.completed, t.pointsMultiplier, t.results])
    );
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16) + '-' + (season.tracks || []).filter((t) => t.completed).length;
  }

  /** Aplica los resultados de la API sobre una temporada base y devuelve una copia actualizada. */
  function buildLiveSeason(base, api) {
    const state = JSON.parse(JSON.stringify(base));
    state.teams = state.teams || [];
    state.drivers = state.drivers || [];
    state.tracks = state.tracks || [];
    const winPts = Number((state.pointsSystem.racePoints || [25])[0]) || 25;

    const driversById = new Map(state.drivers.map((d) => [d.id, d]));
    const teamIds = new Set(state.teams.map((t) => t.id));

    const teamOf = (constructor) => {
      const cid = constructor.constructorId;
      const mapped = TEAM_MAP[cid];
      if (mapped && teamIds.has(mapped)) return mapped;
      const id = mapped || `t_${cid}`;
      if (!teamIds.has(id)) {
        const short = String(constructor.name || cid).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        state.teams.push({ id, name: constructor.name || cid, shortName: short, color: '#64748b', image: '' });
        teamIds.add(id);
      }
      return id;
    };

    const normalize = (s) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');

    const driverOf = (driver, teamId) => {
      const lastName = driver.familyName || '';
      const code = String(driver.code || normalize(lastName).slice(0, 3) || driver.driverId).toUpperCase();
      let id = `d_${code.toLowerCase()}`;
      if (!driversById.has(id)) {
        // Puede que ya exista con otra sigla: lo buscamos por apellido o por dorsal
        const num = Number(driver.permanentNumber) || 0;
        const match = state.drivers.find(
          (d) =>
            (lastName && normalize(d.name).endsWith(normalize(lastName))) ||
            (num && Number(d.number) === num && normalize(d.name).includes(normalize(lastName).slice(0, 3)))
        );
        if (match) id = match.id;
      }
      if (!driversById.has(id)) {
        const d = {
          id,
          name: `${driver.givenName || ''} ${driver.familyName || ''}`.trim() || code,
          code,
          number: Number(driver.permanentNumber) || 0,
          teamId,
          secondaryTeamIds: [],
          country: NATIONALITY_CODES[driver.nationality] || 'INT',
          baseRating: 80,
          image: ''
        };
        state.drivers.push(d);
        driversById.set(id, d);
      }
      return id;
    };

    const sprintByRound = new Map((api.sprint || []).map((r) => [Number(r.round), r]));
    const qualiByRound = new Map((api.qualifying || []).map((r) => [Number(r.round), r]));
    const racedTeams = new Map(); // driverId -> Map(teamId -> carreras)

    (api.results || [])
      .slice()
      .sort((a, b) => Number(a.round) - Number(b.round))
      .forEach((race) => {
        const round = Number(race.round);
        const rows = (race.Results || []).slice().sort((a, b) => Number(a.position) - Number(b.position));
        if (rows.length === 0) return;

        let track = state.tracks.find((t) => Number(t.round) === round);
        if (!track) {
          track = {
            id: `r_${round}`,
            round,
            name: race.raceName,
            country: (race.Circuit && race.Circuit.Location && race.Circuit.Location.country) || '',
            circuit: (race.Circuit && race.Circuit.circuitName) || '',
            catKey: '',
            hasSprint: false,
            completed: false,
            image: '',
            results: {}
          };
          state.tracks.push(track);
        }

        const raceOrder = [];
        const dnfDriverIds = [];
        const driverStatuses = {};
        const driverTeams = {};
        let fastestLapDriverId = '';
        let poleDriverId = '';

        rows.forEach((row) => {
          const teamId = teamOf(row.Constructor);
          const id = driverOf(row.Driver, teamId);
          raceOrder.push(id);
          driverTeams[id] = teamId;
          const cls = classifyRow(row);
          if (cls !== 'FIN') {
            dnfDriverIds.push(id);
            driverStatuses[id] = cls;
          }
          if (row.FastestLap && String(row.FastestLap.rank) === '1') fastestLapDriverId = id;
          if (!poleDriverId && String(row.grid) === '1') poleDriverId = id;

          const tm = racedTeams.get(id) || new Map();
          tm.set(teamId, (tm.get(teamId) || 0) + 1);
          racedTeams.set(id, tm);
        });

        const quali = qualiByRound.get(round);
        if (quali && quali.QualifyingResults && quali.QualifyingResults[0]) {
          const q = quali.QualifyingResults[0];
          poleDriverId = driverOf(q.Driver, teamOf(q.Constructor));
        }

        const sprintRace = sprintByRound.get(round);
        const sprintOrder = sprintRace
          ? (sprintRace.SprintResults || [])
              .slice()
              .sort((a, b) => Number(a.position) - Number(b.position))
              .map((row) => driverOf(row.Driver, teamOf(row.Constructor)))
          : [];

        // Mitad de puntos / doble puntuación detectados por lo que se le entregó al ganador
        const ratio = (Number(rows[0].points) || 0) / winPts;
        let multiplier = 1;
        if (Math.abs(ratio - 0.5) < 0.05) multiplier = 0.5;
        else if (Math.abs(ratio - 2) < 0.1) multiplier = 2;
        else if (ratio === 0) multiplier = 0;

        track.completed = true;
        track.hasSprint = Boolean(sprintRace) || Boolean(track.hasSprint);
        track.pointsMultiplier = multiplier;
        if (multiplier === 0.5) track.suspensionNote = '🌧️ Carrera suspendida — mitad de puntos (50%)';
        else if (multiplier === 2) track.suspensionNote = '⚡ Puntuación doble (200%)';
        else if (multiplier === 1 && /Mitad de Puntos|mitad de puntos|Doble/.test(track.suspensionNote || '')) {
          track.suspensionNote = '';
        }
        track.results = {
          poleDriverId,
          fastestLapDriverId,
          raceOrder,
          dnfDriverIds,
          driverStatuses,
          sprintOrder,
          driverTeams
        };
      });

    // Pilotos que corrieron para más de un equipo (ej. cambios a mitad de temporada)
    racedTeams.forEach((teams, driverId) => {
      const d = driversById.get(driverId);
      if (!d) return;
      const sorted = Array.from(teams.entries()).sort((a, b) => b[1] - a[1]);
      const primary = teams.has(d.teamId) ? d.teamId : sorted[0][0];
      d.teamId = primary;
      d.secondaryTeamIds = sorted.map((e) => e[0]).filter((tid) => tid !== primary);
    });

    state.tracks.sort((a, b) => (a.round || 0) - (b.round || 0));
    state.meta = state.meta || {};
    state.meta.updatedAt = new Date().toISOString();
    return state;
  }

  return { API_BASE, fetchSeasonData, buildLiveSeason, computeVersion };
});
