/**
 * Capa de Datos, Presets de Reglamento y Generadores Visuales SVG
 * Championship Studio — Temporada 2026 (datos públicos de resultados)
 */

const STORAGE_KEY = 'f1_championship_studio_state_2026_v4';
const IDB_NAME = 'F1ChampionshipStudioDB';
const IDB_STORE = 'championship_state';

// Presets de sistemas de puntos históricos y actuales de la F1
const POINTS_PRESETS = {
  f1_2025: {
    name: 'F1 Actual (2025–2026) — Sin pto. Vuelta Rápida + Sprint',
    racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
    fastestLapPoints: 0,
    fastestLapTopLimit: 10,
    polePoints: 0
  },
  f1_2022: {
    name: 'F1 (2019–2024) — Con +1 pto. Vuelta Rápida (Top 10) + Sprint',
    racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
    fastestLapPoints: 1,
    fastestLapTopLimit: 10,
    polePoints: 0
  },
  f1_2003: {
    name: 'F1 Clásico (2003–2009) — Top 8 (10-8-6-5-4-3-2-1)',
    racePoints: [10, 8, 6, 5, 4, 3, 2, 1],
    sprintPoints: [],
    fastestLapPoints: 0,
    fastestLapTopLimit: 10,
    polePoints: 0
  },
  f1_1991: {
    name: 'F1 Retro (1991–2002) — Top 6 (10-6-4-3-2-1)',
    racePoints: [10, 6, 4, 3, 2, 1],
    sprintPoints: [],
    fastestLapPoints: 0,
    fastestLapTopLimit: 6,
    polePoints: 0
  },
  f1_1961: {
    name: 'F1 Era Dorada (1961–1990) — Top 6 (9-6-4-3-2-1)',
    racePoints: [9, 6, 4, 3, 2, 1],
    sprintPoints: [],
    fastestLapPoints: 0,
    fastestLapTopLimit: 6,
    polePoints: 0
  },
  f1_1950: {
    name: 'F1 Orígenes (1950–1959) — Top 5 (8-6-4-3-2) + 1 VR',
    racePoints: [8, 6, 4, 3, 2],
    sprintPoints: [],
    fastestLapPoints: 1,
    fastestLapTopLimit: 20,
    polePoints: 0
  }
};

