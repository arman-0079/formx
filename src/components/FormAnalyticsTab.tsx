import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Form, FormAnalytics } from '../types/form';

interface FormAnalyticsTabProps {
  form: Form;
}

export function FormAnalyticsTab({ form }: FormAnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<FormAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ analytics: FormAnalytics }>(`/api/forms/${form.id}/analytics`)
      .then((res) => {
        if (active) setAnalytics(res.analytics);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load analytics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form.id, form.responseCount]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-700 dark:text-rose-300">
        {error || 'Unable to compute analytics.'}
      </div>
    );
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
  };

  return (
    <div className="space-y-6">
      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Total Responses</div>
          <div className="text-2xl font-bold font-mono-data text-zinc-900 dark:text-zinc-50 mt-1">
            {analytics.totalResponses}
          </div>
        </div>
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Completion Rate</div>
          <div className="text-2xl font-bold font-mono-data text-zinc-900 dark:text-zinc-50 mt-1">
            {analytics.completionRate}%
          </div>
        </div>
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Avg. Completion Time</div>
          <div className="text-2xl font-bold font-mono-data text-zinc-900 dark:text-zinc-50 mt-1">
            {formatDuration(analytics.avgDurationSeconds)}
          </div>
        </div>
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {form.isQuiz && analytics.quizStats ? 'Quiz Pass Rate' : 'Public Views'}
          </div>
          <div className="text-2xl font-bold font-mono-data text-zinc-900 dark:text-zinc-50 mt-1">
            {form.isQuiz && analytics.quizStats ? `${analytics.quizStats.passRate}%` : analytics.viewCount}
          </div>
        </div>
      </div>

      {/* Quiz Aggregate Banner */}
      {form.isQuiz && analytics.quizStats && (
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-zinc-500">Average Score</div>
            <div className="text-lg font-semibold font-mono-data text-zinc-900 dark:text-zinc-100 mt-0.5">
              {analytics.quizStats.averageScore} pts
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Average Percentage</div>
            <div className="text-lg font-semibold font-mono-data text-zinc-900 dark:text-zinc-100 mt-0.5">
              {analytics.quizStats.averagePercentage}%
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Highest Score</div>
            <div className="text-lg font-semibold font-mono-data text-zinc-900 dark:text-zinc-100 mt-0.5">
              {analytics.quizStats.highestScore} pts
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Pass Threshold</div>
            <div className="text-lg font-semibold font-mono-data text-zinc-900 dark:text-zinc-100 mt-0.5">
              {form.settings.passPercentage}%
            </div>
          </div>
        </div>
      )}

      {/* 14-day Response Trends */}
      <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Response Trends</h3>
            <p className="text-xs text-zinc-500">Daily submissions over the last 14 days</p>
          </div>
        </div>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.trends} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="respTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:opacity-15" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#71717a' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#71717a' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e4e4e7',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Responses"
                stroke="#4F46E5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#respTrendGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Question-by-question breakdown */}
      {analytics.totalResponses === 0 ? (
        <div className="p-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-center space-y-2">
          <BarChart3 className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Waiting for first submission</p>
          <p className="text-xs text-zinc-500">
            Question-wise distribution charts and averages will populate automatically once respondents submit.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Question-Wise Breakdown
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analytics.questionStats.map((qs) => (
              <div
                key={qs.questionId}
                className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{qs.title}</h4>
                    <p className="text-xs text-zinc-500 font-mono-data mt-0.5">
                      {qs.totalAnswered} responses
                      {qs.averageValue !== null && qs.averageValue !== undefined
                        ? ` · Mean: ${qs.averageValue}`
                        : ''}
                      {qs.correctRate !== null && qs.correctRate !== undefined
                        ? ` · Accuracy: ${qs.correctRate}%`
                        : ''}
                    </p>
                  </div>
                </div>

                {qs.distribution.length > 0 ? (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={qs.distribution}
                        margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:opacity-15" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: '#71717a' }}
                          interval={0}
                          tickFormatter={(val: string) =>
                            val.length > 14 ? `${val.slice(0, 12)}…` : val
                          }
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e4e4e7',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="count" name="Responses" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : qs.recentTexts && qs.recentTexts.length > 0 ? (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {qs.recentTexts.map((txt, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                      >
                        {txt}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">No entries for this question yet.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
