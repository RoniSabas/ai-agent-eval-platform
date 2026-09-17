import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine, Base, SessionLocal
from app.db.models import Project, Dataset, TestCase, EvaluationRun, MetricResult
from app.api import projects, datasets, evaluations, reports

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Model & Agent QA & Evaluation Platform API",
    description="Open-Source Enterprise Evaluation Platform for RAG, Standard LLMs, and Autonomous AI Agents.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(evaluations.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "AI Evaluation Platform API is running"}

@app.on_event("startup")
def seed_initial_data():
    db = SessionLocal()
    try:
        if db.query(Project).count() == 0:
            # RAG Project
            p1 = Project(name="בנקאות - מודל משכנתאות RAG", description="בדיקת איכות ועקביות לתשובות מודל RAG בנושא זכאות למשכנתא")
            db.add(p1)
            db.commit()
            db.refresh(p1)

            ds1 = Dataset(project_id=p1.id, name="מדגם תשובות RAG - לקוחות", type="RAG")
            db.add(ds1)
            db.commit()
            db.refresh(ds1)

            tc1 = TestCase(
                dataset_id=ds1.id,
                input_question="מהו אחוז המימון המרבי שניתן לקבל למשכנתא עבור דירה יחידה?",
                context=json.dumps(["עבור דירה יחידה, הוראות בנק ישראל מתירות אחוז מימון מרבי של עד 75% משווי הנכס.", "לדירה חלופית אחוז המימון הוא עד 70%."]),
                actual_output="אחוז המימון המרבי לרכישת דירה יחידה הוא עד 75% משווי הדירה, בהתאם להוראות בנק ישראל.",
                expected_ground_truth="75% משווי הנכס"
            )
            tc2 = TestCase(
                dataset_id=ds1.id,
                input_question="האם ניתן לקחת משכנתא לתקופה של 40 שנה?",
                context=json.dumps(["תקופת הפירעון המרבית למשכנתא בבנק מוגבלת ל-30 שנה בלבד."]),
                actual_output="כן, ניתן לקבל משכנתא לתקופה של עד 40 שנה בהחזר חודשי מותאם.",
                expected_ground_truth="לא, התקופה המרבית היא 30 שנה."
            )
            db.add_all([tc1, tc2])
            db.commit()

            run1 = EvaluationRun(
                project_id=p1.id,
                dataset_id=ds1.id,
                name="הריצה הראשונה - RAG Faithfulness Test",
                status="COMPLETED",
                metrics_config=json.dumps([
                    {"name": "faithfulness", "threshold": 0.7},
                    {"name": "answer_relevancy", "threshold": 0.7}
                ]),
                evaluator_config=json.dumps({"provider": "ollama", "model": "llama3"}),
                pass_count=1,
                fail_count=1,
                avg_score=0.72
            )
            db.add(run1)
            db.commit()
            db.refresh(run1)

            m1 = MetricResult(run_id=run1.id, test_case_id=tc1.id, metric_name="faithfulness", score=0.98, passed=True, reason="תשובת המודל נתמכת באופן מלא בהקשר.")
            m2 = MetricResult(run_id=run1.id, test_case_id=tc2.id, metric_name="faithfulness", score=0.20, passed=False, reason="הזיהוי נכשל - המודל טען ל-40 שנה בעוד ההקשר מגביל ל-30 שנה (Hallucination).")
            db.add_all([m1, m2])
            db.commit()

            # AGENT PROJECT
            p2 = Project(name="סוכן בנקאי אוטונומי - העברות ופעולות", description="הערכת ביצועי סוכני AI, בחירת כלים (Tool Calling) ויעילות מסלולים (Trajectories)")
            db.add(p2)
            db.commit()
            db.refresh(p2)

            ds2 = Dataset(project_id=p2.id, name="תרחישי סוכן בנקאי - Tool Calling", type="AGENT_TRAJECTORY")
            db.add(ds2)
            db.commit()
            db.refresh(ds2)

            agent_traj_1 = [
                {
                    "step": 1,
                    "tool_name": "check_account_balance",
                    "tool_input": {"account_id": 94827},
                    "tool_output": {"balance": 15000, "status": "active"}
                },
                {
                    "step": 2,
                    "tool_name": "validate_transfer_limit",
                    "tool_input": {"account_id": 94827, "amount": 5000},
                    "tool_output": {"allowed": True}
                },
                {
                    "step": 3,
                    "tool_name": "execute_transfer",
                    "tool_input": {"from_account": 94827, "to_type": "savings", "amount": 5000},
                    "tool_output": {"transaction_id": "TX99321", "status": "success"}
                }
            ]

            agent_tc1 = TestCase(
                dataset_id=ds2.id,
                input_question="בצע העברה של 5,000 ש\"ח מחשבון העו\"ש לחשבון חסכון עבור לקוח #94827",
                actual_output="בוצעה בהצלחה העברה של 5,000 ש\"ח לחשבון החיסכון. אסמכתא: TX99321.",
                expected_ground_truth="בוצעה העברה בהצלחה.",
                agent_trajectory=json.dumps(agent_traj_1),
                expected_tools=json.dumps(["check_account_balance", "validate_transfer_limit", "execute_transfer"])
            )
            db.add(agent_tc1)
            db.commit()

            run2 = EvaluationRun(
                project_id=p2.id,
                dataset_id=ds2.id,
                name="הערכת סוכן - Tool Selection & Efficiency",
                status="COMPLETED",
                metrics_config=json.dumps([
                    {"name": "agent_tool_selection", "threshold": 0.8},
                    {"name": "agent_step_efficiency", "threshold": 0.8},
                    {"name": "agent_task_completion", "threshold": 0.8}
                ]),
                evaluator_config=json.dumps({"provider": "ollama", "model": "llama3"}),
                pass_count=1,
                fail_count=0,
                avg_score=0.98
            )
            db.add(run2)
            db.commit()
            db.refresh(run2)

            am1 = MetricResult(run_id=run2.id, test_case_id=agent_tc1.id, metric_name="agent_tool_selection", score=1.0, passed=True, reason="הסוכן הפעיל את כל 3 הכלים הנדרשים בסדר הנכון ובאימות פרמטרים מלא.")
            am2 = MetricResult(run_id=run2.id, test_case_id=agent_tc1.id, metric_name="agent_step_efficiency", score=1.0, passed=True, reason="מסלול ביצוע יעיל ללא לולאות קריאה כפולות.")
            am3 = MetricResult(run_id=run2.id, test_case_id=agent_tc1.id, metric_name="agent_task_completion", score=0.95, passed=True, reason="הסוכן ביצע את ההעברה והחזיר אסמכתא תקינה ללקוח.")
            db.add_all([am1, am2, am3])
            db.commit()

    finally:
        db.close()
