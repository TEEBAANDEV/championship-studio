use crate::models::{
    ChampionshipPool, DashboardData, DriverProgression, DriverStanding, PointsSystem, SeasonState,
    Team, TeamStanding, TrackResults,
};
use std::collections::HashMap;

pub fn race_total_points(ps: &PointsSystem, mult: f64) -> f64 {
    let base: f64 = ps.race_points.iter().sum();
    base * mult + ps.fastest_lap_points * mult + ps.pole_points * mult
}

pub fn sprint_total_points(ps: &PointsSystem, mult: f64) -> f64 {
    let base: f64 = ps.sprint_points.iter().sum();
    base * mult
}

pub fn max_driver_race_points(ps: &PointsSystem, mult: f64) -> f64 {
    let top = ps.race_points.first().copied().unwrap_or(0.0);
    (top + ps.fastest_lap_points + ps.pole_points) * mult
}

pub fn max_driver_sprint_points(ps: &PointsSystem, mult: f64) -> f64 {
    ps.sprint_points.first().copied().unwrap_or(0.0) * mult
}

pub fn max_team_race_points(ps: &PointsSystem, mult: f64) -> f64 {
    let p1 = ps.race_points.first().copied().unwrap_or(0.0);
    let p2 = ps.race_points.get(1).copied().unwrap_or(0.0);
    (p1 + p2 + ps.fastest_lap_points + ps.pole_points) * mult
}

pub fn max_team_sprint_points(ps: &PointsSystem, mult: f64) -> f64 {
    let p1 = ps.sprint_points.first().copied().unwrap_or(0.0);
    let p2 = ps.sprint_points.get(1).copied().unwrap_or(0.0);
    (p1 + p2) * mult
}

fn is_non_classified(results: &TrackResults, driver_id: &str) -> bool {
    if let Some(st) = results.driver_statuses.get(driver_id) {
        let u = st.to_uppercase();
        if u == "DNF" || u == "DNS" || u == "DSQ" {
            return true;
        }
    }
    results.dnf_driver_ids.iter().any(|id| id == driver_id)
}

#[derive(Clone, Default)]
struct Accum {
    points: f64,
    wins: u32,
    podiums: u32,
    counts: [u32; 25],
    finishes: Vec<f64>,
    dnf_count: u32,
}

fn compare_countback(a: &Accum, b: &Accum) -> std::cmp::Ordering {
    // Desempate oficial: mayor puntaje y luego conteo de mejores puestos (1°, 2°, 3°...)
    b.points
        .partial_cmp(&a.points)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then_with(|| b.counts.cmp(&a.counts))
}

