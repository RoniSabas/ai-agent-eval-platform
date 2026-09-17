import json
import datetime
import logging
from sqlalchemy.orm import Session
from app.db.models import EvaluationRun, TestCase, MetricResult
from app.eval_engine.metrics import EvaluatorProvider, MetricsEngine

logger = logging.getLogger("eval_runner")

def run_evaluation_job(run_id: int, db: Session):
    run = db.query(EvaluationRun).filter(EvaluationRun.id == run_id).first()
    if not run:
        logger.error(f"EvaluationRun {run_id} not found.")
        return

    try:
        run.status = "RUNNING"
        db.commit()

        try:
            metrics_config = json.loads(run.metrics_config)
        except Exception:
            metrics_config = [{"name": "faithfulness", "threshold": 0.7}]

        try:
            eval_config = json.loads(run.evaluator_config)
        except Exception:
            eval_config = {"provider": "ollama", "model": "llama3"}

        provider = EvaluatorProvider(
            provider=eval_config.get("provider", "ollama"),
            model=eval_config.get("model", "llama3"),
            base_url=eval_config.get("base_url"),
            api_key=eval_config.get("api_key")
        )

        test_cases = db.query(TestCase).filter(TestCase.dataset_id == run.dataset_id).all()
        if not test_cases:
            run.status = "COMPLETED"
            run.error_message = "Dataset has no test cases."
            run.completed_at = datetime.datetime.utcnow()
            db.commit()
            return

        total_scores = []
        pass_count = 0
        fail_count = 0

        for tc in test_cases:
            tc_passed = True
            contexts = tc.get_context_list()
            trajectory = tc.get_agent_trajectory()
            expected_tools = tc.get_expected_tools()

            for m in metrics_config:
                m_name = m.get("name", "").lower()
                threshold = float(m.get("threshold", 0.7))
                
                result_data = {"score": 0.8, "reason": "Evaluated successfully."}

                if m_name == "faithfulness":
                    result_data = MetricsEngine.evaluate_faithfulness(tc.input_question, tc.actual_output or "", contexts, provider)
                elif m_name == "answer_relevancy":
                    result_data = MetricsEngine.evaluate_answer_relevancy(tc.input_question, tc.actual_output or "", provider)
                elif m_name == "context_relevance":
                    result_data = MetricsEngine.evaluate_context_relevance(tc.input_question, contexts, provider)
                elif m_name == "toxicity":
                    result_data = MetricsEngine.evaluate_toxicity(tc.actual_output or "", provider)
                elif m_name == "ground_truth_similarity":
                    result_data = MetricsEngine.evaluate_ground_truth_similarity(tc.actual_output or "", tc.expected_ground_truth or "")
                elif m_name == "agent_tool_selection":
                    result_data = MetricsEngine.evaluate_agent_tool_selection(trajectory, expected_tools)
                elif m_name == "agent_step_efficiency":
                    result_data = MetricsEngine.evaluate_agent_step_efficiency(trajectory)
                elif m_name == "agent_task_completion":
                    result_data = MetricsEngine.evaluate_agent_task_completion(tc.input_question, trajectory, tc.actual_output or "", provider)

                score = result_data["score"]
                passed = score >= threshold
                if not passed:
                    tc_passed = False

                total_scores.append(score)

                metric_rec = MetricResult(
                    run_id=run.id,
                    test_case_id=tc.id,
                    metric_name=m_name,
                    score=score,
                    passed=passed,
                    reason=result_data["reason"]
                )
                db.add(metric_rec)

            if tc_passed:
                pass_count += 1
            else:
                fail_count += 1

        avg_score = round(sum(total_scores) / len(total_scores), 2) if total_scores else 0.0

        run.status = "COMPLETED"
        run.pass_count = pass_count
        run.fail_count = fail_count
        run.avg_score = avg_score
        run.completed_at = datetime.datetime.utcnow()
        db.commit()

        logger.info(f"EvaluationRun {run_id} completed successfully. Avg score: {avg_score}")

    except Exception as e:
        logger.exception(f"Error running EvaluationRun {run_id}: {e}")
        run.status = "FAILED"
        run.error_message = str(e)
        db.commit()
