import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  LogOut,
  Maximize2,
  Minimize2,
  FileText,
  ShieldCheck,
  User,
  Info,
  Check,
  ZoomIn,
  ZoomOut,
  X,
  Code,
  Play,
  Terminal,
  ArrowUp,
  ArrowDown,
  Columns,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { SessionStatusResponse, Question, RunCodeResponse } from '../types';
import { sanitizeText } from '../utils/textSanitizer';
import { CodingWorkspace } from '../components/CodingWorkspace';
import { enterFullScreen, isFullScreen } from '../utils/fullscreen';

export const ActiveAssessmentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionStatusResponse | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<any>(null);
  const [isFlagged, setIsFlagged] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<number | null>(null);

  // Practice & Revision Mode instant feedback state
  const [practiceFeedback, setPracticeFeedback] = useState<{
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
  } | null>(null);
  const [checkingAnswer, setCheckingAnswer] = useState(false);

  // Modals & Real Exam overlays
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showQuestionPaperModal, setShowQuestionPaperModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [paperQuestions, setPaperQuestions] = useState<Question[]>([]);
  const [loadingPaper, setLoadingPaper] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  // Floating Mode Guidance Notification (Auto-hides after 10s, user can also click 'X')
  const [showModeNotice, setShowModeNotice] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowModeNotice(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // UI customization: font size & full screen
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'unanswered' | 'review'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Coding state
  const [codeRunning, setCodeRunning] = useState(false);
  const [codeResults, setCodeResults] = useState<RunCodeResponse | null>(null);
  const [codeStdout, setCodeStdout] = useState('');
  const [activeTestCaseIdx, setActiveTestCaseIdx] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');

  // Time tracking per question
  const questionStartTimeRef = useRef<number>(Date.now());

  // Load session from server
  const loadSession = async () => {
    if (!token) return;
    try {
      const data = await api.getSession(token);
      if (data.status === 'evaluated' || data.status === 'submitted') {
        const results = await api.getResults();
        const matched = results.find(r => r.quiz_id === data.quiz_id);
        if (matched) {
          navigate(`/results/${matched.id}`);
          return;
        }
      }
      setSession(data);
      const firstQ = data.current_question;
      if (firstQ?.metadata_extra?.language) {
        setSelectedLanguage(firstQ.metadata_extra.language);
      }
      if (firstQ?.question_type === 'coding' && !data.current_answer) {
        const starter = firstQ.metadata_extra?.starter_code || (firstQ.metadata_extra?.expected_fn ? `def ${firstQ.metadata_extra.expected_fn}():\n    # Write your solution here\n    pass\n` : 'def solution():\n    # Write your solution here\n    pass\n');
        setCurrentAnswer(starter);
      } else if (firstQ?.question_type === 'arrange_in_order' && (!data.current_answer || !Array.isArray(data.current_answer))) {
        setCurrentAnswer(firstQ.options.map(o => o.id));
      } else if (firstQ?.question_type === 'match_the_following' && (!data.current_answer || typeof data.current_answer !== 'object')) {
        setCurrentAnswer({});
      } else {
        setCurrentAnswer(data.current_answer);
      }
      setIsFlagged(data.is_current_flagged);
      setSessionTimeRemaining(data.session_remaining_seconds ?? null);
      setQuestionTimeRemaining(data.question_remaining_seconds ?? null);
      questionStartTimeRef.current = Date.now();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to assessment session.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [token]);

  // Fullscreen state synchronization & auto-entry handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (active) {
        window.removeEventListener('click', handleUserInteraction);
        window.removeEventListener('keydown', handleUserInteraction);
        window.removeEventListener('pointerdown', handleUserInteraction);
      }
    };

    setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initial attempt to enter fullscreen
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // Continuously capture user gestures (clicks, keys) until fullscreen is established
    const handleUserInteraction = () => {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            window.removeEventListener('click', handleUserInteraction);
            window.removeEventListener('keydown', handleUserInteraction);
            window.removeEventListener('pointerdown', handleUserInteraction);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('pointerdown', handleUserInteraction);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
      // Clean up fullscreen if component unmounts
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Client-side local timer tick down every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTimeRemaining(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });

      setQuestionTimeRemaining(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          handleAutoQuestionTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.current_question_index]);

  const handleAutoQuestionTimeout = () => {
    if (!session || !token) return;
    saveCurrentAnswerToServer(true);
    if (session.current_question_index < session.total_questions - 1) {
      handleNavigate(session.current_question_index + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const saveCurrentAnswerToServer = async (isSkipped: boolean = false, flagOverride?: boolean) => {
    if (!token || !session || !session.current_question) return;
    const spentSecs = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    try {
      await api.submitAnswer(token, {
        question_id: session.current_question.id,
        user_answer: isSkipped ? null : currentAnswer,
        time_spent_seconds: spentSecs,
        is_flagged: flagOverride !== undefined ? flagOverride : isFlagged,
        is_skipped: isSkipped
      });
    } catch (err) {
      console.error('Answer auto-save error:', err);
    }
  };

  // Helper to execute candidate code against test cases
  const handleRunCode = async (codeToRun: string, language: string, testCases: any[]) => {
    if (!token) return;
    setCodeRunning(true);
    try {
      const res = await api.runCode(token, {
        code: codeToRun,
        language: language || 'python',
        test_cases: testCases || []
      });
      setCodeResults(res);
      setCodeStdout(res.stdout);
    } catch (err: any) {
      alert(`Code execution error: ${err.message}`);
    } finally {
      setCodeRunning(false);
    }
  };

  // Interactive answer verification for Practice & Revision Modes
  const handleCheckAnswer = async () => {
    if (!token || !session || !session.current_question || currentAnswer === null || currentAnswer === undefined) return;
    setCheckingAnswer(true);
    try {
      const res = await api.checkAnswer(token, {
        question_id: session.current_question.id,
        user_answer: currentAnswer,
        time_spent_seconds: Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000))
      });
      setPracticeFeedback(res);
    } catch (err: any) {
      alert(`Could not verify answer: ${err.message}`);
    } finally {
      setCheckingAnswer(false);
    }
  };

  const handleNavigate = async (targetIndex: number) => {
    if (!token || !session || targetIndex === session.current_question_index) return;
    await saveCurrentAnswerToServer(false);
    try {
      const updated = await api.navigateSession(token, targetIndex);
      setSession(updated);

      const nextQ = updated.current_question;
      if (nextQ?.metadata_extra?.language) {
        setSelectedLanguage(nextQ.metadata_extra.language);
      }
      if (nextQ?.question_type === 'coding' && !updated.current_answer) {
        const starter = nextQ.metadata_extra?.starter_code || (nextQ.metadata_extra?.expected_fn ? `def ${nextQ.metadata_extra.expected_fn}():\n    # Write your solution here\n    pass\n` : 'def solution():\n    # Write your solution here\n    pass\n');
        setCurrentAnswer(starter);
      } else if (nextQ?.question_type === 'arrange_in_order' && (!updated.current_answer || !Array.isArray(updated.current_answer))) {
        setCurrentAnswer(nextQ.options.map(o => o.id));
      } else if (nextQ?.question_type === 'match_the_following' && (!updated.current_answer || typeof updated.current_answer !== 'object')) {
        setCurrentAnswer({});
      } else {
        setCurrentAnswer(updated.current_answer);
      }

      setIsFlagged(updated.is_current_flagged);
      setQuestionTimeRemaining(updated.question_remaining_seconds ?? null);
      questionStartTimeRef.current = Date.now();
      setCodeResults(null);
      setCodeStdout('');
      setPracticeFeedback(null);
    } catch (err: any) {
      setError(err.message || 'Navigation error.');
    }
  };

  // Mark for review & next
  const handleMarkForReviewAndNext = async () => {
    if (!token || !session) return;
    const nextFlag = true;
    setIsFlagged(true);
    await saveCurrentAnswerToServer(false, nextFlag);
    if (session.current_question_index < session.total_questions - 1) {
      handleNavigate(session.current_question_index + 1);
    }
  };

  const handleClearAnswer = async () => {
    setCurrentAnswer(null);
    setPracticeFeedback(null);
    if (!token || !session || !session.current_question) return;
    try {
      await api.submitAnswer(token, {
        question_id: session.current_question.id,
        user_answer: null,
        time_spent_seconds: 1,
        is_flagged: isFlagged,
        is_skipped: true
      });
      // refresh status
      const updated = await api.getSession(token);
      setSession(updated);
    } catch (err) {
      console.error('Failed to clear answer:', err);
    }
  };

  const toggleFlag = () => {
    const next = !isFlagged;
    setIsFlagged(next);
    saveCurrentAnswerToServer(false, next);
  };

  const handleFinalSubmit = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await saveCurrentAnswerToServer(false);
      const res = await api.submitSession(token);
      // Cleanly exit fullscreen upon submission before navigating
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
      navigate(`/results/${res.result_id}`);
    } catch (err: any) {
      setError(err.message || 'Submission error.');
      setSubmitting(false);
    }
  };

  // Exit assessment to dashboard cleanly
  const handleExitToDashboard = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    navigate('/assessments');
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch(() => {});
      }
    }
  };

  // Question Paper view loader
  const handleOpenQuestionPaper = async () => {
    if (!session) return;
    setShowQuestionPaperModal(true);
    if (paperQuestions.length === 0) {
      setLoadingPaper(true);
      try {
        const questions = await api.getQuizQuestions(session.quiz_id);
        setPaperQuestions(questions);
      } catch (err) {
        console.error('Failed to load questions paper:', err);
      } finally {
        setLoadingPaper(false);
      }
    }
  };

  // Keyboard shortcuts (A, B, C, D for options; ArrowRight/Enter for Next; ArrowLeft for Prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a textarea or input
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key) && session?.current_question) {
        const qType = session.current_question.question_type;
        if (qType === 'single_choice' || qType === 'assertion_reasoning') {
          setCurrentAnswer([key]);
        } else if (qType === 'multiple_choice') {
          const currentArr = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
          if (currentArr.includes(key)) {
            setCurrentAnswer(currentArr.filter(x => x !== key));
          } else {
            setCurrentAnswer([...currentArr, key]);
          }
        }
      } else if (e.key === 'ArrowRight' && session && session.current_question_index < session.total_questions - 1) {
        handleNavigate(session.current_question_index + 1);
      } else if (e.key === 'ArrowLeft' && session && session.current_question_index > 0) {
        handleNavigate(session.current_question_index - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, currentAnswer]);

  const formatTimer = (secs: number | null) => {
    if (secs === null || secs < 0) return '00:00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Deterministic question palette status resolver for exact sequence & authentic CBT colors
  const getQuestionPaletteItem = (index: number) => {
    if (!session) return { is_answered: false, is_flagged: false, is_visited: false };

    const isCurrent = session.current_question_index === index;
    const hasLocalAnswer = currentAnswer !== null &&
      currentAnswer !== undefined &&
      currentAnswer !== '' &&
      (!Array.isArray(currentAnswer) || currentAnswer.length > 0) &&
      (typeof currentAnswer !== 'object' || Array.isArray(currentAnswer) || Object.keys(currentAnswer).length > 0);

    // If backend provided ordered question_palette
    if (session.question_palette && session.question_palette[index]) {
      const p = session.question_palette[index];
      const isAns = isCurrent ? hasLocalAnswer : p.is_answered;
      const isFlg = isCurrent ? isFlagged : p.is_flagged;
      const isVis = isCurrent ? true : p.is_visited;
      return { is_answered: Boolean(isAns), is_flagged: Boolean(isFlg), is_visited: Boolean(isVis) };
    }

    // Sequence fallback using session.question_order
    const qid = session.question_order ? String(session.question_order[index]) : null;
    const st = qid ? session.question_status_map[qid] : null;
    const isAns = isCurrent ? hasLocalAnswer : Boolean(st?.is_answered);
    const isFlg = isCurrent ? isFlagged : Boolean(st?.is_flagged);
    const isVis = isCurrent || Boolean(st?.is_visited) || Boolean(st?.is_answered) || Boolean(st?.is_flagged);
    return { is_answered: isAns, is_flagged: isFlg, is_visited: isVis };
  };

  // Calculate live question statuses for Real Exam palette
  const statusStats = useMemo(() => {
    if (!session) return { answered: 0, notAnswered: 0, marked: 0, markedAnswered: 0, notVisited: 0 };
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let markedAnswered = 0;
    let notVisited = 0;

    for (let i = 0; i < session.total_questions; i++) {
      const p = getQuestionPaletteItem(i);
      if (p.is_flagged && p.is_answered) {
        markedAnswered++;
      } else if (p.is_flagged) {
        marked++;
      } else if (p.is_answered) {
        answered++;
      } else if (p.is_visited) {
        notAnswered++;
      } else {
        notVisited++;
      }
    }
    return { answered, notAnswered, marked, markedAnswered, notVisited };
  }, [session, currentAnswer, isFlagged]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-slate-300">Loading Secure Assessment Environment...</span>
      </div>
    );
  }

  if (error || !session || !session.current_question) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center rounded-2xl bg-card border border-destructive/20 text-destructive shadow-xl">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" />
        <h3 className="text-base font-bold mb-1">Assessment Load Error</h3>
        <p className="text-xs text-muted-foreground mb-4">{error || 'Session could not be loaded.'}</p>
        <button
          onClick={() => navigate('/assessments')}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const q = session.current_question;
  const isLastQuestion = session.current_question_index === session.total_questions - 1;
  const progressPercent = Math.round(((session.current_question_index + 1) / session.total_questions) * 100);

  // Determine section tabs
  const sectionsList = session.sections && session.sections.length > 0
    ? session.sections
    : [{ name: q.section_name || 'Section 1', description: '' }];

  const currentSectionName = q.section_name || 'Section 1';

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col justify-between select-none text-slate-800 dark:text-slate-100 font-sans">
      {/* 1. REAL CBT TOP COMMAND CENTER HEADER (COMPACT, SINGLE-ROW ON MOBILE) */}
      <header className="shrink-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
        {/* Main Header Bar */}
        <div className="max-w-[1700px] mx-auto px-2.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2">
          {/* Left: Brand Icon + Title + Mode Badge */}
          <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate max-w-[130px] xs:max-w-[180px] sm:max-w-md">
                  {session.quiz_title}
                </h1>
                <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  session.mode === 'exam'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : session.mode === 'practice'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                }`}>
                  {session.mode}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
                <span>Question {session.current_question_index + 1} of {session.total_questions}</span>
              </div>
            </div>
          </div>

          {/* Right: Timers & Essential Controls (Arranged Left-to-Right in ONE row) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Per-Question Countdown Timer (if configured) */}
            {questionTimeRemaining !== null && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-[10px] sm:text-xs font-bold transition-all shadow-sm ${
                questionTimeRemaining < 10
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse'
                  : 'bg-indigo-950/70 border-indigo-700/60 text-indigo-300'
              }`}>
                <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                <span>Q: {formatTimer(questionTimeRemaining)}</span>
              </div>
            )}

            {/* Master Total Exam Countdown Clock */}
            {sessionTimeRemaining !== null && (
              <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border font-mono shadow-sm ${
                sessionTimeRemaining < 300
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse font-extrabold text-xs sm:text-sm'
                  : 'bg-slate-800 border-slate-700 text-amber-400 font-bold text-xs sm:text-sm'
              }`}>
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <span className="hidden md:inline text-[9px] uppercase tracking-wider text-slate-300 font-semibold mr-0.5">Time:</span>
                <span className="font-mono tracking-wider font-extrabold text-xs sm:text-sm text-white">{formatTimer(sessionTimeRemaining)}</span>
              </div>
            )}

            {/* Candidate Card (Desktop only) */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-200">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="text-left text-[10px] leading-tight">
                <div className="font-semibold text-slate-200">Candidate</div>
                <div className="text-[9px] text-slate-400 font-mono">Authorized</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleOpenQuestionPaper}
                className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="View Full Question Paper"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                onClick={() => setShowInstructionsModal(true)}
                className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Exam Instructions & Tips"
              >
                <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                onClick={toggleFullscreen}
                className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
                  isFullscreen
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
                }`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>

              <button
                onClick={() => setShowExitModal(true)}
                className="p-1.5 sm:p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors"
                title="Exit Assessment"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Real Exam Section Ribbon (Ultra slim, single line) */}
        <div className="bg-slate-950 border-t border-slate-800/80 px-2.5 sm:px-6 py-1 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap mr-1">
              Sections:
            </span>
            {sectionsList.map((sec, sIdx) => {
              const isSecActive = sec.name.toLowerCase() === currentSectionName.toLowerCase();
              return (
                <div
                  key={sec.name || sIdx}
                  className={`py-0.5 px-2 rounded text-[11px] font-semibold whitespace-nowrap transition-all ${
                    isSecActive
                      ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sec.name}
                </div>
              );
            })}
          </div>

          {/* Question counter on mobile */}
          <div className="sm:hidden text-[10px] font-mono text-slate-400 font-bold shrink-0">
            Q {session.current_question_index + 1}/{session.total_questions}
          </div>
        </div>
      </header>

      {/* Floating Mode Guidance Toast (10s auto-dismiss, dismissible with 'X', takes 0 document flow space) */}
      {showModeNotice && (
        <div className="fixed top-16 right-3 sm:right-6 left-3 sm:left-auto sm:max-w-md z-40 animate-slideDown shadow-2xl">
          <div className={`p-3 sm:p-3.5 rounded-2xl border backdrop-blur-md flex items-start gap-2.5 sm:gap-3 text-xs leading-relaxed shadow-xl ${
            session.mode === 'practice'
              ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
              : session.mode === 'revision'
              ? 'bg-slate-900/95 border-indigo-500/50 text-indigo-200 shadow-indigo-950/50'
              : 'bg-slate-900/95 border-rose-500/50 text-rose-200 shadow-rose-950/50'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              session.mode === 'practice'
                ? 'bg-emerald-500/20 text-emerald-400'
                : session.mode === 'revision'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}>
              {session.mode === 'practice' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : session.mode === 'revision' ? (
                <RotateCcw className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1 text-slate-200">
              {session.mode === 'practice' && (
                <>
                  <strong className="text-emerald-400 font-semibold block mb-0.5">Practice Mode Active</strong>
                  Instant verification enabled. Choose an option and click <strong className="text-white">Check Answer</strong> in the bottom bar to view explanations.
                </>
              )}
              {session.mode === 'revision' && (
                <>
                  <strong className="text-indigo-400 font-semibold block mb-0.5">Revision Mode Active</strong>
                  Spaced repetition reinforcement. Questions target previous mistakes and update your Leitner mastery tiers.
                </>
              )}
              {session.mode === 'exam' && (
                <>
                  <strong className="text-rose-400 font-semibold block mb-0.5">Exam Mode Active</strong>
                  Strict proctored assessment. Work steadily before the countdown expires.
                </>
              )}
              <div className="text-[10px] text-slate-400 mt-1">Auto-closing in 10s</div>
            </div>

            <button
              type="button"
              onClick={() => setShowModeNotice(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full Screen Security Lock Overlay when in windowed mode */}
      {!isFullscreen && (
        <div
          onClick={() => enterFullScreen()}
          className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none animate-fadeIn"
        >
          <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4 animate-pulse">
            <Maximize2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">FullScreen Assessment Mode Required</h2>
          <p className="text-xs text-slate-300 max-w-md leading-relaxed mb-6">
            QuizForge assessments run strictly in full screen to ensure examination focus and security integrity. Click anywhere on this screen to resume in full screen.
          </p>
          <button
            type="button"
            onClick={() => enterFullScreen()}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Enter FullScreen to Continue</span>
          </button>
        </div>
      )}

      {/* Progress Bar */}
      <div className="shrink-0 w-full h-1 bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 2. REAL CBT MAIN TWO-COLUMN WORKSPACE */}
      <main className="flex-1 min-h-0 max-w-[1750px] w-full mx-auto p-1.5 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 lg:gap-5 items-start overflow-hidden">
        {/* Left Column: Question Presentation Area (8-9 Cols on desktop, full width on mobile) - SCROLLABLE */}
        <div className="col-span-1 lg:col-span-8 xl:col-span-9 h-full overflow-y-auto pr-0.5 sm:pr-2 pb-4 sm:pb-6 space-y-3 sm:space-y-4 scrollbar-thin">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3.5 sm:p-7 space-y-3.5 sm:space-y-6">
            {/* Question Header & Marking Scheme */}
            <div className="flex items-center justify-between gap-2 pb-2 sm:pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                <span className="text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Question {session.current_question_index + 1}
                </span>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
                  {q.question_type.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase">
                  {q.difficulty}
                </span>
              </div>

              {/* Marking Scheme, Text Zoom, & Flag */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  +{q.points || 1.00} <span className="text-slate-400">|</span> -{q.negative_marks || 0.00}
                </div>

                {/* Font Size Adjuster */}
                <div className="hidden sm:flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setFontSizeLevel('normal')}
                    className={`px-2 py-0.5 rounded ${fontSizeLevel === 'normal' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    title="Normal text size"
                  >
                    A
                  </button>
                  <button
                    onClick={() => setFontSizeLevel('large')}
                    className={`px-2 py-0.5 rounded ${fontSizeLevel === 'large' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    title="Large text size"
                  >
                    A+
                  </button>
                  <button
                    onClick={() => setFontSizeLevel('xlarge')}
                    className={`px-2 py-0.5 rounded ${fontSizeLevel === 'xlarge' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    title="Extra large text size"
                  >
                    A++
                  </button>
                </div>

                {/* Flag / Bookmark button */}
                <button
                  onClick={toggleFlag}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isFlagged
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title={isFlagged ? 'Flagged for Review' : 'Flag Question'}
                >
                  <Flag className={`w-4 h-4 ${isFlagged ? 'fill-white' : ''}`} />
                </button>
              </div>
            </div>

            {/* Sanitized Question Text (Zero Boxes / Tofu) */}
            <div className={`font-medium text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-wrap ${
              fontSizeLevel === 'large' ? 'text-xl' : fontSizeLevel === 'xlarge' ? 'text-2xl font-semibold' : 'text-base sm:text-lg'
            }`}>
              {sanitizeText(q.question_text)}
            </div>

            {/* Code Output Snippet Presentation (non-coding questions only) */}
            {q.question_type !== 'coding' && (q.question_type === 'code_output' || q.metadata_extra?.code || q.metadata_extra?.code_snippet) && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-md my-4">
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-mono font-bold text-slate-200">
                      snippet.{q.metadata_extra?.language === 'javascript' ? 'js' : 'py'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase font-mono font-bold">
                      {q.metadata_extra?.language || 'python'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Executable Code</span>
                </div>
                <div className="p-4 overflow-x-auto bg-slate-950 text-emerald-300 font-mono text-xs sm:text-sm leading-relaxed">
                  <pre className="whitespace-pre font-mono">{q.metadata_extra?.code || q.metadata_extra?.code_snippet || ''}</pre>
                </div>
              </div>
            )}

            {/* Answer Control Options */}
            <div className="pt-2">
              {/* Single Choice & Assertion/Reasoning */}
              {['single_choice', 'assertion_reasoning'].includes(q.question_type) && (
                <div className="space-y-2 sm:space-y-3">
                  {q.options.map((opt) => {
                    const isSelected = Array.isArray(currentAnswer)
                      ? currentAnswer.includes(opt.id)
                      : currentAnswer === opt.id;
                    const cleanOptText = sanitizeText(opt.text);
                    const isOptCorrect = practiceFeedback ? (
                      Array.isArray(practiceFeedback.correct_answer)
                        ? practiceFeedback.correct_answer.includes(opt.id)
                        : String(practiceFeedback.correct_answer) === String(opt.id)
                    ) : false;
                    const isOptWrong = practiceFeedback && isSelected && !isOptCorrect;

                    let optClasses = isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-semibold ring-2 ring-indigo-500/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200';
                    let badgeClasses = isSelected
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700';

                    if (practiceFeedback) {
                      if (isOptCorrect) {
                        optClasses = 'border-emerald-500 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100 font-bold ring-2 ring-emerald-500/40 shadow-sm';
                        badgeClasses = 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-300';
                      } else if (isOptWrong) {
                        optClasses = 'border-rose-500 bg-rose-500/15 text-rose-950 dark:text-rose-100 font-bold ring-2 ring-rose-500/40 shadow-sm';
                        badgeClasses = 'bg-rose-500 text-white font-bold ring-2 ring-rose-300';
                      }
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() => setCurrentAnswer([opt.id])}
                        className={`p-3 sm:p-4 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 sm:gap-3.5 cursor-pointer transition-all duration-150 ${optClasses}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all shrink-0 ${badgeClasses}`}>
                          {opt.id}
                        </div>
                        <span className={`flex-1 leading-snug ${fontSizeLevel === 'large' ? 'text-base' : fontSizeLevel === 'xlarge' ? 'text-lg' : 'text-xs sm:text-sm'}`}>
                          {cleanOptText}
                        </span>
                        {practiceFeedback && isOptCorrect && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-4 h-4" /> Correct
                          </span>
                        )}
                        {practiceFeedback && isOptWrong && (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 shrink-0">
                            <XCircle className="w-4 h-4" /> Incorrect
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Multiple Choice (Multiple select) */}
              {q.question_type === 'multiple_choice' && (
                <div className="space-y-2 sm:space-y-3">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Select all correct options (Multiple Choice):
                  </span>
                  {q.options.map((opt) => {
                    const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(opt.id);
                    const cleanOptText = sanitizeText(opt.text);
                    const isOptCorrect = practiceFeedback ? (
                      Array.isArray(practiceFeedback.correct_answer)
                        ? practiceFeedback.correct_answer.includes(opt.id)
                        : String(practiceFeedback.correct_answer) === String(opt.id)
                    ) : false;
                    const isOptWrong = practiceFeedback && isSelected && !isOptCorrect;

                    let optClasses = isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-semibold ring-2 ring-indigo-500/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200';
                    let boxClasses = isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-card';

                    if (practiceFeedback) {
                      if (isOptCorrect) {
                        optClasses = 'border-emerald-500 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100 font-bold ring-2 ring-emerald-500/40 shadow-sm';
                        boxClasses = 'bg-emerald-500 border-emerald-500 text-white';
                      } else if (isOptWrong) {
                        optClasses = 'border-rose-500 bg-rose-500/15 text-rose-950 dark:text-rose-100 font-bold ring-2 ring-rose-500/40 shadow-sm';
                        boxClasses = 'bg-rose-500 border-rose-500 text-white';
                      }
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          const currentArr = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
                          if (currentArr.includes(opt.id)) {
                            setCurrentAnswer(currentArr.filter(x => x !== opt.id));
                          } else {
                            setCurrentAnswer([...currentArr, opt.id]);
                          }
                        }}
                        className={`p-3 sm:p-4 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 sm:gap-3.5 cursor-pointer transition-all duration-150 ${optClasses}`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0 ${boxClasses}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className="w-5 text-xs font-bold font-mono text-slate-400">{opt.id}</span>
                        <span className={`flex-1 leading-snug ${fontSizeLevel === 'large' ? 'text-base' : fontSizeLevel === 'xlarge' ? 'text-lg' : 'text-xs sm:text-sm'}`}>
                          {cleanOptText}
                        </span>
                        {practiceFeedback && isOptCorrect && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-4 h-4" /> Correct
                          </span>
                        )}
                        {practiceFeedback && isOptWrong && (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 shrink-0">
                            <XCircle className="w-4 h-4" /> Incorrect
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* True / False */}
              {q.question_type === 'true_false' && (
                <div className="grid grid-cols-2 gap-4">
                  {['TRUE', 'FALSE'].map((val) => {
                    const isSelected = Array.isArray(currentAnswer)
                      ? currentAnswer.includes(val)
                      : String(currentAnswer).toUpperCase() === val;
                    const isOptCorrect = practiceFeedback ? String(practiceFeedback.correct_answer).toUpperCase() === val : false;
                    const isOptWrong = practiceFeedback && isSelected && !isOptCorrect;

                    let btnClasses = isSelected
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/40'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 text-slate-800 dark:text-slate-200';

                    if (practiceFeedback) {
                      if (isOptCorrect) {
                        btnClasses = 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/40';
                      } else if (isOptWrong) {
                        btnClasses = 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/40';
                      }
                    }

                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCurrentAnswer([val])}
                        className={`py-3.5 sm:py-6 rounded-xl sm:rounded-2xl border text-sm sm:text-base font-bold transition-all shadow-sm ${btnClasses}`}
                      >
                        {val === 'TRUE' ? 'True' : 'False'}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Match the Following */}
              {q.question_type === 'match_the_following' && (() => {
                const leftItems = q.options;
                const rightTargets: Array<{ id: string; text: string }> = q.metadata_extra?.match_targets || leftItems.map((opt) => ({
                  id: opt.id,
                  text: opt.text
                }));
                const matchMap: Record<string, string> = (currentAnswer && typeof currentAnswer === 'object' && !Array.isArray(currentAnswer))
                  ? currentAnswer
                  : {};

                const handleMatchChange = (leftId: string, targetId: string) => {
                  const updated = { ...matchMap, [leftId]: targetId };
                  setCurrentAnswer(updated);
                };

                return (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                      <Columns className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>For each item in <strong>Column A (Left)</strong>, select the matching item from <strong>Column B (Right)</strong>:</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column Items with Dropdown selectors */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                          Column A (Items to Match)
                        </span>
                        {leftItems.map((leftOpt) => {
                          const selectedTargetId = matchMap[leftOpt.id] || '';

                          return (
                            <div
                              key={leftOpt.id}
                              className={`p-4 rounded-xl border text-sm transition-all space-y-2.5 ${
                                selectedTargetId
                                  ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                  {leftOpt.id}
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100 flex-1 leading-snug">
                                  {sanitizeText(leftOpt.text)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 pl-9">
                                <span className="text-xs font-bold text-indigo-600">Matches:</span>
                                <select
                                  value={selectedTargetId}
                                  onChange={(e) => handleMatchChange(leftOpt.id, e.target.value)}
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">-- Choose Matching Option --</option>
                                  {rightTargets.map((rt) => (
                                    <option key={rt.id} value={rt.id}>
                                      {rt.text}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right Column (Reference Items) */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                          Column B (Available Options)
                        </span>
                        <div className="space-y-2.5">
                          {rightTargets.map((rt) => {
                            const isMatchedBy = Object.entries(matchMap).find(([_, targetId]) => targetId === rt.id)?.[0];

                            return (
                              <div
                                key={rt.id}
                                className={`p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3 ${
                                  isMatchedBy
                                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-100'
                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                  isMatchedBy
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                  {isMatchedBy ? `✓ ${isMatchedBy}` : '•'}
                                </span>
                                <span className="leading-relaxed flex-1">
                                  {sanitizeText(rt.text)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Arrange in Order */}
              {q.question_type === 'arrange_in_order' && (() => {
                const orderedIds: string[] = Array.isArray(currentAnswer) && currentAnswer.length > 0
                  ? currentAnswer
                  : q.options.map(o => o.id);

                const moveItem = (index: number, direction: 'up' | 'down') => {
                  const targetIndex = direction === 'up' ? index - 1 : index + 1;
                  if (targetIndex < 0 || targetIndex >= orderedIds.length) return;
                  const newArr = [...orderedIds];
                  const temp = newArr[index];
                  newArr[index] = newArr[targetIndex];
                  newArr[targetIndex] = temp;
                  setCurrentAnswer(newArr);
                };

                return (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                      <span>Arrange the sequence from top (first) to bottom (last) using the reorder buttons:</span>
                      <button
                        type="button"
                        onClick={() => setCurrentAnswer(q.options.map(o => o.id))}
                        className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Order</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {orderedIds.map((optId, idx) => {
                        const opt = q.options.find(o => o.id === optId) || { id: optId, text: optId };
                        return (
                          <div
                            key={optId}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm flex items-center gap-3.5 shadow-xs transition-all hover:border-indigo-400"
                          >
                            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="flex-1 font-medium text-slate-900 dark:text-slate-100 leading-snug">
                              {sanitizeText(opt.text)}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveItem(idx, 'up')}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                                title="Move Up"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === orderedIds.length - 1}
                                onClick={() => moveItem(idx, 'down')}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                                title="Move Down"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Code Output and Code Debug */}
              {['code_output', 'code_debug'].includes(q.question_type) && (
                <div className="space-y-4">
                  {q.metadata_extra?.code_snippet && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs shadow-md">
                      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{q.metadata_extra.language || 'python'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase">
                          {q.question_type === 'code_debug' ? 'Buggy Code' : 'Snippet'}
                        </span>
                      </div>
                      <pre className="p-4 text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre font-mono">
                        {q.metadata_extra.code_snippet}
                      </pre>
                    </div>
                  )}

                  {q.options && q.options.length > 0 ? (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-slate-500 block">
                        Select the correct output:
                      </span>
                      {q.options.map((opt) => {
                        const isSelected = Array.isArray(currentAnswer)
                          ? currentAnswer.includes(opt.id)
                          : currentAnswer === opt.id;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => setCurrentAnswer([opt.id])}
                            className={`p-4 rounded-xl border text-sm flex items-center gap-3.5 cursor-pointer font-mono transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-semibold ring-2 ring-indigo-500/30 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-indigo-400 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {opt.id}
                            </div>
                            <span className="flex-1">{sanitizeText(opt.text)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500">Terminal Output:</label>
                      <input
                        type="text"
                        value={currentAnswer ? (Array.isArray(currentAnswer) ? currentAnswer[0] : currentAnswer) : ''}
                        onChange={e => setCurrentAnswer([e.target.value])}
                        placeholder="Type exact terminal output here..."
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Coding Workspace with Pro IDE & Live Test Case Runner */}
              {q.question_type === 'coding' && (() => {
                const lang = selectedLanguage || q.metadata_extra?.language || 'python';
                const expectedFn = q.metadata_extra?.expected_fn || q.metadata_extra?.function_name;
                const defaultStarter = lang === 'javascript'
                  ? (expectedFn ? `function ${expectedFn}(s) {\n    // Write your JavaScript solution here\n    return null;\n}\n` : 'function solution() {\n    // Write your JavaScript solution here\n    return null;\n}\n')
                  : (expectedFn ? `def ${expectedFn}():\n    # Write your Python solution here\n    pass\n` : 'def solution():\n    # Write your Python solution here\n    pass\n');
                const starter = q.metadata_extra?.starter_code || defaultStarter;
                const codeValue = typeof currentAnswer === 'string'
                  ? currentAnswer
                  : (Array.isArray(currentAnswer) ? currentAnswer[0] : '') || starter;

                return (
                  <CodingWorkspace
                    question={q}
                    code={codeValue}
                    onChange={(newCode) => setCurrentAnswer(newCode)}
                    selectedLanguage={lang}
                    onLanguageChange={(newLang) => setSelectedLanguage(newLang)}
                    onRunCode={handleRunCode}
                    running={codeRunning}
                    results={codeResults}
                    stdout={codeStdout}
                    activeCaseIdx={activeTestCaseIdx}
                    setActiveCaseIdx={setActiveTestCaseIdx}
                  />
                );
              })()}

              {/* Numerical */}
              {q.question_type === 'numerical' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500">Calculated Numeric Value:</label>
                  <input
                    type="number"
                    step="any"
                    value={currentAnswer ? (Array.isArray(currentAnswer) ? currentAnswer[0] : currentAnswer) : ''}
                    onChange={e => setCurrentAnswer([e.target.value])}
                    placeholder="Enter numerical response..."
                    className="w-64 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base font-mono font-bold focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  />
                </div>
              )}

              {/* Fill in the blank / Short answer */}
              {['fill_in_the_blank', 'short_answer'].includes(q.question_type) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500">Candidate Answer:</label>
                  <input
                    type="text"
                    value={currentAnswer ? (Array.isArray(currentAnswer) ? currentAnswer[0] : currentAnswer) : ''}
                    onChange={e => setCurrentAnswer([e.target.value])}
                    placeholder="Type your exact response here..."
                    className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  />
                </div>
              )}

              {/* Descriptive / Code writing */}
              {['descriptive', 'code_writing'].includes(q.question_type) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500">Detailed Response:</label>
                  <textarea
                    rows={7}
                    value={currentAnswer ? (Array.isArray(currentAnswer) ? currentAnswer[0] : currentAnswer) : ''}
                    onChange={e => setCurrentAnswer([e.target.value])}
                    placeholder="Write your explanation or code implementation here..."
                    className="w-full p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  />
                </div>
              )}
            </div>

            {/* Practice & Revision Instant Feedback Box */}
            {practiceFeedback && (
              <div className={`p-5 rounded-2xl border transition-all animate-fadeIn space-y-4 ${
                practiceFeedback.is_correct
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700/60 shadow-lg shadow-emerald-500/10'
                  : practiceFeedback.is_partially_correct
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700/60 shadow-lg shadow-amber-500/10'
                  : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700/60 shadow-lg shadow-rose-500/10'
              }`}>
                {/* Header: Status Banner & Points */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    {practiceFeedback.is_correct ? (
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : practiceFeedback.is_partially_correct ? (
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30">
                        <XCircle className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h4 className={`text-sm font-extrabold ${
                        practiceFeedback.is_correct
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : practiceFeedback.is_partially_correct
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-rose-700 dark:text-rose-300'
                      }`}>
                        {practiceFeedback.is_correct
                          ? 'Correct Response!'
                          : practiceFeedback.is_partially_correct
                          ? 'Partially Correct'
                          : 'Incorrect Response'}
                      </h4>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {practiceFeedback.is_correct
                          ? 'Great job! Concept verified.'
                          : 'Review the explanation and worked solution below.'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                      practiceFeedback.is_correct
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                        : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                    }`}>
                      Score: +{practiceFeedback.points_awarded} / {practiceFeedback.max_marks} pts
                    </span>

                    <button
                      type="button"
                      onClick={() => setPracticeFeedback(null)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                      title="Clear feedback to try again"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>

                {/* Spaced Repetition Revision Tag */}
                {session.mode === 'revision' && (
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      {practiceFeedback.is_correct
                        ? 'Spaced Repetition: Mastery tier promoted. Review interval extended.'
                        : 'Spaced Repetition: Re-queued to Box 1 for reinforcement.'}
                    </span>
                  </div>
                )}

                {/* Correct Answer Key */}
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                    Official Answer Key:
                  </span>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {Array.isArray(practiceFeedback.correct_answer)
                      ? practiceFeedback.correct_answer.join(', ')
                      : typeof practiceFeedback.correct_answer === 'object' && practiceFeedback.correct_answer !== null
                      ? JSON.stringify(practiceFeedback.correct_answer, null, 2)
                      : String(practiceFeedback.correct_answer)}
                  </div>
                </div>

                {/* Detailed Explanation */}
                {(practiceFeedback.explanation || q.explanation) && (
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                      Explanation & Rationale:
                    </span>
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {sanitizeText(practiceFeedback.explanation || q.explanation || '')}
                    </div>
                  </div>
                )}

                {/* Step-by-Step Worked Solution */}
                {(practiceFeedback.worked_solution || q.metadata_extra?.worked_solution) && (
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                      Step-by-Step Worked Solution:
                    </span>
                    <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-slate-900 border border-indigo-200 dark:border-slate-800 font-mono text-xs sm:text-sm text-indigo-950 dark:text-indigo-200 leading-relaxed whitespace-pre-wrap">
                      {practiceFeedback.worked_solution || q.metadata_extra?.worked_solution}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fallback simple key when immediate feedback is enabled without checkAnswer */}
            {!practiceFeedback && session.immediate_feedback && q.correct_answer && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  Answer Key: {JSON.stringify(q.correct_answer)}
                </span>
                {q.explanation && <p className="text-slate-600 dark:text-slate-300 mt-1">{sanitizeText(q.explanation)}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Question Palette & Candidate Status (4 Cols) - FIXED IN VIEW ON DESKTOP */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 h-full overflow-y-auto pb-6 space-y-4 scrollbar-thin">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Question Palette
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Total: {session.total_questions}
              </span>
            </div>

            {/* Real Exam 5-Color Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 shadow-xs" />
                <span>Answered ({statusStats.answered})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-rose-500 shadow-xs" />
                <span>Not Answered ({statusStats.notAnswered})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-purple-700 shadow-xs" />
                <span>Review ({statusStats.marked})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-300 dark:bg-slate-700 shadow-xs" />
                <span>Not Visited ({statusStats.notVisited})</span>
              </div>
            </div>

            {/* Filter Tabs for Palette */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10px] font-semibold">
              {(['all', 'answered', 'unanswered', 'review'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPaletteFilter(tab)}
                  className={`flex-1 py-1 rounded-lg capitalize transition-colors ${
                    paletteFilter === tab
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Numbered Palette Grid (NTA / JEE Style with deterministic sequence & real CBT colors) */}
            <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto p-1 scrollbar-thin">
              {Array.from({ length: session.total_questions }).map((_, idx) => {
                const isCurrent = session.current_question_index === idx;
                const p = getQuestionPaletteItem(idx);
                const isAns = p.is_answered;
                const isFlg = p.is_flagged;
                const isVisited = p.is_visited;

                // Filter check
                if (paletteFilter === 'answered' && !isAns) return null;
                if (paletteFilter === 'unanswered' && isAns) return null;
                if (paletteFilter === 'review' && !isFlg) return null;

                // Authentic CBT Exam Color Coding
                let badgeClass = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'; // Not Visited
                if (isFlg && isAns) {
                  badgeClass = 'bg-purple-700 text-white border-purple-800 ring-2 ring-emerald-400 font-bold'; // Answered & Marked for Review
                } else if (isFlg) {
                  badgeClass = 'bg-purple-700 text-white border-purple-800 font-bold'; // Marked for Review
                } else if (isAns) {
                  badgeClass = 'bg-emerald-600 text-white border-emerald-700 font-bold'; // Answered
                } else if (isVisited) {
                  badgeClass = 'bg-rose-500 text-white border-rose-600 font-bold'; // Visited but Not Answered
                }

                if (isCurrent) {
                  badgeClass += ' ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 font-extrabold shadow-md scale-105';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleNavigate(idx)}
                    className={`h-9 rounded-lg border text-xs font-mono transition-all flex items-center justify-center relative ${badgeClass}`}
                    title={`Question ${idx + 1}: ${isAns ? 'Answered' : isVisited ? 'Not Answered' : 'Not Visited'}${isFlg ? ' (Marked for Review)' : ''}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlg && isAns && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1 right-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Palette Bottom Action: Direct Final Submit */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
              >
                Submit Assessment
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 2.5 MOBILE QUESTION PALETTE DRAWER (SLIDE-OVER FOR PHONES & TABLETS) */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-slideUp">
            {/* Drawer Header */}
            <div className="p-4 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Question Palette
                </h3>
                <span className="text-[11px] text-slate-400">
                  Question {session.current_question_index + 1} of {session.total_questions}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Status Legend */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-500 shadow-xs" />
                  <span>Answered ({statusStats.answered})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-rose-500 shadow-xs" />
                  <span>Not Answered ({statusStats.notAnswered})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-purple-700 shadow-xs" />
                  <span>Review ({statusStats.marked})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-slate-300 dark:bg-slate-700 shadow-xs" />
                  <span>Not Visited ({statusStats.notVisited})</span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10px] font-semibold">
                {(['all', 'answered', 'unanswered', 'review'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPaletteFilter(tab)}
                    className={`flex-1 py-1 rounded-lg capitalize transition-colors ${
                      paletteFilter === tab
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Numbered Palette Grid */}
              <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto p-1 scrollbar-thin">
                {Array.from({ length: session.total_questions }).map((_, idx) => {
                  const isCurrent = session.current_question_index === idx;
                  const p = getQuestionPaletteItem(idx);
                  const isAns = p.is_answered;
                  const isFlg = p.is_flagged;
                  const isVisited = p.is_visited;

                  if (paletteFilter === 'answered' && !isAns) return null;
                  if (paletteFilter === 'unanswered' && isAns) return null;
                  if (paletteFilter === 'review' && !isFlg) return null;

                  let badgeClass = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700';
                  if (isFlg && isAns) {
                    badgeClass = 'bg-purple-700 text-white border-purple-800 ring-2 ring-emerald-400 font-bold';
                  } else if (isFlg) {
                    badgeClass = 'bg-purple-700 text-white border-purple-800 font-bold';
                  } else if (isAns) {
                    badgeClass = 'bg-emerald-600 text-white border-emerald-700 font-bold';
                  } else if (isVisited) {
                    badgeClass = 'bg-rose-500 text-white border-rose-600 font-bold';
                  }

                  if (isCurrent) {
                    badgeClass += ' ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 font-extrabold shadow-md scale-105';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        handleNavigate(idx);
                        setShowMobilePalette(false);
                      }}
                      className={`h-11 rounded-xl text-xs font-mono font-semibold border flex items-center justify-center transition-all cursor-pointer relative ${badgeClass}`}
                    >
                      <span>{idx + 1}</span>
                      {isFlg && isAns && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1 right-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions inside Mobile Drawer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex gap-2">
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Close Palette
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMobilePalette(false);
                  setShowSubmitModal(true);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. REAL CBT FIXED BOTTOM EXAM ACTION BAR (RESPONSIVE ON DESKTOP & PHONES) */}
      <footer className="shrink-0 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 z-20">
        <div className="max-w-[1750px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Top/Left Action Row */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold bg-[#7C3AED] hover:bg-purple-600 text-white shadow-sm transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                title="Save status as marked for review and go to next question"
              >
                <Flag className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">Mark for Review</span>
                <span className="xs:hidden">Review</span>
              </button>

              <button
                type="button"
                onClick={handleClearAnswer}
                disabled={!currentAnswer}
                className="px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-2xs active:scale-95 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:hidden shrink-0" />
                <span className="hidden sm:inline">Clear Response</span>
                <span className="sm:hidden">Clear</span>
              </button>
            </div>

            {/* Mobile Question Palette Toggle Button */}
            <button
              type="button"
              onClick={() => setShowMobilePalette(true)}
              className="sm:hidden px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 active:scale-95"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Palette</span>
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px]">
                {session.current_question_index + 1}/{session.total_questions}
              </span>
            </button>
          </div>

          {/* Bottom/Right Action Row: Previous & Check Answer & Save & Next & Submit */}
          <div className="flex items-center justify-end gap-2 sm:gap-2.5">
            {/* Check Answer button for practice & revision modes */}
            {(session.mode === 'practice' || session.mode === 'revision' || session.immediate_feedback) && (
              <button
                type="button"
                onClick={handleCheckAnswer}
                disabled={checkingAnswer || currentAnswer === null || currentAnswer === undefined || (Array.isArray(currentAnswer) && currentAnswer.length === 0)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap"
              >
                {checkingAnswer ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Check</span>
                  </>
                )}
              </button>
            )}

            {session.allow_back_nav && (
              <button
                type="button"
                onClick={() => handleNavigate(session.current_question_index - 1)}
                disabled={session.current_question_index === 0}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-2xs active:scale-95 whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline">Previous</span>
              </button>
            )}

            {!isLastQuestion ? (
              <button
                type="button"
                onClick={() => handleNavigate(session.current_question_index + 1)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95 whitespace-nowrap"
              >
                <span>Save & Next</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>Submit</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* 4. QUESTION PAPER MODAL (REAL EXAM FEATURE) */}
      {showQuestionPaperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Full Question Paper Preview
                </h3>
                <span className="text-xs text-slate-500">{session.quiz_title} • {session.total_questions} Questions</span>
              </div>
              <button
                onClick={() => setShowQuestionPaperModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {loadingPaper ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <div className="w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2" />
                  Loading Question Paper...
                </div>
              ) : paperQuestions.length > 0 ? (
                paperQuestions.map((pq, pIdx) => (
                  <div key={pq.id || pIdx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-slate-900 dark:text-white">Question {pIdx + 1}</span>
                      <span>{pq.points} Marks</span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                      {sanitizeText(pq.question_text)}
                    </div>
                    {pq.options && pq.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        {pq.options.map(opt => (
                          <div key={opt.id} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <strong>{opt.id}.</strong> {sanitizeText(opt.text)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Active question: {sanitizeText(q.question_text)}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowQuestionPaperModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Back to Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. INSTRUCTIONS MODAL */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Exam Rules & Guidelines</h3>
              <button onClick={() => setShowInstructionsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto">
              <p>1. The countdown timer on the top-right shows the remaining exam time. When the clock reaches zero, the assessment will automatically be submitted.</p>
              <p>2. You can navigate between questions using the Question Palette on the right or the Previous and Save & Next buttons at the bottom.</p>
              <p>3. <strong>Keyboard Shortcuts:</strong> Press keys <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">A</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">B</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">C</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">D</kbd> to select options. Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">→</kbd> for Next and <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">←</kbd> for Previous.</p>
              <p>4. <strong>Palette Colors:</strong>
                <br />• <span className="text-emerald-500 font-bold">Green</span>: Question Answered
                <br />• <span className="text-rose-500 font-bold">Red</span>: Question Not Answered
                <br />• <span className="text-purple-500 font-bold">Purple</span>: Marked for Review
                <br />• <span className="text-slate-400 font-bold">Gray</span>: Not Visited Yet
              </p>
              <p>5. Click <strong>Final Submit</strong> only when you have reviewed all responses.</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Close Instructions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. REAL EXAM SUBMIT CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Confirm Assessment Submission</h3>
            <p className="text-xs text-slate-500">
              Please review your summary below before concluding this assessment session:
            </p>

            {/* Summary Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-3">Status Category</th>
                    <th className="p-3 text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Answered Questions
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {statusStats.answered}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      Not Answered (Visited)
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-500">
                      {statusStats.notAnswered}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      Marked for Review
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                      {statusStats.marked + statusStats.markedAnswered}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      Not Visited
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-400">
                      {statusStats.notVisited}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-950 font-bold">
                    <td className="p-3 text-slate-900 dark:text-white">Total Questions</td>
                    <td className="p-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                      {session.total_questions}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {statusStats.notAnswered + statusStats.notVisited > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>You have <strong>{statusStats.notAnswered + statusStats.notVisited}</strong> unanswered questions remaining.</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Return to Assessment
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all"
              >
                {submitting ? 'Submitting & Evaluating...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. EXIT CONFIRMATION MODAL */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Leave Active Assessment?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your server exam timer will continue running in the background. You can resume this session anytime from your Dashboard before the deadline expires.
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Resume Test
              </button>
              <button
                type="button"
                onClick={handleExitToDashboard}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Exit to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
