import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Star,
  Sun,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import type { Form } from '../types/form';

type FolderView = 'all' | 'recent' | 'starred' | 'trashed';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [folder, setFolder] = useState<FolderView>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIsQuiz, setNewIsQuiz] = useState(false);
  const [newLayoutMode, setNewLayoutMode] = useState<'classic' | 'conversational'>('classic');
  const [creating, setCreating] = useState(false);

  const loadForms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ filter: folder });
      if (search.trim()) qs.set('q', search.trim());
      const data = await apiFetch<{ forms: Form[] }>(`/api/forms?${qs.toString()}`);
      setForms(data.forms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms.');
    } finally {
      setLoading(false);
    }
  }, [folder, search]);

  useEffect(() => {
    const t = setTimeout(loadForms, 150);
    return () => clearTimeout(t);
  }, [loadForms]);

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiFetch<{ form: Form }>('/api/forms', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim() || 'Untitled Form',
          description: newDesc.trim(),
          isQuiz: newIsQuiz,
          layoutMode: newLayoutMode,
        }),
      });
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      toast('Form created', 'success');
      navigate(`/forms/${res.form.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create form', 'error');
    } finally {
      setCreating(false);
    }
  };

  const toggleStar = async (form: Form, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !form.isStarred;
    setForms((prev) =>
      prev
        .map((f) => (f.id === form.id ? { ...f, isStarred: nextVal } : f))
        .filter((f) => (folder === 'starred' ? f.isStarred : true))
    );
    try {
      await apiFetch(`/api/forms/${form.id}/meta`, {
        method: 'PATCH',
        body: JSON.stringify({ isStarred: nextVal }),
      });
      toast(nextVal ? 'Added to Starred' : 'Removed from Starred', 'info');
    } catch {
      loadForms();
    }
  };

  const moveToTrash = async (form: Form, isTrashed: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setForms((prev) => prev.filter((f) => f.id !== form.id));
    try {
      await apiFetch(`/api/forms/${form.id}/meta`, {
        method: 'PATCH',
        body: JSON.stringify({ isTrashed }),
      });
      toast(isTrashed ? 'Moved to Trash' : 'Form restored', 'success');
    } catch {
      loadForms();
    }
  };

  const duplicateForm = async (form: Form, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch<{ form: Form }>(`/api/forms/${form.id}/duplicate`, {
        method: 'POST',
      });
      setForms((prev) => [res.form, ...prev]);
      toast('Form duplicated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Duplicate failed', 'error');
    }
  };

  const permanentDelete = async (form: Form, e: React.MouseEvent) => {
    e.stopPropagation();
    setForms((prev) => prev.filter((f) => f.id !== form.id));
    try {
      await apiFetch(`/api/forms/${form.id}`, { method: 'DELETE' });
      toast('Form permanently deleted', 'success');
    } catch {
      loadForms();
    }
  };

  const totalResponses = forms.reduce((sum, f) => sum + (f.responseCount || 0), 0);
  const publishedCount = forms.filter((f) => f.status === 'published' && !f.isTrashed).length;

  const navItems: Array<{ id: FolderView; label: string; icon: typeof Folder }> = [
    { id: 'all', label: 'All Forms', icon: Folder },
    { id: 'recent', label: 'Recent Forms', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trashed', label: 'Trash', icon: Trash2 },
  ];

  const folderHeading = navItems.find((i) => i.id === folder)?.label || 'All Forms';

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <Link to="/dashboard" className="text-lg font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">
          FormX
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-zinc-500"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        <button
          type="button"
          onClick={() => {
            setCreateModalOpen(true);
            setMobileMenuOpen(false);
          }}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New Form
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = folder === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFolder(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                active
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <Link
          to="/profile"
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <UserIcon className="w-4 h-4" />
          <span className="truncate">{user?.name || 'Profile'}</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-full">
            {SidebarContent}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-600 dark:text-zinc-300"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{folderHeading}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:opacity-80"
            >
              <span
                style={{ backgroundColor: user?.avatarColor || '#4F46E5' }}
                className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
              >
                {(user?.name || 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline truncate max-w-[140px]">{user?.name}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6">
          {/* Welcome Section */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold font-display text-zinc-900 dark:text-zinc-50">
                Welcome back, {user?.name.split(' ')[0]}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-mono-data">
                {forms.length} forms in view · {publishedCount} published · {totalResponses} total responses
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Create New Form
            </button>
          </div>

          {/* Search & View Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search forms by title or description..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          </div>

          {/* Forms Grid / List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 animate-pulse"
                >
                  <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded mt-6" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : forms.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-14 text-center space-y-3">
              <FileText className="w-9 h-9 text-zinc-400 mx-auto" />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {search
                  ? 'No matching forms'
                  : folder === 'trashed'
                    ? 'Trash is empty'
                    : folder === 'starred'
                      ? 'No starred forms yet'
                      : 'Create your first form'}
              </h2>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {folder === 'trashed'
                  ? 'Forms you delete appear here before permanent removal.'
                  : 'Start with a blank form, conversational survey, or auto-graded quiz.'}
              </p>
              {folder !== 'trashed' && (
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Form
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {forms.map((form) => (
                <div
                  key={form.id}
                  onClick={() => !form.isTrashed && navigate(`/forms/${form.id}`)}
                  className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between gap-4 transition-colors ${
                    !form.isTrashed
                      ? 'hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer'
                      : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-1">
                        {form.title}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => toggleStar(form, e)}
                        className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                          form.isStarred ? 'text-amber-500' : 'text-zinc-400'
                        }`}
                        aria-label="Toggle star"
                      >
                        <Star className="w-4 h-4" fill={form.isStarred ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span
                        className={
                          form.status === 'published'
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-amber-600 dark:text-amber-400 font-medium'
                        }
                      >
                        {form.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-data">{form.responseCount} responses</span>
                      {form.isQuiz && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Quiz</span>
                        </>
                      )}
                    </div>

                    {form.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 pt-1">
                        {form.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs text-zinc-500">
                    <div className="font-mono-data truncate">
                      Updated {new Date(form.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!form.isTrashed ? (
                        <>
                          {form.status === 'published' && (
                            <a
                              href={`/f/${form.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-indigo-600"
                              title="Open public link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={(e) => duplicateForm(form, e)}
                            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                            title="Duplicate form"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => moveToTrash(form, true, e)}
                            className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-500 hover:text-rose-600"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => moveToTrash(form, false, e)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={(e) => permanentDelete(form, e)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                    <th className="py-3 px-4 font-medium">Form Title</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Responses</th>
                    <th className="py-3 px-4 font-medium">Created</th>
                    <th className="py-3 px-4 font-medium">Last Modified</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {forms.map((form) => (
                    <tr
                      key={form.id}
                      onClick={() => !form.isTrashed && navigate(`/forms/${form.id}`)}
                      className={`h-11 ${
                        !form.isTrashed
                          ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => toggleStar(form, e)}
                            className={form.isStarred ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600'}
                          >
                            <Star className="w-3.5 h-3.5" fill={form.isStarred ? 'currentColor' : 'none'} />
                          </button>
                          <span className="truncate max-w-xs">{form.title}</span>
                          {form.isQuiz && (
                            <span className="text-xs text-zinc-400">· Quiz</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs font-medium">
                        <span
                          className={
                            form.status === 'published'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {form.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-data text-xs text-zinc-700 dark:text-zinc-300">
                        {form.responseCount}
                      </td>
                      <td className="py-2.5 px-4 font-mono-data text-xs text-zinc-500 whitespace-nowrap">
                        {new Date(form.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono-data text-xs text-zinc-500 whitespace-nowrap">
                        {new Date(form.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {!form.isTrashed ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => duplicateForm(form, e)}
                              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => moveToTrash(form, true, e)}
                              className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-400 hover:text-rose-600"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => moveToTrash(form, false, e)}
                              className="text-xs font-medium text-indigo-600 hover:underline"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={(e) => permanentDelete(form, e)}
                              className="text-xs font-medium text-rose-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Create New Form Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateForm}
            className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Create New Form</h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Form Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Customer Onboarding Survey"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief overview for respondents..."
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Presentation Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewLayoutMode('classic')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      newLayoutMode === 'classic'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Classic Scroll</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">All fields per section</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewLayoutMode('conversational')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      newLayoutMode === 'conversational'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Conversational</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">One question at a time</div>
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                <div>
                  <div className="text-xs font-semibold">Enable Quiz Mode</div>
                  <div className="text-[11px] text-zinc-500">Auto-grade responses with points &amp; pass score</div>
                </div>
                <input
                  type="checkbox"
                  checked={newIsQuiz}
                  onChange={(e) => setNewIsQuiz(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create & Open Studio'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
