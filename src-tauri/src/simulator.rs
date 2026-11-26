use crate::models::{EntitySimProb, SeasonState, SimulationOutput, Track};
use crate::standings::compute_dashboard;
use rayon::prelude::*;
use std::collections::HashMap;

pub fn run_simulation(
    state: &SeasonState,
    iterations: u32,
    form_weight: f64,
    chaos: f64,
) -> SimulationOutput {
    let iters = iterations.clamp(500, 100_000);
    let dash = compute_dashboard(state);
    let n_drivers = state.drivers.len();
    let n_teams = state.teams.len();

    if n_drivers == 0 {
        return SimulationOutput {
            iterations: iters,
            drivers: HashMap::new(),
            teams: HashMap::new(),
        };
    }

    let driver_idx_by_id: HashMap<&str, usize> = state
        .drivers
        .iter()
        .enumerate()
        .map(|(i, d)| (d.id.as_str(), i))
        .collect();
    let team_idx_by_id: HashMap<&str, usize> = state
        .teams
        .iter()
        .enumerate()
        .map(|(i, t)| (t.id.as_str(), i))
        .collect();

    let mut base_d_pts = vec![0.0; n_drivers];
    let mut base_d_wins = vec![0u32; n_drivers];
    let mut base_d_skill = vec![80.0; n_drivers];
    let mut base_t_pts = vec![0.0; n_teams];
    let mut base_t_wins = vec![0u32; n_teams];
    let mut driver_team_idx = vec![usize::MAX; n_drivers];

    for (i, d) in state.drivers.iter().enumerate() {
        base_d_skill[i] = d.base_rating;
        if let Some(&ti) = team_idx_by_id.get(d.team_id.as_str()) {
            driver_team_idx[i] = ti;
        }
    }

    for ds in &dash.drivers {
        if let Some(&idx) = driver_idx_by_id.get(ds.id.as_str()) {
            base_d_pts[idx] = ds.points;
            base_d_wins[idx] = ds.wins;
            base_d_skill[idx] = ds.skill_rating;
        }
    }
    for ts in &dash.teams {
        if let Some(&idx) = team_idx_by_id.get(ts.id.as_str()) {
            base_t_pts[idx] = ts.points;
            base_t_wins[idx] = ts.wins;
        }
    }

    let max_pts_so_far = base_d_pts.iter().cloned().fold(1.0_f64, f64::max);
    let fw = form_weight.clamp(0.0, 1.0);
    let ch = chaos.clamp(0.05, 1.0);
    let dnf_prob = 0.06 + ch * 0.16;
    let noise_span = 16.0 + ch * 54.0;

    // Comprimimos el rango base a 78..96 para que el ruido por carrera genere peleas realistas
    let driver_strength: Vec<f64> = state
        .drivers
        .iter()
        .enumerate()
        .map(|(i, _d)| {
            let form_score = 78.0 + (base_d_pts[i] / max_pts_so_far) * 18.0;
            let skill_norm = 78.0 + ((base_d_skill[i] - 60.0) / 39.0) * 18.0;
            skill_norm * (1.0 - fw) + form_score * fw
        })
        .collect();

    let pending: Vec<&Track> = state.tracks.iter().filter(|t| !t.completed).collect();
    let ps = &state.points_system;

    #[derive(Clone)]
    struct Tally {
        d_title: Vec<u32>,
        d_podium: Vec<u32>,
        d_top10: Vec<u32>,
        d_pts_sum: Vec<f64>,
        d_rank_sum: Vec<u64>,
        d_pos_counts: Vec<Vec<u32>>,
        t_title: Vec<u32>,
        t_podium: Vec<u32>,
        t_pts_sum: Vec<f64>,
        t_rank_sum: Vec<u64>,
        t_pos_counts: Vec<Vec<u32>>,
    }

    let empty_tally = || Tally {
        d_title: vec![0; n_drivers],
        d_podium: vec![0; n_drivers],
        d_top10: vec![0; n_drivers],
        d_pts_sum: vec![0.0; n_drivers],
        d_rank_sum: vec![0; n_drivers],
        d_pos_counts: vec![vec![0; n_drivers]; n_drivers],
        t_title: vec![0; n_teams],
        t_podium: vec![0; n_teams],
        t_pts_sum: vec![0.0; n_teams],
        t_rank_sum: vec![0; n_teams],
        t_pos_counts: vec![vec![0; n_teams]; n_teams],
    };

    let merged = (0..iters)
        .into_par_iter()
        .fold(empty_tally, |mut acc, _| {
            let mut rng = fastrand::Rng::new();
            let mut d_pts = base_d_pts.clone();
            let mut d_wins = base_d_wins.clone();
            let mut t_pts = base_t_pts.clone();
            let mut t_wins = base_t_wins.clone();
            let mut order: Vec<(usize, f64)> = Vec::with_capacity(n_drivers);

            for track in &pending {
                let mult = if track.points_multiplier < 0.0 { 1.0 } else { track.points_multiplier };

                if track.has_sprint {
                    order.clear();
                    for i in 0..n_drivers {
                        if rng.f64() < dnf_prob * 0.5 {
                            continue;
                        }
                        let bell = ((rng.f64() + rng.f64()) - 1.0) * noise_span * 0.6;
                        let perf = driver_strength[i] + bell;
                        order.push((i, perf));
                    }
                    order.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
                    for (pos, (d_i, _)) in order.iter().enumerate() {
                        let pts = ps.sprint_points.get(pos).copied().unwrap_or(0.0) * mult;
                        if pts > 0.0 {
                            d_pts[*d_i] += pts;
                            let ti = driver_team_idx[*d_i];
                            if ti < n_teams {
                                t_pts[ti] += pts;
                            }
                        }
                    }
                }

                order.clear();
                for i in 0..n_drivers {
                    if rng.f64() < dnf_prob {
                        continue;
                    }
                    // Suma de dos uniformes para centrar la variacion cerca del ritmo real
                    let bell = ((rng.f64() + rng.f64()) - 1.0) * noise_span * 0.65;
                    let perf = driver_strength[i] + bell;
                    order.push((i, perf));
                }
                order.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

                for (pos, (d_i, _)) in order.iter().enumerate() {
                    let pts = ps.race_points.get(pos).copied().unwrap_or(0.0) * mult;
                    d_pts[*d_i] += pts;
                    if pos == 0 {
                        d_wins[*d_i] += 1;
                    }
                    let ti = driver_team_idx[*d_i];
                    if ti < n_teams {
                        t_pts[ti] += pts;
                        if pos == 0 {
                            t_wins[ti] += 1;
                        }
                    }
                }

                if ps.fastest_lap_points > 0.0 && !order.is_empty() {
                    let top_n = order.len().min(ps.fastest_lap_top_limit);
                    let fl_pick = rng.usize(0..top_n);
                    let d_i = order[fl_pick].0;
                    let bonus = ps.fastest_lap_points * mult;
                    d_pts[d_i] += bonus;
                    let ti = driver_team_idx[d_i];
                    if ti < n_teams {
                        t_pts[ti] += bonus;
                    }
                }

                if ps.pole_points > 0.0 && n_drivers > 0 {
                    let p_pick = order.first().map(|x| x.0).unwrap_or(0);
                    let bonus = ps.pole_points * mult;
                    d_pts[p_pick] += bonus;
                    let ti = driver_team_idx[p_pick];
                    if ti < n_teams {
                        t_pts[ti] += bonus;
                    }
                }
            }

            let mut d_rank: Vec<usize> = (0..n_drivers).collect();
            d_rank.sort_by(|&a, &b| {
                d_pts[b]
                    .partial_cmp(&d_pts[a])
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| d_wins[b].cmp(&d_wins[a]))
            });
            for (rank, &d_i) in d_rank.iter().enumerate() {
                if rank == 0 {
                    acc.d_title[d_i] += 1;
                }
                if rank < 3 {
                    acc.d_podium[d_i] += 1;
                }
                if rank < 10 {
                    acc.d_top10[d_i] += 1;
                }
                acc.d_pts_sum[d_i] += d_pts[d_i];
                acc.d_rank_sum[d_i] += (rank + 1) as u64;
                acc.d_pos_counts[d_i][rank] += 1;
            }

            let mut t_rank: Vec<usize> = (0..n_teams).collect();
            t_rank.sort_by(|&a, &b| {
                t_pts[b]
                    .partial_cmp(&t_pts[a])
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| t_wins[b].cmp(&t_wins[a]))
            });
            for (rank, &t_i) in t_rank.iter().enumerate() {
                if rank == 0 {
                    acc.t_title[t_i] += 1;
                }
                if rank < 3 {
                    acc.t_podium[t_i] += 1;
                }
                acc.t_pts_sum[t_i] += t_pts[t_i];
                acc.t_rank_sum[t_i] += (rank + 1) as u64;
                acc.t_pos_counts[t_i][rank] += 1;
            }

            acc
        })
        .reduce(empty_tally, |mut a, b| {
            for i in 0..n_drivers {
                a.d_title[i] += b.d_title[i];
                a.d_podium[i] += b.d_podium[i];
                a.d_top10[i] += b.d_top10[i];
                a.d_pts_sum[i] += b.d_pts_sum[i];
                a.d_rank_sum[i] += b.d_rank_sum[i];
                for r in 0..n_drivers {
                    a.d_pos_counts[i][r] += b.d_pos_counts[i][r];
                }
            }
            for i in 0..n_teams {
                a.t_title[i] += b.t_title[i];
                a.t_podium[i] += b.t_podium[i];
                a.t_pts_sum[i] += b.t_pts_sum[i];
                a.t_rank_sum[i] += b.t_rank_sum[i];
                for r in 0..n_teams {
                    a.t_pos_counts[i][r] += b.t_pos_counts[i][r];
                }
            }
            a
        });

    let f_iters = iters as f64;
    let mut drivers_out = HashMap::new();
    for (i, d) in state.drivers.iter().enumerate() {
        let position_probs = merged.d_pos_counts[i]
            .iter()
            .map(|&c| (c as f64 / f_iters) * 100.0)
            .collect();
        drivers_out.insert(
            d.id.clone(),
            EntitySimProb {
                id: d.id.clone(),
                title_pct: (merged.d_title[i] as f64 / f_iters) * 100.0,
                podium_pct: (merged.d_podium[i] as f64 / f_iters) * 100.0,
                top10_pct: (merged.d_top10[i] as f64 / f_iters) * 100.0,
                avg_points: merged.d_pts_sum[i] / f_iters,
                expected_rank: merged.d_rank_sum[i] as f64 / f_iters,
                position_probs,
            },
        );
    }

    let mut teams_out = HashMap::new();
    for (i, t) in state.teams.iter().enumerate() {
        let position_probs = merged.t_pos_counts[i]
            .iter()
            .map(|&c| (c as f64 / f_iters) * 100.0)
            .collect();
        teams_out.insert(
            t.id.clone(),
            EntitySimProb {
                id: t.id.clone(),
                title_pct: (merged.t_title[i] as f64 / f_iters) * 100.0,
                podium_pct: (merged.t_podium[i] as f64 / f_iters) * 100.0,
                top10_pct: 100.0,
                avg_points: merged.t_pts_sum[i] / f_iters,
                expected_rank: merged.t_rank_sum[i] as f64 / f_iters,
                position_probs,
            },
        );
    }

    SimulationOutput {
        iterations: iters,
        drivers: drivers_out,
        teams: teams_out,
    }
}
