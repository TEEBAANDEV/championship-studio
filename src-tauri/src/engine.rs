use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::Instant;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PointsSystem {
    #[serde(default)]
    pub race_points: Vec<f64>,
    #[serde(default)]
    pub sprint_points: Vec<f64>,
    #[serde(default)]
    pub fastest_lap_points: f64,
    #[serde(default = "default_fl_limit")]
    pub fastest_lap_top_limit: usize,
    #[serde(default)]
    pub pole_points: f64,
}

fn default_fl_limit() -> usize {
    10
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Team {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub color: String,
    #[serde(default)]
    pub image: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Driver {
    pub id: String,
    pub name: String,
    pub code: String,
    pub number: u32,
    #[serde(default)]
    pub team_id: String,
    #[serde(default)]
    pub secondary_team_ids: Vec<String>,
    #[serde(default)]
    pub country: String,
    #[serde(default = "default_rating")]
    pub base_rating: f64,
    #[serde(default)]
    pub image: String,
}

fn default_rating() -> f64 {
    85.0
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackResults {
    #[serde(default)]
    pub pole_driver_id: String,
    #[serde(default)]
    pub fastest_lap_driver_id: String,
    #[serde(default)]
    pub race_order: Vec<String>,
    #[serde(default)]
    pub dnf_driver_ids: Vec<String>,
    #[serde(default)]
    pub driver_statuses: HashMap<String, String>,
    #[serde(default)]
    pub sprint_order: Vec<String>,
    #[serde(default)]
    pub driver_teams: HashMap<String, String>,
}

fn default_multiplier() -> f64 {
    1.0
}

#[derive(Debug, Clone, Deserialize, Serialize)]
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
    #[serde(default = "default_multiplier")]
    pub points_multiplier: f64,
    #[serde(default)]
    pub suspension_note: String,
    #[serde(default)]
    pub completed: bool,
    #[serde(default)]
    pub results: TrackResults,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionshipState {
    pub points_system: PointsSystem,
    #[serde(default)]
    pub teams: Vec<Team>,
    #[serde(default)]
    pub drivers: Vec<Driver>,
    #[serde(default)]
    pub tracks: Vec<Track>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimOptions {
    #[serde(default = "default_iters")]
    pub iterations: usize,
    #[serde(default = "default_form")]
    pub form_weight: f64,
    #[serde(default = "default_chaos")]
    pub chaos_level: f64,
}

fn default_iters() -> usize {
    10000
}
fn default_form() -> f64 {
    0.70
}
fn default_chaos() -> f64 {
    0.35
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PoolSummary {
    pub pool_per_normal_race: f64,
    pub pool_per_sprint_race: f64,
    pub max_driver_normal_race: f64,
    pub max_driver_sprint_race: f64,
    pub total_championship_pool: f64,
    pub distributed_pool: f64,
    pub remaining_pool: f64,
    pub max_remaining_for_one_driver: f64,
    pub max_possible_for_one_driver_season: f64,
    pub total_races_count: usize,
    pub completed_races_count: usize,
    pub remaining_races_count: usize,
    pub remaining_sprints_count: usize,
    pub remaining_normal_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverSimResult {
    pub id: String,
    pub name: String,
    pub code: String,
    pub number: u32,
    pub image: String,
    pub team_name: String,
    pub team_color: String,
    pub current_points: f64,
    pub current_rank: usize,
    pub max_possible_points: f64,
    pub best_mathematical_rank: usize,
    pub worst_mathematical_rank: usize,
    pub target_rank: usize,
    pub target_chance_pct: f64,
    pub is_rank_locked: bool,
    pub title_status: String,
    pub title_status_label: String,
    pub win_probability: f64,
    pub podium_probability: f64,
    pub top5_probability: f64,
    pub target_sim_probability: f64,
    pub expected_points: f64,
    pub min_projected_points: f64,
    pub max_projected_points: f64,
    pub most_likely_position: usize,
    pub most_likely_position_prob: f64,
    pub position_probabilities: Vec<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSimResult {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub color: String,
    pub image: String,
    pub driver_names: Vec<String>,
    pub current_points: f64,
    pub current_rank: usize,
    pub max_possible_points: f64,
    pub best_mathematical_rank: usize,
    pub worst_mathematical_rank: usize,
    pub target_rank: usize,
    pub target_chance_pct: f64,
    pub is_rank_locked: bool,
    pub title_status: String,
    pub title_status_label: String,
    pub win_probability: f64,
    pub podium_probability: f64,
    pub top5_probability: f64,
    pub target_sim_probability: f64,
    pub expected_points: f64,
    pub min_projected_points: f64,
    pub max_projected_points: f64,
    pub most_likely_position: usize,
    pub most_likely_position_prob: f64,
    pub position_probabilities: Vec<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonteCarloOutput {
    pub pool: PoolSummary,
    pub iterations: usize,
    pub remaining_races: usize,
    pub results: Vec<DriverSimResult>,
    pub team_results: Vec<TeamSimResult>,
    pub elapsed_ms: f64,
    pub threads_used: usize,
    pub engine_badge: String,
}

pub fn calculate_pool(state: &ChampionshipState) -> PoolSummary {
    let ps = &state.points_system;
    let race_sum: f64 = ps.race_points.iter().copied().sum();
    let sprint_sum: f64 = ps.sprint_points.iter().copied().sum();
    let fl_pts = ps.fastest_lap_points;
    let pole_pts = ps.pole_points;

    let pool_per_normal_race = race_sum + fl_pts + pole_pts;
    let pool_per_sprint_race = race_sum + sprint_sum + fl_pts + pole_pts;
    let max_driver_normal_race = ps.race_points.first().copied().unwrap_or(0.0) + fl_pts + pole_pts;
    let max_driver_sprint_race =
        max_driver_normal_race + ps.sprint_points.first().copied().unwrap_or(0.0);

    let mut total_championship_pool = 0.0;
    let mut distributed_pool = 0.0;
    let mut remaining_pool = 0.0;
    let mut max_remaining_for_one_driver = 0.0;
    let mut max_possible_for_one_driver_season = 0.0;

    let mut completed_races_count = 0usize;
    let mut remaining_races_count = 0usize;
    let mut remaining_sprints_count = 0usize;
    let mut remaining_normal_count = 0usize;

    for tr in &state.tracks {
        let mult = tr.points_multiplier;
        let bonus_pool = if mult > 0.0 { fl_pts + pole_pts } else { 0.0 };
        let track_pool = race_sum * mult + bonus_pool + if tr.has_sprint { sprint_sum } else { 0.0 };
        let track_max_one = ps.race_points.first().copied().unwrap_or(0.0) * mult
            + bonus_pool
            + if tr.has_sprint {
                ps.sprint_points.first().copied().unwrap_or(0.0)
            } else {
                0.0
            };
        total_championship_pool += track_pool;
        max_possible_for_one_driver_season += track_max_one;

        if tr.completed {
            distributed_pool += track_pool;
            completed_races_count += 1;
        } else {
            remaining_pool += track_pool;
            max_remaining_for_one_driver += track_max_one;
            remaining_races_count += 1;
            if tr.has_sprint {
                remaining_sprints_count += 1;
            } else {
                remaining_normal_count += 1;
            }
        }
    }

    PoolSummary {
        pool_per_normal_race,
        pool_per_sprint_race,
        max_driver_normal_race,
        max_driver_sprint_race,
        total_championship_pool,
        distributed_pool,
        remaining_pool,
        max_remaining_for_one_driver,
        max_possible_for_one_driver_season,
        total_races_count: state.tracks.len(),
        completed_races_count,
        remaining_races_count,
        remaining_sprints_count,
        remaining_normal_count,
    }
}

#[inline]
fn rand_normal() -> f64 {
    let u = fastrand::f64().max(1e-12);
    let v = fastrand::f64().max(1e-12);
    (-2.0 * u.ln()).sqrt() * (2.0 * std::f64::consts::PI * v).cos()
}

struct PartialAccum {
    drv_win: Vec<usize>,
    drv_pod: Vec<usize>,
    drv_top5: Vec<usize>,
    drv_pos: Vec<Vec<usize>>,
    drv_pts_sum: Vec<f64>,
    drv_samples: Vec<Vec<f64>>,

    tm_win: Vec<usize>,
    tm_pod: Vec<usize>,
    tm_top5: Vec<usize>,
    tm_pos: Vec<Vec<usize>>,
    tm_pts_sum: Vec<f64>,
    tm_samples: Vec<Vec<f64>>,
}

impl PartialAccum {
    fn new(n_drivers: usize, n_teams: usize) -> Self {
        Self {
            drv_win: vec![0; n_drivers],
            drv_pod: vec![0; n_drivers],
            drv_top5: vec![0; n_drivers],
            drv_pos: vec![vec![0; n_drivers]; n_drivers],
            drv_pts_sum: vec![0.0; n_drivers],
            drv_samples: vec![Vec::new(); n_drivers],
            tm_win: vec![0; n_teams],
            tm_pod: vec![0; n_teams],
            tm_top5: vec![0; n_teams],
            tm_pos: vec![vec![0; n_teams]; n_teams],
            tm_pts_sum: vec![0.0; n_teams],
            tm_samples: vec![Vec::new(); n_teams],
        }
    }

    fn merge(mut self, other: Self) -> Self {
        for i in 0..self.drv_win.len() {
            self.drv_win[i] += other.drv_win[i];
            self.drv_pod[i] += other.drv_pod[i];
            self.drv_top5[i] += other.drv_top5[i];
            self.drv_pts_sum[i] += other.drv_pts_sum[i];
            for p in 0..self.drv_pos[i].len() {
                self.drv_pos[i][p] += other.drv_pos[i][p];
            }
            self.drv_samples[i].extend(other.drv_samples[i].iter().copied());
        }
        for t in 0..self.tm_win.len() {
            self.tm_win[t] += other.tm_win[t];
            self.tm_pod[t] += other.tm_pod[t];
            self.tm_top5[t] += other.tm_top5[t];
            self.tm_pts_sum[t] += other.tm_pts_sum[t];
            for p in 0..self.tm_pos[t].len() {
                self.tm_pos[t][p] += other.tm_pos[t][p];
            }
            self.tm_samples[t].extend(other.tm_samples[t].iter().copied());
        }
        self
    }
}

pub fn run_monte_carlo_simulation(state: &ChampionshipState, opts: &SimOptions) -> MonteCarloOutput {
    let start_instant = Instant::now();
    let pool = calculate_pool(state);
    let iterations = opts.iterations.clamp(500, 250_000);
    let form_weight = opts.form_weight.clamp(0.0, 1.0);
    let chaos_level = opts.chaos_level.clamp(0.05, 1.0);

    let teams_map: HashMap<String, &Team> = state.teams.iter().map(|t| (t.id.clone(), t)).collect();
    let drv_id_to_idx: HashMap<String, usize> = state
        .drivers
        .iter()
        .enumerate()
        .map(|(i, d)| (d.id.clone(), i))
        .collect();
    let team_id_to_idx: HashMap<String, usize> = state
        .teams
        .iter()
        .enumerate()
        .map(|(i, t)| (t.id.clone(), i))
        .collect();

    let n_drivers = state.drivers.len();
    let n_teams = state.teams.len();

    // Compute current driver & team points and wins from completed tracks
    let mut cur_drv_pts = vec![0.0f64; n_drivers];
    let mut cur_drv_wins = vec![0usize; n_drivers];
    let mut cur_tm_pts = vec![0.0f64; n_teams];
    let mut cur_tm_wins = vec![0usize; n_teams];
    let mut tm_driver_names: Vec<Vec<String>> = vec![Vec::new(); n_teams];

    for (t_idx, tm) in state.teams.iter().enumerate() {
        for d in &state.drivers {
            if d.team_id == tm.id || d.secondary_team_ids.contains(&tm.id) {
                tm_driver_names[t_idx].push(d.name.clone());
            }
        }
    }

    let ps = &state.points_system;
    let mut sorted_tracks = state.tracks.clone();
    sorted_tracks.sort_by_key(|t| t.round);

    for tr in &sorted_tracks {
        if !tr.completed {
            continue;
        }
        let mult = tr.points_multiplier;
        let mut dnf_set: HashSet<&String> = tr.results.dnf_driver_ids.iter().collect();
        for (k, v) in &tr.results.driver_statuses {
            if v == "DNF" || v == "DNS" || v == "DSQ" {
                dnf_set.insert(k);
            }
        }
        let mut round_drv_pts = vec![0.0f64; n_drivers];

        for (pos_idx, d_id) in tr.results.race_order.iter().enumerate() {
            if let Some(&d_idx) = drv_id_to_idx.get(d_id) {
                let is_dnf = dnf_set.contains(d_id);
                if !is_dnf {
                    if pos_idx == 0 {
                        cur_drv_wins[d_idx] += 1;
                        let raced_tm = tr
                            .results
                            .driver_teams
                            .get(d_id)
                            .cloned()
                            .unwrap_or_else(|| state.drivers[d_idx].team_id.clone());
                        if let Some(&t_idx) = team_id_to_idx.get(&raced_tm) {
                            cur_tm_wins[t_idx] += 1;
                        }
                    }
                    if mult > 0.0 {
                        if let Some(&pts) = ps.race_points.get(pos_idx) {
                            round_drv_pts[d_idx] += ((pts * mult) * 100.0).round() / 100.0;
                        }
                    }
                }
            }
        }

        if tr.has_sprint {
            for (pos_idx, d_id) in tr.results.sprint_order.iter().enumerate() {
                if let Some(&d_idx) = drv_id_to_idx.get(d_id) {
                    if let Some(&pts) = ps.sprint_points.get(pos_idx) {
                        round_drv_pts[d_idx] += pts;
                    }
                }
            }
        }

        if mult > 0.0 && ps.pole_points > 0.0 && !tr.results.pole_driver_id.is_empty() {
            if let Some(&d_idx) = drv_id_to_idx.get(&tr.results.pole_driver_id) {
                round_drv_pts[d_idx] += ps.pole_points;
            }
        }

        if mult > 0.0 && ps.fastest_lap_points > 0.0 && !tr.results.fastest_lap_driver_id.is_empty() {
            let fl_id = &tr.results.fastest_lap_driver_id;
            if let Some(&d_idx) = drv_id_to_idx.get(fl_id) {
                let pos_opt = tr.results.race_order.iter().position(|x| x == fl_id);
                let is_dnf = dnf_set.contains(fl_id);
                if !is_dnf {
                    if let Some(pos) = pos_opt {
                        if pos + 1 <= ps.fastest_lap_top_limit {
                            round_drv_pts[d_idx] += ps.fastest_lap_points;
                        }
                    }
                }
            }
        }

        for d_idx in 0..n_drivers {
            let pts = round_drv_pts[d_idx];
            if pts > 0.0 {
                cur_drv_pts[d_idx] = ((cur_drv_pts[d_idx] + pts) * 100.0).round() / 100.0;
                let d_id = &state.drivers[d_idx].id;
                let raced_tm = tr
                    .results
                    .driver_teams
                    .get(d_id)
                    .cloned()
                    .unwrap_or_else(|| state.drivers[d_idx].team_id.clone());
                if let Some(&t_idx) = team_id_to_idx.get(&raced_tm) {
                    cur_tm_pts[t_idx] = ((cur_tm_pts[t_idx] + pts) * 100.0).round() / 100.0;
                }
            }
        }
    }

    // Current driver & team rank order
    let mut drv_order: Vec<usize> = (0..n_drivers).collect();
    drv_order.sort_by(|&a, &b| {
        cur_drv_pts[b]
            .partial_cmp(&cur_drv_pts[a])
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| cur_drv_wins[b].cmp(&cur_drv_wins[a]))
    });
    let mut drv_current_rank = vec![1usize; n_drivers];
    for (r, &d_idx) in drv_order.iter().enumerate() {
        drv_current_rank[d_idx] = r + 1;
    }

    let mut tm_order: Vec<usize> = (0..n_teams).collect();
    tm_order.sort_by(|&a, &b| {
        cur_tm_pts[b]
            .partial_cmp(&cur_tm_pts[a])
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| cur_tm_wins[b].cmp(&cur_tm_wins[a]))
    });
    let mut tm_current_rank = vec![1usize; n_teams];
    for (r, &t_idx) in tm_order.iter().enumerate() {
        tm_current_rank[t_idx] = r + 1;
    }

    let remaining_tracks: Vec<&Track> = sorted_tracks.iter().filter(|t| !t.completed).collect();
    let max_current_pts = cur_drv_pts.iter().copied().fold(1.0f64, f64::max);

    let skills: Vec<f64> = (0..n_drivers)
        .map(|i| {
            let base = state.drivers[i].base_rating.clamp(50.0, 99.0);
            if pool.completed_races_count == 0 {
                base
            } else {
                let perf_score = 55.0 + (cur_drv_pts[i] / max_current_pts) * 43.0;
                base * (1.0 - form_weight) + perf_score * form_weight
            }
        })
        .collect();

    let drv_team_idx: Vec<Option<usize>> = state
        .drivers
        .iter()
        .map(|d| team_id_to_idx.get(&d.team_id).copied())
        .collect();

    // Parallelize across chunks with Rayon
    let threads_used = rayon::current_num_threads().max(1);
    let num_chunks = (threads_used * 4).max(1);
    let chunk_size = (iterations + num_chunks - 1) / num_chunks;
    let sample_stride = (iterations / 2000).max(1);

    let race_pts = &ps.race_points;
    let sprint_pts = &ps.sprint_points;
    let pole_pts = ps.pole_points;
    let fl_pts = ps.fastest_lap_points;
    let fl_top_limit = ps.fastest_lap_top_limit;
    let sigma = 4.0 + chaos_level * 18.0;
    let dnf_prob = 0.02 + chaos_level * 0.10;

    let combined = (0..num_chunks)
        .into_par_iter()
        .map(|chunk_id| {
            let start_iter = chunk_id * chunk_size;
            let end_iter = ((chunk_id + 1) * chunk_size).min(iterations);
            let mut acc = PartialAccum::new(n_drivers, n_teams);

            if start_iter >= end_iter {
                return acc;
            }

            let mut sim_pts = vec![0.0f64; n_drivers];
            let mut sim_wins = vec![0usize; n_drivers];
            let mut perf = vec![0.0f64; n_drivers];
            let mut order: Vec<usize> = (0..n_drivers).collect();
            let mut sim_tm_pts = vec![0.0f64; n_teams];
            let mut sim_tm_wins = vec![0usize; n_teams];
            let mut tm_car_counts = vec![0u8; n_teams];
            let mut tm_idx_order: Vec<usize> = (0..n_teams).collect();

            for iter in start_iter..end_iter {
                sim_pts.copy_from_slice(&cur_drv_pts);
                sim_wins.copy_from_slice(&cur_drv_wins);
                sim_tm_pts.copy_from_slice(&cur_tm_pts);
                sim_tm_wins.copy_from_slice(&cur_tm_wins);

                for tr in &remaining_tracks {
                    if tr.has_sprint && !sprint_pts.is_empty() {
                        tm_car_counts.fill(0);
                        for i in 0..n_drivers {
                            perf[i] = skills[i] + rand_normal() * sigma;
                            order[i] = i;
                        }
                        order.sort_unstable_by(|&a, &b| {
                            perf[b]
                                .partial_cmp(&perf[a])
                                .unwrap_or(std::cmp::Ordering::Equal)
                        });
                        for (pos, &d_idx) in order.iter().enumerate() {
                            if pos < sprint_pts.len() {
                                let pts = sprint_pts[pos];
                                sim_pts[d_idx] += pts;
                                if let Some(t_idx) = drv_team_idx[d_idx] {
                                    if tm_car_counts[t_idx] < 2 {
                                        sim_tm_pts[t_idx] += pts;
                                        tm_car_counts[t_idx] += 1;
                                    }
                                }
                            }
                        }
                    }

                    // Main race
                    tm_car_counts.fill(0);
                    let mut best_pole_idx = 0usize;
                    let mut best_pole_score = f64::NEG_INFINITY;

                    for i in 0..n_drivers {
                        let q_score = skills[i] + rand_normal() * (sigma * 0.8);
                        if q_score > best_pole_score {
                            best_pole_score = q_score;
                            best_pole_idx = i;
                        }
                        if fastrand::f64() < dnf_prob {
                            perf[i] = -999.0 + fastrand::f64();
                        } else {
                            perf[i] = skills[i] + rand_normal() * sigma;
                        }
                        order[i] = i;
                    }

                    if pole_pts > 0.0 {
                        sim_pts[best_pole_idx] += pole_pts;
                        if let Some(t_idx) = drv_team_idx[best_pole_idx] {
                            sim_tm_pts[t_idx] += pole_pts;
                        }
                    }

                    order.sort_unstable_by(|&a, &b| {
                        perf[b]
                            .partial_cmp(&perf[a])
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });

                    for (pos, &d_idx) in order.iter().enumerate() {
                        if perf[d_idx] <= -500.0 {
                            continue;
                        }
                        if pos == 0 {
                            sim_wins[d_idx] += 1;
                            if let Some(t_idx) = drv_team_idx[d_idx] {
                                sim_tm_wins[t_idx] += 1;
                            }
                        }
                        if pos < race_pts.len() {
                            let pts = race_pts[pos];
                            sim_pts[d_idx] += pts;
                            if let Some(t_idx) = drv_team_idx[d_idx] {
                                if tm_car_counts[t_idx] < 2 {
                                    sim_tm_pts[t_idx] += pts;
                                    tm_car_counts[t_idx] += 1;
                                }
                            }
                        }
                    }

                    if fl_pts > 0.0 {
                        let limit = fl_top_limit.min(order.len());
                        let mut fl_winner = None;
                        let mut fl_best = f64::NEG_INFINITY;
                        for pos in 0..limit {
                            let d_idx = order[pos];
                            if perf[d_idx] <= -500.0 {
                                continue;
                            }
                            let s = skills[d_idx] + rand_normal() * sigma;
                            if s > fl_best {
                                fl_best = s;
                                fl_winner = Some(d_idx);
                            }
                        }
                        if let Some(w_idx) = fl_winner {
                            sim_pts[w_idx] += fl_pts;
                            if let Some(t_idx) = drv_team_idx[w_idx] {
                                sim_tm_pts[t_idx] += fl_pts;
                            }
                        }
                    }
                }

                // Rank drivers for this simulated season
                for i in 0..n_drivers {
                    order[i] = i;
                }
                order.sort_unstable_by(|&a, &b| {
                    sim_pts[b]
                        .partial_cmp(&sim_pts[a])
                        .unwrap_or(std::cmp::Ordering::Equal)
                        .then_with(|| sim_wins[b].cmp(&sim_wins[a]))
                });

                let record_sample = iter % sample_stride == 0;
                for (rank_idx, &d_idx) in order.iter().enumerate() {
                    acc.drv_pos[d_idx][rank_idx] += 1;
                    acc.drv_pts_sum[d_idx] += sim_pts[d_idx];
                    if rank_idx == 0 {
                        acc.drv_win[d_idx] += 1;
                    }
                    if rank_idx < 3 {
                        acc.drv_pod[d_idx] += 1;
                    }
                    if rank_idx < 5 {
                        acc.drv_top5[d_idx] += 1;
                    }
                    if record_sample {
                        acc.drv_samples[d_idx].push(sim_pts[d_idx]);
                    }
                }

                // Rank teams for this simulated season
                for t in 0..n_teams {
                    tm_idx_order[t] = t;
                }
                tm_idx_order.sort_unstable_by(|&a, &b| {
                    sim_tm_pts[b]
                        .partial_cmp(&sim_tm_pts[a])
                        .unwrap_or(std::cmp::Ordering::Equal)
                        .then_with(|| sim_tm_wins[b].cmp(&sim_tm_wins[a]))
                });

                for (rank_idx, &t_idx) in tm_idx_order.iter().enumerate() {
                    acc.tm_pos[t_idx][rank_idx] += 1;
                    acc.tm_pts_sum[t_idx] += sim_tm_pts[t_idx];
                    if rank_idx == 0 {
                        acc.tm_win[t_idx] += 1;
                    }
                    if rank_idx < 3 {
                        acc.tm_pod[t_idx] += 1;
                    }
                    if rank_idx < 5 {
                        acc.tm_top5[t_idx] += 1;
                    }
                    if record_sample {
                        acc.tm_samples[t_idx].push(sim_tm_pts[t_idx]);
                    }
                }
            }

            acc
        })
        .reduce(|| PartialAccum::new(n_drivers, n_teams), |a, b| a.merge(b));

    let inv_iter = 100.0 / (iterations as f64);
    let _leader_pts = drv_order.first().map(|&i| cur_drv_pts[i]).unwrap_or(0.0);
    let second_max_pts = drv_order
        .get(1)
        .map(|&i| cur_drv_pts[i] + pool.max_remaining_for_one_driver)
        .unwrap_or(0.0);

    let max_race_team: f64 = ps.race_points.iter().take(2).copied().sum::<f64>()
        + ps.fastest_lap_points
        + ps.pole_points;
    let max_sprint_team: f64 = ps.sprint_points.iter().take(2).copied().sum();
    let max_remaining_team = (pool.remaining_races_count as f64) * max_race_team
        + (pool.remaining_sprints_count as f64) * max_sprint_team;
    let second_team_max_pts = tm_order
        .get(1)
        .map(|&t| cur_tm_pts[t] + max_remaining_team)
        .unwrap_or(0.0);

    let mut results: Vec<DriverSimResult> = (0..n_drivers)
        .map(|i| {
            let d = &state.drivers[i];
            let mut samples = combined.drv_samples[i].clone();
            samples.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let p10 = if samples.is_empty() {
                cur_drv_pts[i]
            } else {
                samples[(samples.len() as f64 * 0.10) as usize]
            };
            let p90 = if samples.is_empty() {
                cur_drv_pts[i]
            } else {
                samples[((samples.len() as f64 * 0.90) as usize).min(samples.len() - 1)]
            };

            let pos_probs: Vec<f64> = combined.drv_pos[i]
                .iter()
                .map(|&c| (c as f64) * inv_iter)
                .collect();

            let mut best_pos = 1usize;
            let mut best_prob = -1.0f64;
            for (idx, &pr) in pos_probs.iter().enumerate() {
                if pr > best_prob {
                    best_prob = pr;
                    best_pos = idx + 1;
                }
            }

            let tm = teams_map.get(&d.team_id);
            let max_possible = cur_drv_pts[i] + pool.max_remaining_for_one_driver;
            let rivals_unreachable = (0..n_drivers)
                .filter(|&other| other != i && cur_drv_pts[other] > max_possible)
                .count();
            let best_math_rank = 1 + rivals_unreachable;

            let rivals_who_can_pass = (0..n_drivers)
                .filter(|&other| {
                    other != i
                        && (cur_drv_pts[other] + pool.max_remaining_for_one_driver) >= cur_drv_pts[i]
                })
                .count();
            let worst_math_rank = n_drivers.min(1 + rivals_who_can_pass);

            let target_rank = best_math_rank;
            let target_holder_idx = drv_order.get(target_rank.saturating_sub(1)).copied().unwrap_or(i);
            let target_holder_pts = cur_drv_pts[target_holder_idx];
            let is_rank_locked =
                pool.remaining_races_count == 0 || best_math_rank == worst_math_rank;

            let raw_chance_pct = if pool.completed_races_count == 0 {
                100.0
            } else if is_rank_locked || cur_drv_pts[i] >= target_holder_pts {
                100.0
            } else if pool.max_remaining_for_one_driver > 0.0 && max_possible >= target_holder_pts {
                let margin = max_possible - target_holder_pts;
                (((margin + 1.0) / (pool.max_remaining_for_one_driver + 1.0)) * 100.0)
                    .clamp(0.5, 99.9)
            } else {
                0.0
            };
            let target_chance_pct = (raw_chance_pct * 10.0).round() / 10.0;

            let (title_status, title_status_label) = if drv_current_rank[i] == 1
                && (pool.remaining_races_count == 0 || cur_drv_pts[i] > second_max_pts)
            {
                (
                    "champion".to_string(),
                    "¡Campeón Consagrado! (1° • 100%)".to_string(),
                )
            } else if best_math_rank == 1 {
                let lbl = if pool.completed_races_count == 0 {
                    "Opción al Mundial (1°) • 100%".to_string()
                } else if drv_current_rank[i] == 1 {
                    "Líder del Mundial (1°) • 100%".to_string()
                } else {
                    format!("Opción al Mundial (1°) • {:.1}%", target_chance_pct)
                };
                ("contender".to_string(), lbl)
            } else if is_rank_locked {
                (
                    "locked".to_string(),
                    format!("{}° Puesto Asegurado • 100%", target_rank),
                )
            } else {
                let lbl = if drv_current_rank[i] == target_rank {
                    format!("Máx. {}° puesto (En {}°) • 100%", target_rank, target_rank)
                } else {
                    format!("Máx. {}° puesto • {:.1}%", target_rank, target_chance_pct)
                };
                ("subtarget".to_string(), lbl)
            };

            let target_sim_probability = if is_rank_locked {
                100.0
            } else {
                pos_probs.iter().take(target_rank).copied().sum::<f64>()
            };

            DriverSimResult {
                id: d.id.clone(),
                name: d.name.clone(),
                code: d.code.clone(),
                number: d.number,
                image: d.image.clone(),
                team_name: tm.map(|t| t.name.clone()).unwrap_or_else(|| "Independiente".to_string()),
                team_color: tm.map(|t| t.color.clone()).unwrap_or_else(|| "#64748b".to_string()),
                current_points: cur_drv_pts[i],
                current_rank: drv_current_rank[i],
                max_possible_points: max_possible,
                best_mathematical_rank: best_math_rank,
                worst_mathematical_rank: worst_math_rank,
                target_rank,
                target_chance_pct,
                is_rank_locked,
                title_status,
                title_status_label,
                win_probability: (combined.drv_win[i] as f64) * inv_iter,
                podium_probability: (combined.drv_pod[i] as f64) * inv_iter,
                top5_probability: (combined.drv_top5[i] as f64) * inv_iter,
                target_sim_probability,
                expected_points: (combined.drv_pts_sum[i] / (iterations as f64)).round(),
                min_projected_points: p10.round(),
                max_projected_points: p90.round(),
                most_likely_position: best_pos,
                most_likely_position_prob: best_prob.max(0.0),
                position_probabilities: pos_probs,
            }
        })
        .collect();

    results.sort_by(|a, b| {
        a.target_rank
            .cmp(&b.target_rank)
            .then_with(|| {
                b.target_chance_pct
                    .partial_cmp(&a.target_chance_pct)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| {
                b.win_probability
                    .partial_cmp(&a.win_probability)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| {
                b.expected_points
                    .partial_cmp(&a.expected_points)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| a.current_rank.cmp(&b.current_rank))
    });

    let mut team_results: Vec<TeamSimResult> = (0..n_teams)
        .map(|t| {
            let tm = &state.teams[t];
            let mut samples = combined.tm_samples[t].clone();
            samples.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let p10 = if samples.is_empty() {
                cur_tm_pts[t]
            } else {
                samples[(samples.len() as f64 * 0.10) as usize]
            };
            let p90 = if samples.is_empty() {
                cur_tm_pts[t]
            } else {
                samples[((samples.len() as f64 * 0.90) as usize).min(samples.len() - 1)]
            };

            let pos_probs: Vec<f64> = combined.tm_pos[t]
                .iter()
                .map(|&c| (c as f64) * inv_iter)
                .collect();

            let mut best_pos = 1usize;
            let mut best_prob = -1.0f64;
            for (idx, &pr) in pos_probs.iter().enumerate() {
                if pr > best_prob {
                    best_prob = pr;
                    best_pos = idx + 1;
                }
            }

            let max_possible = cur_tm_pts[t] + max_remaining_team;
            let teams_unreachable = (0..n_teams)
                .filter(|&other| other != t && cur_tm_pts[other] > max_possible)
                .count();
            let best_math_rank = 1 + teams_unreachable;

            let teams_who_can_pass = (0..n_teams)
                .filter(|&other| {
                    other != t && (cur_tm_pts[other] + max_remaining_team) >= cur_tm_pts[t]
                })
                .count();
            let worst_math_rank = n_teams.min(1 + teams_who_can_pass);

            let target_rank = best_math_rank;
            let target_holder_idx = tm_order.get(target_rank.saturating_sub(1)).copied().unwrap_or(t);
            let target_holder_pts = cur_tm_pts[target_holder_idx];
            let is_rank_locked =
                pool.remaining_races_count == 0 || best_math_rank == worst_math_rank;

            let raw_chance_pct = if pool.completed_races_count == 0 {
                100.0
            } else if is_rank_locked || cur_tm_pts[t] >= target_holder_pts {
                100.0
            } else if max_remaining_team > 0.0 && max_possible >= target_holder_pts {
                let margin = max_possible - target_holder_pts;
                (((margin + 1.0) / (max_remaining_team + 1.0)) * 100.0).clamp(0.5, 99.9)
            } else {
                0.0
            };
            let target_chance_pct = (raw_chance_pct * 10.0).round() / 10.0;

            let (title_status, title_status_label) = if tm_current_rank[t] == 1
                && (pool.remaining_races_count == 0 || cur_tm_pts[t] > second_team_max_pts)
            {
                (
                    "champion".to_string(),
                    "¡Campeón Consagrado! (1° • 100%)".to_string(),
                )
            } else if best_math_rank == 1 {
                let lbl = if pool.completed_races_count == 0 {
                    "Opción al Mundial (1°) • 100%".to_string()
                } else if tm_current_rank[t] == 1 {
                    "Líder de Constructores (1°) • 100%".to_string()
                } else {
                    format!("Opción al Mundial (1°) • {:.1}%", target_chance_pct)
                };
                ("contender".to_string(), lbl)
            } else if is_rank_locked {
                (
                    "locked".to_string(),
                    format!("{}° Puesto Asegurado • 100%", target_rank),
                )
            } else {
                let lbl = if tm_current_rank[t] == target_rank {
                    format!("Máx. {}° puesto (En {}°) • 100%", target_rank, target_rank)
                } else {
                    format!("Máx. {}° puesto • {:.1}%", target_rank, target_chance_pct)
                };
                ("subtarget".to_string(), lbl)
            };

            let target_sim_probability = if is_rank_locked {
                100.0
            } else {
                pos_probs.iter().take(target_rank).copied().sum::<f64>()
            };

            TeamSimResult {
                id: tm.id.clone(),
                name: tm.name.clone(),
                short_name: tm.short_name.clone(),
                color: tm.color.clone(),
                image: tm.image.clone(),
                driver_names: tm_driver_names[t].clone(),
                current_points: cur_tm_pts[t],
                current_rank: tm_current_rank[t],
                max_possible_points: max_possible,
                best_mathematical_rank: best_math_rank,
                worst_mathematical_rank: worst_math_rank,
                target_rank,
                target_chance_pct,
                is_rank_locked,
                title_status,
                title_status_label,
                win_probability: (combined.tm_win[t] as f64) * inv_iter,
                podium_probability: (combined.tm_pod[t] as f64) * inv_iter,
                top5_probability: (combined.tm_top5[t] as f64) * inv_iter,
                target_sim_probability,
                expected_points: (combined.tm_pts_sum[t] / (iterations as f64)).round(),
                min_projected_points: p10.round(),
                max_projected_points: p90.round(),
                most_likely_position: best_pos,
                most_likely_position_prob: best_prob.max(0.0),
                position_probabilities: pos_probs,
            }
        })
        .collect();

    team_results.sort_by(|a, b| {
        a.target_rank
            .cmp(&b.target_rank)
            .then_with(|| {
                b.target_chance_pct
                    .partial_cmp(&a.target_chance_pct)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| {
                b.win_probability
                    .partial_cmp(&a.win_probability)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| {
                b.expected_points
                    .partial_cmp(&a.expected_points)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| a.current_rank.cmp(&b.current_rank))
    });

    let elapsed_ms = start_instant.elapsed().as_secs_f64() * 1000.0;

    MonteCarloOutput {
        pool,
        iterations,
        remaining_races: remaining_tracks.len(),
        results,
        team_results,
        elapsed_ms,
        threads_used,
        engine_badge: format!(
            "⚙️ Motor multihilo ({} hilos) • {:.1} ms",
            threads_used, elapsed_ms
        ),
    }
}
