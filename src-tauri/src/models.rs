use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    #[serde(default)]
    pub championship_name: String,
    #[serde(default)]
    pub season_year: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointsSystem {
    pub race_points: Vec<f64>,
    pub sprint_points: Vec<f64>,
    #[serde(default)]
    pub fastest_lap_points: f64,
    #[serde(default = "default_fl_limit")]
    pub fastest_lap_top_limit: usize,
    #[serde(default)]
    pub pole_points: f64,
}

fn default_fl_limit() -> usize {
    // Reglamento clasico: solo puntua vuelta rapida dentro del Top 10
    10
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Team {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Driver {
    pub id: String,
    pub name: String,
    pub code: String,
    #[serde(default)]
    pub number: u32,
    pub team_id: String,
    #[serde(default)]
    pub country: String,
    #[serde(default = "default_rating")]
    pub base_rating: f64,
}

fn default_rating() -> f64 {
    80.0
}

// Resultados por fecha: permite registrar DNF/DNS/DSQ, sprint y deltas
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackResults {
    #[serde(default)]
    pub pole_driver_id: String,
    #[serde(default)]
    pub fastest_lap_driver_id: String,
    #[serde(default)]
    pub fastest_lap_time: String,
    #[serde(default)]
    pub race_order: Vec<String>,
    #[serde(default)]
    pub race_times: HashMap<String, String>,
    #[serde(default)]
    pub dnf_driver_ids: Vec<String>,
    #[serde(default)]
    pub driver_statuses: HashMap<String, String>,
    #[serde(default)]
    pub sprint_order: Vec<String>,
    #[serde(default)]
    pub driver_teams: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub round: u32,
    pub name: String,
    #[serde(default)]
    pub country: String,
    #[serde(default)]
    pub circuit: String,
    #[serde(default)]
    pub has_sprint: bool,
    #[serde(default)]
    pub completed: bool,
    #[serde(default = "default_mult")]
    pub points_multiplier: f64,
    #[serde(default)]
    pub results: TrackResults,
}

fn default_mult() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonState {
    pub meta: Meta,
    pub points_system: PointsSystem,
    pub teams: Vec<Team>,
    pub drivers: Vec<Driver>,
    pub tracks: Vec<Track>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionshipPool {
    pub total_pool: f64,
    pub distributed_points: f64,
    pub remaining_points: f64,
    pub max_driver_remaining: f64,
    pub completed_races: usize,
    pub pending_races: usize,
    pub total_races: usize,
    pub contenders_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverStanding {
    pub rank: usize,
    pub id: String,
    pub name: String,
    pub code: String,
    pub number: u32,
    pub team_id: String,
    pub team_name: String,
    pub team_short: String,
    pub team_color: String,
    pub points: f64,
    pub wins: u32,
    pub podiums: u32,
    pub gap_to_leader: f64,
    pub max_possible: f64,
    pub best_possible_rank: usize,
    pub in_contention: bool,
    pub status_label: String,
    pub skill_rating: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamStanding {
    pub rank: usize,
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub color: String,
    pub points: f64,
    pub wins: u32,
    pub podiums: u32,
    pub gap_to_leader: f64,
    pub max_possible: f64,
    pub best_possible_rank: usize,
    pub in_contention: bool,
    pub status_label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverProgression {
    pub id: String,
    pub name: String,
    pub code: String,
    pub color: String,
    pub points_by_round: Vec<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub pool: ChampionshipPool,
    pub drivers: Vec<DriverStanding>,
    pub teams: Vec<TeamStanding>,
    pub round_labels: Vec<String>,
    pub progression: Vec<DriverProgression>,
    pub team_progression: Vec<DriverProgression>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntitySimProb {
    pub id: String,
    pub title_pct: f64,
    pub podium_pct: f64,
    pub top10_pct: f64,
    pub avg_points: f64,
    pub expected_rank: f64,
    pub position_probs: Vec<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationOutput {
    pub iterations: u32,
    pub drivers: HashMap<String, EntitySimProb>,
    pub teams: HashMap<String, EntitySimProb>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RivalRequirement {
    pub name: String,
    pub points: f64,
    pub max_possible: f64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetAnalysis {
    pub entity_name: String,
    pub current_rank: usize,
    pub target_rank: usize,
    pub best_possible_rank: usize,
    pub current_points: f64,
    pub max_possible: f64,
    pub pending_races: usize,
    pub headline: String,
    pub details: Vec<String>,
    pub rivals: Vec<RivalRequirement>,
}
