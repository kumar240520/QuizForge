import {
  Question, QuestionBank, Subject, Topic, Quiz,
  SessionStatusResponse, QuizResult, QuizResultListItem,
  ParsedQuestionItem, ImportJob, RevisionItem,
  DashboardSummary, PerformanceAnalytics, AISettings,
  AppearanceSettings, AppPreferences, RunCodeResponse
} from '../types';

export const API_BASE = '/api/v1';

function getAuthHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = localStorage.getItem('quizforge_jwt_token');
  const baseHeaders: Record<string, string> = {};
  if (token) {
    baseHeaders['Authorization'] = `Bearer ${token}`;
  }
  return { ...baseHeaders, ...(headers as Record<string, string>) };
}

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = getAuthHeaders(init?.headers);
  return fetch(url, { ...init, headers });
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem('quizforge_jwt_token');
    localStorage.removeItem('quizforge_user_profile');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login';
    }
  }
  if (!res.ok) {
    let errorMsg = `Request failed: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      if (errorJson.detail) {
        errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Question Banks & Organization
  getBanks: () => authFetch(`${API_BASE}/banks`).then(r => handleResponse<QuestionBank[]>(r)),
  createBank: (data: Partial<QuestionBank>) =>
    authFetch(`${API_BASE}/banks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<QuestionBank>(r)),
  deleteBank: (id: number) =>
    authFetch(`${API_BASE}/banks/${id}`, { method: 'DELETE' }).then(r => handleResponse(r)),

  getSubjects: (bankId?: number) =>
    authFetch(`${API_BASE}/banks/subjects${bankId ? `?bank_id=${bankId}` : ''}`).then(r => handleResponse<Subject[]>(r)),
  createSubject: (data: Partial<Subject>) =>
    authFetch(`${API_BASE}/banks/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Subject>(r)),

  getTopics: (subjectId?: number) =>
    authFetch(`${API_BASE}/banks/topics${subjectId ? `?subject_id=${subjectId}` : ''}`).then(r => handleResponse<Topic[]>(r)),
  createTopic: (data: Partial<Topic>) =>
    authFetch(`${API_BASE}/banks/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Topic>(r)),

  // Questions
  getQuestions: (params?: { bank_id?: number; quiz_id?: number; unassigned_only?: boolean; subject_id?: number; topic_id?: number; difficulty?: string; question_type?: string; is_favorite?: boolean; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') searchParams.append(k, String(v));
      });
    }
    return authFetch(`${API_BASE}/questions?${searchParams.toString()}`).then(r => handleResponse<Question[]>(r));
  },
  getQuestion: (id: number) => authFetch(`${API_BASE}/questions/${id}`).then(r => handleResponse<Question>(r)),
  createQuestion: (data: Partial<Question>) =>
    authFetch(`${API_BASE}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Question>(r)),
  updateQuestion: (id: number, data: Partial<Question>) =>
    authFetch(`${API_BASE}/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Question>(r)),
  deleteQuestion: (id: number) =>
    authFetch(`${API_BASE}/questions/${id}`, { method: 'DELETE' }).then(r => handleResponse(r)),
  batchDeleteQuestions: (ids: number[]) =>
    authFetch(`${API_BASE}/questions/batch-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    }).then(r => handleResponse(r)),
  clearAllQuestions: (bankId?: number) =>
    authFetch(`${API_BASE}/questions/clear-all${bankId ? `?bank_id=${bankId}` : ''}`, { method: 'DELETE' }).then(r => handleResponse(r)),
  duplicateQuestion: (id: number) =>
    authFetch(`${API_BASE}/questions/${id}/duplicate`, { method: 'POST' }).then(r => handleResponse<Question>(r)),
  toggleFavorite: (id: number) =>
    authFetch(`${API_BASE}/questions/${id}/toggle-favorite`, { method: 'POST' }).then(r => handleResponse<Question>(r)),

  // Imports
  uploadPdf: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return authFetch(`${API_BASE}/imports/pdf`, { method: 'POST', body: formData }).then(r => handleResponse<ImportJob>(r));
  },
  importText: (content: string, bankId?: number) =>
    authFetch(`${API_BASE}/imports/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, bank_id: bankId })
    }).then(r => handleResponse<ImportJob>(r)),
  importJson: (items: any[]) =>
    authFetch(`${API_BASE}/imports/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    }).then(r => handleResponse<ImportJob>(r)),
  getImportJob: (jobId: number) =>
    authFetch(`${API_BASE}/imports/jobs/${jobId}`).then(r => handleResponse<ImportJob>(r)),
  approveImportJob: (jobId: number, data: { quiz_id?: number; bank_id?: number; subject_id?: number; topic_id?: number; target_section?: string; questions: ParsedQuestionItem[] }) =>
    authFetch(`${API_BASE}/imports/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, ...data })
    }).then(r => handleResponse<{ message: string; imported_count: number; bank_id?: number; quiz_id?: number }>(r)),

  // AI Generation
  generateQuestions: (params: {
    subject: string;
    topic: string;
    subtopics?: string;
    educational_level?: string;
    question_count: number;
    question_types: string[];
    difficulty: string;
    num_mcq_options?: number;
    require_explanations?: boolean;
    source_material?: string;
    source_only_mode?: boolean;
    api_key?: string;
    model_name?: string;
  }) =>
    authFetch(`${API_BASE}/generation/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }).then(r => handleResponse<ParsedQuestionItem[]>(r)),

  generateGroundedFromFile: (formData: FormData) =>
    authFetch(`${API_BASE}/generation/grounded-from-file`, {
      method: 'POST',
      body: formData
    }).then(r => handleResponse<ParsedQuestionItem[]>(r)),

  saveGeneratedToBank: (data: { quiz_id?: number; bank_id?: number; subject_id?: number; topic_id?: number; questions: ParsedQuestionItem[] }) =>
    authFetch(`${API_BASE}/generation/save-to-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: 0, ...data })
    }).then(r => handleResponse<{ message: string; question_ids: number[]; bank_id: number }>(r)),

  // Quizzes / Assessments
  getQuizzes: () => authFetch(`${API_BASE}/quizzes`).then(r => handleResponse<Quiz[]>(r)),
  getQuiz: (id: number) => authFetch(`${API_BASE}/quizzes/${id}`).then(r => handleResponse<Quiz>(r)),
  createQuiz: (data: Partial<Quiz>) =>
    authFetch(`${API_BASE}/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Quiz>(r)),
  updateQuiz: (id: number, data: Partial<Quiz>) =>
    authFetch(`${API_BASE}/quizzes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Quiz>(r)),
  deleteQuiz: (id: number) =>
    authFetch(`${API_BASE}/quizzes/${id}`, { method: 'DELETE' }).then(r => handleResponse(r)),
  getQuizQuestions: (quizId: number) =>
    authFetch(`${API_BASE}/quizzes/${quizId}/questions`).then(r => handleResponse<Question[]>(r)),
  addQuestionToQuiz: (quizId: number, data: Partial<Question>) =>
    authFetch(`${API_BASE}/quizzes/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Question>(r)),
  deleteQuestionFromQuiz: (quizId: number, questionId: number) =>
    authFetch(`${API_BASE}/quizzes/${quizId}/questions/${questionId}`, { method: 'DELETE' }).then(r => handleResponse(r)),
  deleteSectionFromQuiz: (quizId: number, sectionName: string) =>
    authFetch(`${API_BASE}/quizzes/${quizId}/sections/${encodeURIComponent(sectionName)}`, { method: 'DELETE' }).then(r => handleResponse(r)),

  // Sessions (Quiz taking)
  startSession: (quizId: number, questionCount?: number, questionIds?: number[], mode?: string) =>
    authFetch(`${API_BASE}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_id: quizId, question_count: questionCount, question_ids: questionIds, mode })
    }).then(r => handleResponse<SessionStatusResponse>(r)),
  getSession: (token: string) =>
    authFetch(`${API_BASE}/sessions/${token}`).then(r => handleResponse<SessionStatusResponse>(r)),
  submitAnswer: (token: string, data: { question_id: number; user_answer: any; time_spent_seconds?: number; is_flagged?: boolean; is_skipped?: boolean }) =>
    authFetch(`${API_BASE}/sessions/${token}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<{ message: string }>(r)),
  checkAnswer: (token: string, data: { question_id: number; user_answer: any; time_spent_seconds?: number }) =>
    authFetch(`${API_BASE}/sessions/${token}/check-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<{
      question_id: number;
      is_correct: boolean;
      is_partially_correct?: boolean;
      points_awarded: number;
      max_marks: number;
      correct_answer: any;
      explanation?: string;
      worked_solution?: string;
      feedback?: string;
      details?: Record<string, any>;
    }>(r)),
  navigateSession: (token: string, targetIndex: number) =>
    authFetch(`${API_BASE}/sessions/${token}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_index: targetIndex })
    }).then(r => handleResponse<SessionStatusResponse>(r)),
  submitSession: (token: string) =>
    authFetch(`${API_BASE}/sessions/${token}/submit`, { method: 'POST' }).then(r => handleResponse<{ message: string; result_id: number; session_token: string }>(r)),
  runCode: (token: string, data: { code: string; language?: string; test_cases?: any[] }) =>
    authFetch(`${API_BASE}/sessions/${token}/run-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<RunCodeResponse>(r)),

  // Results
  getResults: () => authFetch(`${API_BASE}/results`).then(r => handleResponse<QuizResultListItem[]>(r)),
  getResult: (id: number) => authFetch(`${API_BASE}/results/${id}`).then(r => handleResponse<QuizResult>(r)),

  // Revision & Spaced Repetition
  getRevisionItems: (params?: { due_only?: boolean; mastery_state?: string }) => {
    const sp = new URLSearchParams();
    if (params?.due_only) sp.append('due_only', 'true');
    if (params?.mastery_state) sp.append('mastery_state', params.mastery_state);
    return authFetch(`${API_BASE}/revision/items?${sp.toString()}`).then(r => handleResponse<RevisionItem[]>(r));
  },
  createRevisionQuiz: (data: { title?: string; filter_by: string; question_count: number; subject_id?: number; topic_id?: number; timing_mode?: string }) =>
    authFetch(`${API_BASE}/revision/create-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<Quiz>(r)),

  // Analytics
  getDashboardSummary: () => authFetch(`${API_BASE}/analytics/dashboard`).then(r => handleResponse<DashboardSummary>(r)),
  getPerformanceAnalytics: () => authFetch(`${API_BASE}/analytics/performance`).then(r => handleResponse<PerformanceAnalytics>(r)),

  // Settings
  getAISettings: () => authFetch(`${API_BASE}/settings/ai`).then(r => handleResponse<AISettings>(r)),
  updateAISettings: (data: { api_key?: string; model_name?: string }) =>
    authFetch(`${API_BASE}/settings/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse(r)),
  testAIConnection: (data: { api_key?: string; model_name?: string }) =>
    authFetch(`${API_BASE}/settings/ai/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse<{ success: boolean; message: string; model_used?: string; available_models?: string[] }>(r)),

  getAppearance: () => authFetch(`${API_BASE}/settings/appearance`).then(r => handleResponse<AppearanceSettings>(r)),
  updateAppearance: (data: AppearanceSettings) =>
    authFetch(`${API_BASE}/settings/appearance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse(r)),

  getPreferences: () => authFetch(`${API_BASE}/settings/preferences`).then(r => handleResponse<AppPreferences>(r)),
  updatePreferences: (data: AppPreferences) =>
    authFetch(`${API_BASE}/settings/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => handleResponse(r)),

  getBackup: () => authFetch(`${API_BASE}/settings/backup`).then(r => handleResponse<any>(r)),
  resetHistory: () => authFetch(`${API_BASE}/settings/data/reset-history`, { method: 'POST' }).then(r => handleResponse(r)),
  purgeFullStorage: (confirmation: string) =>
    authFetch(`${API_BASE}/settings/data/purge-full-storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation })
    }).then(r => handleResponse<{ message: string }>(r)),
};
