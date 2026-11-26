import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  KeyRound,
  Layers,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export function LandingAuthPage() {
  const navigate = useNavigate();
  const { login, register, loginDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [generatedTokenHint, setGeneratedTokenHint] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      await loginDemo();
      toast('Signed into Demo Workspace', 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch demo workspace.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast('Welcome back to FormX', 'success');
        navigate('/dashboard');
      } else if (mode === 'register') {
        await register(name, email, password);
        toast('Account created successfully', 'success');
        navigate('/dashboard');
      } else if (mode === 'forgot') {
        const res = await apiFetch<{ message: string; resetToken: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setGeneratedTokenHint(res.resetToken);
        setResetToken(res.resetToken);
        setMode('reset');
        toast('Reset token generated', 'info');
      } else if (mode === 'reset') {
        await apiFetch<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, token: resetToken, newPassword }),
        });
        toast('Password updated. Please sign in.', 'success');
        setGeneratedTokenHint(null);
        setPassword('');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a href="/" className="text-xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap shrink-0">
            FormX
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <a href="#capabilities" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#modes" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0">
              Presentation
            </a>
            <a href="#analytics" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0">
              Analytics
            </a>
            <a href="#quiz" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0">
              Quiz Engine
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDemo}
              disabled={demoLoading}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {demoLoading ? 'Opening...' : 'Explore Demo Workspace'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Auth Split */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Story & Demo Trigger */}
          <div className="lg:col-span-7 space-y-8 pt-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>13 Question Types</span>
                <span aria-hidden="true">·</span>
                <span>Classic &amp; Conversational Modes</span>
                <span aria-hidden="true">·</span>
                <span>Auto-Graded Quizzes</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.1] text-balance">
                Build forms, surveys, and quizzes people actually finish.
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                FormX pairs a drag-and-drop studio with dual respondent layouts, real-time analytics, CSV &amp; Excel exports, and automated quiz grading in one crisp workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDemo}
                disabled={demoLoading}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {demoLoading ? 'Launching Demo...' : 'Launch Demo Workspace'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>

            {/* Key Architectural Pillars */}
            <div id="capabilities" className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <div id="modes" className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Dual Presentation Modes
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Publish forms as classic multi-section pages or Typeform-style single-question conversational flows.
                </p>
              </div>

              <div id="analytics" className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Real-Time Analytics &amp; Exports
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Track completion rates, average completion time, 14-day response trends, and export to CSV or Excel.
                </p>
              </div>

              <div id="quiz" className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Server-Graded Quiz Engine
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Assign marks, correct answers, pass thresholds, and answer explanations graded securely on submit.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Sharing &amp; Access Guardrails
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Generate public links, SVG QR codes, iframe embeds, passcodes, response caps, and open/close dates.
                </p>
              </div>
            </div>
          </div>

          {/* Right Authentication Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {mode === 'login' && 'Sign in to FormX'}
                    {mode === 'register' && 'Create your workspace'}
                    {mode === 'forgot' && 'Reset your password'}
                    {mode === 'reset' && 'Set a new password'}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {mode === 'login' && 'Access your forms, responses, and analytics.'}
                    {mode === 'register' && 'Start building forms and quizzes in seconds.'}
                    {mode === 'forgot' && 'Generate a one-time recovery token.'}
                    {mode === 'reset' && 'Enter your recovery token and new password.'}
                  </p>
                </div>
                <KeyRound className="w-5 h-5 text-zinc-400" />
              </div>

              {(mode === 'login' || mode === 'register') && (
                <div className="grid grid-cols-2 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === 'login'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === 'register'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {generatedTokenHint && mode === 'reset' && (
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-xs space-y-1">
                  <div className="font-medium text-indigo-900 dark:text-indigo-200">
                    Recovery Token Generated
                  </div>
                  <div className="font-mono-data text-indigo-700 dark:text-indigo-300">
                    Token: <strong>{generatedTokenHint}</strong> (auto-filled below)
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {(mode === 'login' || mode === 'register') && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Password
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode('forgot');
                            setError(null);
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {mode === 'reset' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Reset Token
                      </label>
                      <input
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="FX-XXXXXXXX"
                        className="w-full px-3.5 py-2.5 text-sm font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting
                    ? 'Processing...'
                    : mode === 'login'
                      ? 'Sign In'
                      : mode === 'register'
                        ? 'Create Account'
                        : mode === 'forgot'
                          ? 'Generate Reset Token'
                          : 'Update Password'}
                </button>

                {(mode === 'forgot' || mode === 'reset') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="w-full text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 pt-1"
                  >
                    Back to Sign In
                  </button>
                )}
              </form>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                <span>Want to inspect pre-built forms &amp; analytics?</span>
                <button
                  type="button"
                  onClick={handleDemo}
                  disabled={demoLoading}
                  className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                >
                  Instant Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