function createHelmetSvg(primaryColor, accentColor, driverNumber) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primaryColor}" />
        <stop offset="100%" stop-color="#0d1017" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="26" fill="url(#bg)" />
    <circle cx="60" cy="60" r="44" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-opacity="0.35" />
    <path d="M26 70 C24 40, 48 22, 74 26 C94 29, 100 48, 96 74 L78 86 L34 86 Z" fill="${primaryColor}" stroke="#ffffff" stroke-width="2.5"/>
    <path d="M52 44 L95 48 L93 64 L52 60 Z" fill="#111827" stroke="${accentColor}" stroke-width="2"/>
    <path d="M30 74 L88 74 L82 82 L32 82 Z" fill="${accentColor}" />
    <text x="53" y="40" font-family="system-ui, sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle">${driverNumber}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createTeamSvg(teamColor, shortCode) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <rect width="120" height="120" rx="24" fill="#121621" />
    <path d="M60 14 L102 30 L102 64 C102 88, 60 106, 60 106 C60 106, 18 88, 18 64 L18 30 Z" fill="${teamColor}" stroke="#ffffff" stroke-width="3" />
    <path d="M30 45 L90 45" stroke="rgba(255,255,255,0.35)" stroke-width="3" />
    <text x="60" y="73" font-family="system-ui, sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">${shortCode}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createTrackSvg(accentColor, variantIndex = 1) {
  const paths = [
    'M 22 76 C 18 45, 42 24, 65 32 C 85 38, 102 22, 100 52 C 98 80, 74 92, 54 84 C 38 78, 26 95, 22 76 Z',
    'M 20 55 L 48 25 L 88 28 C 105 32, 102 62, 82 66 L 64 68 L 52 92 L 24 85 Z',
    'M 25 35 C 50 18, 95 25, 96 55 C 97 85, 72 95, 58 76 C 46 60, 32 95, 20 75 C 12 60, 15 42, 25 35 Z',
    'M 18 68 L 36 30 L 62 38 L 88 22 L 102 50 L 78 88 L 42 84 Z'
  ];
  const chosen = paths[(variantIndex - 1) % paths.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <rect width="120" height="120" rx="22" fill="#0f131d" />
    <path d="${chosen}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="11" stroke-linejoin="round" stroke-linecap="round" />
    <path d="${chosen}" fill="none" stroke="${accentColor}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="36" cy="32" r="5" fill="#ffffff" stroke="#e10600" stroke-width="2.5" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const OFFICIAL_2026_TRACKS_DATA = [
  {
    "round": 1,
    "name": "GP de Australia",
    "country": "Australia",
    "circuit": "Albert Park, Melbourne",
    "catKey": "australia",
    "color": "#10b981",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_rus",
      "fastestLapDriverId": "d_ver",
      "raceOrder": [
        "d_rus",
        "d_ant",
        "d_lec",
        "d_ham",
        "d_nor",
        "d_ver",
        "d_bea",
        "d_lin",
        "d_bor",
        "d_gas",
        "d_oco",
        "d_alb",
        "d_law",
        "d_col",
        "d_sai",
        "d_per",
        "d_str",
        "d_alo",
        "d_bot",
        "d_had",
        "d_pia",
        "d_hul"
      ],
      "dnfDriverIds": [
        "d_str",
        "d_alo",
        "d_bot",
        "d_had",
        "d_pia",
        "d_hul"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_rus": "t_mer",
        "d_ant": "t_mer",
        "d_lec": "t_fer",
        "d_ham": "t_fer",
        "d_nor": "t_mcl",
        "d_ver": "t_rbr",
        "d_bea": "t_haa",
        "d_lin": "t_vrb",
        "d_bor": "t_aud",
        "d_gas": "t_alp",
        "d_oco": "t_haa",
        "d_alb": "t_wil",
        "d_law": "t_vrb",
        "d_col": "t_alp",
        "d_sai": "t_wil",
        "d_per": "t_cad",
        "d_str": "t_amr",
        "d_alo": "t_amr",
        "d_bot": "t_cad",
        "d_had": "t_rbr",
        "d_pia": "t_mcl",
        "d_hul": "t_aud"
      }
    }
  },
  {
    "round": 2,
    "name": "GP de China",
    "country": "China",
    "circuit": "Shanghai International Circuit",
    "catKey": "china",
    "color": "#ef4444",
    "hasSprint": true,
    "completed": true,
    "results": {
      "poleDriverId": "d_ant",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_ant",
        "d_rus",
        "d_ham",
        "d_lec",
        "d_bea",
        "d_gas",
        "d_law",
        "d_had",
        "d_sai",
        "d_col",
        "d_hul",
        "d_lin",
        "d_bot",
        "d_oco",
        "d_per",
        "d_ver",
        "d_alo",
        "d_str",
        "d_pia",
        "d_nor",
        "d_bor",
        "d_alb"
      ],
      "dnfDriverIds": [
        "d_ver",
        "d_alo",
        "d_str",
        "d_pia",
        "d_nor",
        "d_bor",
        "d_alb"
      ],
      "sprintOrder": [
        "d_rus",
        "d_lec",
        "d_ham",
        "d_nor",
        "d_ant",
        "d_pia",
        "d_law",
        "d_bea",
        "d_ver",
        "d_oco",
        "d_gas",
        "d_sai",
        "d_bor",
        "d_col",
        "d_had",
        "d_alb",
        "d_alo",
        "d_str",
        "d_per",
        "d_hul",
        "d_bot",
        "d_lin"
      ],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_rus": "t_mer",
        "d_ham": "t_fer",
        "d_lec": "t_fer",
        "d_bea": "t_haa",
        "d_gas": "t_alp",
        "d_law": "t_vrb",
        "d_had": "t_rbr",
        "d_sai": "t_wil",
        "d_col": "t_alp",
        "d_hul": "t_aud",
        "d_lin": "t_vrb",
        "d_bot": "t_cad",
        "d_oco": "t_haa",
        "d_per": "t_cad",
        "d_ver": "t_rbr",
        "d_alo": "t_amr",
        "d_str": "t_amr",
        "d_pia": "t_mcl",
        "d_nor": "t_mcl",
        "d_bor": "t_aud",
        "d_alb": "t_wil"
      }
    }
  },
  {
    "round": 3,
    "name": "GP de Japón",
    "country": "Japón",
    "circuit": "Suzuka Circuit",
    "catKey": "japan",
    "color": "#f43f5e",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_ant",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_ant",
        "d_pia",
        "d_lec",
        "d_rus",
        "d_nor",
        "d_ham",
        "d_gas",
        "d_ver",
        "d_law",
        "d_oco",
        "d_hul",
        "d_had",
        "d_bor",
        "d_lin",
        "d_sai",
        "d_col",
        "d_per",
        "d_alo",
        "d_bot",
        "d_alb",
        "d_str",
        "d_bea"
      ],
      "dnfDriverIds": [
        "d_str",
        "d_bea"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_pia": "t_mcl",
        "d_lec": "t_fer",
        "d_rus": "t_mer",
        "d_nor": "t_mcl",
        "d_ham": "t_fer",
        "d_gas": "t_alp",
        "d_ver": "t_rbr",
        "d_law": "t_vrb",
        "d_oco": "t_haa",
        "d_hul": "t_aud",
        "d_had": "t_rbr",
        "d_bor": "t_aud",
        "d_lin": "t_vrb",
        "d_sai": "t_wil",
        "d_col": "t_alp",
        "d_per": "t_cad",
        "d_alo": "t_amr",
        "d_bot": "t_cad",
        "d_alb": "t_wil",
        "d_str": "t_amr",
        "d_bea": "t_haa"
      }
    }
  },
  {
    "round": 4,
    "name": "GP de Miami",
    "country": "Estados Unidos",
    "circuit": "Miami International Autodrome",
    "catKey": "miami",
    "color": "#06b6d4",
    "hasSprint": true,
    "completed": true,
    "results": {
      "poleDriverId": "d_ant",
      "fastestLapDriverId": "d_nor",
      "raceOrder": [
        "d_ant",
        "d_nor",
        "d_pia",
        "d_rus",
        "d_ver",
        "d_ham",
        "d_col",
        "d_lec",
        "d_sai",
        "d_alb",
        "d_bea",
        "d_bor",
        "d_oco",
        "d_lin",
        "d_alo",
        "d_per",
        "d_str",
        "d_bot",
        "d_hul",
        "d_law",
        "d_gas",
        "d_had"
      ],
      "dnfDriverIds": [
        "d_hul",
        "d_law",
        "d_gas",
        "d_had"
      ],
      "sprintOrder": [
        "d_nor",
        "d_pia",
        "d_lec",
        "d_rus",
        "d_ver",
        "d_ant",
        "d_ham",
        "d_gas",
        "d_had",
        "d_col",
        "d_oco",
        "d_bea",
        "d_sai",
        "d_law",
        "d_alo",
        "d_per",
        "d_str",
        "d_alb",
        "d_bot",
        "d_hul",
        "d_lin",
        "d_bor"
      ],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_nor": "t_mcl",
        "d_pia": "t_mcl",
        "d_rus": "t_mer",
        "d_ver": "t_rbr",
        "d_ham": "t_fer",
        "d_col": "t_alp",
        "d_lec": "t_fer",
        "d_sai": "t_wil",
        "d_alb": "t_wil",
        "d_bea": "t_haa",
        "d_bor": "t_aud",
        "d_oco": "t_haa",
        "d_lin": "t_vrb",
        "d_alo": "t_amr",
        "d_per": "t_cad",
        "d_str": "t_amr",
        "d_bot": "t_cad",
        "d_hul": "t_aud",
        "d_law": "t_vrb",
        "d_gas": "t_alp",
        "d_had": "t_rbr"
      }
    }
  },
  {
    "round": 5,
    "name": "GP de Canadá",
    "country": "Canadá",
    "circuit": "Circuit Gilles-Villeneuve, Montreal",
    "catKey": "canada",
    "color": "#ef4444",
    "hasSprint": true,
    "completed": true,
    "results": {
      "poleDriverId": "d_rus",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_ant",
        "d_ham",
        "d_ver",
        "d_lec",
        "d_had",
        "d_col",
        "d_law",
        "d_gas",
        "d_sai",
        "d_bea",
        "d_pia",
        "d_hul",
        "d_bor",
        "d_oco",
        "d_str",
        "d_bot",
        "d_per",
        "d_nor",
        "d_rus",
        "d_alo",
        "d_alb",
        "d_lin"
      ],
      "dnfDriverIds": [
        "d_per",
        "d_nor",
        "d_rus",
        "d_alo",
        "d_alb",
        "d_lin"
      ],
      "sprintOrder": [
        "d_rus",
        "d_nor",
        "d_ant",
        "d_pia",
        "d_lec",
        "d_ham",
        "d_ver",
        "d_lin",
        "d_col",
        "d_sai",
        "d_law",
        "d_bor",
        "d_oco",
        "d_per",
        "d_hul",
        "d_str",
        "d_bot",
        "d_bea",
        "d_alb",
        "d_gas",
        "d_had",
        "d_alo"
      ],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_ham": "t_fer",
        "d_ver": "t_rbr",
        "d_lec": "t_fer",
        "d_had": "t_rbr",
        "d_col": "t_alp",
        "d_law": "t_vrb",
        "d_gas": "t_alp",
        "d_sai": "t_wil",
        "d_bea": "t_haa",
        "d_pia": "t_mcl",
        "d_hul": "t_aud",
        "d_bor": "t_aud",
        "d_oco": "t_haa",
        "d_str": "t_amr",
        "d_bot": "t_cad",
        "d_per": "t_cad",
        "d_nor": "t_mcl",
        "d_rus": "t_mer",
        "d_alo": "t_amr",
        "d_alb": "t_wil",
        "d_lin": "t_vrb"
      }
    }
  },
  {
    "round": 6,
    "name": "GP de Mónaco",
    "country": "Mónaco",
    "circuit": "Circuit de Monaco, Monte Carlo",
    "catKey": "monaco",
    "color": "#f59e0b",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_ant",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_ant",
        "d_ham",
        "d_had",
        "d_pia",
        "d_law",
        "d_lin",
        "d_gas",
        "d_alb",
        "d_oco",
        "d_alo",
        "d_bor",
        "d_rus",
        "d_hul",
        "d_col",
        "d_per",
        "d_sai",
        "d_lec",
        "d_str",
        "d_nor",
        "d_bea",
        "d_bot",
        "d_ver"
      ],
      "dnfDriverIds": [
        "d_sai",
        "d_lec",
        "d_str",
        "d_nor",
        "d_bea",
        "d_bot",
        "d_ver"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_ham": "t_fer",
        "d_had": "t_rbr",
        "d_pia": "t_mcl",
        "d_law": "t_vrb",
        "d_lin": "t_vrb",
        "d_gas": "t_alp",
        "d_alb": "t_wil",
        "d_oco": "t_haa",
        "d_alo": "t_amr",
        "d_bor": "t_aud",
        "d_rus": "t_mer",
        "d_hul": "t_aud",
        "d_col": "t_alp",
        "d_per": "t_cad",
        "d_sai": "t_wil",
        "d_lec": "t_fer",
        "d_str": "t_amr",
        "d_nor": "t_mcl",
        "d_bea": "t_haa",
        "d_bot": "t_cad",
        "d_ver": "t_rbr"
      }
    }
  },
  {
    "round": 7,
    "name": "GP de Barcelona-Cataluña",
    "country": "España",
    "circuit": "Circuit de Barcelona-Catalunya",
    "catKey": "barcelona",
    "color": "#eab308",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_rus",
      "fastestLapDriverId": "d_ham",
      "raceOrder": [
        "d_ham",
        "d_rus",
        "d_nor",
        "d_ver",
        "d_pia",
        "d_had",
        "d_gas",
        "d_law",
        "d_lin",
        "d_col",
        "d_bor",
        "d_sai",
        "d_oco",
        "d_per",
        "d_lec",
        "d_ant",
        "d_bea",
        "d_alb",
        "d_alo",
        "d_hul",
        "d_bot",
        "d_str"
      ],
      "dnfDriverIds": [
        "d_lec",
        "d_ant",
        "d_bea",
        "d_alb",
        "d_alo",
        "d_hul",
        "d_bot",
        "d_str"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ham": "t_fer",
        "d_rus": "t_mer",
        "d_nor": "t_mcl",
        "d_ver": "t_rbr",
        "d_pia": "t_mcl",
        "d_had": "t_rbr",
        "d_gas": "t_alp",
        "d_law": "t_vrb",
        "d_lin": "t_vrb",
        "d_col": "t_alp",
        "d_bor": "t_aud",
        "d_sai": "t_wil",
        "d_oco": "t_haa",
        "d_per": "t_cad",
        "d_lec": "t_fer",
        "d_ant": "t_mer",
        "d_bea": "t_haa",
        "d_alb": "t_wil",
        "d_alo": "t_amr",
        "d_hul": "t_aud",
        "d_bot": "t_cad",
        "d_str": "t_amr"
      }
    }
  },
  {
    "round": 8,
    "name": "GP de Austria",
    "country": "Austria",
    "circuit": "Red Bull Ring, Spielberg",
    "catKey": "austria",
    "color": "#ef4444",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_rus",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_rus",
        "d_ver",
        "d_ant",
        "d_pia",
        "d_ham",
        "d_had",
        "d_nor",
        "d_lec",
        "d_law",
        "d_lin",
        "d_bor",
        "d_hul",
        "d_gas",
        "d_bea",
        "d_col",
        "d_oco",
        "d_alb",
        "d_alo",
        "d_str",
        "d_sai",
        "d_per",
        "d_bot"
      ],
      "dnfDriverIds": [
        "d_str",
        "d_sai",
        "d_per",
        "d_bot"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_rus": "t_mer",
        "d_ver": "t_rbr",
        "d_ant": "t_mer",
        "d_pia": "t_mcl",
        "d_ham": "t_fer",
        "d_had": "t_rbr",
        "d_nor": "t_mcl",
        "d_lec": "t_fer",
        "d_law": "t_vrb",
        "d_lin": "t_vrb",
        "d_bor": "t_aud",
        "d_hul": "t_aud",
        "d_gas": "t_alp",
        "d_bea": "t_haa",
        "d_col": "t_alp",
        "d_oco": "t_haa",
        "d_alb": "t_wil",
        "d_alo": "t_amr",
        "d_str": "t_amr",
        "d_sai": "t_wil",
        "d_per": "t_cad",
        "d_bot": "t_cad"
      }
    }
  },
  {
    "round": 9,
    "name": "GP de Gran Bretaña",
    "country": "Reino Unido",
    "circuit": "Silverstone Circuit",
    "catKey": "britain",
    "color": "#3b82f6",
    "hasSprint": true,
    "completed": true,
    "results": {
      "poleDriverId": "d_ant",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_lec",
        "d_rus",
        "d_ham",
        "d_nor",
        "d_had",
        "d_law",
        "d_lin",
        "d_bor",
        "d_col",
        "d_gas",
        "d_pia",
        "d_bea",
        "d_oco",
        "d_per",
        "d_ant",
        "d_bot",
        "d_sai",
        "d_alo",
        "d_str",
        "d_ver",
        "d_alb",
        "d_hul"
      ],
      "dnfDriverIds": [
        "d_ver",
        "d_alb",
        "d_hul"
      ],
      "sprintOrder": [
        "d_ant",
        "d_ham",
        "d_nor",
        "d_rus",
        "d_lec",
        "d_ver",
        "d_pia",
        "d_law",
        "d_had",
        "d_lin",
        "d_gas",
        "d_col",
        "d_bor",
        "d_bea",
        "d_hul",
        "d_oco",
        "d_sai",
        "d_alb",
        "d_bot",
        "d_alo",
        "d_str",
        "d_per"
      ],
      "driverTeams": {
        "d_lec": "t_fer",
        "d_rus": "t_mer",
        "d_ham": "t_fer",
        "d_nor": "t_mcl",
        "d_had": "t_rbr",
        "d_law": "t_vrb",
        "d_lin": "t_vrb",
        "d_bor": "t_aud",
        "d_col": "t_alp",
        "d_gas": "t_alp",
        "d_pia": "t_mcl",
        "d_bea": "t_haa",
        "d_oco": "t_haa",
        "d_per": "t_cad",
        "d_ant": "t_mer",
        "d_bot": "t_cad",
        "d_sai": "t_wil",
        "d_alo": "t_amr",
        "d_str": "t_amr",
        "d_ver": "t_rbr",
        "d_alb": "t_wil",
        "d_hul": "t_aud"
      }
    }
  },
  {
    "round": 10,
    "name": "GP de Bélgica",
    "country": "Bélgica",
    "circuit": "Circuit de Spa-Francorchamps",
    "catKey": "belgium",
    "color": "#f59e0b",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_ant",
      "fastestLapDriverId": "d_nor",
      "raceOrder": [
        "d_ant",
        "d_lec",
        "d_ver",
        "d_ham",
        "d_pia",
        "d_had",
        "d_nor",
        "d_bor",
        "d_lin",
        "d_col",
        "d_gas",
        "d_law",
        "d_hul",
        "d_bea",
        "d_alb",
        "d_sai",
        "d_oco",
        "d_bot",
        "d_alo",
        "d_str",
        "d_per",
        "d_rus"
      ],
      "dnfDriverIds": [
        "d_str",
        "d_per",
        "d_rus"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_lec": "t_fer",
        "d_ver": "t_rbr",
        "d_ham": "t_fer",
        "d_pia": "t_mcl",
        "d_had": "t_rbr",
        "d_nor": "t_mcl",
        "d_bor": "t_aud",
        "d_lin": "t_vrb",
        "d_col": "t_alp",
        "d_gas": "t_alp",
        "d_law": "t_vrb",
        "d_hul": "t_aud",
        "d_bea": "t_haa",
        "d_alb": "t_wil",
        "d_sai": "t_wil",
        "d_oco": "t_haa",
        "d_bot": "t_cad",
        "d_alo": "t_amr",
        "d_str": "t_amr",
        "d_per": "t_cad",
        "d_rus": "t_mer"
      }
    }
  },
  {
    "round": 11,
    "name": "GP de Hungría",
    "country": "Hungría",
    "circuit": "Hungaroring, Budapest",
    "catKey": "hungary",
    "color": "#10b981",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_nor",
      "fastestLapDriverId": "d_lec",
      "raceOrder": [
        "d_nor",
        "d_ver",
        "d_ant",
        "d_lec",
        "d_ham",
        "d_had",
        "d_rus",
        "d_law",
        "d_hul",
        "d_lin",
        "d_bor",
        "d_gas",
        "d_str",
        "d_alo",
        "d_col",
        "d_oco",
        "d_alb",
        "d_sai",
        "d_bea",
        "d_pia",
        "d_per",
        "d_bot"
      ],
      "dnfDriverIds": [
        "d_pia",
        "d_per",
        "d_bot"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_nor": "t_mcl",
        "d_ver": "t_rbr",
        "d_ant": "t_mer",
        "d_lec": "t_fer",
        "d_ham": "t_fer",
        "d_had": "t_rbr",
        "d_rus": "t_mer",
        "d_law": "t_vrb",
        "d_hul": "t_aud",
        "d_lin": "t_vrb",
        "d_bor": "t_aud",
        "d_gas": "t_alp",
        "d_str": "t_amr",
        "d_alo": "t_amr",
        "d_col": "t_alp",
        "d_oco": "t_haa",
        "d_alb": "t_wil",
        "d_sai": "t_wil",
        "d_bea": "t_haa",
        "d_pia": "t_mcl",
        "d_per": "t_cad",
        "d_bot": "t_cad"
      }
    }
  },
  {
    "round": 12,
    "name": "GP de los Países Bajos",
    "country": "Países Bajos",
    "circuit": "Circuit Zandvoort",
    "catKey": "netherlands",
    "color": "#f97316",
    "hasSprint": true,
    "completed": true,
    "results": {
      "poleDriverId": "d_nor",
      "fastestLapDriverId": "d_lec",
      "raceOrder": [
        "d_nor",
        "d_ant",
        "d_rus",
        "d_ham",
        "d_lec",
        "d_pia",
        "d_law",
        "d_hul",
        "d_alo",
        "d_gas",
        "d_tsu",
        "d_lin",
        "d_bor",
        "d_col",
        "d_per",
        "d_sai",
        "d_alb",
        "d_bot",
        "d_oco",
        "d_str",
        "d_bea",
        "d_ver"
      ],
      "dnfDriverIds": [
        "d_alb",
        "d_bot",
        "d_oco",
        "d_str",
        "d_bea",
        "d_ver"
      ],
      "sprintOrder": [
        "d_rus",
        "d_lec",
        "d_nor",
        "d_ant",
        "d_pia",
        "d_ver",
        "d_ham",
        "d_gas",
        "d_bor",
        "d_lin",
        "d_law",
        "d_col",
        "d_tsu",
        "d_oco",
        "d_bea",
        "d_alb",
        "d_str",
        "d_alo",
        "d_bot",
        "d_sai",
        "d_per",
        "d_hul"
      ],
      "driverTeams": {
        "d_nor": "t_mcl",
        "d_ant": "t_mer",
        "d_rus": "t_mer",
        "d_ham": "t_fer",
        "d_lec": "t_fer",
        "d_pia": "t_mcl",
        "d_law": "t_rbr",
        "d_hul": "t_aud",
        "d_alo": "t_amr",
        "d_gas": "t_alp",
        "d_tsu": "t_vrb",
        "d_lin": "t_vrb",
        "d_bor": "t_aud",
        "d_col": "t_alp",
        "d_per": "t_cad",
        "d_sai": "t_wil",
        "d_alb": "t_wil",
        "d_bot": "t_cad",
        "d_oco": "t_haa",
        "d_str": "t_amr",
        "d_bea": "t_haa",
        "d_ver": "t_rbr"
      }
    }
  },
  {
    "round": 13,
    "name": "GP de Italia",
    "country": "Italia",
    "circuit": "Autodromo Nazionale Monza",
    "catKey": "monza",
    "color": "#22c55e",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_gas",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_ant",
        "d_rus",
        "d_ver",
        "d_nor",
        "d_pia",
        "d_ham",
        "d_gas",
        "d_lin",
        "d_col",
        "d_tsu",
        "d_bor",
        "d_hul",
        "d_sai",
        "d_law",
        "d_bea",
        "d_oco",
        "d_alb",
        "d_per",
        "d_bot",
        "d_str",
        "d_alo",
        "d_lec"
      ],
      "dnfDriverIds": [
        "d_str",
        "d_alo",
        "d_lec"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_rus": "t_mer",
        "d_ver": "t_rbr",
        "d_nor": "t_mcl",
        "d_pia": "t_mcl",
        "d_ham": "t_fer",
        "d_gas": "t_alp",
        "d_lin": "t_vrb",
        "d_col": "t_alp",
        "d_tsu": "t_vrb",
        "d_bor": "t_aud",
        "d_hul": "t_aud",
        "d_sai": "t_wil",
        "d_law": "t_rbr",
        "d_bea": "t_haa",
        "d_oco": "t_haa",
        "d_alb": "t_wil",
        "d_per": "t_cad",
        "d_bot": "t_cad",
        "d_str": "t_amr",
        "d_alo": "t_amr",
        "d_lec": "t_fer"
      }
    }
  },
  {
    "round": 14,
    "name": "GP de España (Madrid)",
    "country": "España",
    "circuit": "Circuito de Madring, Madrid",
    "catKey": "madrid",
    "color": "#eab308",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_nor",
      "fastestLapDriverId": "d_rus",
      "raceOrder": [
        "d_ant",
        "d_ver",
        "d_nor",
        "d_lec",
        "d_rus",
        "d_law",
        "d_col",
        "d_pia",
        "d_lin",
        "d_hul",
        "d_oco",
        "d_gas",
        "d_bor",
        "d_tsu",
        "d_alb",
        "d_bea",
        "d_alo",
        "d_bot",
        "d_sai",
        "d_per",
        "d_str",
        "d_ham"
      ],
      "dnfDriverIds": [
        "d_sai",
        "d_per",
        "d_str",
        "d_ham"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_ver": "t_rbr",
        "d_nor": "t_mcl",
        "d_lec": "t_fer",
        "d_rus": "t_mer",
        "d_law": "t_rbr",
        "d_col": "t_alp",
        "d_pia": "t_mcl",
        "d_lin": "t_vrb",
        "d_hul": "t_aud",
        "d_oco": "t_haa",
        "d_gas": "t_alp",
        "d_bor": "t_aud",
        "d_tsu": "t_vrb",
        "d_alb": "t_wil",
        "d_bea": "t_haa",
        "d_alo": "t_amr",
        "d_bot": "t_cad",
        "d_sai": "t_wil",
        "d_per": "t_cad",
        "d_str": "t_amr",
        "d_ham": "t_fer"
      }
    }
  },
  {
    "round": 15,
    "name": "GP de Azerbaiyán",
    "country": "Azerbaiyán",
    "circuit": "Baku City Circuit",
    "catKey": "baku",
    "color": "#38bdf8",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_rus",
      "fastestLapDriverId": "d_rus",
      "raceOrder": [
        "d_rus",
        "d_ver",
        "d_had",
        "d_lec",
        "d_ant",
        "d_ham",
        "d_lin",
        "d_oco",
        "d_bea",
        "d_sai",
        "d_hul",
        "d_law",
        "d_pia",
        "d_per",
        "d_bor",
        "d_bot",
        "d_col",
        "d_gas",
        "d_nor",
        "d_alb",
        "d_alo",
        "d_str"
      ],
      "dnfDriverIds": [
        "d_bot",
        "d_col",
        "d_gas",
        "d_nor",
        "d_alb",
        "d_alo",
        "d_str"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_rus": "t_mer",
        "d_ver": "t_rbr",
        "d_had": "t_rbr",
        "d_lec": "t_fer",
        "d_ant": "t_mer",
        "d_ham": "t_fer",
        "d_lin": "t_vrb",
        "d_oco": "t_haa",
        "d_bea": "t_haa",
        "d_sai": "t_wil",
        "d_hul": "t_aud",
        "d_law": "t_vrb",
        "d_pia": "t_mcl",
        "d_per": "t_cad",
        "d_bor": "t_aud",
        "d_bot": "t_cad",
        "d_col": "t_alp",
        "d_gas": "t_alp",
        "d_nor": "t_mcl",
        "d_alb": "t_wil",
        "d_alo": "t_amr",
        "d_str": "t_amr"
      }
    }
  },
  {
    "round": 16,
    "name": "GP de Baréin",
    "country": "Baréin",
    "circuit": "Bahrain International Circuit, Sakhir",
    "catKey": "bahrain",
    "color": "#e10600",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_ver",
      "fastestLapDriverId": "d_ver",
      "raceOrder": [
        "d_ver",
        "d_ant",
        "d_ham",
        "d_lec",
        "d_had",
        "d_pia",
        "d_law",
        "d_alo",
        "d_nor",
        "d_lin",
        "d_hul",
        "d_str",
        "d_col",
        "d_bea",
        "d_oco",
        "d_gas",
        "d_sai",
        "d_bor",
        "d_per",
        "d_rus",
        "d_alb",
        "d_bot"
      ],
      "dnfDriverIds": [
        "d_rus",
        "d_alb",
        "d_bot"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ver": "t_rbr",
        "d_ant": "t_mer",
        "d_ham": "t_fer",
        "d_lec": "t_fer",
        "d_had": "t_rbr",
        "d_pia": "t_mcl",
        "d_law": "t_vrb",
        "d_alo": "t_amr",
        "d_nor": "t_mcl",
        "d_lin": "t_vrb",
        "d_hul": "t_aud",
        "d_str": "t_amr",
        "d_col": "t_alp",
        "d_bea": "t_haa",
        "d_oco": "t_haa",
        "d_gas": "t_alp",
        "d_sai": "t_wil",
        "d_bor": "t_aud",
        "d_per": "t_cad",
        "d_rus": "t_mer",
        "d_alb": "t_wil",
        "d_bot": "t_cad"
      }
    }
  },
  {
    "round": 17,
    "name": "GP de Singapur",
    "country": "Singapur",
    "circuit": "Marina Bay Street Circuit",
    "catKey": "singapore",
    "color": "#a855f7",
    "hasSprint": true,
    "completed": true,
    "results": {
      "poleDriverId": "d_ver",
      "fastestLapDriverId": "d_lec",
      "raceOrder": [
        "d_ver",
        "d_lec",
        "d_ant",
        "d_nor",
        "d_pia",
        "d_ham",
        "d_law",
        "d_hul",
        "d_rus",
        "d_had",
        "d_gas",
        "d_bea",
        "d_oco",
        "d_sai",
        "d_lin",
        "d_alo",
        "d_per",
        "d_alb",
        "d_bot",
        "d_str",
        "d_col",
        "d_bor"
      ],
      "dnfDriverIds": [
        "d_alb",
        "d_str",
        "d_col",
        "d_bor"
      ],
      "sprintOrder": [
        "d_ver",
        "d_ham",
        "d_lec",
        "d_ant",
        "d_law",
        "d_bea",
        "d_hul",
        "d_nor",
        "d_gas",
        "d_oco",
        "d_alo",
        "d_sai",
        "d_lin",
        "d_pia",
        "d_alb",
        "d_bor",
        "d_bot",
        "d_had",
        "d_col",
        "d_rus",
        "d_per",
        "d_str"
      ],
      "driverTeams": {
        "d_ver": "t_rbr",
        "d_lec": "t_fer",
        "d_ant": "t_mer",
        "d_nor": "t_mcl",
        "d_pia": "t_mcl",
        "d_ham": "t_fer",
        "d_law": "t_vrb",
        "d_hul": "t_aud",
        "d_rus": "t_mer",
        "d_had": "t_rbr",
        "d_gas": "t_alp",
        "d_bea": "t_haa",
        "d_oco": "t_haa",
        "d_sai": "t_wil",
        "d_lin": "t_vrb",
        "d_alo": "t_amr",
        "d_per": "t_cad",
        "d_alb": "t_wil",
        "d_bot": "t_cad",
        "d_str": "t_amr",
        "d_col": "t_alp",
        "d_bor": "t_aud"
      }
    }
  },
  {
    "round": 18,
    "name": "GP de Estados Unidos",
    "country": "Estados Unidos",
    "circuit": "Circuit of the Americas, Austin",
    "catKey": "austin",
    "color": "#3b82f6",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_ant",
      "fastestLapDriverId": "d_lec",
      "raceOrder": [
        "d_ant",
        "d_lec",
        "d_ver",
        "d_ham",
        "d_nor",
        "d_had",
        "d_pia",
        "d_rus",
        "d_law",
        "d_gas",
        "d_hul",
        "d_lin",
        "d_bor",
        "d_oco",
        "d_str",
        "d_alo",
        "d_alb",
        "d_sai",
        "d_per",
        "d_bot",
        "d_col",
        "d_bea"
      ],
      "dnfDriverIds": [
        "d_bot",
        "d_col",
        "d_bea"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ant": "t_mer",
        "d_lec": "t_fer",
        "d_ver": "t_rbr",
        "d_ham": "t_fer",
        "d_nor": "t_mcl",
        "d_had": "t_rbr",
        "d_pia": "t_mcl",
        "d_rus": "t_mer",
        "d_law": "t_vrb",
        "d_gas": "t_alp",
        "d_hul": "t_aud",
        "d_lin": "t_vrb",
        "d_bor": "t_aud",
        "d_oco": "t_haa",
        "d_str": "t_amr",
        "d_alo": "t_amr",
        "d_alb": "t_wil",
        "d_sai": "t_wil",
        "d_per": "t_cad",
        "d_bot": "t_cad",
        "d_col": "t_alp",
        "d_bea": "t_haa"
      }
    }
  },
  {
    "round": 19,
    "name": "GP de Ciudad de México",
    "country": "México",
    "circuit": "Autódromo Hermanos Rodríguez",
    "catKey": "mexico",
    "color": "#10b981",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_ham",
      "fastestLapDriverId": "d_ham",
      "raceOrder": [
        "d_ver",
        "d_ham",
        "d_ant",
        "d_lec",
        "d_nor",
        "d_rus",
        "d_law",
        "d_bor",
        "d_had",
        "d_hir",
        "d_alb",
        "d_sai",
        "d_pia",
        "d_hul",
        "d_col",
        "d_per",
        "d_gas",
        "d_lin",
        "d_bea",
        "d_bot",
        "d_str",
        "d_alo"
      ],
      "dnfDriverIds": [
        "d_lin",
        "d_bea",
        "d_bot",
        "d_str",
        "d_alo"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_ver": "t_rbr",
        "d_ham": "t_fer",
        "d_ant": "t_mer",
        "d_lec": "t_fer",
        "d_nor": "t_mcl",
        "d_rus": "t_mer",
        "d_law": "t_vrb",
        "d_bor": "t_aud",
        "d_had": "t_rbr",
        "d_hir": "t_haa",
        "d_alb": "t_wil",
        "d_sai": "t_wil",
        "d_pia": "t_mcl",
        "d_hul": "t_aud",
        "d_col": "t_alp",
        "d_per": "t_cad",
        "d_gas": "t_alp",
        "d_lin": "t_vrb",
        "d_bea": "t_haa",
        "d_bot": "t_cad",
        "d_str": "t_amr",
        "d_alo": "t_amr"
      }
    }
  },
  {
    "round": 20,
    "name": "GP de São Paulo",
    "country": "Brasil",
    "circuit": "Autódromo José Carlos Pace, Interlagos",
    "catKey": "brazil",
    "color": "#eab308",
    "hasSprint": false,
    "completed": true,
    "results": {
      "poleDriverId": "d_nor",
      "fastestLapDriverId": "d_ant",
      "raceOrder": [
        "d_nor",
        "d_ver",
        "d_had",
        "d_rus",
        "d_ant",
        "d_pia",
        "d_lec",
        "d_law",
        "d_ham",
        "d_hul",
        "d_lin",
        "d_alo",
        "d_col",
        "d_gas",
        "d_alb",
        "d_bor",
        "d_bea",
        "d_per",
        "d_sai",
        "d_cam",
        "d_str",
        "d_bot"
      ],
      "dnfDriverIds": [
        "d_str",
        "d_bot"
      ],
      "sprintOrder": [],
      "driverTeams": {
        "d_nor": "t_mcl",
        "d_ver": "t_rbr",
        "d_had": "t_rbr",
        "d_rus": "t_mer",
        "d_ant": "t_mer",
        "d_pia": "t_mcl",
        "d_lec": "t_fer",
        "d_law": "t_vrb",
        "d_ham": "t_fer",
        "d_hul": "t_aud",
        "d_lin": "t_vrb",
        "d_alo": "t_amr",
        "d_col": "t_alp",
        "d_gas": "t_alp",
        "d_alb": "t_wil",
        "d_bor": "t_aud",
        "d_bea": "t_haa",
        "d_per": "t_cad",
        "d_sai": "t_wil",
        "d_cam": "t_haa",
        "d_str": "t_amr",
        "d_bot": "t_cad"
      }
    }
  },
  {
    "round": 21,
    "name": "GP de Las Vegas",
    "country": "Estados Unidos",
    "circuit": "Las Vegas Strip Circuit",
    "catKey": "vegas",
    "color": "#ec4899",
    "hasSprint": false,
    "completed": false,
    "results": {
      "poleDriverId": "",
      "fastestLapDriverId": "",
      "raceOrder": [],
      "dnfDriverIds": [],
      "sprintOrder": [],
      "driverTeams": {}
    }
  },
  {
    "round": 22,
    "name": "GP de Catar",
    "country": "Catar",
    "circuit": "Lusail International Circuit",
    "catKey": "qatar",
    "color": "#8b5cf6",
    "hasSprint": false,
    "completed": false,
    "results": {
      "poleDriverId": "",
      "fastestLapDriverId": "",
      "raceOrder": [],
      "dnfDriverIds": [],
      "sprintOrder": [],
      "driverTeams": {}
    }
  },
  {
    "round": 23,
    "name": "GP de Abu Dabi",
    "country": "Emiratos Árabes",
    "circuit": "Yas Marina Circuit",
    "catKey": "abudhabi",
    "color": "#06b6d4",
    "hasSprint": false,
    "completed": false,
    "results": {
      "poleDriverId": "",
      "fastestLapDriverId": "",
      "raceOrder": [],
      "dnfDriverIds": [],
      "sprintOrder": [],
      "driverTeams": {}
    }
  }
];

