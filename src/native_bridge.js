/**
 * Puente con la versión de escritorio: conecta la interfaz con el motor
 * de simulación y con el guardado en disco.
 */
(function () {
  function getInvoke() {
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      return window.__TAURI__.core.invoke;
    }
    if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
      return window.__TAURI_INTERNALS__.invoke;
    }
    return null;
  }

  const invoke = getInvoke();
  if (!invoke) return;

  window.desktopAPI = {
    isDesktop: true,
    runMonteCarloNative: (state, options) => invoke('run_monte_carlo', { state, options }),
    openImagesFolder: (kind) => invoke('open_images_folder', { kind: kind || 'drivers' }),
    listLocalImages: () => invoke('list_local_images'),
    saveImageToLocal: (kind, fileStem, dataUri) =>
      invoke('save_image_to_local', {
        kind: kind || 'drivers',
        fileStem: String(fileStem || 'imagen'),
        dataUri: String(dataUri || '')
      }),
    exportChampionship: (jsonContent, suggestedName) =>
      invoke('export_championship', {
        jsonContent: String(jsonContent || ''),
        suggestedName: String(suggestedName || 'campeonato.json')
      }),
    importChampionship: () => invoke('import_championship'),
    saveStateDisk: (jsonContent) => invoke('save_state_disk', { jsonContent: String(jsonContent || '') }),
    loadStateDisk: () => invoke('load_state_disk'),
    getHistoricalCatalog: () => invoke('get_historical_catalog'),
    loadHistoricalSeason: (year) => invoke('load_historical_season', { year: Number(year) || 2026 })
  };
})();
