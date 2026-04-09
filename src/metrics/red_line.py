from ..database.models import Deviation, Project


def detect_deviations(project: Project, thresholds: dict) -> list[Deviation]:
    deviations = []
    slip_threshold = thresholds.get("schedule_slippage_days", 5)
    cost_threshold = thresholds.get("cost_overrun_percent", 10)
    cpi_warning = thresholds.get("cpi_warning", 0.9)
    cpi_critical = thresholds.get("cpi_critical", 0.8)
    spi_warning = thresholds.get("spi_warning", 0.9)
    spi_critical = thresholds.get("spi_critical", 0.8)

    for task in project.tasks:
        if task.summary or task.is_null:
            continue

        # Schedule slippage
        if task.baseline_finish and task.finish:
            slip_days = (task.finish - task.baseline_finish).total_seconds() / 86400
            if slip_days > slip_threshold:
                severity = "critical" if slip_days > slip_threshold * 2 else "warning"
                deviations.append(Deviation(
                    task_uid=task.task_uid,
                    deviation_type="schedule_slippage",
                    severity=severity,
                    metric_name="Finish Date Slippage",
                    baseline_value=task.baseline_finish.isoformat(),
                    actual_value=task.finish.isoformat(),
                    variance=slip_days,
                    description=(
                        f"Task '{task.name}' finish slipped {slip_days:.1f} days "
                        f"(baseline: {task.baseline_finish.date()}, "
                        f"current: {task.finish.date()})"
                    ),
                ))

        # Cost overrun
        if task.baseline_cost and task.baseline_cost > 0 and task.cost:
            cost_var_pct = ((task.cost - task.baseline_cost) / task.baseline_cost) * 100
            if cost_var_pct > cost_threshold:
                severity = "critical" if cost_var_pct > cost_threshold * 2 else "warning"
                deviations.append(Deviation(
                    task_uid=task.task_uid,
                    deviation_type="cost_overrun",
                    severity=severity,
                    metric_name="Cost Overrun",
                    baseline_value=f"${task.baseline_cost:,.2f}",
                    actual_value=f"${task.cost:,.2f}",
                    variance=task.cost - task.baseline_cost,
                    variance_percent=cost_var_pct,
                    description=(
                        f"Task '{task.name}' cost overrun of {cost_var_pct:.1f}% "
                        f"(baseline: ${task.baseline_cost:,.0f}, "
                        f"current: ${task.cost:,.0f})"
                    ),
                ))

        # Milestone slippage
        if task.milestone and task.baseline_finish and task.finish:
            slip_days = (task.finish - task.baseline_finish).total_seconds() / 86400
            if slip_days > 1:
                severity = "critical" if slip_days > slip_threshold else "warning"
                deviations.append(Deviation(
                    task_uid=task.task_uid,
                    deviation_type="milestone_slippage",
                    severity=severity,
                    metric_name="Milestone Slippage",
                    baseline_value=task.baseline_finish.isoformat(),
                    actual_value=task.finish.isoformat(),
                    variance=slip_days,
                    description=f"Milestone '{task.name}' slipped {slip_days:.1f} days",
                ))

        # Duration overrun
        if (task.baseline_duration_hours and task.baseline_duration_hours > 0
                and task.actual_duration_hours):
            dur_var_pct = (
                (task.actual_duration_hours - task.baseline_duration_hours)
                / task.baseline_duration_hours * 100
            )
            if dur_var_pct > cost_threshold:
                deviations.append(Deviation(
                    task_uid=task.task_uid,
                    deviation_type="duration_overrun",
                    severity="warning",
                    metric_name="Duration Overrun",
                    baseline_value=f"{task.baseline_duration_hours:.1f}h",
                    actual_value=f"{task.actual_duration_hours:.1f}h",
                    variance=task.actual_duration_hours - task.baseline_duration_hours,
                    variance_percent=dur_var_pct,
                    description=f"Task '{task.name}' duration overrun of {dur_var_pct:.1f}%",
                ))

    # Project-level CPI
    if project.bcwp is not None and project.acwp is not None and project.acwp > 0:
        cpi = project.bcwp / project.acwp
        if cpi < cpi_critical:
            deviations.append(Deviation(
                task_uid=None,
                deviation_type="cpi_critical",
                severity="critical",
                metric_name="Cost Performance Index",
                baseline_value="1.0",
                actual_value=f"{cpi:.3f}",
                variance=1.0 - cpi,
                description=f"Project CPI of {cpi:.3f} is critically below threshold ({cpi_critical})",
            ))
        elif cpi < cpi_warning:
            deviations.append(Deviation(
                task_uid=None,
                deviation_type="cpi_critical",
                severity="warning",
                metric_name="Cost Performance Index",
                baseline_value="1.0",
                actual_value=f"{cpi:.3f}",
                variance=1.0 - cpi,
                description=f"Project CPI of {cpi:.3f} is below warning threshold ({cpi_warning})",
            ))

    # Project-level SPI
    if project.bcwp is not None and project.bcws is not None and project.bcws > 0:
        spi = project.bcwp / project.bcws
        if spi < spi_critical:
            deviations.append(Deviation(
                task_uid=None,
                deviation_type="spi_critical",
                severity="critical",
                metric_name="Schedule Performance Index",
                baseline_value="1.0",
                actual_value=f"{spi:.3f}",
                variance=1.0 - spi,
                description=f"Project SPI of {spi:.3f} is critically below threshold ({spi_critical})",
            ))
        elif spi < spi_warning:
            deviations.append(Deviation(
                task_uid=None,
                deviation_type="spi_critical",
                severity="warning",
                metric_name="Schedule Performance Index",
                baseline_value="1.0",
                actual_value=f"{spi:.3f}",
                variance=1.0 - spi,
                description=f"Project SPI of {spi:.3f} is below warning threshold ({spi_warning})",
            ))

    return deviations
