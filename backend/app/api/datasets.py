import json
import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import Dataset, TestCase

router = APIRouter(prefix="/datasets", tags=["Datasets"])

class TestCaseCreate(BaseModel):
    input_question: str
    context: Optional[List[str]] = None
    actual_output: Optional[str] = None
    expected_ground_truth: Optional[str] = None
    agent_trajectory: Optional[List[Any]] = None
    expected_tools: Optional[List[str]] = None

class DatasetCreate(BaseModel):
    project_id: int
    name: str
    type: str = "RAG" # RAG, STANDARD_LLM, AGENT_TRAJECTORY
    test_cases: List[TestCaseCreate] = []

@router.post("", status_code=201)
def create_dataset(payload: DatasetCreate, db: Session = Depends(get_db)):
    ds = Dataset(
        project_id=payload.project_id,
        name=payload.name,
        type=payload.type
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    for tc in payload.test_cases:
        test_case = TestCase(
            dataset_id=ds.id,
            input_question=tc.input_question,
            context=json.dumps(tc.context) if tc.context else None,
            actual_output=tc.actual_output,
            expected_ground_truth=tc.expected_ground_truth,
            agent_trajectory=json.dumps(tc.agent_trajectory) if tc.agent_trajectory else None,
            expected_tools=json.dumps(tc.expected_tools) if tc.expected_tools else None
        )
        db.add(test_case)

    db.commit()
    return {"id": ds.id, "name": ds.name, "test_cases_count": len(payload.test_cases)}


@router.post("/upload", status_code=201)
async def upload_dataset_file(
    project_id: int = Form(...),
    name: str = Form(...),
    type: str = Form("RAG"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    test_cases_list = []

    filename = file.filename.lower()
    if filename.endswith(".json"):
        try:
            data = json.loads(content.decode("utf-8"))
            if isinstance(data, list):
                for item in data:
                    test_cases_list.append({
                        "input_question": item.get("goal") or item.get("question") or item.get("input_question") or item.get("input", ""),
                        "context": item.get("context") or item.get("contexts") or [],
                        "actual_output": item.get("answer") or item.get("actual_output") or item.get("final_output", ""),
                        "expected_ground_truth": item.get("ground_truth") or item.get("expected_ground_truth", ""),
                        "agent_trajectory": item.get("trajectory") or item.get("agent_trajectory") or [],
                        "expected_tools": item.get("expected_tools") or []
                    })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON file format: {str(e)}")
    elif filename.endswith(".csv"):
        try:
            df = pd.read_csv(io.BytesIO(content))
            for _, row in df.iterrows():
                q = str(row.get("question") or row.get("goal") or row.get("input") or "")
                a = str(row.get("answer") or row.get("actual_output") or row.get("output") or "")
                gt = str(row.get("ground_truth") or row.get("expected_ground_truth") or "")
                ctx_raw = row.get("context") or ""
                traj_raw = row.get("trajectory") or ""
                tools_raw = row.get("expected_tools") or ""
                
                ctx_list = []
                if isinstance(ctx_raw, str) and ctx_raw:
                    try: ctx_list = json.loads(ctx_raw)
                    except Exception: ctx_list = [c.strip() for c in ctx_raw.split(";") if c.strip()]

                traj_list = []
                if isinstance(traj_raw, str) and traj_raw:
                    try: traj_list = json.loads(traj_raw)
                    except Exception: pass

                tools_list = []
                if isinstance(tools_raw, str) and tools_raw:
                    try: tools_list = json.loads(tools_raw)
                    except Exception: tools_list = [t.strip() for t in tools_raw.split(";") if t.strip()]

                test_cases_list.append({
                    "input_question": q,
                    "context": ctx_list,
                    "actual_output": a,
                    "expected_ground_truth": gt,
                    "agent_trajectory": traj_list,
                    "expected_tools": tools_list
                })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Only CSV or JSON files are supported.")

    ds = Dataset(project_id=project_id, name=name, type=type)
    db.add(ds)
    db.commit()
    db.refresh(ds)

    for item in test_cases_list:
        tc = TestCase(
            dataset_id=ds.id,
            input_question=item["input_question"],
            context=json.dumps(item["context"]) if item["context"] else None,
            actual_output=item["actual_output"],
            expected_ground_truth=item["expected_ground_truth"],
            agent_trajectory=json.dumps(item["agent_trajectory"]) if item["agent_trajectory"] else None,
            expected_tools=json.dumps(item["expected_tools"]) if item["expected_tools"] else None
        )
        db.add(tc)

    db.commit()
    return {"id": ds.id, "name": ds.name, "test_cases_count": len(test_cases_list)}


@router.get("", status_code=200)
def list_datasets(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Dataset)
    if project_id:
        query = query.filter(Dataset.project_id == project_id)
    datasets = query.order_by(Dataset.id.desc()).all()

    result = []
    for d in datasets:
        tc_count = db.query(TestCase).filter(TestCase.dataset_id == d.id).count()
        result.append({
            "id": d.id,
            "project_id": d.project_id,
            "name": d.name,
            "type": d.type,
            "test_cases_count": tc_count,
            "created_at": d.created_at
        })
    return result


@router.get("/{dataset_id}/test_cases")
def get_dataset_test_cases(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    tcs = db.query(TestCase).filter(TestCase.dataset_id == dataset_id).all()
    res = []
    for tc in tcs:
        res.append({
            "id": tc.id,
            "input_question": tc.input_question,
            "context": tc.get_context_list(),
            "actual_output": tc.actual_output,
            "expected_ground_truth": tc.expected_ground_truth,
            "agent_trajectory": tc.get_agent_trajectory(),
            "expected_tools": tc.get_expected_tools()
        })
    return res
