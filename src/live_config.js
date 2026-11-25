/**
 * Configuración de las actualizaciones automáticas de resultados.
 *
 * baseUrl: carpeta pública donde está publicado data/live (por ejemplo la URL "raw" de tu repositorio
 *          o una página de GitHub Pages). Debe contener manifest.json y season_current.json.
 *          Si lo dejas vacío, la app consulta directamente la API pública de resultados.
 * season:  temporada que se sincroniza.
 */
window.LIVE_DATA_CONFIG = {
  baseUrl: '',
  season: 2026
};
