use crate::models::SeasonState;
use std::fs;
use std::path::PathBuf;

const DEFAULT_SEASON_JSON: &str = include_str!("../../data/live/season_current.json");

fn data_dir() -> PathBuf {
    // En desarrollo guardamos junto al repo; en el ejecutable suelto usamos LOCALAPPDATA
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors().skip(1) {
            if ancestor.join("src-tauri").is_dir() && ancestor.join("src").is_dir() {
                let dir = ancestor.join("datos");
                let _ = fs::create_dir_all(&dir);
                return dir;
            }
        }
    }
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    let dir = base.join("ChampionshipStudio");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn state_file_path() -> PathBuf {
    data_dir().join("season_state.json")
}

fn custom_file_path() -> PathBuf {
    data_dir().join("custom_season.json")
}

pub fn load_season() -> Result<SeasonState, String> {
    let path = state_file_path();
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(parsed) = serde_json::from_str::<SeasonState>(&raw) {
            if !parsed.drivers.is_empty() {
                return Ok(parsed);
            }
        }
    }
    serde_json::from_str::<SeasonState>(DEFAULT_SEASON_JSON)
        .map_err(|e| format!("No se pudo cargar la temporada base: {}", e))
}

pub fn save_season(state: &SeasonState) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(state_file_path(), raw.as_bytes()).map_err(|e| e.to_string())
}

pub fn reset_season() -> Result<SeasonState, String> {
    let base: SeasonState =
        serde_json::from_str(DEFAULT_SEASON_JSON).map_err(|e| e.to_string())?;
    let _ = save_season(&base);
    Ok(base)
}

pub fn default_custom_season() -> SeasonState {
    serde_json::from_str(
        r##"{
          "meta": { "championshipName": "Liga Personalizada", "seasonYear": "2026", "updatedAt": "" },
          "pointsSystem": {
            "racePoints": [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
            "sprintPoints": [8, 7, 6, 5, 4, 3, 2, 1],
            "fastestLapPoints": 1,
            "fastestLapTopLimit": 10,
            "polePoints": 0
          },
          "teams": [
            { "id": "ct_1", "name": "Escudería Roja", "shortName": "ROJ", "color": "#e10600" },
            { "id": "ct_2", "name": "Escudería Azul", "shortName": "AZU", "color": "#3671c6" }
          ],
          "drivers": [
            { "id": "cd_1", "name": "Jugador 1", "code": "JG1", "number": 1, "teamId": "ct_1", "country": "", "baseRating": 88 },
            { "id": "cd_2", "name": "Jugador 2", "code": "JG2", "number": 2, "teamId": "ct_2", "country": "", "baseRating": 88 },
            { "id": "cd_3", "name": "Jugador 3", "code": "JG3", "number": 3, "teamId": "ct_1", "country": "", "baseRating": 85 },
            { "id": "cd_4", "name": "Jugador 4", "code": "JG4", "number": 4, "teamId": "ct_2", "country": "", "baseRating": 85 }
          ],
          "tracks": [
            { "id": "cr_1", "round": 1, "name": "Fecha 1 — Australia", "country": "Australia", "circuit": "Albert Park", "hasSprint": false, "completed": false, "pointsMultiplier": 1, "results": {} },
            { "id": "cr_2", "round": 2, "name": "Fecha 2 — Mónaco", "country": "Mónaco", "circuit": "Monte Carlo", "hasSprint": false, "completed": false, "pointsMultiplier": 1, "results": {} },
            { "id": "cr_3", "round": 3, "name": "Fecha 3 — Brasil", "country": "Brasil", "circuit": "Interlagos", "hasSprint": false, "completed": false, "pointsMultiplier": 1, "results": {} }
          ]
        }"##,
    )
    .expect("default custom season")
}

pub fn load_custom_season() -> SeasonState {
    if let Ok(raw) = fs::read_to_string(custom_file_path()) {
        if let Ok(parsed) = serde_json::from_str::<SeasonState>(&raw) {
            return parsed;
        }
    }
    default_custom_season()
}

pub fn save_custom_season(state: &SeasonState) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(custom_file_path(), raw.as_bytes()).map_err(|e| e.to_string())
}

pub fn reset_custom_season() -> Result<SeasonState, String> {
    let base = default_custom_season();
    save_custom_season(&base)?;
    Ok(base)
}
