use crate::models::{
    DriverStanding, PointsSystem, RivalRequirement, SeasonState, TargetAnalysis, TeamStanding,
    Track,
};
use crate::standings::{compute_dashboard, max_driver_race_points, max_driver_sprint_points};

fn pos_label_for_avg_points(ps: &PointsSystem, pts_per_race: f64) -> String {
    if pts_per_race <= 0.0 {
        return "sin necesidad de sumar puntos".into();
    }
    for (idx, &p) in ps.race_points.iter().enumerate() {
        if p <= pts_per_race + 1e-6 && idx == 0 {
            return "1° puesto (victoria)".into();
        }
    }
    let mut best_pos = None;
    for (idx, &p) in ps.race_points.iter().enumerate().rev() {
        if p + 1e-6 >= pts_per_race {
            best_pos = Some(idx + 1);
            break;
        }
    }
    match best_pos {
        Some(pos) => format!("al menos {}° puesto por carrera", pos),
        None => "1° puesto y puntos extra (Sprint / VR)".into(),
    }
}

fn rival_must_finish_at_or_worse(ps: &PointsSystem, max_allowed_pts: f64, mult: f64) -> String {
    if max_allowed_pts < 0.0 {
        return "no puede ser superado ni quedando último".into();
    }
    for (idx, &p) in ps.race_points.iter().enumerate() {
        if p * mult <= max_allowed_pts + 1e-6 {
            return if idx == 0 {
                "puede terminar incluso 1°".into()
            } else {
                format!("debe terminar {}° o peor", idx + 1)
            };
        }
    }
    format!(
        "debe quedar fuera de puntos ({}° o peor / DNF)",
        ps.race_points.len() + 1
    )
}

fn driver_best_pos_to_reach(ps: &PointsSystem, needed_pts: f64, mult: f64) -> String {
    if needed_pts <= 0.0 {
        return "incluso sin sumar puntos".into();
    }
    for (idx, &p) in ps.race_points.iter().enumerate().rev() {
        if p * mult + 1e-6 >= needed_pts {
            return format!("al menos {}° puesto", idx + 1);
        }
    }
    let top = ps.race_points.first().copied().unwrap_or(0.0) * mult;
    if needed_pts <= top + (ps.fastest_lap_points + ps.pole_points) * mult + 1e-6 {
        "1° puesto + bonificación (VR / Pole)".into()
    } else {
        format!("sumar {:.0} pts (requiere Sprint / bonificaciones)", needed_pts)
    }
}