function createDemoChampionship(startAtZero = false) {
  const teams = [
    { id: 't_mer', name: 'Mercedes-AMG Petronas', shortName: 'MER', color: '#27F4D2', image: createTeamSvg('#27F4D2', 'MER') },
    { id: 't_fer', name: 'Scuderia Ferrari HP', shortName: 'FER', color: '#E80020', image: createTeamSvg('#E80020', 'FER') },
    { id: 't_rbr', name: 'Oracle Red Bull Racing', shortName: 'RBR', color: '#3671C6', image: createTeamSvg('#3671C6', 'RBR') },
    { id: 't_mcl', name: 'McLaren Formula 1 Team', shortName: 'MCL', color: '#FF8000', image: createTeamSvg('#FF8000', 'MCL') },
    { id: 't_vrb', name: 'Visa Cash App Racing Bulls', shortName: 'VRB', color: '#6692FF', image: createTeamSvg('#6692FF', 'VRB') },
    { id: 't_alp', name: 'BWT Alpine F1 Team', shortName: 'ALP', color: '#FF87BC', image: createTeamSvg('#FF87BC', 'ALP') },
    { id: 't_haa', name: 'MoneyGram Haas F1 Team', shortName: 'HAA', color: '#B6BABD', image: createTeamSvg('#B6BABD', 'HAA') },
    { id: 't_aud', name: 'Audi F1 Team', shortName: 'AUD', color: '#F50537', image: createTeamSvg('#F50537', 'AUD') },
    { id: 't_wil', name: 'Atlassian Williams Racing', shortName: 'WIL', color: '#64C4FF', image: createTeamSvg('#64C4FF', 'WIL') },
    { id: 't_amr', name: 'Aston Martin Aramco', shortName: 'AMR', color: '#229971', image: createTeamSvg('#229971', 'AMR') },
    { id: 't_cad', name: 'Cadillac Formula 1 Team', shortName: 'CAD', color: '#E5C158', image: createTeamSvg('#E5C158', 'CAD') }
  ];

  // Parrilla oficial 2026 completa (incluyendo rotaciones/reemplazos reales de la temporada)
  const drivers = [
    { id: 'd_ant', name: 'Kimi Antonelli', code: 'ANT', number: 12, teamId: 't_mer', secondaryTeamIds: [], country: 'ITA', baseRating: 96, image: createHelmetSvg('#27F4D2', '#00a19c', '12') },
    { id: 'd_ver', name: 'Max Verstappen', code: 'VER', number: 3, teamId: 't_rbr', secondaryTeamIds: [], country: 'NED', baseRating: 95, image: createHelmetSvg('#3671C6', '#ef4444', '3') },
    { id: 'd_rus', name: 'George Russell', code: 'RUS', number: 63, teamId: 't_mer', secondaryTeamIds: [], country: 'GBR', baseRating: 94, image: createHelmetSvg('#27F4D2', '#111827', '63') },
    { id: 'd_ham', name: 'Lewis Hamilton', code: 'HAM', number: 44, teamId: 't_fer', secondaryTeamIds: [], country: 'GBR', baseRating: 94, image: createHelmetSvg('#E80020', '#a855f7', '44') },
    { id: 'd_lec', name: 'Charles Leclerc', code: 'LEC', number: 16, teamId: 't_fer', secondaryTeamIds: [], country: 'MON', baseRating: 94, image: createHelmetSvg('#E80020', '#ffffff', '16') },
    { id: 'd_nor', name: 'Lando Norris', code: 'NOR', number: 1, teamId: 't_mcl', secondaryTeamIds: [], country: 'GBR', baseRating: 94, image: createHelmetSvg('#FF8000', '#d9f99d', '1') },
    { id: 'd_pia', name: 'Oscar Piastri', code: 'PIA', number: 81, teamId: 't_mcl', secondaryTeamIds: [], country: 'AUS', baseRating: 91, image: createHelmetSvg('#FF8000', '#38bdf8', '81') },
    { id: 'd_had', name: 'Isack Hadjar', code: 'HAD', number: 6, teamId: 't_rbr', secondaryTeamIds: [], country: 'FRA', baseRating: 89, image: createHelmetSvg('#3671C6', '#facc15', '6') },
    { id: 'd_law', name: 'Liam Lawson', code: 'LAW', number: 30, teamId: 't_vrb', secondaryTeamIds: ['t_rbr'], country: 'NZL', baseRating: 88, image: createHelmetSvg('#6692FF', '#ffffff', '30') },
    { id: 'd_gas', name: 'Pierre Gasly', code: 'GAS', number: 10, teamId: 't_alp', secondaryTeamIds: [], country: 'FRA', baseRating: 86, image: createHelmetSvg('#FF87BC', '#3b82f6', '10') },
    { id: 'd_lin', name: 'Arvid Lindblad', code: 'LIN', number: 41, teamId: 't_vrb', secondaryTeamIds: [], country: 'GBR', baseRating: 85, image: createHelmetSvg('#6692FF', '#facc15', '41') },
    { id: 'd_col', name: 'Franco Colapinto', code: 'COL', number: 43, teamId: 't_alp', secondaryTeamIds: [], country: 'ARG', baseRating: 85, image: createHelmetSvg('#FF87BC', '#38bdf8', '43') },
    { id: 'd_bea', name: 'Oliver Bearman', code: 'BEA', number: 87, teamId: 't_haa', secondaryTeamIds: [], country: 'GBR', baseRating: 84, image: createHelmetSvg('#B6BABD', '#ef4444', '87') },
    { id: 'd_bor', name: 'Gabriel Bortoleto', code: 'BOR', number: 5, teamId: 't_aud', secondaryTeamIds: [], country: 'BRA', baseRating: 83, image: createHelmetSvg('#F50537', '#22c55e', '5') },
    { id: 'd_hul', name: 'Nico Hülkenberg', code: 'HUL', number: 27, teamId: 't_aud', secondaryTeamIds: [], country: 'GER', baseRating: 83, image: createHelmetSvg('#F50537', '#ffffff', '27') },
    { id: 'd_oco', name: 'Esteban Ocon', code: 'OCO', number: 31, teamId: 't_haa', secondaryTeamIds: [], country: 'FRA', baseRating: 82, image: createHelmetSvg('#B6BABD', '#dc2626', '31') },
    { id: 'd_alo', name: 'Fernando Alonso', code: 'ALO', number: 14, teamId: 't_amr', secondaryTeamIds: [], country: 'ESP', baseRating: 83, image: createHelmetSvg('#229971', '#facc15', '14') },
    { id: 'd_sai', name: 'Carlos Sainz', code: 'SAI', number: 55, teamId: 't_wil', secondaryTeamIds: [], country: 'ESP', baseRating: 83, image: createHelmetSvg('#64C4FF', '#ef4444', '55') },
    { id: 'd_alb', name: 'Alexander Albon', code: 'ALB', number: 23, teamId: 't_wil', secondaryTeamIds: [], country: 'THA', baseRating: 82, image: createHelmetSvg('#64C4FF', '#f8fafc', '23') },
    { id: 'd_tsu', name: 'Yuki Tsunoda', code: 'TSU', number: 22, teamId: 't_vrb', secondaryTeamIds: [], country: 'JPN', baseRating: 80, image: createHelmetSvg('#6692FF', '#ef4444', '22') },
    { id: 'd_hir', name: 'Ryo Hirakawa', code: 'HIR', number: 50, teamId: 't_haa', secondaryTeamIds: [], country: 'JPN', baseRating: 79, image: createHelmetSvg('#B6BABD', '#ef4444', '50') },
    { id: 'd_str', name: 'Lance Stroll', code: 'STR', number: 18, teamId: 't_amr', secondaryTeamIds: [], country: 'CAN', baseRating: 79, image: createHelmetSvg('#229971', '#ffffff', '18') },
    { id: 'd_bot', name: 'Valtteri Bottas', code: 'BOT', number: 77, teamId: 't_cad', secondaryTeamIds: [], country: 'FIN', baseRating: 79, image: createHelmetSvg('#E5C158', '#38bdf8', '77') },
    { id: 'd_per', name: 'Sergio Pérez', code: 'PER', number: 11, teamId: 't_cad', secondaryTeamIds: [], country: 'MEX', baseRating: 79, image: createHelmetSvg('#E5C158', '#22c55e', '11') },
    { id: 'd_cam', name: 'Rafael Câmara', code: 'CAM', number: 51, teamId: 't_haa', secondaryTeamIds: [], country: 'BRA', baseRating: 79, image: createHelmetSvg('#B6BABD', '#22c55e', '51') }
  ];

  const catalogMap = {};
  if (typeof window !== 'undefined' && Array.isArray(window.F1TracksCatalog)) {
    window.F1TracksCatalog.forEach((c) => {
      catalogMap[c.key] = c.dataUri;
    });
  }

  const tracks = OFFICIAL_2026_TRACKS_DATA.map((t) => {
    const isCompleted = !startAtZero && Boolean(t.completed);
    const svgImage = catalogMap[t.catKey] || createTrackSvg(t.color || '#e10600', t.round);
    return {
      id: `r_${t.round}`,
      round: t.round,
      name: t.name,
      country: t.country,
      circuit: t.circuit,
      catKey: t.catKey,
      hasSprint: Boolean(t.hasSprint),
      completed: isCompleted,
      image: svgImage,
      results: isCompleted
        ? JSON.parse(JSON.stringify(t.results))
        : {
            poleDriverId: '',
            fastestLapDriverId: '',
            raceOrder: [],
            dnfDriverIds: [],
            sprintOrder: [],
            driverTeams: {}
          }
    };
  });

  const demoState = {
    meta: {
      championshipName: 'Campeonato Mundial de Fórmula 1',
      seasonYear: '2026',
      updatedAt: new Date().toISOString()
    },
    pointsSystem: {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
      fastestLapPoints: 0,
      fastestLapTopLimit: 10,
      polePoints: 0
    },
    teams,
    drivers,
    tracks
  };
  applyImageCatalog(demoState);
  return demoState;
}

