export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'fill_in_the_blank'
  | 'short_answer'
  | 'match_the_following'
  | 'arrange_in_order'
  | 'numerical'
  | 'code_output'
  | 'code_writing'
  | 'coding'
  | 'code_debug'
  | 'assertion_reasoning'
  | 'descriptive';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: number;
  question_text: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  bank_id?: number | null;
  quiz_id?: number | null;
  subject_id?: number | null;
  topic_id?: number | null;
  section_name?: string | null;
  per_question_timer?: number | null;
  options: QuestionOption[];
  correct_answer: any;
  accepted_answers: string[];
  numerical_tolerance: number;
  explanation?: string | null;
  worked_solution?: string | null;
  points: number;
  negative_marks: number;
  source_ref?: string | null;
  creation_source: string;
  is_approved: boolean;
  is_favorite: boolean;
  tags: string[];
  version: number;
  metadata_extra?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface QuestionBank {
  id: number;
  title: string;
  description?: string | null;
  is_default: boolean;
  question_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: number;
  name: string;
  description?: string | null;
  bank_id?: number | null;
  created_at: string;
}

export interface Topic {
  id: number;
  name: string;
  description?: string | null;
  subject_id: number;
  created_at: string;
}

export interface Quiz {
  id: number;
  title: string;
  description?: string | null;
  mode: 'practice' | 'exam' | 'revision';
  timing_mode: 'total_duration' | 'per_question' | 'both' | 'untimed';
  duration_minutes?: number | null;
  per_question_seconds?: number | null;
  custom_question_durations?: Record<string, number>;
  positive_marks: number;
  negative_marks: number;
  partial_credit: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  allow_skip: boolean;
  allow_back_nav: boolean;
  allow_change_answer: boolean;
  immediate_feedback: boolean;
  show_explanation: boolean;
  auto_submit_on_timeout: boolean;
  question_ids: number[];
  question_count_to_present?: number | null;
  sections?: Array<{ name: string; description?: string }>;
  question_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ClientQuestionView {
  id: number;
  question_text: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  points: number;
  negative_marks: number;
  options: QuestionOption[];
  correct_answer?: any;
  explanation?: string | null;
  worked_solution?: string | null;
  time_limit_seconds?: number | null;
  section_name?: string | null;
  metadata_extra?: Record<string, any>;
}

export interface SessionStatusResponse {
  session_token: string;
  quiz_id: number;
  quiz_title: string;
  mode: 'practice' | 'exam' | 'revision';
  status: string;
  current_question_index: number;
  total_questions: number;
  started_at?: string | null;
  session_deadline?: string | null;
  session_remaining_seconds?: number | null;
  question_remaining_seconds?: number | null;
  answered_count: number;
  flagged_count: number;
  skipped_count: number;
  question_order?: number[];
  question_palette?: Array<{
    index: number;
    question_id: number;
    is_answered: boolean;
    is_flagged: boolean;
    is_visited: boolean;
  }>;
  question_status_map: Record<string, { is_answered: boolean; is_flagged: boolean; is_skipped: boolean; is_visited?: boolean; time_spent_seconds?: number }>;
  current_question?: ClientQuestionView | null;
  current_answer?: any;
  is_current_flagged: boolean;
  sections?: Array<{ name: string; description?: string }>;
  allow_skip: boolean;
  allow_back_nav: boolean;
  allow_change_answer: boolean;
  immediate_feedback: boolean;
  show_explanation: boolean;
  timing_mode: string;
}

export interface TestCaseResult {
  input: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  error?: string | null;
  execution_time_ms: number;
}

export interface RunCodeResponse {
  all_passed: boolean;
  passed_count: number;
  total_count: number;
  results: TestCaseResult[];
  stdout: string;
}

export interface QuestionAttemptDetail {
  id: number;
  question_id: number;
  question_snapshot: Record<string, any>;
  user_answer: any;
  is_correct: boolean;
  is_partially_correct: boolean;
  marks_awarded: number;
  max_marks: number;
  time_spent_seconds: number;
  feedback?: string | null;
  evaluation_method: string;
}

export interface QuizResult {
  id: number;
  quiz_id: number;
  quiz_title?: string | null;
  session_id: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  partially_correct_count: number;
  pending_review_count: number;
  score: number;
  max_score: number;
  percentage: number;
  time_taken_seconds: number;
  completed_at: string;
  breakdown: Record<string, any>;
  attempt_details?: QuestionAttemptDetail[];
}

export interface QuizResultListItem {
  id: number;
  quiz_id: number;
  quiz_title: string;
  score: number;
  max_score: number;
  percentage: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  time_taken_seconds: number;
  completed_at: string;
}

export interface ParsedQuestionItem {
  temp_id: string;
  question_text: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  options: QuestionOption[];
  correct_answer: any;
  accepted_answers: string[];
  numerical_tolerance: number;
  explanation?: string | null;
  points: number;
  negative_marks: number;
  source_ref?: string | null;
  section_name?: string;
  per_question_timer?: number;
  status: 'valid' | 'needs_review' | 'duplicate' | 'missing_answer';
  issues: string[];
  is_approved: boolean;
  metadata_extra?: Record<string, any>;
}

export interface ImportJob {
  id: number;
  source_type: 'pdf' | 'text' | 'json';
  filename?: string | null;
  total_detected: number;
  successfully_parsed: number;
  issues_count: number;
  parsed_questions: ParsedQuestionItem[];
  issues: Array<{ question_index: number; temp_id: string; issues: string[] }>;
  status: string;
  created_at: string;
}

export interface RevisionItem {
  id: number;
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  difficulty: Difficulty;
  subject_name?: string | null;
  topic_name?: string | null;
  mastery_state: 'new' | 'learning' | 'needs_revision' | 'mastered';
  total_attempts: number;
  correct_attempts: number;
  accuracy_percentage: number;
  streak: number;
  next_review_due: string;
  is_due: boolean;
}

export interface DashboardSummary {
  total_assessments_taken: number;
  total_questions_answered: number;
  average_percentage: number;
  best_percentage: number;
  accuracy_rate: number;
  weak_topics: Array<{ topic: string; accuracy: number; total_questions: number }>;
  recent_results: Array<{
    id: number;
    quiz_title: string;
    score: number;
    max_score: number;
    percentage: number;
    total_questions: number;
    correct_count: number;
    time_taken_seconds: number;
    completed_at: string;
  }>;
  mastery_counts: {
    new: number;
    learning: number;
    needs_revision: number;
    mastered: number;
  };
}

export interface PerformanceAnalytics {
  trends: Array<{
    attempt_number: number;
    quiz_title: string;
    percentage: number;
    score: number;
    max_score: number;
    correct_count: number;
    incorrect_count: number;
    date: string;
  }>;
  topic_accuracy: Array<{ topic: string; accuracy: number; total: number }>;
  difficulty_accuracy: Array<{ difficulty: string; accuracy: number; total: number }>;
  type_accuracy: Array<{ type: string; accuracy: number; total: number }>;
  total_attempts: number;
}

export interface AISettings {
  is_key_configured: boolean;
  masked_key?: string | null;
  model_name: string;
  available_models: string[];
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  accent_color: string;
  font_size: string;
}

export interface AppPreferences {
  default_timing_mode: string;
  default_quiz_duration_mins: number;
  default_question_seconds: number;
  default_positive_marks: number;
  default_negative_marks: number;
  confirm_on_leave: boolean;
}

export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string | null;
  role: 'admin' | 'candidate';
  is_active: boolean;
  created_at: string;
  is_gemini_configured?: boolean;
  masked_gemini_key?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TOTPSetupResponse {
  secret: string;
  otpauth_uri: string;
  qr_code_base64: string;
  instructions: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  role: 'admin' | 'candidate';
  is_active: boolean;
  is_gemini_configured: boolean;
  masked_gemini_key?: string | null;
  created_at: string;
  last_login_at?: string | null;
  quizzes_count: number;
  questions_count: number;
  banks_count: number;
  attempts_count: number;
}
