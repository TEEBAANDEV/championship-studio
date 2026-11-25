/**
 * Actualiza data/live/season_current.json y data/live/manifest.json con los últimos resultados.
 * Lo ejecuta una GitHub Action (ver .github/workflows/update-data.yml) o a mano: node scripts/update_live_data.js
 */
const fs = require('fs');
const path = require('path');
const LiveSync = require('../src/live_sync.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'live');
const SEASON = Number(process.env.SEASON) || 2026;
const OUT_SEASON = path.join(OUT_DIR, 'season_current.json');
const OUT_MANIFEST = path.join(OUT_DIR, 'manifest.json');
const FALLBACK_BASE = path.join(ROOT, 'datos', 'hist', 'seasons', `season_${SEASON}.json`);

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const baseFile = fs.existsSync(OUT_SEASON) ? OUT_SEASON : FALLBACK_BASE;
  const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  console.log(`Base: ${path.relative(ROOT, baseFile)}`);

  const api = await LiveSync.fetchSeasonData(fetch, SEASON, { sleepMs: 400 });
  console.log(`Carreras recibidas: ${api.results.length} (sprints: ${api.sprint.length})`);
  if (api.results.length === 0) {
    console.log('La API no devolvió carreras; no se modifica nada.');
    return;
  }

  const season = LiveSync.buildLiveSeason(base, api);
  const version = LiveSync.computeVersion(season);
  const completed = season.tracks.filter((t) => t.completed);
  const last = completed[completed.length - 1];

  let previous = null;
  try {
    previous = JSON.parse(fs.readFileSync(OUT_MANIFEST, 'utf8'));
  } catch (_e) {
    previous = null;
  }
  if (previous && previous.version === version) {
    console.log(`Sin cambios (versión ${version}). Nada que publicar.`);
    return;
  }

  const manifest = {
    version,
    season: SEASON,
    updatedAt: new Date().toISOString(),
    completedRounds: completed.length,
    totalRounds: season.tracks.length,
    lastRaceName: last ? last.name : '',
    source: 'Jolpica-F1 API (compatible con Ergast)'
  };
  fs.writeFileSync(OUT_SEASON, JSON.stringify(season));
  fs.writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Actualizado: ${completed.length}/${season.tracks.length} fechas — último GP: ${manifest.lastRaceName}`);
}

main().catch((err) => {
  console.error('Error actualizando datos:', err);
  process.exit(1);
});
