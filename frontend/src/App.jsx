import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Database, PlayCircle, FileText, CheckCircle2, XCircle, 
  Upload, Sparkles, RefreshCw, Eye, ArrowDownToLine, Server, ShieldCheck,
  Bot, Wrench, GitCommit, Route
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(false);

  // New Run Form State
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [runName, setRunName] = useState('');
  const [evalProvider, setEvalProvider] = useState('ollama');
  const [evalModel, setEvalModel] = useState('llama3');
  const [metrics, setMetrics] = useState({
    faithfulness: true,
    answer_relevancy: true,
    context_relevance: false,
    ground_truth_similarity: true,
    agent_tool_selection: true,
    agent_step_efficiency: true,
    agent_task_completion: true,
  });

  // Upload Dataset Form State
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState('RAG');
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [projRes, dsRes, evalRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/datasets'),
        fetch('/api/evaluations')
      ]);

      const projs = await projRes.json();
      const dss = await dsRes.json();
      const evals = await evalRes.json();

      setProjects(projs);
      setDatasets(dss);
      setEvaluations(evals);

      if (projs.length > 0) setSelectedProject(projs[0].id);
      if (dss.length > 0) setSelectedDataset(dss[0].id);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRun = async (e) => {
    e.preventDefault();
    if (!selectedDataset) return alert("אנא בחר מכלול נתונים");
    
    const activeMetrics = Object.entries(metrics)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => ({ name, threshold: 0.7 }));

    const payload = {
      project_id: parseInt(selectedProject || projects[0]?.id || 1),
      dataset_id: parseInt(selectedDataset),
      name: runName || `הרצת בדיקה ${new Date().toLocaleTimeString('he-IL')}`,
      metrics: activeMetrics,
      evaluator: {
        provider: evalProvider,
        model: evalModel
      }
    };

    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("הרצת הבדיקה התחילה בהצלחה!");
        setRunName('');
        fetchInitialData();
        setActiveTab('history');
      } else {
        alert("שגיאה בהתחלת הרצת הבדיקה");
      }
    } catch (err) {
      console.error(err);
      alert("שגיאת תקשורת עם השרת");
    }
  };

  const handleUploadDataset = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadName) return alert("אנא מלא את שדה השם ובחר קובץ");

    const formData = new FormData();
    formData.append('project_id', selectedProject || projects[0]?.id || 1);
    formData.append('name', uploadName);
    formData.append('type', uploadType);
    formData.append('file', uploadFile);

    try {
      const res = await fetch('/api/datasets/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        alert("מכלול הנתונים הועלה בהצלחה!");
        setUploadName('');
        setUploadFile(null);
        fetchInitialData();
        setActiveTab('datasets');
      } else {
        const err = await res.json();
        alert(`שגיאה בהעלאה: ${err.detail || 'קובץ לא תקין'}`);
      }
    } catch (err) {
      console.error(err);
      alert("שגיאה בהעלאת הקובץ");
    }
  };

  const viewRunDetails = async (runId) => {
    try {
      const res = await fetch(`/api/evaluations/${runId}`);
      const data = await res.json();
      setSelectedRun(data);
    } catch (err) {
      console.error(err);
    }
  };

  const avgScoreAll = evaluations.length > 0 
    ? (evaluations.reduce((acc, curr) => acc + (curr.avg_score || 0), 0) / evaluations.length * 100).toFixed(0)
    : 0;
  const totalPass = evaluations.reduce((acc, curr) => acc + (curr.pass_count || 0), 0);
  const totalFail = evaluations.reduce((acc, curr) => acc + (curr.fail_count || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">AI & Agent Quality Hub</h1>
              <p className="text-xs text-slate-500 font-medium">פלטפורמת בדיקות איכות לסוכנים, RAG ומודלים</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              לוח בקרה
            </button>
            <button
              onClick={() => setActiveTab('datasets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'datasets' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-4 h-4" />
              מכלי נתונים ({datasets.length})
            </button>
            <button
              onClick={() => setActiveTab('new-run')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'new-run' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              הרצת בדיקה חדשה
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              היסטוריית הרצות
            </button>
          </nav>

          <button 
            onClick={fetchInitialData} 
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="רענן נתונים"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ציון איכות ממוצע</p>
                  <p className="text-3xl font-extrabold text-indigo-600 mt-1">{avgScoreAll}%</p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">סה"כ הרצות בדיקה</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{evaluations.length}</p>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">בדיקות שעברו (PASS)</p>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-1">{totalPass}</p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">חריגות וכשלים (FAIL)</p>
                  <p className="text-3xl font-extrabold text-rose-600 mt-1">{totalFail}</p>
                </div>
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                  <XCircle className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">הרצות איכות אחרונות (RAG, LLM & Agent Trajectories)</h2>
                  <p className="text-sm text-slate-500">תוצאות בדיקות איכות, ביצועי סוכנים ו-Tool Calling בזמן אמת</p>
                </div>
                <button
                  onClick={() => setActiveTab('new-run')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" />
                  הרץ בדיקה חדשה
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">שם ההרצה</th>
                      <th className="p-3">מכלול נתונים</th>
                      <th className="p-3">סטטוס</th>
                      <th className="p-3">ציון איכות</th>
                      <th className="p-3">הצלחות / כשלים</th>
                      <th className="p-3">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evaluations.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">{run.name}</td>
                        <td className="p-3 text-slate-600">{run.dataset_name}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            run.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            run.status === 'RUNNING' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {run.status === 'COMPLETED' ? 'הושלם' : run.status}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-indigo-600">
                          {intVal(run.avg_score * 100)}%
                        </td>
                        <td className="p-3">
                          <span className="text-emerald-600 font-bold">{run.pass_count} עברו</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-rose-600 font-bold">{run.fail_count} נכשלו</span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => viewRunDetails(run.id)}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            צפה בפירוט
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DATASETS */}
        {activeTab === 'datasets' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                העלאת מכלול נתונים (CSV / JSON)
              </h2>
              <p className="text-xs text-slate-500 mb-5">טען דוגמאות בדיקה, RAG או Agent Tool Calling Trajectories</p>

              <form onSubmit={handleUploadDataset} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">שם מכלול הנתונים</label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמה: סוכן ביצוע פעולות בנקאיות"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">סוג המודל / הסוכן הנבדק</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="AGENT_TRAJECTORY">🤖 סוכן אוטונומי (Agent Trajectory & Tool Calling)</option>
                    <option value="RAG">📚 RAG (כולל שליפת הקשר מקור)</option>
                    <option value="STANDARD_LLM">💬 Standard LLM (שאלה ותשובה בלבד)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">קובץ נתונים (CSV או JSON)</label>
                  <input
                    type="file"
                    accept=".csv,.json"
                    required
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full text-xs text-slate-500 file:ml-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm"
                >
                  העלה מכלול נתונים
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">מכלי נתונים קיימים במערכת</h2>

              <div className="space-y-4">
                {datasets.map((ds) => (
                  <div key={ds.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-200 transition-all flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{ds.name}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          ds.type === 'AGENT_TRAJECTORY' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ds.type === 'AGENT_TRAJECTORY' ? '🤖 סוכן (Agent)' : ds.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        מכיל <strong className="text-slate-800">{ds.test_cases_count} מקרי בדיקה</strong> • נוצר ב-{new Date(ds.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedDataset(ds.id);
                        setActiveTab('new-run');
                      }}
                      className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                    >
                      הרץ בדיקה על מכלול זה
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NEW RUN */}
        {activeTab === 'new-run' && (
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
              <PlayCircle className="w-6 h-6 text-indigo-600" />
              הגדרת הרצת בדיקת איכות חדשה
            </h2>
            <p className="text-sm text-slate-500 mb-6">בחר את מכלול הנתונים, המטריקות למדידה ומודל ה-Judge המוערך</p>

            <form onSubmit={handleStartRun} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">שם ההרצה</label>
                  <input
                    type="text"
                    placeholder="לדוגמה: בדיקת סוכן בנקאי - Tool Calling"
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">מכלול הנתונים הנבדק</label>
                  <select
                    value={selectedDataset}
                    onChange={(e) => setSelectedDataset(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} [{d.type}] ({d.test_cases_count} בדיקות)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Evaluator Setup */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  הגדרת מודל שופט (LLM Judge Server)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">סוג השרת (Provider)</label>
                    <select
                      value={evalProvider}
                      onChange={(e) => setEvalProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                    >
                      <option value="ollama">Ollama (מקומי / בנק - Air-Gapped)</option>
                      <option value="azure_openai">Azure OpenAI Enterprise</option>
                      <option value="openai">OpenAI API Direct</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">שם המודל השופט</label>
                    <input
                      type="text"
                      value={evalModel}
                      onChange={(e) => setEvalModel(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                      placeholder="e.g. llama3, mistral, gpt-4o"
                    />
                  </div>
                </div>
              </div>

              {/* Metrics Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-3">מטריקות איכות למדידה</label>
                
                {/* Agent Metrics Group */}
                <div className="mb-4">
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                    🤖 מטריקות ייעודיות לסוכנים (Agent Trajectory & Tools)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-center gap-3 p-3 border border-purple-200 bg-purple-50/40 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={metrics.agent_tool_selection}
                        onChange={(e) => setMetrics({...metrics, agent_tool_selection: e.target.checked})}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <div>
                        <div className="text-xs font-bold text-purple-900">Tool Selection Accuracy</div>
                        <div className="text-[11px] text-purple-700">דיוק בחירת הכלים והפרמטרים</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-purple-200 bg-purple-50/40 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={metrics.agent_step_efficiency}
                        onChange={(e) => setMetrics({...metrics, agent_step_efficiency: e.target.checked})}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <div>
                        <div className="text-xs font-bold text-purple-900">Trajectory Efficiency</div>
                        <div className="text-[11px] text-purple-700">יעילות הצעדים וזיהוי לולאות</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-purple-200 bg-purple-50/40 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={metrics.agent_task_completion}
                        onChange={(e) => setMetrics({...metrics, agent_task_completion: e.target.checked})}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <div>
                        <div className="text-xs font-bold text-purple-900">Task Completion</div>
                        <div className="text-[11px] text-purple-700">השגת יעד המשימה בסוף השרשרת</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* RAG & LLM Metrics Group */}
                <div>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                    📚 מטריקות RAG ו-LLM רגיל
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={metrics.faithfulness}
                        onChange={(e) => setMetrics({...metrics, faithfulness: e.target.checked})}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Faithfulness</div>
                        <div className="text-[11px] text-slate-500">נאמנות להקשר ואי-הזיה</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={metrics.answer_relevancy}
                        onChange={(e) => setMetrics({...metrics, answer_relevancy: e.target.checked})}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Answer Relevancy</div>
                        <div className="text-[11px] text-slate-500">רלוונטיות התשובה לשאלה</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={metrics.ground_truth_similarity}
                        onChange={(e) => setMetrics({...metrics, ground_truth_similarity: e.target.checked})}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Ground Truth Match</div>
                        <div className="text-[11px] text-slate-500">השוואה לתשובת ייחוס</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all text-base flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                הפעל בדיקת איכות עכשיו
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">כל הרצות הבדיקה במערכת</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">מזהה</th>
                    <th className="p-3">שם הרצה</th>
                    <th className="p-3">מכלול נתונים</th>
                    <th className="p-3">ציון איכות</th>
                    <th className="p-3">סטטוס</th>
                    <th className="p-3">זמן הרצה</th>
                    <th className="p-3">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluations.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-400">#{run.id}</td>
                      <td className="p-3 font-bold text-slate-900">{run.name}</td>
                      <td className="p-3 text-slate-600">{run.dataset_name}</td>
                      <td className="p-3 font-extrabold text-indigo-600">{intVal(run.avg_score * 100)}%</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          {run.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{new Date(run.created_at).toLocaleString('he-IL')}</td>
                      <td className="p-3 flex items-center gap-2">
                        <button
                          onClick={() => viewRunDetails(run.id)}
                          className="bg-indigo-50 text-indigo-600 font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-100"
                        >
                          צפה בפירוט
                        </button>
                        <a
                          href={`/api/reports/html/${run.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex items-center gap-1"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          דוח HTML
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RUN DETAILS MODAL (WITH AGENT TRAJECTORY VISUALIZER) */}
        {selectedRun && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedRun.name}</h3>
                  <p className="text-xs text-slate-500">מכלול נתונים: {selectedRun.dataset_name} • ציון ממוצע: <strong className="text-indigo-600">{intVal(selectedRun.avg_score * 100)}%</strong></p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/reports/csv/${selectedRun.id}`}
                    download
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    ייצא CSV
                  </a>
                  <button
                    onClick={() => setSelectedRun(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 text-xl font-bold rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {selectedRun.test_cases?.map((tc, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-5 bg-white space-y-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">תרחיש #{idx + 1}</span>
                        <span className="font-bold text-slate-900 text-base">{tc.input_question}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        tc.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {tc.passed ? 'עבר PASS' : 'נכשל FAIL'}
                      </span>
                    </div>

                    {/* Agent Trajectory Timeline (If Present) */}
                    {tc.agent_trajectory && tc.agent_trajectory.length > 0 && (
                      <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                            <Bot className="w-4 h-4 text-purple-600" />
                            נתיב צעדים והפעלת כלים של הסוכן (Agent Trajectory Timeline)
                          </span>
                          <span className="text-[11px] font-bold text-purple-700">
                            {tc.agent_trajectory.length} צעדים מבוצעים
                          </span>
                        </div>

                        <div className="space-y-2 relative border-r-2 border-purple-200 mr-2 pr-4">
                          {tc.agent_trajectory.map((step, sIdx) => (
                            <div key={sIdx} className="bg-white border border-purple-100 rounded-lg p-3 shadow-2xs text-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-purple-900">
                                <span className="flex items-center gap-1.5">
                                  <Wrench className="w-3.5 h-3.5 text-purple-600" />
                                  צעד #{step.step || sIdx + 1}: כלי `{step.tool_name || step.action}`
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono mt-1">
                                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                  <span className="text-slate-500 font-bold font-sans block">קלט לכלי (Input):</span>
                                  {JSON.stringify(step.tool_input || step.input || {})}
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                  <span className="text-slate-500 font-bold font-sans block">פלט מהכלי (Output):</span>
                                  {JSON.stringify(step.tool_output || step.output || {})}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standard Actual Output / Ground Truth */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-600 block mb-1">תשובת הסוכן / המודל הסופית:</span>
                        <p className="text-slate-800 font-mono">{tc.actual_output || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-600 block mb-1">כלים מצופים (Expected Tools):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tc.expected_tools?.map((t, ti) => (
                            <span key={ti} className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-mono">
                              {t}
                            </span>
                          )) || <span className="text-slate-400 font-sans">לא הוגדרו כלים מצופים</span>}
                        </div>
                      </div>
                    </div>

                    {/* Metrics detail breakdown */}
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-600">מטריקות וציונים:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tc.metrics?.map((m, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800">{m.metric_name}</span>
                              <p className="text-slate-500 text-[11px] mt-0.5">{m.reason}</p>
                            </div>
                            <span className={`font-bold text-xs px-2 py-1 rounded ${
                              m.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {intVal(m.score * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function intVal(val) {
  return Math.round(val || 0);
}
