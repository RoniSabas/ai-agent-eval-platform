import io
import json
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import EvaluationRun, Dataset, TestCase, MetricResult, Project

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/csv/{run_id}")
def export_csv_report(run_id: int, db: Session = Depends(get_db)):
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    test_cases = db.query(TestCase).filter(TestCase.dataset_id == run.dataset_id).all()
    results = db.query(MetricResult).filter(MetricResult.run_id == run_id).all()

    # Map metric results by test_case_id
    tc_map = {}
    for r in results:
        if r.test_case_id not in tc_map:
            tc_map[r.test_case_id] = {}
        tc_map[r.test_case_id][f"{r.metric_name}_score"] = r.score
        tc_map[r.test_case_id][f"{r.metric_name}_passed"] = r.passed
        tc_map[r.test_case_id][f"{r.metric_name}_reason"] = r.reason

    rows = []
    for tc in test_cases:
        row = {
            "test_case_id": tc.id,
            "question": tc.input_question,
            "actual_output": tc.actual_output,
            "ground_truth": tc.expected_ground_truth,
        }
        row.update(tc_map.get(tc.id, {}))
        rows.append(row)

    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = Response(content=stream.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=eval_report_run_{run_id}.csv"
    return response


@router.get("/html/{run_id}", response_class=HTMLResponse)
def export_html_report(run_id: int, db: Session = Depends(get_db)):
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    project = db.query(Project).filter(Project.id == run.project_id).first()
    ds = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
    test_cases = db.query(TestCase).filter(TestCase.dataset_id == run.dataset_id).all()
    results = db.query(MetricResult).filter(MetricResult.run_id == run_id).all()

    tc_map = {}
    for r in results:
        if r.test_case_id not in tc_map:
            tc_map[r.test_case_id] = []
        tc_map[r.test_case_id].append(r)

    rows_html = ""
    for tc in test_cases:
        m_list = tc_map.get(tc.id, [])
        m_html = "".join([
            f"<li><strong>{m.metric_name}</strong>: {m.score} ({'PASS' if m.passed else 'FAIL'}) - <em>{m.reason}</em></li>"
            for m in m_list
        ])
        rows_html += f"""
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; font-weight: 500;">{tc.input_question}</td>
            <td style="padding: 12px; font-family: monospace; font-size: 13px;">{tc.actual_output or '-'}</td>
            <td style="padding: 12px;"><ul>{m_html}</ul></td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>דוח איכות מודל - {run.name}</title>
        <style>
            body {{ font-family: system-ui, -apple-system, sans-serif; padding: 40px; background: #f9fafb; color: #111827; }}
            .container {{ max-width: 900px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
            .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }}
            .stats {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }}
            .card {{ background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; }}
            .card-title {{ font-size: 14px; color: #6b7280; }}
            .card-val {{ font-size: 24px; font-weight: bold; margin-top: 4px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 16px; text-align: right; }}
            th {{ background: #f3f4f6; padding: 12px; border-bottom: 2px solid #e5e7eb; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div>
                    <h1 style="margin:0; font-size: 24px;">דוח איכות ובדיקות AI</h1>
                    <p style="margin: 4px 0 0 0; color: #6b7280;">פרויקט: {project.name if project else 'כללי'} | מכלול: {run.name}</p>
                </div>
                <div style="text-align: left;">
                    <span style="background: #dbeafe; color: #1e40af; padding: 6px 12px; border-radius: 20px; font-weight: bold;">
                        {run.status}
                    </span>
                </div>
            </div>

            <div class="stats">
                <div class="card">
                    <div class="card-title">ציון איכות ממוצע</div>
                    <div class="card-val" style="color: #2563eb;">{int(run.avg_score * 100)}%</div>
                </div>
                <div class="card">
                    <div class="card-title">בדיקות שעברו</div>
                    <div class="card-val" style="color: #16a34a;">{run.pass_count}</div>
                </div>
                <div class="card">
                    <div class="card-title">בדיקות שנכשלו</div>
                    <div class="card-val" style="color: #dc2626;">{run.fail_count}</div>
                </div>
            </div>

            <h2 style="font-size: 18px; margin-top: 24px;">פירוט מקרי הבדיקה והמטריקות</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">שאלה / קלט</th>
                        <th style="width: 35%;">תשובת המודל שנבדקה</th>
                        <th style="width: 35%;">מטריקות וציונים</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)
