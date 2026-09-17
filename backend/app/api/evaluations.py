import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import EvaluationRun, TestCase, MetricResult, Dataset
from app.eval_engine.runner import run_evaluation_job

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])

class MetricConfigItem(BaseModel):
    name: str
    threshold: float = 0.7

class EvaluatorConfigItem(BaseModel):
    provider: str = "ollama"
    model: str = "llama3"
    base_url: Optional[str] = None
    api_key: Optional[str] = None

class CreateEvaluationRunRequest(BaseModel):
    project_id: int
    dataset_id: int
    name: str
    metrics: List[MetricConfigItem]
    evaluator: EvaluatorConfigItem

@router.post("", status_code=202)
def start_evaluation_run(
    payload: CreateEvaluationRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    ds = db.query(Dataset).filter(Dataset.id == payload.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    metrics_json = json.dumps([m.model_dump() for m in payload.metrics])
    eval_json = json.dumps(payload.evaluator.model_dump())

    run = EvaluationRun(
        project_id=payload.project_id,
        dataset_id=payload.dataset_id,
        name=payload.name,
        status="PENDING",
        metrics_config=metrics_json,
        evaluator_config=eval_json
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    background_tasks.add_task(run_evaluation_job, run.id, db)

    return {"run_id": run.id, "status": run.status, "message": "Evaluation run queued successfully"}


@router.get("")
def list_evaluations(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(EvaluationRun)
    if project_id:
        query = query.filter(EvaluationRun.project_id == project_id)
    runs = query.order_by(EvaluationRun.id.desc()).all()

    res = []
    for r in runs:
        ds = db.query(Dataset).filter(Dataset.id == r.dataset_id).first()
        res.append({
            "id": r.id,
            "project_id": r.project_id,
            "dataset_id": r.dataset_id,
            "dataset_name": ds.name if ds else "Unknown",
            "name": r.name,
            "status": r.status,
            "pass_count": r.pass_count,
            "fail_count": r.fail_count,
            "avg_score": r.avg_score,
            "created_at": r.created_at,
            "completed_at": r.completed_at
        })
    return res


@router.get("/{run_id}")
def get_evaluation_details(run_id: int, db: Session = Depends(get_db)):
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")

    ds = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
    test_cases = db.query(TestCase).filter(TestCase.dataset_id == run.dataset_id).all()
    results = db.query(MetricResult).filter(MetricResult.run_id == run_id).all()

    tc_results_map: Dict[int, List[Dict[str, Any]]] = {}
    for res in results:
        if res.test_case_id not in tc_results_map:
            tc_results_map[res.test_case_id] = []
        tc_results_map[res.test_case_id].append({
            "metric_name": res.metric_name,
            "score": res.score,
            "passed": res.passed,
            "reason": res.reason
        })

    test_case_details = []
    for tc in test_cases:
        tc_metrics = tc_results_map.get(tc.id, [])
        tc_passed = all(m["passed"] for m in tc_metrics) if tc_metrics else True
        test_case_details.append({
            "test_case_id": tc.id,
            "input_question": tc.input_question,
            "context": tc.get_context_list(),
            "actual_output": tc.actual_output,
            "expected_ground_truth": tc.expected_ground_truth,
            "agent_trajectory": tc.get_agent_trajectory(),
            "expected_tools": tc.get_expected_tools(),
            "passed": tc_passed,
            "metrics": tc_metrics
        })

    return {
        "id": run.id,
        "name": run.name,
        "project_id": run.project_id,
        "dataset_name": ds.name if ds else "Unknown",
        "status": run.status,
        "pass_count": run.pass_count,
        "fail_count": run.fail_count,
        "avg_score": run.avg_score,
        "metrics_config": json.loads(run.metrics_config),
        "evaluator_config": json.loads(run.evaluator_config),
        "created_at": run.created_at,
        "completed_at": run.completed_at,
        "test_cases": test_case_details
    }
