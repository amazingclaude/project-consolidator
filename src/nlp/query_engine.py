import json
import logging

from sqlalchemy.orm import Session

from ..ai.foundry import create_foundry_client
from ..database.queries import run_raw_sql

logger = logging.getLogger(__name__)

SQL_QUERY_TOOL = {
    "type": "function",
    "function": {
        "name": "query_project_database",
        "description": (
            "Execute a SQL SELECT query against the project portfolio database. "
            "Available tables: projects, tasks, resources, assignments, deviations. "
            "Key columns on tasks: project_id, task_uid, name, start, finish, "
            "baseline_start, baseline_finish, actual_start, actual_finish, "
            "duration_hours, baseline_duration_hours, percent_complete, "
            "cost, baseline_cost, actual_cost, bcws, bcwp, acwp, "
            "critical (boolean), milestone (boolean), summary (boolean), resource_names. "
            "Key columns on projects: id, name, cost, baseline_cost, actual_cost, "
            "start, finish, baseline_start, baseline_finish, bcws, bcwp, acwp. "
            "Key columns on deviations: project_id, task_uid, deviation_type, severity, "
            "metric_name, variance, variance_percent, description. "
            "deviation_type values: schedule_slippage, cost_overrun, milestone_slippage, "
            "duration_overrun, cpi_critical, spi_critical. "
            "severity values: warning, critical. "
            "Only SELECT queries are allowed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "A SQLite SELECT query to execute",
                },
                "explanation": {
                    "type": "string",
                    "description": "Brief explanation of what this query finds",
                },
            },
            "required": ["sql", "explanation"],
        },
    },
}

SYSTEM_PROMPT = """You are an expert project management analyst with deep knowledge of
Earned Value Management (EVM), critical path analysis, and portfolio management.

You have access to a SQLite database containing consolidated data from hundreds of
Microsoft Project files. Use the query_project_database tool to answer questions.

Database schema:
- projects: id, name, file_path, file_format, start, finish, baseline_start, baseline_finish,
  actual_start, actual_finish, status_date, cost, baseline_cost, actual_cost, bcws, bcwp, acwp
- tasks: id, project_id, task_uid, name, wbs, outline_level, start, finish,
  baseline_start, baseline_finish, actual_start, actual_finish,
  duration_hours, baseline_duration_hours, actual_duration_hours, remaining_duration_hours,
  percent_complete, cost, baseline_cost, actual_cost, remaining_cost,
  bcws, bcwp, acwp, critical, milestone, summary, is_null, resource_names, predecessor_uids
- resources: id, project_id, resource_uid, name, resource_type, cost, actual_cost
- assignments: id, project_id, assignment_uid, task_uid, resource_uid,
  work_hours, actual_work_hours, cost, actual_cost
- deviations: id, project_id, task_uid, deviation_type, severity,
  metric_name, baseline_value, actual_value, variance, variance_percent, description

Key formulas:
- CPI = BCWP / ACWP (>1 = under budget)
- SPI = BCWP / BCWS (>1 = ahead of schedule)
- EAC = BAC / CPI (estimate at completion)
- CV = BCWP - ACWP (cost variance)
- SV = BCWP - BCWS (schedule variance)

Provide clear, actionable answers. Include specific numbers and project names.
Format currency with $ and commas. Format percentages to 1 decimal place."""


class NLQueryEngine:
    def __init__(self, model: str, max_tokens: int, session: Session):
        self.client = create_foundry_client()
        self.model = model
        self.max_tokens = max_tokens
        self.session = session

    def ask(self, question: str) -> str:
        for _ in range(3):
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=min(self.max_tokens, 2048),
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                ],
                tools=[SQL_QUERY_TOOL],
                tool_choice="auto",
            )

            message = response.choices[0].message
            tool_calls = message.tool_calls or []
            if not tool_calls:
                return message.content or ""

            tool_outputs = []
            for tool_call in tool_calls:
                tool_args = json.loads(tool_call.function.arguments or "{}")
                sql = tool_args.get("sql", "")

                if not sql.strip().upper().startswith("SELECT"):
                    tool_result = "Error: Only SELECT queries are allowed."
                else:
                    try:
                        results = run_raw_sql(self.session, sql)
                        if len(results) > 100:
                            tool_result = (
                                json.dumps(results[:100], default=str)
                                + f"\n... ({len(results)} total rows, showing first 100)"
                            )
                        else:
                            tool_result = json.dumps(results, default=str)
                    except Exception as e:
                        tool_result = f"Query error: {str(e)}"

                tool_outputs.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_result,
                    }
                )

            followup = self.client.chat.completions.create(
                model=self.model,
                max_tokens=min(self.max_tokens, 2048),
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": question},
                    {
                        "role": "assistant",
                        "content": message.content or "",
                        "tool_calls": [
                            {
                                "id": tool_call.id,
                                "type": "function",
                                "function": {
                                    "name": tool_call.function.name,
                                    "arguments": tool_call.function.arguments,
                                },
                            }
                            for tool_call in tool_calls
                        ],
                    },
                    *tool_outputs,
                ],
                tools=[SQL_QUERY_TOOL],
                tool_choice="none",
            )
            return followup.choices[0].message.content or ""

        return "I was unable to find a satisfactory answer after multiple queries. Please try rephrasing your question."
