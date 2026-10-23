import React, { useState, useRef, useMemo } from 'react';
import {
  Code,
  Play,
  RotateCcw,
  Terminal,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { ClientQuestionView, RunCodeResponse } from '../types';

interface CodingWorkspaceProps {
  question: ClientQuestionView;
  code: string;
  onChange: (code: string) => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  onRunCode: (codeToRun: string, language: string, testCases: any[]) => Promise<void>;
  running: boolean;
  results: RunCodeResponse | null;
  stdout: string;
  activeCaseIdx: number;
  setActiveCaseIdx: (idx: number) => void;
}

export const CodingWorkspace: React.FC<CodingWorkspaceProps> = ({
  question,
  code,
  onChange,
  selectedLanguage,
  onLanguageChange,
  onRunCode,
  running,
  results,
  stdout,
  activeCaseIdx,
  setActiveCaseIdx
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copiedInput, setCopiedInput] = useState(false);
  const [showConsoleTab, setShowConsoleTab] = useState(false);

  // Extract metadata
  const expectedFn = question.metadata_extra?.expected_fn || question.metadata_extra?.function_name;
  const constraints: string[] = question.metadata_extra?.constraints || [];
  const sampleIn = question.metadata_extra?.sample_input;
  const sampleOut = question.metadata_extra?.sample_output;

  const rawCases: any[] = question.metadata_extra?.test_cases || [];
  const testCases = useMemo(() => {
    if (rawCases.length > 0) return rawCases;
    if (sampleIn) {
      return [{
        input: sampleIn,
        expected_output: sampleOut || '',
        expected_fn: expectedFn
      }];
    }
    return [];
  }, [rawCases, sampleIn, sampleOut, expectedFn]);

  const defaultStarter = useMemo(() => {
    if (selectedLanguage === 'javascript') {
      return expectedFn
        ? `function ${expectedFn}(s) {\n    // Write your JavaScript solution here\n    return null;\n}\n`
        : `function solution() {\n    // Write your JavaScript solution here\n    return null;\n}\n`;
    }
    return expectedFn
      ? `def ${expectedFn}():\n    # Write your Python solution here\n    pass\n`
      : `def solution():\n    # Write your Python solution here\n    pass\n`;
  }, [expectedFn, selectedLanguage]);

  const starterCode = question.metadata_extra?.starter_code || defaultStarter;

  // Split lines for line numbers
  const lines = useMemo(() => {
    return (code || '').split('\n');
  }, [code]);

  // Synchronize gutter scroll with textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Update cursor line and column
  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const { selectionStart, value } = textareaRef.current;
    const textBefore = value.substring(0, selectionStart);
    const lineNum = textBefore.split('\n').length;
    const lastNewlineIdx = textBefore.lastIndexOf('\n');
    const colNum = selectionStart - lastNewlineIdx;
    setCursorPos({ line: lineNum, col: colNum });
  };

  // Handle Tab key indentation and Ctrl+Enter execution
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Run shortcut: Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!running) {
        onRunCode(code, selectedLanguage, testCases);
      }
      return;
    }

    // Tab indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd, value } = textarea;
      const indent = '    '; // 4 spaces standard

      if (!e.shiftKey) {
        // Standard Tab
        if (selectionStart === selectionEnd) {
          const nextVal = value.substring(0, selectionStart) + indent + value.substring(selectionEnd);
          onChange(nextVal);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + 4;
              updateCursorPosition();
            }
          });
        } else {
          // Multi-line indent
          const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
          const lineEnd = value.indexOf('\n', selectionEnd);
          const actualEnd = lineEnd === -1 ? value.length : lineEnd;
          const selectedBlock = value.substring(lineStart, actualEnd);
          const indentedBlock = selectedBlock
            .split('\n')
            .map(l => indent + l)
            .join('\n');
          const nextVal = value.substring(0, lineStart) + indentedBlock + value.substring(actualEnd);
          onChange(nextVal);
        }
      } else {
        // Shift + Tab: unindent
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const currentLineText = value.substring(lineStart);
        let spacesToRemove = 0;
        if (currentLineText.startsWith('    ')) spacesToRemove = 4;
        else if (currentLineText.startsWith('  ')) spacesToRemove = 2;
        else if (currentLineText.startsWith(' ')) spacesToRemove = 1;

        if (spacesToRemove > 0) {
          const nextVal = value.substring(0, lineStart) + currentLineText.substring(spacesToRemove);
          onChange(nextVal);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = Math.max(lineStart, selectionStart - spacesToRemove);
              updateCursorPosition();
            }
          });
        }
      }
    }
  };

  const copySampleInput = () => {
    if (!sampleIn) return;
    navigator.clipboard.writeText(sampleIn);
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 2000);
  };

  const handleResetCode = () => {
    if (window.confirm('Reset code to starter template? Any unsaved edits will be lost.')) {
      onChange(starterCode);
    }
  };

  // Calculate execution stats
  const totalExecutionTime = useMemo(() => {
    if (!results?.results) return 0;
    return results.results.reduce((acc, curr) => acc + (curr.execution_time_ms || 0), 0);
  }, [results]);

  const activeResult = results?.results?.[activeCaseIdx];

  return (
    <div className="w-full space-y-4 text-slate-900 transition-all">
      {/* 1. TOP BAR: Problem Specification & Constraints (LIGHT THEME) */}
      {(expectedFn || constraints.length > 0 || sampleIn || sampleOut) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5 shadow-xs">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Code className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Function Specification
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Implement the target signature according to algorithmic constraints
                </span>
              </div>
            </div>

            {expectedFn && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold shadow-2xs">
                <span className="text-indigo-600">def</span>
                <span className="text-emerald-700">{expectedFn}</span>
                <span className="text-slate-500">(...)</span>
              </div>
            )}
          </div>

          {/* Constraints Chips */}
          {constraints.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Constraints & Complexity Guarantees:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {constraints.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs font-medium shadow-2xs"
                  >
                    <span className="text-indigo-600 mr-1.5 font-bold">•</span>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sample I/O Grid (LIGHT THEME) */}
          {(sampleIn || sampleOut) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {sampleIn && (
                <div className="rounded-xl bg-slate-50/80 border border-slate-200 p-3.5 space-y-1.5 relative group shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Sample Input
                    </span>
                    <button
                      type="button"
                      onClick={copySampleInput}
                      className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200 text-[11px] flex items-center gap-1 transition-colors"
                      title="Copy sample input"
                    >
                      {copiedInput ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-sans font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="font-sans">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                    {sampleIn}
                  </pre>
                </div>
              )}

              {sampleOut && (
                <div className="rounded-xl bg-slate-50/80 border border-slate-200 p-3.5 space-y-1.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Expected Output
                  </span>
                  <pre className="font-mono text-xs text-emerald-700 font-bold whitespace-pre-wrap leading-relaxed select-all">
                    {sampleOut}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. THE CODING SPACE (STAYS DARK AS REQUESTED) */}
      <div className="rounded-2xl border border-slate-800 bg-[#070A11] overflow-hidden shadow-xl">
        {/* IDE Toolbar */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* File Tab & Language Selector */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono font-medium text-slate-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{selectedLanguage === 'javascript' ? 'solution.js' : 'solution.py'}</span>
            </div>

            {/* Language dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1 rounded-md bg-slate-800 hover:bg-slate-750 border border-slate-700 text-indigo-300 font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors"
              >
                <option value="python">Python 3.13</option>
                <option value="javascript">JavaScript (Node.js)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400 pointer-events-none absolute right-2" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex text-[11px] text-slate-500 font-mono items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">Enter</kbd>
              <span className="text-slate-400">to run</span>
            </span>

            <button
              type="button"
              onClick={handleResetCode}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              title="Reset to starter template"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={running}
              onClick={() => onRunCode(code, selectedLanguage, testCases)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md hover:shadow-emerald-900/30 disabled:opacity-50 active:scale-98 transition-all"
            >
              {running ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run Test Cases ({testCases.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Area with Synchronized Line Numbers Gutter */}
        <div className="relative flex min-h-[280px] max-h-[500px] overflow-hidden bg-[#070A11] font-mono text-xs">
          {/* Line Numbers Gutter */}
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="w-12 py-3 px-2 bg-slate-900/70 border-r border-slate-800 text-right text-slate-500 select-none overflow-hidden shrink-0 space-y-0 leading-5"
          >
            {lines.map((_, idx) => {
              const lineNo = idx + 1;
              const isCurrentLine = cursorPos.line === lineNo;
              return (
                <div
                  key={lineNo}
                  className={`h-5 transition-colors ${
                    isCurrentLine ? 'text-indigo-400 font-bold' : 'text-slate-600'
                  }`}
                >
                  {lineNo}
                </div>
              );
            })}
          </div>

          {/* Interactive Textarea with Tab Support */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              onChange(e.target.value);
              updateCursorPosition();
            }}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onClick={updateCursorPosition}
            onKeyUp={updateCursorPosition}
            placeholder={`# Enter your ${selectedLanguage} code here...`}
            spellCheck={false}
            className="flex-1 p-3 bg-transparent text-emerald-400 font-mono text-xs leading-5 focus:outline-none resize-none overflow-y-auto selection:bg-indigo-900/80 selection:text-white"
            style={{ tabSize: 4 }}
          />
        </div>

        {/* Status Bar */}
        <div className="px-4 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
          <div className="flex items-center gap-3">
            <span>
              Ln <strong className="text-slate-200">{cursorPos.line}</strong>, Col <strong className="text-slate-200">{cursorPos.col}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>{lines.length} lines</span>
            <span className="text-slate-700">|</span>
            <span>{code.length} chars</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="hidden sm:inline">Spaces: 4</span>
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="text-indigo-300 font-semibold">{selectedLanguage === 'javascript' ? 'JavaScript' : 'Python 3'}</span>
          </div>
        </div>
      </div>

      {/* 3. TEST CASES & EXECUTION CONSOLE (LIGHT THEME) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 shadow-xs">
        {/* Console Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Terminal className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Test Cases & Verification Console
            </span>
          </div>

          {/* Execution Result Badge */}
          {results ? (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider shadow-2xs ${
                  results.all_passed
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}
              >
                {results.all_passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span>
                  {results.passed_count} of {results.total_count} Passed
                </span>
              </span>

              {totalExecutionTime > 0 && (
                <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  ⚡ {totalExecutionTime.toFixed(1)} ms
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-mono">
              Ready to execute
            </span>
          )}
        </div>

        {/* Test Case Tabs */}
        {testCases.length > 0 ? (
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {testCases.map((_, idx) => {
                const res = results?.results?.[idx];
                const isSelected = activeCaseIdx === idx && !showConsoleTab;

                let statusDot = 'bg-slate-300';
                if (res) {
                  statusDot = res.passed ? 'bg-emerald-500' : 'bg-rose-500';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveCaseIdx(idx);
                      setShowConsoleTab(false);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                    <span>Case {idx + 1}</span>
                  </button>
                );
              })}

              {stdout && (
                <button
                  type="button"
                  onClick={() => setShowConsoleTab(true)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap border ${
                    showConsoleTab
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Standard Output (stdout)</span>
                </button>
              )}
            </div>

            {/* Test Case Details Pane */}
            {!showConsoleTab && testCases[activeCaseIdx] && (
              <div className="space-y-3">
                {/* Input and Expected Output Dual-Card (LIGHT THEME) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Parameter Input
                    </span>
                    <pre className="text-slate-900 font-medium whitespace-pre-wrap leading-relaxed select-all">
                      {testCases[activeCaseIdx].input || '(No arguments)'}
                    </pre>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                      Expected Return Value
                    </span>
                    <pre className="text-emerald-700 font-bold whitespace-pre-wrap leading-relaxed select-all">
                      {testCases[activeCaseIdx].expected_output}
                    </pre>
                  </div>
                </div>

                {/* Execution Result Box (LIGHT THEME, HIGH CONTRAST) */}
                {activeResult ? (
                  <div
                    className={`p-4 rounded-xl border space-y-2.5 transition-all shadow-2xs ${
                      activeResult.passed
                        ? 'bg-emerald-50/80 border-emerald-300 text-slate-900'
                        : 'bg-rose-50/80 border-rose-300 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200/80">
                      <span
                        className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                          activeResult.passed ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {activeResult.passed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Test Case Passed</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>Test Case Failed: {activeResult.error ? 'Runtime Error' : 'Wrong Answer'}</span>
                          </>
                        )}
                      </span>
                      <span className="text-slate-600 font-mono text-[11px] font-semibold">
                        ⚡ {activeResult.execution_time_ms} ms
                      </span>
                    </div>

                    {/* Actual Output */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-600 block tracking-wider">
                        Your Function Returned:
                      </span>
                      <div className={`p-2.5 rounded-lg border font-mono text-xs ${
                        activeResult.passed ? 'bg-white border-emerald-200' : 'bg-white border-rose-200'
                      }`}>
                        <pre
                          className={`whitespace-pre-wrap leading-relaxed font-bold ${
                            activeResult.passed ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {activeResult.actual_output !== undefined && activeResult.actual_output !== null && activeResult.actual_output !== ''
                            ? activeResult.actual_output
                            : 'None'}
                        </pre>
                      </div>
                    </div>

                    {/* Exception / Traceback if failed */}
                    {activeResult.error && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] uppercase font-bold text-rose-800 flex items-center gap-1 tracking-wider">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Runtime Error / Traceback:</span>
                        </span>
                        <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-rose-300 font-mono text-xs whitespace-pre-wrap leading-relaxed overflow-x-auto">
                          {activeResult.error}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    Click <strong className="text-emerald-700 font-bold">"Run Test Cases"</strong> to verify your solution against this test case.
                  </div>
                )}
              </div>
            )}

            {/* Standard Output (stdout) Console */}
            {showConsoleTab && (
              <div className="space-y-2">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-cyan-300 space-y-1.5 shadow-sm">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">
                    Standard Output Stream (stdout):
                  </span>
                  <pre className="whitespace-pre-wrap leading-relaxed text-slate-200">
                    {stdout || '(No output produced to stdout)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
            No public test cases configured for this question. Your code will be evaluated by the server upon submission.
          </div>
        )}
      </div>
    </div>
  );
};
