import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  ArrowLeft,
  Award,
  BarChart2,
  Eye,
  ImagePlus,
  Inbox,
  Moon,
  Palette,
  Plus,
  Save,
  Settings,
  Share2,
  Sun,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiFetch, getAuthToken } from '../lib/api';
import {
  FORM_THEME_PRESETS,
  HEADER_BANNER_PRESETS,
  resolveHeaderImageUrl,
} from '../lib/presets';
import {
  QUESTION_TYPE_CATALOG,
  createDefaultQuestion,
} from '../components/QuestionTypeMeta';
import { SortableQuestionCard } from '../components/SortableQuestionCard';
import { FormResponsesTab } from '../components/FormResponsesTab';
import { FormAnalyticsTab } from '../components/FormAnalyticsTab';
import { PublicFormView } from '../components/PublicFormView';
import { ShareModal } from '../components/ShareModal';
import type { Form, FormSettings, Question, QuestionType } from '../types/form';

export function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [activeTab, setActiveTab] = useState<'build' | 'responses' | 'analytics'>('build');
  const [inspectorTab, setInspectorTab] = useState<'design' | 'quiz' | 'rules'>('design');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadForm = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ form: Form }>(`/api/forms/${id}`);
      setForm(res.form);
      setDirty(false);
      if (res.form.questions.length > 0) {
        setSelectedQuestionId(res.form.questions[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load form.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const persistForm = async (overrideStatus?: 'draft' | 'published', explicitForm?: Form) => {
    const target = explicitForm || form;
    if (!target) return;
    setSaving(true);
    try {
      const payload = {
        title: target.title,
        description: target.description,
        status: overrideStatus || target.status,
        isQuiz: target.isQuiz,
        settings: target.settings,
        questions: target.questions.map((q, idx) => ({ ...q, orderIndex: idx })),
      };
      const res = await apiFetch<{ form: Form }>(`/api/forms/${target.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setForm(res.form);
      setDirty(false);
      toast(
        overrideStatus === 'published'
          ? 'Form published and live!'
          : overrideStatus === 'draft'
            ? 'Form reverted to draft'
            : 'Changes saved',
        'success'
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save form', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateFormPatch = (patch: Partial<Form>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const updateSettings = (patch: Partial<FormSettings>) => {
    setForm((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev
    );
    setDirty(true);
  };

  const addQuestion = (type: QuestionType) => {
    if (!form) return;
    const q = createDefaultQuestion(type, form.id, form.questions.length);
    setForm({ ...form, questions: [...form.questions, q] });
    setSelectedQuestionId(q.id);
    setDirty(true);
  };

  const updateQuestion = (updated: Question) => {
    if (!form) return;
    setForm({
      ...form,
      questions: form.questions.map((q) => (q.id === updated.id ? updated : q)),
    });
    setDirty(true);
  };

  const duplicateQuestion = (q: Question) => {
    if (!form) return;
    const copy: Question = {
      ...q,
      id: `q_${nanoid(8)}`,
      title: `${q.title} (Copy)`,
      options: { ...q.options, choices: q.options.choices ? [...q.options.choices] : undefined },
    };
    const idx = form.questions.findIndex((item) => item.id === q.id);
    const next = [...form.questions];
    next.splice(idx + 1, 0, copy);
    setForm({ ...form, questions: next });
    setSelectedQuestionId(copy.id);
    setDirty(true);
  };

  const deleteQuestion = (qId: string) => {
    if (!form) return;
    setForm({ ...form, questions: form.questions.filter((q) => q.id !== qId) });
    setDirty(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!form) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.questions.findIndex((q) => q.id === active.id);
    const newIndex = form.questions.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setForm({ ...form, questions: arrayMove(form.questions, oldIndex, newIndex) });
    setDirty(true);
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeader(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = getAuthToken();
      const res = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Header upload failed');
      updateSettings({ headerImage: data.url });
      toast('Header image uploaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingHeader(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-14 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-96 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center space-y-4">
          <p className="text-sm text-rose-600">{error || 'Form not found.'}</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const headerBannerUrl = resolveHeaderImageUrl(form.settings.headerImage);
  const totalQuizPoints = form.questions
    .filter((q) => q.type !== 'section_break' && q.correctAnswer !== null && q.points > 0)
    .reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Studio Top Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateFormPatch({ title: e.target.value })}
              className="text-sm sm:text-base font-semibold font-display bg-transparent focus:outline-none border-b border-transparent focus:border-indigo-500 truncate max-w-[200px] sm:max-w-xs"
              aria-label="Form title"
            />
            <span className="hidden md:inline text-xs text-zinc-400 font-mono-data whitespace-nowrap">
              · {form.status === 'published' ? 'Published' : 'Draft'}
              {dirty ? ' · Unsaved' : ''}
            </span>
          </div>

          {/* Center Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 order-3 sm:order-2 w-full sm:w-auto justify-center">
            {[
              { id: 'build', label: 'Build', icon: Wrench },
              { id: 'responses', label: `Responses (${form.responseCount})`, icon: Inbox },
              { id: 'analytics', label: 'Analytics', icon: BarChart2 },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 order-2 sm:order-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Preview</span>
            </button>

            <button
              type="button"
              onClick={() => persistForm()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                persistForm(form.status === 'published' ? 'draft' : 'published')
              }
              className="px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {form.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === 'build' && (
        <div className="flex-1 max-w-[1440px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
          {/* Left Question Palette */}
          <aside className="lg:col-span-3 xl:col-span-2">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sticky top-20 space-y-3">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Add Question Type
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5 max-h-[70vh] overflow-y-auto pr-1">
                {QUESTION_TYPE_CATALOG.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => addQuestion(item.type)}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-left rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Center Drag-and-Drop Canvas */}
          <section className="lg:col-span-5 xl:col-span-6 space-y-4">
            {/* Form Title & Header Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div
                className="h-2 w-full"
                style={{ backgroundColor: form.settings.primaryColor }}
              />
              {headerBannerUrl && (
                <img
                  src={headerBannerUrl}
                  alt="Form header"
                  referrerPolicy="no-referrer"
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-6 space-y-2">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormPatch({ title: e.target.value })}
                  placeholder="Form title..."
                  className="w-full text-2xl font-bold font-display bg-transparent text-zinc-900 dark:text-zinc-50 focus:outline-none border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 pb-1"
                />
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => updateFormPatch({ description: e.target.value })}
                  placeholder="Form description or instructions for respondents..."
                  className="w-full text-sm bg-transparent text-zinc-600 dark:text-zinc-400 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Drag and Drop Questions List */}
            {form.questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center space-y-3">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  No questions added yet
                </p>
                <p className="text-xs text-zinc-500">
                  Pick any of the 13 question types from the palette to start building.
                </p>
                <button
                  type="button"
                  onClick={() => addQuestion('short_answer')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Short Answer
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={form.questions.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {form.questions.map((q, idx) => (
                      <SortableQuestionCard
                        key={q.id}
                        question={q}
                        index={idx}
                        isSelected={selectedQuestionId === q.id}
                        isQuiz={form.isQuiz}
                        settings={form.settings}
                        onSelect={() => setSelectedQuestionId(q.id)}
                        onChange={updateQuestion}
                        onDuplicate={() => duplicateQuestion(q)}
                        onDelete={() => deleteQuestion(q.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>

          {/* Right Inspector Panel: Design / Quiz / Rules */}
          <aside className="lg:col-span-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-20 overflow-hidden">
              <div className="grid grid-cols-3 border-b border-zinc-200 dark:border-zinc-800">
                {[
                  { id: 'design', label: 'Design', icon: Palette },
                  { id: 'quiz', label: 'Quiz', icon: Award },
                  { id: 'rules', label: 'Rules', icon: Settings },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = inspectorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setInspectorTab(tab.id as typeof inspectorTab)}
                      className={`flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
                        active
                          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto text-sm">
                {inspectorTab === 'design' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Public Form Layout
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['classic', 'conversational'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updateSettings({ layoutMode: mode })}
                            className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize ${
                              form.settings.layoutMode === mode
                                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {mode === 'classic' ? 'Classic Scroll' : 'Conversational'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Theme Preset
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {FORM_THEME_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              updateSettings({
                                themeName: preset.id,
                                primaryColor: preset.primaryColor,
                                backgroundColor: preset.backgroundColor,
                              })
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                              form.settings.themeName === preset.id
                                ? 'border-indigo-600 font-medium'
                                : 'border-zinc-200 dark:border-zinc-800'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: preset.primaryColor }}
                            />
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Primary Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={form.settings.primaryColor}
                            onChange={(e) =>
                              updateSettings({ themeName: 'custom', primaryColor: e.target.value })
                            }
                            className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                          />
                          <span className="text-xs font-mono-data text-zinc-500">
                            {form.settings.primaryColor}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Page Background
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={form.settings.backgroundColor}
                            onChange={(e) =>
                              updateSettings({ themeName: 'custom', backgroundColor: e.target.value })
                            }
                            className="w-8 h-8 rounded border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                          />
                          <span className="text-xs font-mono-data text-zinc-500">
                            {form.settings.backgroundColor}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Header Image
                        </label>
                        {form.settings.headerImage && (
                          <button
                            type="button"
                            onClick={() => updateSettings({ headerImage: null })}
                            className="text-xs text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {HEADER_BANNER_PRESETS.map((banner) => (
                          <button
                            key={banner.id}
                            type="button"
                            onClick={() => updateSettings({ headerImage: banner.id })}
                            className={`rounded-lg overflow-hidden border transition-all ${
                              form.settings.headerImage === banner.id
                                ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                                : 'border-zinc-200 dark:border-zinc-800 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={banner.src}
                              alt={banner.label}
                              referrerPolicy="no-referrer"
                              className="w-full h-12 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingHeader ? 'Uploading...' : 'Upload Custom Header'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingHeader}
                          onChange={handleHeaderUpload}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Font Style
                        </label>
                        <select
                          value={form.settings.fontStyle}
                          onChange={(e) =>
                            updateSettings({
                              fontStyle: e.target.value as FormSettings['fontStyle'],
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                        >
                          <option value="sans">DM Sans (Clean)</option>
                          <option value="display">Jakarta Display</option>
                          <option value="serif">Editorial Serif</option>
                          <option value="mono">Technical Mono</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Button Style
                        </label>
                        <select
                          value={form.settings.buttonStyle}
                          onChange={(e) =>
                            updateSettings({
                              buttonStyle: e.target.value as FormSettings['buttonStyle'],
                            })
                          }
                          className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                        >
                          <option value="rounded">Rounded</option>
                          <option value="pill">Pill</option>
                          <option value="square">Sharp Square</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Welcome Message
                      </label>
                      <input
                        type="text"
                        value={form.settings.welcomeTitle}
                        onChange={(e) => updateSettings({ welcomeTitle: e.target.value })}
                        placeholder="Optional welcome headline..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 mb-2"
                      />
                      <textarea
                        rows={2}
                        value={form.settings.welcomeMessage}
                        onChange={(e) => updateSettings({ welcomeMessage: e.target.value })}
                        placeholder="Optional welcome body..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Submission Confirmation Message
                      </label>
                      <textarea
                        rows={2}
                        value={form.settings.confirmationMessage}
                        onChange={(e) => updateSettings({ confirmationMessage: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                      />
                    </div>
                  </>
                )}

                {inspectorTab === 'quiz' && (
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Quiz Mode</div>
                        <div className="text-[11px] text-zinc-500">
                          Enable marks, answer keys &amp; auto-grading
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.isQuiz}
                        onChange={(e) => updateFormPatch({ isQuiz: e.target.checked })}
                        className="w-4 h-4 accent-indigo-600"
                      />
                    </label>

                    {form.isQuiz ? (
                      <>
                        <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Total Graded Points</span>
                          <span className="text-sm font-bold font-mono-data">{totalQuizPoints} pts</span>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Passing Threshold (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={form.settings.passPercentage}
                            onChange={(e) =>
                              updateSettings({
                                passPercentage: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full px-3 py-2 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                          />
                        </div>

                        <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                          <div>
                            <div className="text-xs font-medium">Show Results Immediately</div>
                            <div className="text-[11px] text-zinc-500">
                              Display score &amp; explanations after submission
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={form.settings.showResultsImmediately}
                            onChange={(e) =>
                              updateSettings({ showResultsImmediately: e.target.checked })
                            }
                            className="w-4 h-4 accent-indigo-600"
                          />
                        </label>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Turn on Quiz Mode to configure per-question points, correct answers, and explanations on each question card.
                      </p>
                    )}
                  </div>
                )}

                {inspectorTab === 'rules' && (
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Accepting Responses</div>
                        <div className="text-[11px] text-zinc-500">Allow respondents to submit</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.settings.acceptingResponses}
                        onChange={(e) =>
                          updateSettings({ acceptingResponses: e.target.checked })
                        }
                        className="w-4 h-4 accent-indigo-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Public Access</div>
                        <div className="text-[11px] text-zinc-500">
                          Uncheck to require a passcode
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.settings.isPublic}
                        onChange={(e) => updateSettings({ isPublic: e.target.checked })}
                        className="w-4 h-4 accent-indigo-600"
                      />
                    </label>

                    {!form.settings.isPublic && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Private Form Passcode
                        </label>
                        <input
                          type="text"
                          value={form.settings.passcode || ''}
                          onChange={(e) => updateSettings({ passcode: e.target.value })}
                          placeholder="Enter access passcode..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Response Limit (optional)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={form.settings.responseLimit ?? ''}
                        onChange={(e) =>
                          updateSettings({
                            responseLimit: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        placeholder="No limit"
                        className="w-full px-3 py-2 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Start Date (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={form.settings.startDate ? form.settings.startDate.slice(0, 16) : ''}
                        onChange={(e) =>
                          updateSettings({
                            startDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        End Date (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={form.settings.endDate ? form.settings.endDate.slice(0, 16) : ''}
                        onChange={(e) =>
                          updateSettings({
                            endDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                          })
                        }
                        className="w-full px-3 py-2 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'responses' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          <FormResponsesTab
            form={form}
            onResponseCountChange={(count) => setForm((prev) => (prev ? { ...prev, responseCount: count } : prev))}
          />
        </main>
      )}

      {activeTab === 'analytics' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
          <FormAnalyticsTab form={form} />
        </main>
      )}

      {/* Fullscreen Live Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs font-medium text-zinc-500">
              <span className="text-zinc-900 dark:text-zinc-100 font-semibold">Live Preview</span>
              <span>·</span>
              <span className="capitalize">{form.settings.layoutMode} mode</span>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-3.5 h-3.5" />
              Close Preview
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PublicFormView previewForm={form} onClosePreview={() => setPreviewOpen(false)} />
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareOpen && (
        <ShareModal
          form={form}
          onClose={() => setShareOpen(false)}
          onPublishNow={() => persistForm('published')}
          onUpdateSettings={updateSettings}
        />
      )}
    </div>
  );
}
