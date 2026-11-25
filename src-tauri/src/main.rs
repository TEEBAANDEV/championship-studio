#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use engine::{ChampionshipState, MonteCarloOutput, SimOptions};
use serde::Serialize;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

fn project_root_dir() -> PathBuf {
    // Modo desarrollo: si el ejecutable vive dentro de la carpeta del proyecto, usamos esa carpeta.
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors().skip(1) {
            if ancestor.join("src-tauri").is_dir() && ancestor.join("src").is_dir() {
                return ancestor.to_path_buf();
            }
        }
    }
    // Uso normal: carpeta propia del usuario (no depende de ninguna ruta fija).
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    let dir = base.join("ChampionshipStudio");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn ensure_image_dirs() -> (PathBuf, PathBuf) {
    let root = project_root_dir();
    let drivers_dir = root.join("imagenes").join("pilotos");
    let teams_dir = root.join("imagenes").join("equipos");
    let _ = fs::create_dir_all(&drivers_dir);
    let _ = fs::create_dir_all(&teams_dir);
    (drivers_dir, teams_dir)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalImageEntry {
    file_name: String,
    base_name: String,
    data_uri: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ListImagesResponse {
    ok: bool,
    drivers_dir: String,
    teams_dir: String,
    drivers: Vec<LocalImageEntry>,
    teams: Vec<LocalImageEntry>,
}

fn read_dir_as_data_uris(dir: &Path) -> Vec<LocalImageEntry> {
    let mut out = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return out,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let base_name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        if ext == "svg" {
            if let Ok(raw) = fs::read_to_string(&path) {
                let encoded = BASE64.encode(raw.as_bytes());
                out.push(LocalImageEntry {
                    file_name,
                    base_name,
                    data_uri: format!("data:image/svg+xml;base64,{}", encoded),
                });
            }
        } else if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp") {
            if let Ok(bytes) = fs::read(&path) {
                let mime = match ext.as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "webp" => "image/webp",
                    _ => "image/png",
                };
                out.push(LocalImageEntry {
                    file_name,
                    base_name,
                    data_uri: format!("data:{};base64,{}", mime, BASE64.encode(&bytes)),
                });
            }
        }
    }

    out.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    out
}

#[tauri::command]
fn run_monte_carlo(state: ChampionshipState, options: SimOptions) -> MonteCarloOutput {
    engine::run_monte_carlo_simulation(&state, &options)
}

#[tauri::command]
fn open_images_folder(kind: String) -> serde_json::Value {
    let (drivers_dir, teams_dir) = ensure_image_dirs();
    let target = if kind == "teams" {
        teams_dir
    } else {
        drivers_dir
    };
    let _ = Command::new("explorer").arg(&target).spawn();
    serde_json::json!({
        "ok": true,
        "path": target.to_string_lossy()
    })
}

#[tauri::command]
fn list_local_images() -> ListImagesResponse {
    let (drivers_dir, teams_dir) = ensure_image_dirs();
    ListImagesResponse {
        ok: true,
        drivers_dir: drivers_dir.to_string_lossy().to_string(),
        teams_dir: teams_dir.to_string_lossy().to_string(),
        drivers: read_dir_as_data_uris(&drivers_dir),
        teams: read_dir_as_data_uris(&teams_dir),
    }
}

#[tauri::command]
fn save_image_to_local(kind: String, file_stem: String, data_uri: String) -> serde_json::Value {
    let (drivers_dir, teams_dir) = ensure_image_dirs();
    let dir = if kind == "teams" {
        teams_dir
    } else {
        drivers_dir
    };

    let safe_stem: String = file_stem
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect();
    let safe_stem = if safe_stem.is_empty() {
        "imagen".to_string()
    } else {
        safe_stem
    };

    if let Some(idx) = data_uri.find(";base64,") {
        let header = &data_uri[..idx];
        let b64 = &data_uri[idx + 8..];
        let ext = if header.contains("webp") {
            "webp"
        } else if header.contains("jpeg") || header.contains("jpg") {
            "jpg"
        } else if header.contains("svg") {
            "svg"
        } else {
            "png"
        };
        if let Ok(bytes) = BASE64.decode(b64) {
            let out_path = dir.join(format!("{}.{}", safe_stem, ext));
            if fs::write(&out_path, bytes).is_ok() {
                return serde_json::json!({
                    "ok": true,
                    "filePath": out_path.to_string_lossy()
                });
            }
        }
    }

    serde_json::json!({ "ok": false })
}

#[tauri::command]
fn export_championship(json_content: String, suggested_name: String) -> serde_json::Value {
    let file_opt = rfd::FileDialog::new()
        .set_title("Exportar Campeonato F1")
        .set_file_name(&suggested_name)
        .add_filter("Archivo de Campeonato JSON", &["json"])
        .save_file();

    if let Some(path) = file_opt {
        if fs::write(&path, json_content.as_bytes()).is_ok() {
            return serde_json::json!({
                "ok": true,
                "filePath": path.to_string_lossy()
            });
        }
    }
    serde_json::json!({ "ok": false })
}

#[tauri::command]
fn import_championship() -> serde_json::Value {
    let file_opt = rfd::FileDialog::new()
        .set_title("Importar Campeonato F1")
        .add_filter("Archivo de Campeonato JSON", &["json"])
        .pick_file();

    if let Some(path) = file_opt {
        if let Ok(content) = fs::read_to_string(&path) {
            return serde_json::json!({
                "ok": true,
                "content": content
            });
        }
    }
    serde_json::json!({ "ok": false })
}

#[tauri::command]
fn save_state_disk(json_content: String) -> bool {
    let data_dir = project_root_dir().join("datos");
    let _ = fs::create_dir_all(&data_dir);
    let file_path = data_dir.join("campeonato_2026_v4.json");
    fs::write(file_path, json_content.as_bytes()).is_ok()
}

#[tauri::command]
fn load_state_disk() -> Option<String> {
    let file_path = project_root_dir().join("datos").join("campeonato_2026_v4.json");
    fs::read_to_string(file_path).ok()
}

#[tauri::command]
fn get_historical_catalog() -> Option<String> {
    let file_path = project_root_dir()
        .join("datos")
        .join("hist")
        .join("catalog_1950_2026.json");
    fs::read_to_string(file_path).ok()
}

#[tauri::command]
fn load_historical_season(year: u32) -> Option<String> {
    let file_path = project_root_dir()
        .join("datos")
        .join("hist")
        .join("seasons")
        .join(format!("season_{}.json", year));
    fs::read_to_string(file_path).ok()
}

fn close_previous_instances() {
    let my_pid = std::process::id();
    let filter = format!("PID ne {}", my_pid);
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    for exe_name in ["f1-championship-studio.exe", "F1-Championship-Studio-Rust.exe"] {
        let _ = Command::new("taskkill")
            .args(["/F", "/FI", &filter, "/IM", exe_name])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
}

fn main() {
    close_previous_instances();
    let _ = ensure_image_dirs();
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_monte_carlo,
            open_images_folder,
            list_local_images,
            save_image_to_local,
            export_championship,
            import_championship,
            save_state_disk,
            load_state_disk,
            get_historical_catalog,
            load_historical_season
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar F1 Championship Studio en Rust (Tauri)");
}
