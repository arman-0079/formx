import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Lock,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { ApiError, apiFetch } from '../lib/api';
import { resolveHeaderImageUrl } from '../lib/presets';
import { QuestionFieldInput } from './QuestionFieldInput';
import type { Form, FormSettings, Question, QuizQuestionBreakdown } from '../types/form';

interface PublicFormPayload {
  id: string;
  title: string;
  description: string;
  slug: string;
  isQuiz: boolean;
  settings: FormSettings;
  questions: Question[];
}

interface QuizSubmitResult {
  earnedScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  breakdown: QuizQuestionBreakdown[];
}

interface PublicFormViewProps {
  slug?: string;
  previewForm?: Form;
  onClosePreview?: () => void;
}

export function PublicFormView({ slug, previewForm, onClosePreview }: PublicFormViewProps) {
  const isPreview = Boolean(previewForm);
  const [form, setForm] = useState<PublicFormPayload | null>(
    previewForm
      ? {
          id: previewForm.id,
          title: previewForm.title,
          description: previewForm.description,
          slug: previewForm.slug,
          isQuiz: previewForm.isQuiz,
          settings: previewForm.settings,
          questions: previewForm.questions,
        }
      : null
  );
  const [loading, setLoading] = useState(!previewForm);
  const [closedMessage, setClosedMessage] = useState<string | null>(null);
  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [verifiedPasscode, setVerifiedPasscode] = useState('');

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [honeypot, setHoneypot] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [submittedState, setSubmittedState] = useState<{
    confirmationMessage: string;
    quizResult: QuizSubmitResult | null;
  } | null>(null);

  // Conversational stepper state: -1 is welcome screen if welcomeTitle/welcomeMessage exists
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [startedConversational, setStartedConversational] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const loadPublicForm = async (passcodeAttempt = '') => {
    if (!slug) return;
    setLoading(true);
    setClosedMessage(null);
    setPasscodeError('');
    try {
      const qs = passcodeAttempt ? `?passcode=${encodeURIComponent(passcodeAttempt)}` : '';
      const res = await apiFetch<{
        requiresPasscode?: boolean;
        title?: string;
        form?: PublicFormPayload;
      }>(`/api/public/forms/${encodeURIComponent(slug)}${qs}`);

      if (res.requiresPasscode) {
        setRequiresPasscode(true);
        if (passcodeAttempt) {
          setPasscodeError('Incorrect passcode. Please try again.');
        }
      } else if (res.form) {
        setRequiresPasscode(false);
        setVerifiedPasscode(passcodeAttempt);
        setForm(res.form);
        startTimeRef.current = Date.now();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setClosedMessage(err.message);
      } else {
        setClosedMessage('Unable to load this form.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (previewForm) {
      setForm({
        id: previewForm.id,
        title: previewForm.title,
        description: previewForm.description,
        slug: previewForm.slug,
        isQuiz: previewForm.isQuiz,
        settings: previewForm.settings,
        questions: previewForm.questions,
      });
      setLoading(false);
    } else if (slug) {
      loadPublicForm();
    }
  }, [slug, previewForm]);

  const activeQuestions = useMemo(() => {
    if (!form) return [];
    if (form.settings.layoutMode === 'conversational') {
      return form.questions.filter((q) => q.type !== 'section_break');
    }
    return form.questions;
  }, [form]);

  const validateQuestion = (q: Question, val: unknown): string | null => {
    if (q.type === 'section_break') return null;
    const empty =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim() === '') ||
      (Array.isArray(val) && val.length === 0);

    if (q.required && empty) {
      return 'This question is required.';
    }
    if (empty) return null;

    if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).trim())) {
      return 'Please enter a valid email address.';
    }
    if (q.type === 'phone' && !/^[+\d\s().-]{7,24}$/.test(String(val).trim())) {
      return 'Please enter a valid phone number.';
    }
    if (q.type === 'number') {
      const num = Number(val);
      if (Number.isNaN(num)) return 'Please enter a valid number.';
      if (q.options.minNumber !== null && q.options.minNumber !== undefined && num < q.options.minNumber) {
        return `Minimum value is ${q.options.minNumber}.`;
      }
      if (q.options.maxNumber !== null && q.options.maxNumber !== undefined && num > q.options.maxNumber) {
        return `Maximum value is ${q.options.maxNumber}.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form) return;

    const errors: Record<string, string> = {};
    for (const q of form.questions) {
      const err = validateQuestion(q, answers[q.id]);
      if (err) errors[q.id] = err;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError('Please complete all required fields before submitting.');
      return;
    }

    if (isPreview) {
      // Simulate confirmation + preview quiz score locally without hitting public DB
      let previewQuiz: QuizSubmitResult | null = null;
      if (form.isQuiz) {
        const breakdown: QuizQuestionBreakdown[] = [];
        let earned = 0;
        let maxScore = 0;
        for (const q of form.questions) {
          if (q.type === 'section_break' || q.points <= 0 || q.correctAnswer === null) continue;
          maxScore += q.points;
          const u = answers[q.id];
          let ok = false;
          if (Array.isArray(q.correctAnswer)) {
            const exp = new Set(q.correctAnswer.map((s) => String(s).trim().toLowerCase()));
            const arr = Array.isArray(u) ? u.map((s) => String(s).trim().toLowerCase()) : [];
            ok = exp.size === arr.length && arr.every((x) => exp.has(x));
          } else {
            ok = String(u ?? '').trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
          }
          if (ok) earned += q.points;
          breakdown.push({
            questionId: q.id,
            title: q.title,
            userAnswer: u ?? null,
            correctAnswer: q.correctAnswer,
            isCorrect: ok,
            pointsEarned: ok ? q.points : 0,
            pointsPossible: q.points,
            explanation: q.explanation,
          });
        }
        const pct = maxScore > 0 ? Math.round((earned / maxScore) * 100) : 100;
        previewQuiz = {
          earnedScore: earned,
          maxScore,
          percentage: pct,
          passed: pct >= form.settings.passPercentage,
          breakdown,
        };
      }
      setSubmittedState({
        confirmationMessage: form.settings.confirmationMessage || 'Thank you! Your response has been recorded.',
        quizResult: form.settings.showResultsImmediately ? previewQuiz : null,
      });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      const res = await apiFetch<{
        submitted: boolean;
        confirmationMessage: string;
        quizResult: QuizSubmitResult | null;
      }>(`/api/public/forms/${encodeURIComponent(form.slug)}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers,
          passcode: verifiedPasscode,
          durationSeconds,
          _hp: honeypot,
        }),
      });
      setSubmittedState({
        confirmationMessage: res.confirmationMessage,
        quizResult: res.quizResult,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
        setSubmitError(err.message);
      } else {
        setSubmitError('Failed to submit your response. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="w-full max-w-2xl space-y-4">
          <div className="h-32 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (closedMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="max-w-md w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-3">
          <XCircle className="w-10 h-10 text-zinc-400 mx-auto" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Form Unavailable</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{closedMessage}</p>
        </div>
      </div>
    );
  }

  if (requiresPasscode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadPublicForm(passcodeInput);
          }}
          className="max-w-md w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-5"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Private Form Access</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Enter the access passcode provided by the form creator.
            </p>
          </div>
          <input
            type="password"
            value={passcodeInput}
            onChange={(e) => setPasscodeInput(e.target.value)}
            placeholder="Enter passcode"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          {passcodeError && <p className="text-xs text-rose-600">{passcodeError}</p>}
          <button
            type="submit"
            className="w-full py-2.5 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Unlock Form
          </button>
        </form>
      </div>
    );
  }

  if (!form) return null;

  const { settings } = form;
  const headerUrl = resolveHeaderImageUrl(settings.headerImage);
  const fontClass =
    settings.fontStyle === 'serif'
      ? 'font-serif'
      : settings.fontStyle === 'mono'
        ? 'font-mono-data'
        : settings.fontStyle === 'display'
          ? 'font-display'
          : 'font-sans-body';

  const buttonRadiusClass =
    settings.buttonStyle === 'pill'
      ? 'rounded-full'
      : settings.buttonStyle === 'square'
        ? 'rounded-none'
        : 'rounded-lg';

  const resetSubmission = () => {
    setAnswers({});
    setFieldErrors({});
    setSubmitError(null);
    setSubmittedState(null);
    setStepIndex(0);
    setStartedConversational(false);
    startTimeRef.current = Date.now();
  };

  if (submittedState) {
    return (
      <div
        style={{ backgroundColor: settings.backgroundColor }}
        className={`min-h-screen py-12 px-4 dark:bg-zinc-950 ${fontClass}`}
      >
        <div className="max-w-2xl mx-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white"
              style={{ backgroundColor: settings.primaryColor }}
            >
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{form.title}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {submittedState.confirmationMessage}
              </p>
            </div>
          </div>

          {submittedState.quizResult && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <Award
                    className={`w-8 h-8 ${
                      submittedState.quizResult.passed ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Quiz Score</div>
                    <div className="text-2xl font-bold font-mono-data text-zinc-900 dark:text-zinc-50">
                      {submittedState.quizResult.earnedScore} / {submittedState.quizResult.maxScore}{' '}
                      <span className="text-base font-medium text-zinc-500">
                        ({submittedState.quizResult.percentage}%)
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                    submittedState.quizResult.passed
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}
                >
                  {submittedState.quizResult.passed ? 'Passed' : 'Did Not Pass'} (Pass: {settings.passPercentage}%)
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Answer Breakdown</h2>
                {submittedState.quizResult.breakdown.map((item, idx) => (
                  <div
                    key={item.questionId}
                    className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {idx + 1}. {item.title}
                      </p>
                      <span
                        className={`text-xs font-mono-data font-medium shrink-0 ${
                          item.isCorrect ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {item.pointsEarned}/{item.pointsPossible} pts
                      </span>
                    </div>
                    <div className="text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                      <div>
                        Your answer:{' '}
                        <span className="font-medium text-zinc-900 dark:text-zinc-200">
                          {Array.isArray(item.userAnswer)
                            ? item.userAnswer.join(', ')
                            : String(item.userAnswer ?? 'No answer')}
                        </span>
                      </div>
                      {!item.isCorrect && (
                        <div>
                          Correct answer:{' '}
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {Array.isArray(item.correctAnswer)
                              ? item.correctAnswer.join(', ')
                              : String(item.correctAnswer)}
                          </span>
                        </div>
                      )}
                      {item.explanation && (
                        <p className="pt-1 text-zinc-500 dark:text-zinc-400 italic">{item.explanation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={resetSubmission}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${buttonRadiusClass}`}
            >
              <RotateCcw className="w-4 h-4" />
              Submit Another Response
            </button>
            {onClosePreview && (
              <button
                type="button"
                onClick={onClosePreview}
                className={`px-4 py-2 text-sm font-medium text-white ${buttonRadiusClass}`}
                style={{ backgroundColor: settings.primaryColor }}
              >
                Back to Editor
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CONVERSATIONAL (TYPEFORM) MODE
  if (settings.layoutMode === 'conversational') {
    const hasWelcome = Boolean(settings.welcomeTitle || settings.welcomeMessage);
    const showWelcome = hasWelcome && !startedConversational;
    const currentQ = activeQuestions[stepIndex];
    const progressPct =
      activeQuestions.length > 0 ? Math.round(((stepIndex + 1) / activeQuestions.length) * 100) : 100;

    const handleNextStep = () => {
      if (!currentQ) return;
      const err = validateQuestion(currentQ, answers[currentQ.id]);
      if (err) {
        setFieldErrors((prev) => ({ ...prev, [currentQ.id]: err }));
        return;
      }
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[currentQ.id];
        return next;
      });
      if (stepIndex < activeQuestions.length - 1) {
        setStepIndex((i) => i + 1);
      } else {
        handleSubmit();
      }
    };

    return (
      <div
        style={{ backgroundColor: settings.backgroundColor }}
        className={`min-h-screen flex flex-col dark:bg-zinc-950 ${fontClass}`}
      >
        <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: showWelcome ? '0%' : `${progressPct}%`,
              backgroundColor: settings.primaryColor,
            }}
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {showWelcome ? (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
                >
                  {headerUrl && (
                    <img
                      src={headerUrl}
                      alt={form.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-44 object-cover"
                    />
                  )}
                  <div className="p-8 space-y-5">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {form.title} · {activeQuestions.length} questions
                      </p>
                      <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 text-balance">
                        {settings.welcomeTitle || form.title}
                      </h1>
                      {(settings.welcomeMessage || form.description) && (
                        <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {settings.welcomeMessage || form.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStartedConversational(true)}
                      style={{ backgroundColor: settings.primaryColor }}
                      className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white hover:opacity-95 transition-opacity ${buttonRadiusClass}`}
                    >
                      Start
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : currentQ ? (
                <motion.div
                  key={currentQ.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-6"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono-data">
                    <span>
                      Question {stepIndex + 1} of {activeQuestions.length}
                    </span>
                    {form.isQuiz && currentQ.points > 0 && <span>{currentQ.points} pts</span>}
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {currentQ.title}
                      {currentQ.required && <span className="text-rose-600 ml-1">*</span>}
                    </h2>
                    {currentQ.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{currentQ.description}</p>
                    )}
                  </div>

                  {currentQ.imageUrl && (
                    <img
                      src={currentQ.imageUrl}
                      alt={currentQ.title}
                      referrerPolicy="no-referrer"
                      className="max-h-64 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                    />
                  )}

                  <QuestionFieldInput
                    question={currentQ}
                    value={answers[currentQ.id]}
                    onChange={(val) => {
                      setAnswers((prev) => ({ ...prev, [currentQ.id]: val }));
                      if (fieldErrors[currentQ.id]) {
                        setFieldErrors((prev) => {
                          const n = { ...prev };
                          delete n[currentQ.id];
                          return n;
                        });
                      }
                    }}
                    primaryColor={settings.primaryColor}
                    buttonStyle={settings.buttonStyle}
                    error={fieldErrors[currentQ.id]}
                    formSlug={form.slug}
                    isPreview={isPreview}
                  />

                  {fieldErrors[currentQ.id] && (
                    <p className="text-xs text-rose-600 font-medium">{fieldErrors[currentQ.id]}</p>
                  )}
                  {submitError && <p className="text-xs text-rose-600 font-medium">{submitError}</p>}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={stepIndex === 0}
                      onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 ${buttonRadiusClass}`}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleNextStep}
                      style={{ backgroundColor: settings.primaryColor }}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white hover:opacity-95 transition-opacity ${buttonRadiusClass}`}
                    >
                      {stepIndex === activeQuestions.length - 1
                        ? submitting
                          ? 'Submitting...'
                          : 'Submit'
                        : 'Continue'}
                      {stepIndex === activeQuestions.length - 1 ? (
                        <Send className="w-4 h-4" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
                  <p className="text-sm text-zinc-500">This form has no questions yet.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // CLASSIC SCROLL MODE
  return (
    <div
      style={{ backgroundColor: settings.backgroundColor }}
      className={`min-h-screen py-8 sm:py-12 px-4 dark:bg-zinc-950 ${fontClass}`}
    >
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
        {/* Honeypot anti-spam trap */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="h-2 w-full" style={{ backgroundColor: settings.primaryColor }} />
          {headerUrl && (
            <img
              src={headerUrl}
              alt={form.title}
              referrerPolicy="no-referrer"
              className="w-full h-44 sm:h-52 object-cover"
            />
          )}
          <div className="p-6 sm:p-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 text-balance">
              {form.title}
            </h1>
            {form.description && (
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {form.description}
              </p>
            )}
            {(settings.welcomeTitle || settings.welcomeMessage) && (
              <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300">
                {settings.welcomeTitle && <div className="font-medium text-zinc-900 dark:text-zinc-100">{settings.welcomeTitle}</div>}
                {settings.welcomeMessage && <p className="mt-0.5">{settings.welcomeMessage}</p>}
              </div>
            )}
          </div>
        </div>

        {form.questions.map((q) => {
          if (q.type === 'section_break') {
            return (
              <div
                key={q.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-1"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{q.title}</h2>
                {q.description && <p className="text-sm text-zinc-600 dark:text-zinc-400">{q.description}</p>}
              </div>
            );
          }

          return (
            <div
              key={q.id}
              className={`rounded-xl border bg-white dark:bg-zinc-900 p-6 space-y-3.5 ${
                fieldErrors[q.id]
                  ? 'border-rose-400 dark:border-rose-700'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <label className="block text-base font-medium text-zinc-900 dark:text-zinc-100">
                    {q.title}
                    {q.required && <span className="text-rose-600 ml-1">*</span>}
                  </label>
                  {q.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{q.description}</p>
                  )}
                </div>
                {form.isQuiz && q.points > 0 && (
                  <span className="text-xs font-mono-data text-zinc-500 dark:text-zinc-400 shrink-0">
                    {q.points} pts
                  </span>
                )}
              </div>

              {q.imageUrl && (
                <img
                  src={q.imageUrl}
                  alt={q.title}
                  referrerPolicy="no-referrer"
                  className="max-h-64 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                />
              )}

              <QuestionFieldInput
                question={q}
                value={answers[q.id]}
                onChange={(val) => {
                  setAnswers((prev) => ({ ...prev, [q.id]: val }));
                  if (fieldErrors[q.id]) {
                    setFieldErrors((prev) => {
                      const n = { ...prev };
                      delete n[q.id];
                      return n;
                    });
                  }
                }}
                primaryColor={settings.primaryColor}
                buttonStyle={settings.buttonStyle}
                error={fieldErrors[q.id]}
                formSlug={form.slug}
                isPreview={isPreview}
              />

              {fieldErrors[q.id] && <p className="text-xs text-rose-600 font-medium">{fieldErrors[q.id]}</p>}
            </div>
          );
        })}

        {submitError && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={submitting}
            style={{ backgroundColor: settings.primaryColor }}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white hover:opacity-95 transition-opacity disabled:opacity-60 ${buttonRadiusClass}`}
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>

          <button
            type="button"
            onClick={resetSubmission}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Clear form
          </button>
        </div>
      </form>
    </div>
  );
}
