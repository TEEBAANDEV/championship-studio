#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod scenarios;
mod simulator;
mod standings;
mod storage;

use models::{DashboardData, SeasonState, SimulationOutput, TargetAnalysis};
use tauri::Manager;

#[tauri::command]
fn load_season() -> Result<SeasonState, String> {
    let season = storage::load_season()?;
    if season.tracks.is_empty() {
        return Err("La temporada cargada no tiene fechas configuradas.".into());
    }
    Ok(season)
}

#[tauri::command]
fn save_season(state: SeasonState) -> Result<(), String> {
    if state.drivers.is_empty() || state.teams.is_empty() {
        return Err("No se puede guardar una temporada sin pilotos o escuderías.".into());
    }
    storage::save_season(&state)
}

#[tauri::command]
fn reset_season() -> Result<SeasonState, String> {
    storage::reset_season()
}

#[tauri::command]
fn load_custom_season() -> SeasonState {
    storage::load_custom_season()
}

#[tauri::command]
fn save_custom_season(state: SeasonState) -> Result<(), String> {
    if state.drivers.len() < 2 {
        return Err("Una liga personalizada necesita al menos 2 pilotos.".into());
    }
    storage::save_custom_season(&state)
}

#[tauri::command]
fn reset_custom_season() -> Result<SeasonState, String> {
    storage::reset_custom_season()
}

#[tauri::command]
fn compute_dashboard(state: SeasonState) -> DashboardData {
    standings::compute_dashboard(&state)
}

#[tauri::command]
fn run_simulation(
    state: SeasonState,
    iterations: u32,
    form_weight: f64,
    chaos: f64,
) -> SimulationOutput {
    // Limite practico para no congelar equipos con pocos nucleos
    let safe_iters = iterations.clamp(1_000, 100_000);
    simulator::run_simulation(&state, safe_iters, form_weight, chaos)
}

#[tauri::command]
fn analyze_target(
    state: SeasonState,
    kind: String,
    entity_id: String,
    target_rank: Option<usize>,
) -> Option<TargetAnalysis> {
    if entity_id.trim().is_empty() {
        return None;
    }
    scenarios::analyze_target(&state, &kind, &entity_id, target_rank)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // En Windows a veces arranca minimizada si hubo una instancia previa cerrada rapido
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_season,
            save_season,
            reset_season,
            load_custom_season,
            save_custom_season,
            reset_custom_season,
            compute_dashboard,
            run_simulation,
            analyze_target
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar la ventana principal de Championship Studio");
}