function createEmptyChampionship() {
  return {
    meta: {
      championshipName: 'Mi Campeonato Personalizado',
      seasonYear: '2026',
      updatedAt: new Date().toISOString()
    },
    pointsSystem: {
      racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
      fastestLapPoints: 0,
      fastestLapTopLimit: 10,
      polePoints: 0
    },
    teams: [],
    drivers: [],
    tracks: []
  };
}

// IndexedDB helper con fallback seguro a localStorage
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveStateToStorage(state) {
  state.meta.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(state);
  try {
    if (typeof window !== 'undefined' && window.desktopAPI && typeof window.desktopAPI.saveStateDisk === 'function') {
      await window.desktopAPI.saveStateDisk(serialized);
    }
  } catch (_err) {
    // Continuar a IndexedDB
  }
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(state, STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (_err) {
    // Fallback a localStorage protegido con try/catch
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch (err) {
    console.warn('Aviso: LocalStorage lleno, los datos principales siguen respaldados en disco / IndexedDB.', err);
  }
}

function upgradeTracksWithRealCatalogSvgs(state) {
  if (!state || !Array.isArray(state.tracks)) return false;
  let upgraded = false;
  const hasCatalog = typeof window !== 'undefined' && Array.isArray(window.F1TracksCatalog);
  const isSeason2026 = state.meta && String(state.meta.seasonYear) === '2026';

  state.tracks.forEach((tr, idx) => {
    // En la temporada 2026 oficial, los 6 Sprints son China, Miami, Canadá, Gran Bretaña, Países Bajos y Singapur (Catar no tiene Sprint)
    if (isSeason2026 && (tr.catKey === 'qatar' || (tr.name && tr.name.includes('Catar'))) && tr.hasSprint) {
      tr.hasSprint = false;
      upgraded = true;
    }
    const isOldGenericPlaceholder =
      !tr.image || tr.image.includes('0%200%20120%20120') || tr.image.includes('0 0 120 120');
    if (isOldGenericPlaceholder && hasCatalog) {
      const match = tr.catKey && window.F1TracksCatalog.find((c) => c.key === tr.catKey);
      if (match && match.dataUri) {
        tr.image = match.dataUri;
        upgraded = true;
      }
    }
    if (!tr.image) {
      tr.image = createTrackSvg(tr.color || '#e10600', tr.round || (idx + 1));
      upgraded = true;
    }
  });
  return upgraded;
}

const OFFICIAL_PHOTO_DRIVER_MATCH = {
  ANT: 'antonelli',
  VER: 'max verstappen',
  RUS: 'george russell',
  HAM: 'lewis hamilton',
  LEC: 'charles leclerc',
  NOR: 'lando norris',
  PIA: 'oscar piastri',
  HAD: 'isack hadjar',
  LAW: 'liam lawson',
  GAS: 'pierre gasly',
  LIN: 'arvid lindblad',
  COL: 'franco colapinto',
  BEA: 'oliver bearman',
  BOR: 'gabriel bortoleto',
  HUL: 'nico hulkenberg',
  OCO: 'esteban ocon',
  ALO: 'fernando alonso',
  SAI: 'carlos sainz',
  ALB: 'alexander albon',
  TSU: 'yuki tsunoda',
  HIR: 'ryo hirakawa',
  STR: 'lance stroll',
  BOT: 'valtteri bottas',
  PER: 'sergio perez',
  CAM: 'rafael camara'
};

const OFFICIAL_LOGO_TEAM_MATCH = {
  MER: 'mercedes',
  FER: 'ferrari',
  RBR: 'red bull',
  MCL: 'mclaren',
  VRB: 'racing bulls',
  ALP: 'alpine',
  HAA: 'haas',
  AUD: 'audi',
  WIL: 'williams',
  AMR: 'aston martin',
  CAD: 'cadillac'
};

function normalizeTextSimple(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function applyImageCatalog(state) {
  if (!state) return false;
  let upgraded = false;
  const officialTeams = (typeof window !== 'undefined' && window.ImageCatalog && window.ImageCatalog.teams) || {};
  const officialDrivers = (typeof window !== 'undefined' && window.ImageCatalog && window.ImageCatalog.drivers) || {};

  const teamColorMap = {};
  (state.teams || []).forEach((t) => {
    teamColorMap[t.id] = t.color || '#e10600';
    const code = (t.shortName || '').toUpperCase();
    const normName = normalizeTextSimple(t.name);
    const expectedSub = OFFICIAL_LOGO_TEAM_MATCH[code];
    const matchesOfficialTeam = expectedSub && (normName.includes(expectedSub) || (code === 'VRB' && normName.includes('rb')));

    if (officialTeams[code] && matchesOfficialTeam && (!t.image || t.image.startsWith('data:image/svg+xml'))) {
      t.image = officialTeams[code];
      upgraded = true;
    } else if (!t.image) {
      t.image = createTeamSvg(t.color || '#3b82f6', code || 'F1');
      upgraded = true;
    }
  });

  (state.drivers || []).forEach((d) => {
    const code = (d.code || '').toUpperCase();
    const normName = normalizeTextSimple(d.name);
    const expectedSub = OFFICIAL_PHOTO_DRIVER_MATCH[code];
    const matchesOfficialDriver =
      (expectedSub && normName.includes(expectedSub)) ||
      (code === 'ANT' && normName.includes('antonelli')) ||
      (code === 'SAI' && normName.includes('carlos sainz') && !normName.includes('sr'));

    if (officialDrivers[code] && matchesOfficialDriver && (!d.image || d.image.startsWith('data:image/svg+xml'))) {
      d.image = officialDrivers[code];
      upgraded = true;
    } else if (!d.image) {
      const primaryColor = teamColorMap[d.teamId] || '#e10600';
      d.image = createHelmetSvg(primaryColor, '#ffffff', String(d.number || '1'));
      upgraded = true;
    }
  });

  return upgraded;
}

function hydrateSeasonStateVisuals(state) {
  if (!state) return state;
  upgradeTracksWithRealCatalogSvgs(state);
  applyImageCatalog(state);
  return state;
}

async function loadStateFromStorage() {
  try {
    if (typeof window !== 'undefined' && window.desktopAPI && typeof window.desktopAPI.loadStateDisk === 'function') {
      const diskRaw = await window.desktopAPI.loadStateDisk();
      if (diskRaw) {
        const diskParsed = JSON.parse(diskRaw);
        if (diskParsed && diskParsed.drivers && diskParsed.pointsSystem) {
          const upTracks = upgradeTracksWithRealCatalogSvgs(diskParsed);
          const upImgs = applyImageCatalog(diskParsed);
          if (upTracks || upImgs) {
            await saveStateToStorage(diskParsed);
          }
          return diskParsed;
        }
      }
    }
  } catch (_err) {
    // Continuar a IndexedDB
  }

  try {
    const db = await openDatabase();
    const data = await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (data && data.drivers && data.pointsSystem) {
      const upTracks = upgradeTracksWithRealCatalogSvgs(data);
      const upImgs = applyImageCatalog(data);
      if (upTracks || upImgs) {
        await saveStateToStorage(data);
      }
      return data;
    }
  } catch (_err) {
    // Continuar a localStorage
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.drivers && parsed.pointsSystem) {
        const upTracks = upgradeTracksWithRealCatalogSvgs(parsed);
        const upImgs = applyImageCatalog(parsed);
        if (upTracks || upImgs) {
          await saveStateToStorage(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('No se pudo leer localStorage, cargando temporada 2026:', err);
  }

  const demo = createDemoChampionship(false);
  applyImageCatalog(demo);
  await saveStateToStorage(demo);
  return demo;
}

function processImageFile(file, maxWidth = 360, maxHeight = 360) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ningún archivo'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No pudimos leer la imagen seleccionada.'));
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (file.type === 'image/svg+xml') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.88));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

window.ChampionshipData = {
  POINTS_PRESETS,
  createDemoChampionship,
  createEmptyChampionship,
  createHelmetSvg,
  createTeamSvg,
  createTrackSvg,
  hydrateSeasonStateVisuals,
  saveStateToStorage,
  loadStateFromStorage,
  processImageFile
};
