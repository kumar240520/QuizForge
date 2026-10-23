import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Code,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileUp,
  Sparkles,
  Layers
} from 'lucide-react';
import { api } from '../services/api';

export const ImportQuestionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetQuizId = searchParams.get('quiz_id');
  const targetSection = searchParams.get('section');
  const [activeTab, setActiveTab] = useState<'pdf' | 'text' | 'json'>('pdf');
  
  // PDF state
  const [file, setFile] = useState<File | null>(null);
  
  // Text state
  const [pastedText, setPastedText] = useState('');
  
  // JSON state
  const [jsonContent, setJsonContent] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleText = `1. What is the default port for HTTPS?
A. 80
B. 443
C. 8080
D. 22
Answer: B
Explanation: Port 443 is the standard TCP port for secure web traffic via TLS/SSL.

2. In Python, which collection type is immutable?
(a) List
(b) Dictionary
(c) Tuple
(d) Set
Ans: (c)

3. Which of the following are ACID properties in database management? (Select all that apply)
A. Atomicity
B. Consistency
C. Isolation
D. Durability
Answer: A, B, C, D`;

  const sampleJson = `[
  {
    "question_text": "Which sorting algorithm has O(n log n) average time complexity?",
    "question_type": "single_choice",
    "difficulty": "medium",
    "options": [
      {"id": "A", "text": "Merge Sort"},
      {"id": "B", "text": "Bubble Sort"},
      {"id": "C", "text": "Insertion Sort"},
      {"id": "D", "text": "Selection Sort"}
    ],
    "correct_answer": ["A"],
    "explanation": "Merge sort divides the array in half recursively and merges in linear time.",
    "points": 1.0
  }
]`;

  const handleUploadPdf = async () => {
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (targetQuizId) {
        sessionStorage.setItem('quizforge_import_target_quiz_id', targetQuizId);
      } else {
        sessionStorage.removeItem('quizforge_import_target_quiz_id');
      }
      if (targetSection) {
        sessionStorage.setItem('quizforge_import_target_section', targetSection);
      } else {
        sessionStorage.removeItem('quizforge_import_target_section');
      }
      const job = await api.uploadPdf(file);
      navigate(`/imports/${job.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to parse PDF document.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportText = async () => {
    if (!pastedText.trim()) {
      setError('Please paste question content into the text area.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (targetQuizId) {
        sessionStorage.setItem('quizforge_import_target_quiz_id', targetQuizId);
      } else {
        sessionStorage.removeItem('quizforge_import_target_quiz_id');
      }
      if (targetSection) {
        sessionStorage.setItem('quizforge_import_target_section', targetSection);
      } else {
        sessionStorage.removeItem('quizforge_import_target_section');
      }
      const job = await api.importText(pastedText);
      navigate(`/imports/${job.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to parse questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = async () => {
    if (!jsonContent.trim()) {
      setError('Please provide a JSON array of questions.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (targetQuizId) {
        sessionStorage.setItem('quizforge_import_target_quiz_id', targetQuizId);
      } else {
        sessionStorage.removeItem('quizforge_import_target_quiz_id');
      }
      if (targetSection) {
        sessionStorage.setItem('quizforge_import_target_section', targetSection);
      } else {
        sessionStorage.removeItem('quizforge_import_target_section');
      }
      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON content must be an array of question objects.');
      }
      const job = await api.importJson(parsed);
      navigate(`/imports/${job.id}`);
    } catch (err: any) {
      setError(err.message || 'Invalid JSON format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Import Questions
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload existing question papers, tests, or study material. QuizForge extracts questions and answers automatically.
        </p>
      </div>

      {/* Target Assessment & Section Info Banner */}
      {(targetQuizId || targetSection) && (
        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-foreground">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span>
              Directing imports to Assessment <strong>#{targetQuizId}</strong>
              {targetSection ? (
                <> &rarr; Section: <strong className="text-primary font-bold px-1.5 py-0.5 rounded bg-primary/20">{targetSection}</strong></>
              ) : (
                ' (General)'
              )}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Questions will be placed into this section with zero unwanted auto-created sections.
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => { setActiveTab('pdf'); setError(null); }}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'pdf'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileUp className="w-4 h-4" />
          <span>Upload PDF</span>
        </button>

        <button
          onClick={() => { setActiveTab('text'); setError(null); }}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'text'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Pasted Text</span>
        </button>

        <button
          onClick={() => { setActiveTab('json'); setError(null); }}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'json'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>Structured JSON</span>
        </button>
      </div>

      {/* Tab 1: PDF */}
      {activeTab === 'pdf' && (
        <div className="p-8 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
              file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => document.getElementById('pdf-file-input')?.click()}
          >
            <input
              id="pdf-file-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }}
            />
            <UploadCloud className="w-12 h-12 mx-auto text-primary mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              {file ? file.name : 'Click to select or drag and drop a PDF'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Ready to parse` : 'Supports standard exams, practice papers, and question sheets up to 25MB'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Automatically detects question numbers, options, answer keys, and explanations.
            </span>
            <button
              onClick={handleUploadPdf}
              disabled={loading || !file}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Parsing PDF...</span>
                </>
              ) : (
                <>
                  <span>Extract Questions</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Pasted Text */}
      {activeTab === 'text' && (
        <div className="p-8 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Paste Questions with Options and Answers</span>
            <button
              type="button"
              onClick={() => setPastedText(sampleText)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Sample Text
            </button>
          </div>

          <textarea
            rows={12}
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            placeholder={`1. What is the capital of Japan?\nA. Tokyo\nB. Kyoto\nAnswer: A\nExplanation: Tokyo is the current capital.`}
            className="w-full p-4 rounded-xl bg-background border border-input text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Supports inline answers, separate answer keys at bottom, and diverse option markers.
            </span>
            <button
              onClick={handleImportText}
              disabled={loading || !pastedText.trim()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Parsing Questions...</span>
                </>
              ) : (
                <>
                  <span>Parse Questions</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: JSON */}
      {activeTab === 'json' && (
        <div className="p-8 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Structured Question JSON</span>
            <button
              type="button"
              onClick={() => setJsonContent(sampleJson)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Sample JSON
            </button>
          </div>

          <textarea
            rows={12}
            value={jsonContent}
            onChange={e => setJsonContent(e.target.value)}
            placeholder="[ { question_text: '...', options: [...] } ]"
            className="w-full p-4 rounded-xl bg-background border border-input text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Validates question schemas, options format, points, and answer keys.
            </span>
            <button
              onClick={handleImportJson}
              disabled={loading || !jsonContent.trim()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validating JSON...</span>
                </>
              ) : (
                <>
                  <span>Validate and Review</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
