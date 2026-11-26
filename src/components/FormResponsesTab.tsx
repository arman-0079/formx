import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Inbox,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiDownloadFile, apiFetch } from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { Form, FormResponse } from '../types/form';

interface FormResponsesTabProps {
  form: Form;
  onResponseCountChange: (count: number) => void;
}

export function FormResponsesTab({ form, onResponseCountChange }: FormResponsesTabProps) {
  const { toast } = useToast();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [selected, setSelected] = useState<FormResponse | null>(null);

  const loadResponses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      const data = await apiFetch<{ responses: FormResponse[] }>(
        `/api/forms/${form.id}/responses?${qs.toString()}`
      );
      setResponses(data.responses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load responses.');
    } finally {
      setLoading(false);
    }
  }, [form.id, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(loadResponses, 180);
    return () => clearTimeout(t);
  }, [loadResponses]);

  const handleDelete = async (responseId: string) => {
    try {
      const res = await apiFetch<{ deleted: boolean; responseCount: number }>(
        `/api/forms/${form.id}/responses/${responseId}`,
        { method: 'DELETE' }
      );
      setResponses((prev) => prev.filter((r) => r.id !== responseId));
      onResponseCountChange(res.responseCount);
      if (selected?.id === responseId) setSelected(null);
      toast('Response deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      await apiDownloadFile(
        `/api/forms/${form.id}/export/${format}`,
        `${form.slug}-responses.${format}`
      );
      toast(`Exported ${format.toUpperCase()} file`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  };

  const downloadSummaryReport = () => {
    const questions = form.questions.filter((q) => q.type !== 'section_break');
    const lines: string[] = [
      `FORMX RESPONSE REPORT`,
      `Form: ${form.title}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Total Responses: ${responses.length}`,
      `====================================================`,
      '',
    ];

    responses.forEach((resp, idx) => {
      lines.push(`Submission #${idx + 1} (${new Date(resp.submittedAt).toLocaleString()})`);
      if (resp.respondentEmail) lines.push(`Email: ${resp.respondentEmail}`);
      lines.push(`Completion Time: ${resp.durationSeconds}s`);
      if (resp.quizResult) {
        lines.push(
          `Quiz Score: ${resp.quizResult.earnedScore}/${resp.quizResult.maxScore} (${resp.quizResult.percentage}%) - ${
            resp.quizResult.passed ? 'PASSED' : 'FAILED'
          }`
        );
      }
      questions.forEach((q) => {
        const val = resp.answers[q.id];
        const formatted = Array.isArray(val)
          ? val.join(', ')
          : typeof val === 'object' && val !== null && 'name' in val
            ? (val as { name: string }).name
            : String(val ?? '—');
        lines.push(`  - ${q.title}: ${formatted}`);
      });
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.slug}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Response report downloaded', 'success');
  };

  const displayQuestions = form.questions.filter((q) => q.type !== 'section_break').slice(0, 3);

  const renderCellValue = (val: unknown) => {
    if (val === undefined || val === null || val === '') {
      return <span className="text-zinc-400">—</span>;
    }
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object' && val !== null && 'url' in val) {
      const f = val as { url: string; name: string };
      return (
        <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[140px]">{f.name}</span>
        </span>
      );
    }
    return String(val);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search answers or email..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {form.isQuiz && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              {(['all', 'passed', 'failed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={downloadSummaryReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            Download Report
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-6 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : responses.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-2">
          <Inbox className="w-8 h-8 text-zinc-400 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No responses recorded</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Publish your form and share its link. Incoming submissions will appear here immediately.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-medium whitespace-nowrap">Submitted</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Duration</th>
                {form.isQuiz && <th className="py-3 px-4 font-medium whitespace-nowrap">Score</th>}
                {displayQuestions.map((q) => (
                  <th key={q.id} className="py-3 px-4 font-medium max-w-[200px] truncate">
                    {q.title}
                  </th>
                ))}
                <th className="py-3 px-4 font-medium text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {responses.map((resp) => (
                <tr
                  key={resp.id}
                  onClick={() => setSelected(resp)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 text-xs font-mono-data text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {new Date(resp.submittedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono-data text-zinc-500 whitespace-nowrap">
                    {resp.durationSeconds}s
                  </td>
                  {form.isQuiz && (
                    <td className="py-3 px-4 text-xs font-mono-data whitespace-nowrap">
                      {resp.quizResult ? (
                        <span
                          className={
                            resp.quizResult.passed
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-rose-600 dark:text-rose-400 font-medium'
                          }
                        >
                          {resp.quizResult.earnedScore}/{resp.quizResult.maxScore} ({resp.quizResult.percentage}%)
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  {displayQuestions.map((q) => (
                    <td
                      key={q.id}
                      className="py-3 px-4 text-xs text-zinc-700 dark:text-zinc-300 max-w-[220px] truncate"
                    >
                      {renderCellValue(resp.answers[q.id])}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(resp.id);
                      }}
                      className="p-1.5 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      aria-label="Delete response"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Individual Submission Detail Drawer/Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Submission Details
                </h3>
                <p className="text-xs font-mono-data text-zinc-500">
                  {new Date(selected.submittedAt).toLocaleString()} · {selected.durationSeconds}s
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {selected.quizResult && (
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500">Quiz Result</div>
                    <div className="text-lg font-bold font-mono-data text-zinc-900 dark:text-zinc-50">
                      {selected.quizResult.earnedScore} / {selected.quizResult.maxScore} (
                      {selected.quizResult.percentage}%)
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded ${
                      selected.quizResult.passed
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {selected.quizResult.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
              )}

              {form.questions
                .filter((q) => q.type !== 'section_break')
                .map((q) => {
                  const raw = selected.answers[q.id];
                  const fileObj =
                    typeof raw === 'object' && raw !== null && 'url' in raw
                      ? (raw as { url: string; name: string })
                      : null;
                  return (
                    <div key={q.id} className="space-y-1 pb-4 border-b border-zinc-100 dark:border-zinc-800/80 last:border-0">
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{q.title}</div>
                      {fileObj ? (
                        <a
                          href={`${fileObj.url}?download=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          {fileObj.name}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <div className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                          {Array.isArray(raw)
                            ? raw.length > 0
                              ? raw.join(', ')
                              : '—'
                            : raw !== undefined && raw !== null && raw !== ''
                              ? String(raw)
                              : '—'}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDelete(selected.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Submission
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