pub fn analyze_target(
    state: &SeasonState,
    kind: &str,
    entity_id: &str,
    custom_target_rank: Option<usize>,
) -> Option<TargetAnalysis> {
    let dash = compute_dashboard(state);
    let pending_tracks: Vec<&Track> = state.tracks.iter().filter(|t| !t.completed).collect();
    let pending = pending_tracks.len();
    let ps = &state.points_system;

    if kind == "team" {
        let me = dash.teams.iter().find(|t| t.id == entity_id)?;
        let target = custom_target_rank
            .unwrap_or(me.best_possible_rank)
            .clamp(me.best_possible_rank, dash.teams.len());

        if pending == 0 {
            return Some(TargetAnalysis {
                entity_name: me.name.clone(),
                current_rank: me.rank,
                target_rank: target,
                best_possible_rank: me.best_possible_rank,
                current_points: me.points,
                max_possible: me.max_possible,
                pending_races: 0,
                headline: format!("Temporada finalizada en el puesto #{}", me.rank),
                details: vec!["No quedan fechas pendientes por disputar.".into()],
                rivals: Vec::new(),
            });
        }

        let mut details = Vec::new();
        let mut rivals = Vec::new();
        let mut headline = format!("Objetivo #{}: requiere superar a los rivales directos", target);

        let ahead: Vec<&TeamStanding> = dash
            .teams
            .iter()
            .filter(|t| t.id != me.id && t.points > me.points)
            .collect();
        let pass_needed = ahead.len().saturating_sub(target.saturating_sub(1));

        if pass_needed == 0 {
            let max_below = dash
                .teams
                .iter()
                .filter(|t| t.id != me.id && t.rank >= target)
                .map(|t| t.max_possible)
                .fold(0.0_f64, f64::max);
            let clinch = (max_below - me.points + 1.0).max(0.0);

            if clinch <= 0.0 {
                headline = format!("¡Puesto #{} asegurado matemáticamente!", target);
                details.push("Ninguna escudería por detrás puede alcanzar su puntaje actual.".into());
            } else {
                headline = format!(
                    "Depende de sí misma: necesita {:.0} pts más para asegurar el #{}",
                    clinch, target
                );
                details.push(format!(
                    "Sumando {:.0} pts en {} fecha(s) ({:.1} pts/carrera entre ambos autos), asegura al menos el #{}.",
                    clinch,
                    pending,
                    clinch / pending as f64,
                    target
                ));
            }
        } else if let Some(target_rival) = ahead.iter().rev().nth(pass_needed - 1) {
            let gap = target_rival.points - me.points;
            headline = format!(
                "Debe descontar {:.0} pts a {} (promedio {:.1} pts/carrera más que ellos)",
                gap,
                target_rival.short_name,
                gap / pending as f64
            );
            details.push(format!(
                "Actualmente está {:.0} pts por detrás de {} en {} fecha(s) restante(s).",
                gap, target_rival.name, pending
            ));

            for r in ahead.iter().rev().take(pass_needed) {
                let d_pts = r.points - me.points;
                let max_rival_add = (me.max_possible - r.points - 1.0).max(0.0);
                rivals.push(RivalRequirement {
                    name: r.name.clone(),
                    points: r.points,
                    max_possible: r.max_possible,
                    summary: format!(
                        "Está {:.0} pts arriba. {} necesita sumar al menos {:.0} pts más que {} (si {} hace su máximo, {} no puede sumar más de {:.0} pts).",
                        d_pts, me.short_name, d_pts + 1.0, r.short_name, me.short_name, r.short_name, max_rival_add
                    ),
                });
            }
        }

        return Some(TargetAnalysis {
            entity_name: me.name.clone(),
            current_rank: me.rank,
            target_rank: target,
            best_possible_rank: me.best_possible_rank,
            current_points: me.points,
            max_possible: me.max_possible,
            pending_races: pending,
            headline,
            details,
            rivals,
        });
    }

    let me = dash.drivers.iter().find(|d| d.id == entity_id)?;
    let target = custom_target_rank
        .unwrap_or(me.best_possible_rank)
        .clamp(me.best_possible_rank, dash.drivers.len());

    if pending == 0 {
        return Some(TargetAnalysis {
            entity_name: me.name.clone(),
            current_rank: me.rank,
            target_rank: target,
            best_possible_rank: me.best_possible_rank,
            current_points: me.points,
            max_possible: me.max_possible,
            pending_races: 0,
            headline: format!("Temporada finalizada en el puesto #{}", me.rank),
            details: vec!["No quedan fechas pendientes por disputar.".into()],
            rivals: Vec::new(),
        });
    }

    let mut details = Vec::new();
    let mut rivals = Vec::new();
    let headline;

    if pending == 1 {
        // Ultima fecha: evaluamos posiciones exactas y desempate por victorias
        let last = pending_tracks[0];
        let mult = if last.points_multiplier < 0.0 { 1.0 } else { last.points_multiplier };
        let mut max_win_pts = max_driver_race_points(ps, mult);
        if last.has_sprint {
            max_win_pts += max_driver_sprint_points(ps, mult);
        }

        let ahead: Vec<&DriverStanding> = dash
            .drivers
            .iter()
            .filter(|d| d.id != me.id && d.points > me.points)
            .collect();
        let pass_needed = ahead.len().saturating_sub(target.saturating_sub(1));

        if pass_needed == 0 {
            let max_below = dash
                .drivers
                .iter()
                .filter(|d| d.id != me.id && d.rank >= target)
                .map(|d| d.max_possible)
                .fold(0.0_f64, f64::max);
            let clinch = (max_below - me.points + 1.0).max(0.0);
            if clinch <= 0.0 {
                headline = format!("¡Puesto #{} asegurado matemáticamente!", target);
                details.push(format!("Ningún rival puede alcanzar sus {:.0} pts en {}.", me.points, last.name));
            } else {
                let req_pos = driver_best_pos_to_reach(ps, clinch, mult);
                headline = format!(
                    "Última fecha ({}): necesita {} para asegurar el #{}",
                    last.name, req_pos, target
                );
                details.push(format!(
                    "Sumando {:.0} pts ({}) nadie por detrás puede superarlo.",
                    clinch, req_pos
                ));
            }
        } else if let Some(target_rival) = ahead.iter().rev().nth(pass_needed - 1) {
            let diff = target_rival.points - me.points;
            let my_req = driver_best_pos_to_reach(ps, diff + 1.0, mult);
            let rival_max_if_i_win = (me.points + max_win_pts - target_rival.points - 1.0).max(-1.0);
            let rival_pos = rival_must_finish_at_or_worse(ps, rival_max_if_i_win, mult);

            headline = format!(
                "En {}: {} necesita {} y que {} {}",
                last.name, me.code, my_req, target_rival.code, rival_pos
            );
            details.push(format!(
                "Está {:.0} pts detrás de {}. Incluso ganando todo ({:.0} pts), necesita que sus rivales directos no sumen.",
                diff, target_rival.name, max_win_pts
            ));
        } else {
            headline = format!("Última fecha: {}", last.name);
        }

        let direct_rivals: Vec<&DriverStanding> = dash
            .drivers
            .iter()
            .filter(|d| d.id != me.id && d.max_possible >= me.points)
            .take(4)
            .collect();

        for r in direct_rivals {
            let diff = r.points - me.points;
            let summary = if diff.abs() < 1e-6 {
                if me.wins > r.wins {
                    format!("Empatados en puntos: en caso de igualdad, gana {} por victorias ({} vs {}).", me.code, me.wins, r.wins)
                } else if r.wins > me.wins {
                    format!("Empatados en puntos: {} gana por victorias ({} vs {}), por lo que {} debe quedar por delante.", r.code, r.wins, me.wins, me.code)
                } else {
                    "Empatados en puntos y victorias: quien termine delante en la carrera se queda con el puesto.".into()
                }
            } else if diff > 0.0 {
                let min_pos = driver_best_pos_to_reach(ps, diff + 1.0, mult);
                let r_cap = (me.points + max_win_pts - r.points - 1.0).max(-1.0);
                let r_pos = rival_must_finish_at_or_worse(ps, r_cap, mult);
                format!(
                    "Está {:.0} pts arriba: {} necesita {} (y si {} gana, {} {}).",
                    diff, me.code, min_pos, me.code, r.code, r_pos
                )
            } else {
                let r_needed = (-diff) + 1.0;
                let r_pos = driver_best_pos_to_reach(ps, r_needed, mult);
                format!(
                    "{} tiene {:.0} pts de ventaja: solo lo pierde si {} logra {} y {} no suma.",
                    me.code, -diff, r.code, r_pos, me.code
                )
            };
            rivals.push(RivalRequirement {
                name: r.name.clone(),
                points: r.points,
                max_possible: r.max_possible,
                summary,
            });
        }
    } else {
        let ahead: Vec<&DriverStanding> = dash
            .drivers
            .iter()
            .filter(|d| d.id != me.id && d.points > me.points)
            .collect();
        let pass_needed = ahead.len().saturating_sub(target.saturating_sub(1));

        if pass_needed == 0 {
            let max_below = dash
                .drivers
                .iter()
                .filter(|d| d.id != me.id && d.rank >= target)
                .map(|d| d.max_possible)
                .fold(0.0_f64, f64::max);
            let clinch = (max_below - me.points + 1.0).max(0.0);

            if clinch <= 0.0 {
                headline = format!("¡Puesto #{} asegurado matemáticamente!", target);
                details.push(format!(
                    "Ningún piloto por detrás puede alcanzar sus {:.0} pts actuales.",
                    me.points
                ));
            } else if clinch <= dash.pool.max_driver_remaining {
                let avg_pts = clinch / pending as f64;
                let pos_desc = pos_label_for_avg_points(ps, avg_pts);
                headline = format!(
                    "Depende de sí mismo: necesita {} ({:.0} pts) para asegurar el #{}",
                    pos_desc, clinch, target
                );
                details.push(format!(
                    "Con {:.0} pts en las {} fecha(s) restantes ({:.1} pts/carrera) nadie puede quitarle el #{}.",
                    clinch, pending, avg_pts, target
                ));
            } else {
                headline = format!("Mantiene el #{} dependiendo de resultados", target);
                details.push(format!(
                    "Necesita sumar más puntos que sus perseguidores en las {} fechas restantes.",
                    pending
                ));
            }
        } else if let Some(target_rival) = ahead.iter().rev().nth(pass_needed - 1) {
            let gap = target_rival.points - me.points;
            let avg_gap = (gap + 1.0) / pending as f64;
            let avg_my_pos = pos_label_for_avg_points(ps, avg_gap);

            headline = format!(
                "Para el #{}: descontar {:.0} pts a {} (promediar {} si {} no suma)",
                target,
                gap,
                target_rival.code,
                avg_my_pos,
                target_rival.code
            );
            details.push(format!(
                "Si {} suma puntos, {} deberá terminar aún mejor ubicado para recortar esos {:.0} pts en {} fechas.",
                target_rival.code, me.code, gap, pending
            ));

            for r in ahead.iter().rev().take(pass_needed) {
                let d_pts = r.points - me.points;
                let max_rival_add = (me.max_possible - r.points - 1.0).max(0.0);
                let max_rival_avg = max_rival_add / pending as f64;
                let rival_cap_pos = rival_must_finish_at_or_worse(ps, max_rival_avg, 1.0);
                rivals.push(RivalRequirement {
                    name: r.name.clone(),
                    points: r.points,
                    max_possible: r.max_possible,
                    summary: format!(
                        "Está {:.0} pts arriba. {} debe sacarle {:.0} pts de ventaja en {} fechas (si {} gana todo, {} {}).",
                        d_pts, me.code, d_pts + 1.0, pending, me.code, r.code, rival_cap_pos
                    ),
                });
            }
        } else {
            headline = format!("Objetivo #{}", target);
        }
    }

    Some(TargetAnalysis {
        entity_name: me.name.clone(),
        current_rank: me.rank,
        target_rank: target,
        best_possible_rank: me.best_possible_rank,
        current_points: me.points,
        max_possible: me.max_possible,
        pending_races: pending,
        headline,
        details,
        rivals,
    })
}
