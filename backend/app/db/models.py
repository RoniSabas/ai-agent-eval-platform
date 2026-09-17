import datetime
import json
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    eval_runs = relationship("EvaluationRun", back_populates="project", cascade="all, delete-orphan")

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="RAG") # "RAG", "STANDARD_LLM", "AGENT_TRAJECTORY"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="datasets")
    test_cases = relationship("TestCase", back_populates="dataset", cascade="all, delete-orphan")
    eval_runs = relationship("EvaluationRun", back_populates="dataset")

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    input_question = Column(Text, nullable=False) # User Goal / Prompt
    context = Column(Text, nullable=True) # JSON list of strings or text
    actual_output = Column(Text, nullable=True) # Final Agent Response
    expected_ground_truth = Column(Text, nullable=True)
    
    # Agent Trajectory extensions
    agent_trajectory = Column(Text, nullable=True) # JSON list of step objects [{step:1, tool_name:"...", tool_input:{...}, tool_output:{...}}]
    expected_tools = Column(Text, nullable=True) # JSON list of tool names expected to be called
    
    extra_metadata = Column(Text, nullable=True) # JSON object

    dataset = relationship("Dataset", back_populates="test_cases")
    results = relationship("MetricResult", back_populates="test_case", cascade="all, delete-orphan")

    def get_context_list(self):
        if not self.context:
            return []
        try:
            val = json.loads(self.context)
            if isinstance(val, list):
                return val
            return [str(val)]
        except Exception:
            return [self.context]

    def get_agent_trajectory(self):
        if not self.agent_trajectory:
            return []
        try:
            val = json.loads(self.agent_trajectory)
            return val if isinstance(val, list) else []
        except Exception:
            return []

    def get_expected_tools(self):
        if not self.expected_tools:
            return []
        try:
            val = json.loads(self.expected_tools)
            return val if isinstance(val, list) else []
        except Exception:
            return []

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, RUNNING, COMPLETED, FAILED
    metrics_config = Column(Text, nullable=False) # JSON array of metric dicts
    evaluator_config = Column(Text, nullable=False) # JSON object (provider, model, base_url, api_key)
    pass_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    avg_score = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="eval_runs")
    dataset = relationship("Dataset", back_populates="eval_runs")
    metric_results = relationship("MetricResult", back_populates="run", cascade="all, delete-orphan")

class MetricResult(Base):
    __tablename__ = "metric_results"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("evaluation_runs.id"), nullable=False)
    test_case_id = Column(Integer, ForeignKey("test_cases.id"), nullable=False)
    metric_name = Column(String(100), nullable=False)
    score = Column(Float, nullable=False) # 0.0 - 1.0
    passed = Column(Boolean, nullable=False)
    reason = Column(Text, nullable=True)

    run = relationship("EvaluationRun", back_populates="metric_results")
    test_case = relationship("TestCase", back_populates="results")