pub fn compute_dashboard(state: &SeasonState) -> DashboardData {
    let mut driver_map: HashMap<String, Accum> = state
        .drivers
        .iter()
        .map(|d| (d.id.clone(), Accum::default()))
        .collect();
    let mut team_map: HashMap<String, Accum> = state
        .teams
        .iter()
        .map(|t| (t.id.clone(), Accum::default()))
        .collect();

    let driver_default_team: HashMap<&str, &str> = state
        .drivers
        .iter()
        .map(|d| (d.id.as_str(), d.team_id.as_str()))
        .collect();

    let mut total_pool = 0.0;
    let mut distributed_points = 0.0;
    let mut remaining_points = 0.0;
    let mut max_driver_remaining = 0.0;
    let mut max_team_remaining = 0.0;
    let mut completed_races = 0usize;
    let mut pending_races = 0usize;
    let mut round_labels: Vec<String> = Vec::new();
    let mut round_snapshots: HashMap<String, Vec<f64>> = state
        .drivers
        .iter()
        .map(|d| (d.id.clone(), Vec::new()))
        .collect();
    let mut team_snapshots: HashMap<String, Vec<f64>> = state
        .teams
        .iter()
        .map(|t| (t.id.clone(), Vec::new()))
        .collect();

    let ps = &state.points_system;

    for track in &state.tracks {
        let mult = if track.points_multiplier < 0.0 { 1.0 } else { track.points_multiplier };
        let race_pool = race_total_points(ps, mult)
            + if track.has_sprint { sprint_total_points(ps, mult) } else { 0.0 };
        total_pool += race_pool;

        if !track.completed {
            pending_races += 1;
            remaining_points += race_pool;
            max_driver_remaining += max_driver_race_points(ps, mult)
                + if track.has_sprint { max_driver_sprint_points(ps, mult) } else { 0.0 };
            max_team_remaining += max_team_race_points(ps, mult)
                + if track.has_sprint { max_team_sprint_points(ps, mult) } else { 0.0 };
            continue;
        }

        completed_races += 1;

        let resolve_team = |driver_id: &str| -> String {
            track
                .results
                .driver_teams
                .get(driver_id)
                .cloned()
                .or_else(|| driver_default_team.get(driver_id).map(|s| (*s).to_string()))
                .unwrap_or_default()
        };

        let mut pos_idx = 0usize;
        for d_id in &track.results.race_order {
            if is_non_classified(&track.results, d_id) {
                if let Some(acc) = driver_map.get_mut(d_id) {
                    acc.dnf_count += 1;
                    acc.finishes.push(20.0);
                }
                continue;
            }
            let pts = ps.race_points.get(pos_idx).copied().unwrap_or(0.0) * mult;
            distributed_points += pts;

            if let Some(acc) = driver_map.get_mut(d_id) {
                acc.points += pts;
                acc.finishes.push((pos_idx + 1) as f64);
                if pos_idx == 0 {
                    acc.wins += 1;
                }
                if pos_idx < 3 {
                    acc.podiums += 1;
                }
                if pos_idx < acc.counts.len() {
                    acc.counts[pos_idx] += 1;
                }
            }
            let t_id = resolve_team(d_id);
            if let Some(t_acc) = team_map.get_mut(&t_id) {
                t_acc.points += pts;
                if pos_idx == 0 {
                    t_acc.wins += 1;
                }
                if pos_idx < 3 {
                    t_acc.podiums += 1;
                }
                if pos_idx < t_acc.counts.len() {
                    t_acc.counts[pos_idx] += 1;
                }
            }
            pos_idx += 1;
        }

        if ps.fastest_lap_points > 0.0 && !track.results.fastest_lap_driver_id.is_empty() {
            let fl_id = &track.results.fastest_lap_driver_id;
            let classified_pos = track
                .results
                .race_order
                .iter()
                .filter(|id| !is_non_classified(&track.results, id))
                .position(|id| id == fl_id);
            if let Some(pos) = classified_pos {
                if pos < ps.fastest_lap_top_limit {
                    let bonus = ps.fastest_lap_points * mult;
                    distributed_points += bonus;
                    if let Some(acc) = driver_map.get_mut(fl_id) {
                        acc.points += bonus;
                    }
                    let t_id = resolve_team(fl_id);
                    if let Some(t_acc) = team_map.get_mut(&t_id) {
                        t_acc.points += bonus;
                    }
                }
            }
        }

        if ps.pole_points > 0.0 && !track.results.pole_driver_id.is_empty() {
            let p_id = &track.results.pole_driver_id;
            let bonus = ps.pole_points * mult;
            distributed_points += bonus;
            if let Some(acc) = driver_map.get_mut(p_id) {
                acc.points += bonus;
            }
            let t_id = resolve_team(p_id);
            if let Some(t_acc) = team_map.get_mut(&t_id) {
                t_acc.points += bonus;
            }
        }

        if track.has_sprint {
            for (idx, d_id) in track.results.sprint_order.iter().enumerate() {
                if is_non_classified(&track.results, d_id) {
                    continue;
                }
                let pts = ps.sprint_points.get(idx).copied().unwrap_or(0.0) * mult;
                if pts <= 0.0 {
                    continue;
                }
                distributed_points += pts;
                if let Some(acc) = driver_map.get_mut(d_id) {
                    acc.points += pts;
                }
                let t_id = resolve_team(d_id);
                if let Some(t_acc) = team_map.get_mut(&t_id) {
                    t_acc.points += pts;
                }
            }
        }

        round_labels.push(format!("R{}", track.round));
        for d in &state.drivers {
            let pts_now = driver_map.get(&d.id).map(|a| a.points).unwrap_or(0.0);
            if let Some(series) = round_snapshots.get_mut(&d.id) {
                series.push(pts_now);
            }
        }
        for t in &state.teams {
            let pts_now = team_map.get(&t.id).map(|a| a.points).unwrap_or(0.0);
            if let Some(series) = team_snapshots.get_mut(&t.id) {
                series.push(pts_now);
            }
        }
    }

    let teams_by_id: HashMap<&str, &Team> = state.teams.iter().map(|t| (t.id.as_str(), t)).collect();

    let mut driver_rows: Vec<(DriverStanding, Accum)> = state
        .drivers
        .iter()
        .map(|d| {
            let acc = driver_map.get(&d.id).cloned().unwrap_or_default();
            let tm = teams_by_id.get(d.team_id.as_str());
            let max_possible = acc.points + max_driver_remaining;
            // Rating dinamico (60..99): mezcla temporada completa, ultimas 5 carreras y fiabilidad
            let skill_rating = if acc.finishes.is_empty() {
                d.base_rating
            } else {
                let n = acc.finishes.len() as f64;
                let avg_all = acc.finishes.iter().sum::<f64>() / n;
                let recent_slice = &acc.finishes[acc.finishes.len().saturating_sub(5)..];
                let avg_recent = recent_slice.iter().sum::<f64>() / recent_slice.len() as f64;
                let finish_rate = (n - acc.dnf_count as f64).max(0.0) / n;
                let s_all = (98.0 - (avg_all - 1.0) * 1.8).clamp(60.0, 99.0);
                let s_recent = (98.0 - (avg_recent - 1.0) * 1.8).clamp(60.0, 99.0);
                let s_rel = 65.0 + finish_rate * 34.0;
                (0.45 * s_all + 0.45 * s_recent + 0.10 * s_rel).clamp(60.0, 99.0)
            };
            (
                DriverStanding {
                    rank: 0,
                    id: d.id.clone(),
                    name: d.name.clone(),
                    code: d.code.clone(),
                    number: d.number,
                    team_id: d.team_id.clone(),
                    team_name: tm.map(|t| t.name.clone()).unwrap_or_else(|| "Independiente".into()),
                    team_short: tm.map(|t| t.short_name.clone()).unwrap_or_else(|| "IND".into()),
                    team_color: tm.map(|t| t.color.clone()).unwrap_or_else(|| "#888888".into()),
                    points: acc.points,
                    wins: acc.wins,
                    podiums: acc.podiums,
                    gap_to_leader: 0.0,
                    max_possible,
                    best_possible_rank: 1,
                    in_contention: false,
                    status_label: String::new(),
                    skill_rating,
                },
                acc,
            )
        })
        .collect();

    driver_rows.sort_by(|a, b| compare_countback(&a.1, &b.1).then_with(|| a.0.name.cmp(&b.0.name)));

    let leader_pts = driver_rows.first().map(|r| r.0.points).unwrap_or(0.0);
    let mut contenders_count = 0usize;

    for i in 0..driver_rows.len() {
        let max_p = driver_rows[i].0.max_possible;
        let strictly_ahead = driver_rows
            .iter()
            .enumerate()
            .filter(|(j, r)| *j != i && r.0.points > max_p + 1e-9)
            .count();
        let best_rank = strictly_ahead + 1;
        let in_cont = max_p + 1e-9 >= leader_pts;
        if in_cont {
            contenders_count += 1;
        }
        let row = &mut driver_rows[i].0;
        row.rank = i + 1;
        row.gap_to_leader = (leader_pts - row.points).max(0.0);
        row.best_possible_rank = best_rank;
        row.in_contention = in_cont;
        row.status_label = if i == 0 {
            "Líder".into()
        } else if in_cont {
            "En pelea".into()
        } else {
            "Sin chances".into()
        };
    }

    let drivers: Vec<DriverStanding> = driver_rows.into_iter().map(|(r, _)| r).collect();

    let mut team_rows: Vec<(TeamStanding, Accum)> = state
        .teams
        .iter()
        .map(|t| {
            let acc = team_map.get(&t.id).cloned().unwrap_or_default();
            let max_possible = acc.points + max_team_remaining;
            (
                TeamStanding {
                    rank: 0,
                    id: t.id.clone(),
                    name: t.name.clone(),
                    short_name: t.short_name.clone(),
                    color: t.color.clone(),
                    points: acc.points,
                    wins: acc.wins,
                    podiums: acc.podiums,
                    gap_to_leader: 0.0,
                    max_possible,
                    best_possible_rank: 1,
                    in_contention: false,
                    status_label: String::new(),
                },
                acc,
            )
        })
        .collect();

    team_rows.sort_by(|a, b| compare_countback(&a.1, &b.1).then_with(|| a.0.name.cmp(&b.0.name)));
    let t_leader_pts = team_rows.first().map(|r| r.0.points).unwrap_or(0.0);

    for i in 0..team_rows.len() {
        let max_p = team_rows[i].0.max_possible;
        let strictly_ahead = team_rows
            .iter()
            .enumerate()
            .filter(|(j, r)| *j != i && r.0.points > max_p + 1e-9)
            .count();
        let best_rank = strictly_ahead + 1;
        let in_cont = max_p + 1e-9 >= t_leader_pts;
        let row = &mut team_rows[i].0;
        row.rank = i + 1;
        row.gap_to_leader = (t_leader_pts - row.points).max(0.0);
        row.best_possible_rank = best_rank;
        row.in_contention = in_cont;
        row.status_label = if i == 0 {
            "Líder".into()
        } else if in_cont {
            "En pelea".into()
        } else {
            "Sin chances".into()
        };
    }

    let teams: Vec<TeamStanding> = team_rows.into_iter().map(|(r, _)| r).collect();

    let progression: Vec<DriverProgression> = drivers
        .iter()
        .take(6)
        .map(|d| DriverProgression {
            id: d.id.clone(),
            name: d.name.clone(),
            code: d.code.clone(),
            color: d.team_color.clone(),
            points_by_round: round_snapshots.get(&d.id).cloned().unwrap_or_default(),
        })
        .collect();

    let team_progression: Vec<DriverProgression> = teams
        .iter()
        .take(6)
        .map(|t| DriverProgression {
            id: t.id.clone(),
            name: t.name.clone(),
            code: t.short_name.clone(),
            color: t.color.clone(),
            points_by_round: team_snapshots.get(&t.id).cloned().unwrap_or_default(),
        })
        .collect();

    DashboardData {
        pool: ChampionshipPool {
            total_pool,
            distributed_points,
            remaining_points,
            max_driver_remaining,
            completed_races,
            pending_races,
            total_races: state.tracks.len(),
            contenders_count,
        },
        drivers,
        teams,
        round_labels,
        progression,
        team_progression,
    }
}
