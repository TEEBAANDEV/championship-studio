/**
 * Generador de Base de Datos Histórica F1 (1950–2026)
 * Procesa los archivos oficiales de F1DB (datos/f1db_raw/*.json) y genera:
 *  1. datos/hist/catalog_1950_2026.json (Catálogo maestro de 77 temporadas, 920 pilotos, 187 escuderías y 78 circuitos)
 *  2. datos/hist/seasons/season_<YEAR>.json (77 archivos de estado de campeonato completos listos para cargar y simular)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'C:/Users/teeba/Documents/F1-Championship-Manager';
const RAW_DIR = path.join(ROOT, 'datos', 'f1db_raw');
const OUT_DIR = path.join(ROOT, 'datos', 'hist');
const SEASONS_DIR = path.join(OUT_DIR, 'seasons');

fs.mkdirSync(SEASONS_DIR, { recursive: true });

console.log('Cargando archivos raw de F1DB...');
const countries = require(path.join(RAW_DIR, 'f1db-countries.json'));
const circuits = require(path.join(RAW_DIR, 'f1db-circuits.json'));
const constructors = require(path.join(RAW_DIR, 'f1db-constructors.json'));
const drivers = require(path.join(RAW_DIR, 'f1db-drivers.json'));
const grandsPrix = require(path.join(RAW_DIR, 'f1db-grands-prix.json'));
const races = require(path.join(RAW_DIR, 'f1db-races.json'));
const raceResults = require(path.join(RAW_DIR, 'f1db-races-race-results.json'));
const sprintResults = require(path.join(RAW_DIR, 'f1db-races-sprint-race-results.json'));
const driverStandings = require(path.join(RAW_DIR, 'f1db-seasons-driver-standings.json'));
const constructorStandings = require(path.join(RAW_DIR, 'f1db-seasons-constructor-standings.json'));

// Mapa de países
const countryMap = new Map();
for (const c of countries) {
  countryMap.set(c.id, {
    code: c.alpha3Code || c.iocCode || c.alpha2Code || 'INT',
    name: c.name
  });
}

// Traducción amigable de países frecuentes al español
const COUNTRY_ES = {
  'United Kingdom': 'Reino Unido',
  'Italy': 'Italia',
  'France': 'Francia',
  'Germany': 'Alemania',
  'United States': 'Estados Unidos',
  'Brazil': 'Brasil',
  'Spain': 'España',
  'Belgium': 'Bélgica',
  'Monaco': 'Mónaco',
  'Canada': 'Canadá',
  'Japan': 'Japón',
  'Australia': 'Australia',
  'Austria': 'Austria',
  'Netherlands': 'Países Bajos',
  'Hungary': 'Hungría',
  'Mexico': 'México',
  'Argentina': 'Argentina',
  'South Africa': 'Sudáfrica',
  'Switzerland': 'Suiza',
  'Sweden': 'Suecia',
  'Portugal': 'Portugal',
  'Malaysia': 'Malasia',
  'China': 'China',
  'Bahrain': 'Baréin',
  'Turkey': 'Turquía',
  'Singapore': 'Singapur',
  'United Arab Emirates': 'Emiratos Árabes',
  'South Korea': 'Corea del Sur',
  'India': 'India',
  'Russia': 'Rusia',
  'Azerbaijan': 'Azerbaiyán',
  'Saudi Arabia': 'Arabia Saudita',
  'Qatar': 'Catar',
  'Morocco': 'Marruecos',
  'Finland': 'Finlandia',
  'New Zealand': 'Nueva Zelanda',
  'Colombia': 'Colombia',
  'Venezuela': 'Venezuela',
  'Poland': 'Polonia',
  'Denmark': 'Dinamarca',
  'Thailand': 'Tailandia',
  'Ireland': 'Irlanda',
  'Chile': 'Chile',
  'Uruguay': 'Uruguay'
};

// Traducción exacta de los 54 Grandes Premios históricos de la F1 (1950–2026)
const GRAND_PRIX_NAMES_ES = {
  '70th-anniversary': 'GP del 70.º Aniversario',
  'abu-dhabi': 'GP de Abu Dabi',
  'argentina': 'GP de Argentina',
  'australia': 'GP de Australia',
  'austria': 'GP de Austria',
  'azerbaijan': 'GP de Azerbaiyán',
  'bahrain': 'GP de Baréin',
  'barcelona-catalunya': 'GP de Barcelona-Cataluña',
  'belgium': 'GP de Bélgica',
  'brazil': 'GP de Brasil',
  'caesars-palace': 'GP de Caesars Palace',
  'canada': 'GP de Canadá',
  'china': 'GP de China',
  'dallas': 'GP de Dallas',
  'detroit': 'GP de Detroit',
  'eifel': 'GP de Eifel',
  'emilia-romagna': 'GP de Emilia-Romaña',
  'europe': 'GP de Europa',
  'france': 'GP de Francia',
  'germany': 'GP de Alemania',
  'great-britain': 'GP de Gran Bretaña',
  'hungary': 'GP de Hungría',
  'india': 'GP de la India',
  'indianapolis': '500 Millas de Indianápolis',
  'italy': 'GP de Italia',
  'japan': 'GP de Japón',
  'korea': 'GP de Corea',
  'las-vegas': 'GP de Las Vegas',
  'luxembourg': 'GP de Luxemburgo',
  'malaysia': 'GP de Malasia',
  'mexico': 'GP de México',
  'miami': 'GP de Miami',
  'monaco': 'GP de Mónaco',
  'morocco': 'GP de Marruecos',
  'netherlands': 'GP de los Países Bajos',
  'pacific': 'GP del Pacífico',
  'pescara': 'GP de Pescara',
  'portugal': 'GP de Portugal',
  'qatar': 'GP de Catar',
  'russia': 'GP de Rusia',
  'sakhir': 'GP de Sakhir',
  'san-marino': 'GP de San Marino',
  'sao-paulo': 'GP de São Paulo',
  'saudi-arabia': 'GP de Arabia Saudita',
  'singapore': 'GP de Singapur',
  'south-africa': 'GP de Sudáfrica',
  'spain': 'GP de España',
  'styria': 'GP de Estiria',
  'sweden': 'GP de Suecia',
  'switzerland': 'GP de Suiza',
  'turkey': 'GP de Turquía',
  'tuscany': 'GP de la Toscana',
  'united-states-west': 'GP del Oeste de EE. UU.',
  'united-states': 'GP de Estados Unidos'
};

const gpMap = new Map();
for (const g of grandsPrix) gpMap.set(g.id, g);

function getCountryInfo(countryId) {
  const raw = countryMap.get(countryId);
  if (!raw) return { code: 'INT', name: countryId || 'Internacional' };
  return {
    code: raw.code,
    name: COUNTRY_ES[raw.name] || raw.name
  };
}

// Colores históricos icónicos por constructorId de F1DB
const HISTORIC_TEAM_COLORS = {
  'ferrari': '#E80020',
  'mclaren': '#FF8000',
  'mercedes': '#27F4D2',
  'red-bull': '#3671C6',
  'williams': '#005AFF',
  'lotus-climax': '#15803D',
  'lotus-ford': '#D4AF37',
  'team-lotus': '#15803D',
  'lotus-racing': '#15803D',
  'lotus-f1': '#D4AF37',
  'brabham': '#1E3A8A',
  'brabham-repco': '#047857',
  'brabham-climax': '#047857',
  'brabham-ford': '#1E3A8A',
  'brabham-alfa-romeo': '#DC2626',
  'brabham-bmw': '#2563EB',
  'renault': '#FFF500',
  'alpine': '#FF87BC',
  'benetton': '#10B981',
  'tyrrell': '#1D4ED8',
  'brm': '#065F46',
  'cooper': '#047857',
  'cooper-climax': '#047857',
  'vanwall': '#059669',
  'alfa-romeo': '#991B1B',
  'maserati': '#DC2626',
  'lancia': '#B91C1C',
  'mercedes-benz': '#E2E8F0',
  'matra': '#2563EB',
  'matra-ford': '#2563EB',
  'march': '#EF4444',
  'ligier': '#2563EB',
  'jordan': '#FACC15',
  'sauber': '#3B82F6',
  'kick-sauber': '#52E252',
  'audi': '#F50537',
  'bmw-sauber': '#1D4ED8',
  'bmw': '#1D4ED8',
  'honda': '#F8FAFC',
  'brawn': '#D9F99D',
  'toyota': '#EF4444',
  'bar': '#E2E8F0',
  'jaguar': '#059669',
  'stewart': '#F8FAFC',
  'arrows': '#F97316',
  'footwork': '#F97316',
  'minardi': '#F59E0B',
  'toro-rosso': '#1D4ED8',
  'alphatauri': '#38BDF8',
  'rb': '#6692FF',
  'racing-bulls': '#6692FF',
  'force-india': '#F97316',
  'racing-point': '#F472B6',
  'aston-martin': '#229971',
  'haas': '#B6BABD',
  'cadillac': '#E5C158',
  'prost': '#1E40AF',
  'shadow': '#475569',
  'wolf': '#CA8A04',
  'hesketh': '#F8FAFC',
  'penske': '#DC2626',
  'eagle': '#1E3A8A',
  'scarab': '#38BDF8',
  'connaught': '#047857',
  'gordini': '#3B82F6',
  'talbot-lago': '#60A5FA',
  'porsche': '#E2E8F0',
  'lola': '#EF4444',
  'larrousse': '#3B82F6',
  'dallara': '#DC2626',
  'leyton-house': '#06B6D4',
  'march-ford': '#EF4444',
  'surtees': '#3B82F6',
  'fittipaldi': '#FACC15',
  'copersucar': '#FACC15',
  'ats-wheels': '#FACC15',
  'ensign': '#EF4444',
  'toleman': '#3B82F6',
  'osella': '#2563EB',
  'zakspeed': '#EF4444',
  'ags': '#38BDF8',
  'onyx': '#EC4899',
  'rial': '#2563EB',
  'scuderia-italia': '#DC2626',
  'andrea-moda': '#64748B',
  'simtek': '#8B5CF6',
  'pacific': '#06B6D4',
  'forti': '#FACC15',
  'super-aguri': '#EF4444',
  'spyker': '#F97316',
  'midland': '#EF4444',
  'virgin': '#EF4444',
  'marussia': '#EF4444',
  'manor': '#EF4444',
  'caterham': '#10B981',
  'hrt': '#A1A1AA',
  'kurtis-kraft': '#F97316',
  'epperly': '#EAB308',
  'watson': '#3B82F6',
  'kuzma': '#10B981'
};

const PALETTE_FALLBACK = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
  '#84CC16', '#EAB308', '#22C55E', '#A855F7', '#F43F5E'
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getTeamColor(constructorId) {
  if (HISTORIC_TEAM_COLORS[constructorId]) return HISTORIC_TEAM_COLORS[constructorId];
  for (const [key, col] of Object.entries(HISTORIC_TEAM_COLORS)) {
    if (constructorId.startsWith(key)) return col;
  }
  return PALETTE_FALLBACK[hashString(constructorId) % PALETTE_FALLBACK.length];
}

function makeTeamShortName(c) {
  const map = {
    'ferrari': 'FER',
    'mclaren': 'MCL',
    'mercedes': 'MER',
    'red-bull': 'RBR',
    'williams': 'WIL',
    'team-lotus': 'LOT',
    'lotus-f1': 'LOT',
    'lotus-racing': 'LOT',
    'brabham': 'BT',
    'renault': 'REN',
    'alpine': 'ALP',
    'benetton': 'BEN',
    'tyrrell': 'TYR',
    'brm': 'BRM',
    'cooper': 'COO',
    'vanwall': 'VAN',
    'alfa-romeo': 'ALF',
    'maserati': 'MAS',
    'matra': 'MAT',
    'march': 'MAR',
    'ligier': 'LIG',
    'jordan': 'JOR',
    'sauber': 'SAU',
    'kick-sauber': 'KIC',
    'audi': 'AUD',
    'bmw-sauber': 'BMW',
    'honda': 'HON',
    'brawn': 'BGP',
    'toyota': 'TOY',
    'bar': 'BAR',
    'jaguar': 'JAG',
    'stewart': 'STE',
    'arrows': 'ARR',
    'footwork': 'FTW',
    'minardi': 'MIN',
    'toro-rosso': 'STR',
    'alphatauri': 'AT',
    'rb': 'VRB',
    'racing-bulls': 'VRB',
    'force-india': 'SFI',
    'racing-point': 'RP',
    'aston-martin': 'AMR',
    'haas': 'HAA',
    'cadillac': 'CAD',
    'prost': 'PRO',
    'shadow': 'SHA',
    'wolf': 'WLF',
    'hesketh': 'HES',
    'toleman': 'TOL',
    'fittipaldi': 'FIT',
    'surtees': 'SUR',
    'penske': 'PEN',
    'eagle': 'EAG',
    'porsche': 'POR',
    'gordini': 'GOR',
    'lancia': 'LAN',
    'talbot-lago': 'TAL'
  };
  if (map[c.id]) return map[c.id];
  const clean = (c.name || c.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.slice(0, 3).padEnd(3, 'X');
}

function makeDriverCode(d) {
  if (d.abbreviation && d.abbreviation.length === 3) return d.abbreviation.toUpperCase();
  const last = (d.lastName || d.name || d.id).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (last.length >= 3) return last.slice(0, 3);
  const first = (d.firstName || 'X').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
  return (last + first + 'XXX').slice(0, 3);
}

function computeDriverBaseRating(d) {
  const titles = d.totalChampionshipWins || 0;
  const wins = d.totalRaceWins || 0;
  const podiums = d.totalPodiums || 0;
  const poles = d.totalPolePositions || 0;
  const starts = d.totalRaceStarts || 0;
  const points = d.totalPoints || 0;

  let rating = 70;
  if (titles >= 5) rating = 98;
  else if (titles >= 3) rating = 96;
  else if (titles >= 2) rating = 94;
  else if (titles === 1) rating = 92;
  else if (wins >= 10) rating = 90;
  else if (wins >= 5) rating = 88;
  else if (wins >= 2) rating = 86;
  else if (wins === 1) rating = 84;
  else if (podiums >= 10) rating = 83;
  else if (podiums >= 3) rating = 81;
  else if (podiums >= 1) rating = 79;
  else if (points >= 50 || starts >= 80) rating = 77;
  else if (points >= 10 || starts >= 30) rating = 75;
  else if (points > 0 || starts >= 10) rating = 72;
  else rating = 68;

  if (poles >= 20 && rating < 95) rating += 2;
  else if (poles >= 5 && rating < 92) rating += 1;

  return Math.min(99, Math.max(64, rating));
}

// Mapeo de circuitId de F1DB a nuestro catálogo de trazados SVG
const CIRCUIT_TO_CATKEY = {
  'melbourne': 'australia',
  'shanghai': 'china',
  'suzuka': 'japan',
  'miami': 'miami',
  'montreal': 'canada',
  'monaco': 'monaco',
  'catalunya': 'spain',
  'spielberg': 'austria',
  'silverstone': 'britain',
  'spa-francorchamps': 'belgium',
  'hungaroring': 'hungary',
  'zandvoort': 'netherlands',
  'monza': 'italy',
  'madrid': 'madrid',
  'baku': 'azerbaijan',
  'marina-bay': 'singapore',
  'austin': 'usa',
  'mexico-city': 'mexico',
  'interlagos': 'brazil',
  'las-vegas': 'vegas',
  'lusail': 'qatar',
  'yas-marina': 'abudhabi',
  'bahrain': 'bahrain',
  'jeddah': 'saudi',
  'imola': 'imola'
};

// Sistema de puntos histórico por año
function getPointsSystemForYear(year) {
  if (year <= 1959) {
    return {
      label: '1950–1959 (8-6-4-3-2 + 1 VR)',
      pointsSystem: {
        racePoints: [8, 6, 4, 3, 2],
        sprintPoints: [],
        fastestLapPoints: 1,
        fastestLapTopLimit: 20,
        polePoints: 0
      }
    };
  }
  if (year === 1960) {
    return {
      label: '1960 (8-6-4-3-2-1)',
      pointsSystem: {
        racePoints: [8, 6, 4, 3, 2, 1],
        sprintPoints: [],
        fastestLapPoints: 0,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  if (year >= 1961 && year <= 1990) {
    return {
      label: '1961–1990 (9-6-4-3-2-1)',
      pointsSystem: {
        racePoints: [9, 6, 4, 3, 2, 1],
        sprintPoints: [],
        fastestLapPoints: 0,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  if (year >= 1991 && year <= 2002) {
    return {
      label: '1991–2002 (10-6-4-3-2-1)',
      pointsSystem: {
        racePoints: [10, 6, 4, 3, 2, 1],
        sprintPoints: [],
        fastestLapPoints: 0,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  if (year >= 2003 && year <= 2009) {
    return {
      label: '2003–2009 (10-8-6-5-4-3-2-1)',
      pointsSystem: {
        racePoints: [10, 8, 6, 5, 4, 3, 2, 1],
        sprintPoints: [],
        fastestLapPoints: 0,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  if (year >= 2010 && year <= 2018) {
    return {
      label: '2010–2018 (25-18-15-12-10-8-6-4-2-1)',
      pointsSystem: {
        racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
        sprintPoints: [],
        fastestLapPoints: 0,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  if (year >= 2019 && year <= 2020) {
    return {
      label: '2019–2020 (25-18-15-12-10-8-6-4-2-1 + 1 VR)',
      pointsSystem: {
        racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
        sprintPoints: [],
        fastestLapPoints: 1,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  if (year === 2021) {
    return {
      label: '2021 (25-18-15-12-10-8-6-4-2-1 + 1 VR + Sprint 3-2-1)',
      pointsSystem: {
        racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
        sprintPoints: [3, 2, 1],
        fastestLapPoints: 1,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  if (year >= 2022 && year <= 2024) {
    return {
      label: '2022–2024 (25-18-15-12-10-8-6-4-2-1 + 1 VR + Sprint Top 8)',
      pointsSystem: {
        racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
        sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
        fastestLapPoints: 1,
        fastestLapTopLimit: 10,
        polePoints: 0
      }
    };
  }
  return {
    label: '2025–2026 (25-18-15-12-10-8-6-4-2-1 + Sprint Top 8)',
    pointsSystem: {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
      fastestLapPoints: 0,
      fastestLapTopLimit: 10,
      polePoints: 0
    }
  };
}

// Indexar entidades base
const circuitById = new Map();
for (const c of circuits) circuitById.set(c.id, c);

const constructorById = new Map();
for (const c of constructors) constructorById.set(c.id, c);

const driverById = new Map();
for (const d of drivers) driverById.set(d.id, d);

// Indexar resultados por raceId
const resultsByRaceId = new Map();
const driverYears = new Map();
const driverPrimaryConstructorCounts = new Map();
const driverMostCommonNumber = new Map();
const constructorYears = new Map();
const circuitYears = new Map();

for (const r of races) {
  const cy = circuitYears.get(r.circuitId) || { first: r.year, last: r.year };
  if (r.year < cy.first) cy.first = r.year;
  if (r.year > cy.last) cy.last = r.year;
  circuitYears.set(r.circuitId, cy);
}

for (const rr of raceResults) {
  let list = resultsByRaceId.get(rr.raceId);
  if (!list) {
    list = [];
    resultsByRaceId.set(rr.raceId, list);
  }
  list.push(rr);

  const dy = driverYears.get(rr.driverId) || { first: rr.year, last: rr.year };
  if (rr.year < dy.first) dy.first = rr.year;
  if (rr.year > dy.last) dy.last = rr.year;
  driverYears.set(rr.driverId, dy);

  const ty = constructorYears.get(rr.constructorId) || { first: rr.year, last: rr.year };
  if (rr.year < ty.first) ty.first = rr.year;
  if (rr.year > ty.last) ty.last = rr.year;
  constructorYears.set(rr.constructorId, ty);

  let tcMap = driverPrimaryConstructorCounts.get(rr.driverId);
  if (!tcMap) {
    tcMap = new Map();
    driverPrimaryConstructorCounts.set(rr.driverId, tcMap);
  }
  tcMap.set(rr.constructorId, (tcMap.get(rr.constructorId) || 0) + 1);

  if (rr.driverNumber && !isNaN(parseInt(rr.driverNumber, 10))) {
    const num = parseInt(rr.driverNumber, 10);
    let nMap = driverMostCommonNumber.get(rr.driverId);
    if (!nMap) {
      nMap = new Map();
      driverMostCommonNumber.set(rr.driverId, nMap);
    }
    nMap.set(num, (nMap.get(num) || 0) + 1);
  }
}

const sprintsByRaceId = new Map();
for (const sr of sprintResults) {
  let list = sprintsByRaceId.get(sr.raceId);
  if (!list) {
    list = [];
    sprintsByRaceId.set(sr.raceId, list);
  }
  list.push(sr);
}

// Campeones oficiales por año según F1DB
const championDriverByYear = new Map();
for (const ds of driverStandings) {
  if (ds.championshipWon || ds.positionNumber === 1) {
    if (!championDriverByYear.has(ds.year) || ds.championshipWon) {
      championDriverByYear.set(ds.year, ds);
    }
  }
}

const championConstructorByYear = new Map();
for (const cs of constructorStandings) {
  if (cs.championshipWon || cs.positionNumber === 1) {
    if (!championConstructorByYear.has(cs.year) || cs.championshipWon) {
      championConstructorByYear.set(cs.year, cs);
    }
  }
}

// Cargar el estado oficial verificado de 2026 desde src/data.js para que 2026 tenga las 23 fechas (20 completadas) exactas
function loadOfficial2026FromDataJs() {
  try {
    const dataJsCode = fs.readFileSync(path.join(ROOT, 'src', 'data.js'), 'utf8');
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(dataJsCode, sandbox);
    if (sandbox.window.ChampionshipData && typeof sandbox.window.ChampionshipData.createDemoChampionship === 'function') {
      const st = sandbox.window.ChampionshipData.createDemoChampionship(false);
      // Limpiar dataURIs pesados en el archivo JSON para que la hidratación visual ocurra al cargar
      st.teams.forEach((t) => { t.image = ''; });
      st.drivers.forEach((d) => { d.image = ''; });
      st.tracks.forEach((tr) => { tr.image = ''; });
      return st;
    }
  } catch (e) {
    console.warn('No se pudo extraer 2026 desde data.js:', e.message);
  }
  return null;
}

const official2026State = loadOfficial2026FromDataJs();

// Agrupar carreras por año
const racesByYear = new Map();
for (const r of races) {
  let list = racesByYear.get(r.year);
  if (!list) {
    list = [];
    racesByYear.set(r.year, list);
  }
  list.push(r);
}

const seasonsSummary = [];
const allYears = Array.from(racesByYear.keys()).sort((a, b) => a - b);

console.log(`Procesando ${allYears.length} temporadas (${allYears[0]}–${allYears[allYears.length - 1]})...`);

for (const year of allYears) {
  if (year === 2026 && official2026State) {
    fs.writeFileSync(
      path.join(SEASONS_DIR, `season_2026.json`),
      JSON.stringify(official2026State)
    );
    const completed2026 = official2026State.tracks.filter((t) => t.completed).length;
    seasonsSummary.push({
      year: 2026,
      decade: '2020s',
      raceCount: official2026State.tracks.length,
      completedCount: completed2026,
      driverCount: official2026State.drivers.length,
      teamCount: official2026State.teams.length,
      pointsSystemLabel: '2025–2026 (25-18-15-12-10-8-6-4-2-1 + Sprint Top 8)',
      championDriver: {
        id: 'd_ant',
        name: 'Kimi Antonelli (Líder 2026)',
        country: 'ITA',
        points: 356
      },
      championTeam: {
        id: 't_mer',
        name: 'Mercedes-AMG Petronas (Líder 2026)',
        color: '#27F4D2',
        points: 659
      }
    });
    continue;
  }

  const yearRaces = racesByYear.get(year).sort((a, b) => a.round - b.round);
  const { label: pointsLabel, pointsSystem } = getPointsSystemForYear(year);

  const seasonTeamIds = new Set();
  const seasonDriverTeamCounts = new Map();
  const seasonDriverNumbers = new Map();
  const seasonDriverPoints = new Map();

  for (const r of yearRaces) {
    const rRes = resultsByRaceId.get(r.id) || [];
    for (const row of rRes) {
      if (!row.driverId || !row.constructorId) continue;
      seasonTeamIds.add(row.constructorId);

      let tMap = seasonDriverTeamCounts.get(row.driverId);
      if (!tMap) {
        tMap = new Map();
        seasonDriverTeamCounts.set(row.driverId, tMap);
      }
      tMap.set(row.constructorId, (tMap.get(row.constructorId) || 0) + 1);

      if (row.driverNumber && !isNaN(parseInt(row.driverNumber, 10))) {
        seasonDriverNumbers.set(row.driverId, parseInt(row.driverNumber, 10));
      }
      seasonDriverPoints.set(row.driverId, (seasonDriverPoints.get(row.driverId) || 0) + (row.points || 0));
    }
  }

  let activeDriverIds = Array.from(seasonDriverTeamCounts.keys());
  if (activeDriverIds.length > 42) {
    activeDriverIds.sort((a, b) => {
      const ptsA = seasonDriverPoints.get(a) || 0;
      const ptsB = seasonDriverPoints.get(b) || 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      const startsA = Array.from(seasonDriverTeamCounts.get(a).values()).reduce((s, v) => s + v, 0);
      const startsB = Array.from(seasonDriverTeamCounts.get(b).values()).reduce((s, v) => s + v, 0);
      return startsB - startsA;
    });
    activeDriverIds = activeDriverIds.slice(0, 42);
  }
  const activeDriverSet = new Set(activeDriverIds);

  const activeTeamSet = new Set();
  for (const dId of activeDriverIds) {
    const tMap = seasonDriverTeamCounts.get(dId);
    for (const cId of tMap.keys()) activeTeamSet.add(cId);
  }

  const teams = Array.from(activeTeamSet).map((cId) => {
    const cObj = constructorById.get(cId) || { id: cId, name: cId, fullName: cId };
    return {
      id: `t_${cId}`,
      name: cObj.fullName || cObj.name || cId,
      shortName: makeTeamShortName(cObj),
      color: getTeamColor(cId),
      image: ''
    };
  });

  const usedCodes = new Set();
  const driversList = activeDriverIds.map((dId, idx) => {
    const dObj = driverById.get(dId) || { id: dId, name: dId, fullName: dId };
    const tMap = seasonDriverTeamCounts.get(dId);
    const sortedTeams = Array.from(tMap.entries()).sort((a, b) => b[1] - a[1]);
    const primaryConstructorId = sortedTeams[0][0];
    const secondaryTeamIds = sortedTeams.slice(1).map((e) => `t_${e[0]}`);

    let code = makeDriverCode(dObj);
    if (usedCodes.has(code)) {
      const alt = (code.slice(0, 2) + ((idx % 9) + 1)).toUpperCase();
      code = alt;
    }
    usedCodes.add(code);

    const countryInfo = getCountryInfo(dObj.nationalityCountryId || dObj.countryOfBirthCountryId);
    const number = dObj.permanentNumber || seasonDriverNumbers.get(dId) || (idx + 1);
    const baseRating = computeDriverBaseRating(dObj);

    return {
      id: `d_${dId}`,
      name: dObj.name || dObj.fullName || `${dObj.firstName || ''} ${dObj.lastName || ''}`.trim(),
      code,
      number,
      teamId: `t_${primaryConstructorId}`,
      secondaryTeamIds,
      country: countryInfo.code,
      baseRating,
      image: ''
    };
  });

  let completedCount = 0;
  const tracks = yearRaces.map((r, rIdx) => {
    const cir = circuitById.get(r.circuitId) || { name: r.circuitId, placeName: '' };
    const gpObj = gpMap.get(r.grandPrixId);
    const countryInfo = getCountryInfo(r.countryId || (gpObj && gpObj.countryId) || cir.countryId);
    const rawRes = (resultsByRaceId.get(r.id) || []).sort((a, b) => (a.positionDisplayOrder || 999) - (b.positionDisplayOrder || 999));
    const rawSprint = (sprintsByRaceId.get(r.id) || []).sort((a, b) => (a.positionDisplayOrder || 999) - (b.positionDisplayOrder || 999));

    const seenDrivers = new Set();
    const raceOrder = [];
    const dnfDriverIds = [];
    const driverStatuses = {};
    const driverTeams = {};
    let poleDriverId = '';
    let fastestLapDriverId = '';

    for (const row of rawRes) {
      if (!activeDriverSet.has(row.driverId)) continue;
      const internalDriverId = `d_${row.driverId}`;
      const internalTeamId = `t_${row.constructorId}`;

      if (row.polePosition && !poleDriverId) {
        poleDriverId = internalDriverId;
      }
      if (row.fastestLap && !fastestLapDriverId) {
        fastestLapDriverId = internalDriverId;
      }

      if (!seenDrivers.has(internalDriverId)) {
        seenDrivers.add(internalDriverId);
        raceOrder.push(internalDriverId);
        driverTeams[internalDriverId] = internalTeamId;

        const isClassified = row.positionNumber !== null && row.positionNumber !== undefined;
        if (!isClassified) {
          dnfDriverIds.push(internalDriverId);
          const posTxt = String(row.positionText || '').toUpperCase().trim();
          if (posTxt === 'DSQ' || posTxt === 'EX') {
            driverStatuses[internalDriverId] = 'DSQ';
          } else if (posTxt === 'DNS' || posTxt === 'DNQ' || posTxt === 'DNPQ' || posTxt === 'DNP') {
            driverStatuses[internalDriverId] = 'DNS';
          } else {
            driverStatuses[internalDriverId] = 'DNF';
          }
        }
      }
    }

    // Detectar carreras históricas con mitad de puntos (50%), doble puntuación (200%) o suspendidas/acortadas
    let pointsMultiplier = 1;
    let suspensionNote = '';
    const isHalfPointsRace =
      (year === 1975 && (r.round === 4 || r.round === 12)) ||
      (year === 1984 && r.round === 6) ||
      (year === 1991 && r.round === 16) ||
      (year === 2009 && r.round === 2) ||
      (year === 2021 && r.round === 12);

    if (isHalfPointsRace) {
      pointsMultiplier = 0.5;
      const lapsInfo = r.laps && r.scheduledLaps ? ` (${r.laps}/${r.scheduledLaps} vueltas)` : '';
      if (year === 2021 && r.round === 12) {
        // En Bélgica 2021 se suspendió tras Safety Car por lluvia y no hubo punto de vuelta rápida
        fastestLapDriverId = '';
        suspensionNote = `🌧️ Suspendida por lluvia${lapsInfo} — Mitad de Puntos (50%)`;
      } else if (year === 1975 && r.round === 4) {
        suspensionNote = `🚩 Suspendida por accidente${lapsInfo} — Mitad de Puntos (50%)`;
      } else {
        suspensionNote = `🌧️ Suspendida por lluvia${lapsInfo} — Mitad de Puntos (50%)`;
      }
    } else if (year === 2014 && r.round === 19) {
      pointsMultiplier = 2;
      suspensionNote = '⚡ Puntuación Doble Oficial FIA (200%)';
    } else if (r.laps && r.scheduledLaps && r.laps < r.scheduledLaps) {
      suspensionNote = `🚩 Carrera acortada (${r.laps}/${r.scheduledLaps} vueltas — 100% puntos)`;
    }

    const sprintOrder = [];
    const seenSprint = new Set();
    for (const sRow of rawSprint) {
      if (!activeDriverSet.has(sRow.driverId)) continue;
      const internalDriverId = `d_${sRow.driverId}`;
      if (!seenSprint.has(internalDriverId)) {
        seenSprint.add(internalDriverId);
        sprintOrder.push(internalDriverId);
      }
    }

    const isCompleted = raceOrder.length > 0;
    if (isCompleted) completedCount++;

    const catKey = CIRCUIT_TO_CATKEY[r.circuitId] || r.circuitId;
    const gpName = GRAND_PRIX_NAMES_ES[r.grandPrixId]
      || (gpObj ? `GP de ${gpObj.name}` : `GP #${r.round}`);

    return {
      id: `r_${r.round}`,
      round: r.round,
      name: gpName,
      country: countryInfo.name,
      circuit: `${cir.fullName || cir.name}${cir.placeName ? `, ${cir.placeName}` : ''}`,
      catKey,
      color: PALETTE_FALLBACK[rIdx % PALETTE_FALLBACK.length],
      hasSprint: sprintOrder.length > 0 || Boolean(r.sprintQualifyingFormat),
      pointsMultiplier,
      suspensionNote,
      completed: isCompleted,
      image: '',
      results: isCompleted
        ? {
            poleDriverId,
            fastestLapDriverId,
            raceOrder,
            dnfDriverIds,
            driverStatuses,
            sprintOrder,
            driverTeams
          }
        : {
            poleDriverId: '',
            fastestLapDriverId: '',
            raceOrder: [],
            dnfDriverIds: [],
            driverStatuses: {},
            sprintOrder: [],
            driverTeams: {}
          }
    };
  });

  const seasonState = {
    meta: {
      championshipName: `Campeonato Mundial de Fórmula 1 ${year}`,
      seasonYear: String(year),
      updatedAt: new Date().toISOString()
    },
    pointsSystem,
    teams,
    drivers: driversList,
    tracks
  };

  fs.writeFileSync(
    path.join(SEASONS_DIR, `season_${year}.json`),
    JSON.stringify(seasonState)
  );

  const champDS = championDriverByYear.get(year);
  const champDriverObj = champDS ? driverById.get(champDS.driverId) : null;
  const champCS = championConstructorByYear.get(year);
  const champTeamObj = champCS ? constructorById.get(champCS.constructorId) : null;

  const decade = `${Math.floor(year / 10) * 10}s`;
  seasonsSummary.push({
    year,
    decade,
    raceCount: tracks.length,
    completedCount,
    driverCount: driversList.length,
    teamCount: teams.length,
    pointsSystemLabel: pointsLabel,
    championDriver: champDriverObj
      ? {
          id: `d_${champDriverObj.id}`,
          name: champDriverObj.name || champDriverObj.fullName,
          country: getCountryInfo(champDriverObj.nationalityCountryId).code,
          points: champDS.points
        }
      : { id: '', name: '—', country: 'INT', points: 0 },
    championTeam: champTeamObj
      ? {
          id: `t_${champTeamObj.id}`,
          name: champTeamObj.fullName || champTeamObj.name,
          color: getTeamColor(champTeamObj.id),
          points: champCS.points
        }
      : {
          id: '',
          name: year < 1958 ? 'Sin Copa Constructores (<1958)' : '—',
          color: '#64748B',
          points: 0
        }
  });
}

seasonsSummary.sort((a, b) => b.year - a.year);

// Construir catálogo histórico completo de Pilotos (los 920 pilotos de la historia de F1DB)
const catalogDrivers = drivers
  .map((d) => {
    const dy = driverYears.get(d.id) || {
      first: d.dateOfBirth ? parseInt(d.dateOfBirth.slice(0, 4), 10) + 22 : 1950,
      last: d.dateOfBirth ? parseInt(d.dateOfBirth.slice(0, 4), 10) + 25 : 1950
    };
    const tcMap = driverPrimaryConstructorCounts.get(d.id);
    let primaryConstructorId = 'ferrari';
    if (tcMap && tcMap.size > 0) {
      primaryConstructorId = Array.from(tcMap.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }
    const cObj = constructorById.get(primaryConstructorId);
    const nMap = driverMostCommonNumber.get(d.id);
    let favNum = d.permanentNumber || 0;
    if (!favNum && nMap && nMap.size > 0) {
      favNum = Array.from(nMap.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }
    if (!favNum) favNum = (hashString(d.id) % 88) + 2;

    const countryInfo = getCountryInfo(d.nationalityCountryId || d.countryOfBirthCountryId);

    return {
      id: `d_${d.id}`,
      f1dbId: d.id,
      name: d.name || d.fullName,
      code: makeDriverCode(d),
      number: favNum,
      country: countryInfo.code,
      countryName: countryInfo.name,
      dateOfBirth: d.dateOfBirth || '',
      placeOfBirth: d.placeOfBirth || '',
      baseRating: computeDriverBaseRating(d),
      titles: d.totalChampionshipWins || 0,
      wins: d.totalRaceWins || 0,
      podiums: d.totalPodiums || 0,
      poles: d.totalPolePositions || 0,
      fastestLaps: d.totalFastestLaps || 0,
      starts: d.totalRaceStarts || 0,
      entries: d.totalRaceEntries || 0,
      points: Math.round((d.totalPoints || 0) * 100) / 100,
      firstYear: dy.first,
      lastYear: dy.last,
      primaryTeamId: `t_${primaryConstructorId}`,
      primaryTeamName: cObj ? (cObj.fullName || cObj.name) : primaryConstructorId,
      primaryColor: getTeamColor(primaryConstructorId)
    };
  })
  .sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    if (b.points !== a.points) return b.points - a.points;
    if (b.starts !== a.starts) return b.starts - a.starts;
    return b.entries - a.entries;
  });

// Construir catálogo histórico completo de Escuderías / Constructores (los 187 constructores de F1DB)
const catalogConstructors = constructors
  .map((c) => {
    const ty = constructorYears.get(c.id) || { first: 1950, last: 1950 };
    const countryInfo = getCountryInfo(c.countryId);
    return {
      id: `t_${c.id}`,
      f1dbId: c.id,
      name: c.fullName || c.name,
      shortName: makeTeamShortName(c),
      color: getTeamColor(c.id),
      country: countryInfo.code,
      countryName: countryInfo.name,
      titles: c.totalChampionshipWins || 0,
      wins: c.totalRaceWins || 0,
      podiums: c.totalPodiums || 0,
      poles: c.totalPolePositions || 0,
      fastestLaps: c.totalFastestLaps || 0,
      starts: c.totalRaceStarts || 0,
      entries: c.totalRaceEntries || 0,
      points: Math.round((c.totalPoints || 0) * 100) / 100,
      firstYear: ty.first,
      lastYear: ty.last
    };
  })
  .sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    if (b.points !== a.points) return b.points - a.points;
    return b.starts - a.starts;
  });

// Construir catálogo histórico completo de Circuitos (los 78 circuitos de 1950–2026)
const catalogCircuits = circuits
  .map((c, idx) => {
    const cy = circuitYears.get(c.id) || { first: 1950, last: 2026 };
    const countryInfo = getCountryInfo(c.countryId);
    return {
      id: `c_${c.id}`,
      f1dbId: c.id,
      name: c.fullName || c.name,
      shortName: c.name,
      placeName: c.placeName || '',
      country: countryInfo.name,
      countryCode: countryInfo.code,
      lengthKm: c.length || 0,
      turns: c.turns || 0,
      type: c.type || 'RACE',
      direction: c.direction || 'CLOCKWISE',
      totalRacesHeld: c.totalRacesHeld || 0,
      firstYear: cy.first,
      lastYear: cy.last,
      catKey: CIRCUIT_TO_CATKEY[c.id] || c.id,
      color: PALETTE_FALLBACK[idx % PALETTE_FALLBACK.length]
    };
  })
  .sort((a, b) => b.totalRacesHeld - a.totalRacesHeld);

const masterCatalog = {
  generatedAt: new Date().toISOString(),
  stats: {
    totalSeasons: seasonsSummary.length,
    totalDrivers: catalogDrivers.length,
    totalConstructors: catalogConstructors.length,
    totalCircuits: catalogCircuits.length,
    totalRaces: races.length
  },
  seasons: seasonsSummary,
  drivers: catalogDrivers,
  constructors: catalogConstructors,
  circuits: catalogCircuits
};

const catalogPath = path.join(OUT_DIR, 'catalog_1950_2026.json');
fs.writeFileSync(catalogPath, JSON.stringify(masterCatalog));

// También escribir un bundle JS ligero con el catálogo para que esté disponible instantáneamente en window.F1HistoricalCatalog
const jsCatalogContent = `// Catálogo Maestro Histórico F1 (1950–2026) — Generado desde F1DB Oficial\nwindow.F1HistoricalCatalog = ${JSON.stringify(masterCatalog)};\n`;
fs.writeFileSync(path.join(ROOT, 'src', 'historical_catalog.js'), jsCatalogContent);

// Escribir bundle con las 77 temporadas pre-empaquetadas para carga instantánea en navegador y WebView
const seasonsBundle = {};
for (const y of allYears) {
  const sFile = path.join(SEASONS_DIR, `season_${y}.json`);
  if (fs.existsSync(sFile)) {
    seasonsBundle[y] = JSON.parse(fs.readFileSync(sFile, 'utf8'));
  }
}
fs.writeFileSync(
  path.join(ROOT, 'src', 'historical_seasons_bundle.js'),
  `// Bundle de las 77 Temporadas Históricas F1 (1950–2026)\nwindow.F1HistoricalSeasons = ${JSON.stringify(seasonsBundle)};\n`
);

// Eliminar el zip temporal si existe
const zipFile = path.join(RAW_DIR, 'f1db.zip');
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

console.log('¡Base de datos histórica y catálogo JS generados con éxito!');
console.log(masterCatalog.stats);
