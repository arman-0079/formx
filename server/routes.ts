import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import rateLimit from 'express-rate-limit';
import * as XLSX from 'xlsx';
import {
  db,
  UPLOADS_DIR,
  defaultFormSettings,
  getFormFullById,
  mapQuestionRow,
  mapSettingsRow,
} from './db.ts';
import { requireAuth } from './auth.ts';
import type { AuthenticatedRequest } from './auth.ts';
import type {
  FormAnalytics,
  FormResponse,
  FormSettings,
  Question,
  QuestionAnalytics,
  QuizQuestionBreakdown,
} from '../src/types/form.ts';

export const apiRouter = Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many file uploads. Please wait before trying again.' },
});

const publicSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Submission rate limit reached. Please wait a few minutes.' },
});

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_RESPONSE_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.txt', '.csv']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    cb(null, `${nanoid(14)}${ext}`);
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      cb(new Error('Only JPG, PNG, WebP, and GIF images are allowed.'));
      return;
    }
    cb(null, true);
  },
});

const responseFileUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_RESPONSE_EXTS.has(ext)) {
      cb(new Error('Unsupported file type. Allowed: PDF, PNG, JPG, WebP, DOC, DOCX, TXT, CSV.'));
      return;
    }
    cb(null, true);
  },
});

// Serve uploaded files safely
apiRouter.get('/uploads/:filename', (req: Request, res: Response) => {
  const filename = String(req.params.filename || '');
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) {
    res.status(400).json({ error: 'Invalid filename.' });
    return;
  }
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.query.download === '1') {
    res.download(filePath, filename);
    return;
  }
  res.sendFile(filePath);
});

// Upload image for form builder (header or question image)
apiRouter.post('/uploads/image', requireAuth, uploadLimiter, (req: AuthenticatedRequest, res: Response) => {
  imageUpload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Image upload failed.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    res.json({
      url: `/api/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
    });
  });
});

// Upload file for public respondent File Upload question
apiRouter.post('/uploads/response-file/:slug', uploadLimiter, (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');
  const formRow = db
    .prepare("SELECT id FROM forms WHERE slug = ? AND status = 'published' AND is_trashed = 0")
    .get(slug) as { id: string } | undefined;
  if (!formRow) {
    res.status(404).json({ error: 'Published form not found.' });
    return;
  }
  responseFileUpload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'File upload failed.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }
    res.json({
      url: `/api/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
    });
  });
});

// ------------------- AUTHENTICATED FORMS API -------------------

apiRouter.get('/forms', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const filter = String(req.query.filter ?? 'all');
  const queryText = String(req.query.q ?? '').trim().toLowerCase();

  let sql = 'SELECT * FROM forms WHERE user_id = ?';
  const params: unknown[] = [userId];

  if (filter === 'trashed') {
    sql += ' AND is_trashed = 1';
  } else {
    sql += ' AND is_trashed = 0';
    if (filter === 'starred') {
      sql += ' AND is_starred = 1';
    }
  }

  if (queryText) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)';
    params.push(`%${queryText}%`, `%${queryText}%`);
  }

  sql += filter === 'recent' ? ' ORDER BY updated_at DESC LIMIT 12' : ' ORDER BY updated_at DESC';

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  const forms = rows.map((row) => {
    const settingsRow = db.prepare('SELECT * FROM form_settings WHERE form_id = ?').get(String(row.id)) as Record<string, unknown> | undefined;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title),
      description: String(row.description ?? ''),
      slug: String(row.slug),
      status: String(row.status) as 'draft' | 'published',
      isStarred: Boolean(row.is_starred),
      isTrashed: Boolean(row.is_trashed),
      isQuiz: Boolean(row.is_quiz),
      responseCount: Number(row.response_count ?? 0),
      viewCount: Number(row.view_count ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      settings: mapSettingsRow(settingsRow),
      questions: [],
    };
  });

  res.json({ forms });
});

apiRouter.post('/forms', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const title = String(req.body?.title ?? 'Untitled Form').trim() || 'Untitled Form';
  const description = String(req.body?.description ?? '').trim();
  const isQuiz = Boolean(req.body?.isQuiz);
  const layoutMode = req.body?.layoutMode === 'conversational' ? 'conversational' : 'classic';

  const formId = `form_${nanoid(8)}`;
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'form';
  const slug = `${baseSlug}-${nanoid(5)}`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO forms (id, user_id, title, description, slug, status, is_starred, is_trashed, is_quiz, response_count, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 0, 0, ?, 0, 0, ?, ?)`
    ).run(formId, userId, title, description, slug, isQuiz ? 1 : 0, now, now);

    db.prepare(
      `INSERT INTO form_settings (form_id, layout_mode) VALUES (?, ?)`
    ).run(formId, layoutMode);

    db.prepare(
      `INSERT INTO questions (id, form_id, order_index, type, title, description, image_url, required, options_json, points, correct_answer_json, explanation)
       VALUES (?, ?, 0, ?, ?, '', NULL, 1, ?, 1, NULL, '')`
    ).run(
      `q_${nanoid(8)}`,
      formId,
      isQuiz ? 'multiple_choice' : 'short_answer',
      isQuiz ? 'Question 1' : 'What is your name?',
      isQuiz ? JSON.stringify({ choices: ['Option A', 'Option B', 'Option C'] }) : JSON.stringify({ placeholder: 'Type your answer...' })
    );
  });

  tx();
  const full = getFormFullById(formId, userId);
  res.status(201).json({ form: full });
});

apiRouter.get('/forms/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const form = getFormFullById(String(req.params.id), req.user!.id);
  if (!form) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }
  res.json({ form });
});

apiRouter.put('/forms/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const formId = String(req.params.id);
  const existing = db.prepare('SELECT id FROM forms WHERE id = ? AND user_id = ?').get(formId, userId);
  if (!existing) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }

  const title = String(req.body?.title ?? 'Untitled Form').trim() || 'Untitled Form';
  const description = String(req.body?.description ?? '');
  const status = req.body?.status === 'published' ? 'published' : 'draft';
  const isQuiz = Boolean(req.body?.isQuiz);
  const settings: FormSettings = { ...defaultFormSettings(), ...(req.body?.settings || {}) };
  const questions: Question[] = Array.isArray(req.body?.questions) ? req.body.questions : [];
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE forms SET title = ?, description = ?, status = ?, is_quiz = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    ).run(title, description, status, isQuiz ? 1 : 0, now, formId, userId);

    db.prepare(
      `INSERT INTO form_settings (
        form_id, theme_name, primary_color, background_color, header_image, font_style, button_style, layout_mode,
        welcome_title, welcome_message, confirmation_message, is_public, passcode, accepting_responses,
        response_limit, start_date, end_date, pass_percentage, show_results_immediately
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(form_id) DO UPDATE SET
        theme_name = excluded.theme_name,
        primary_color = excluded.primary_color,
        background_color = excluded.background_color,
        header_image = excluded.header_image,
        font_style = excluded.font_style,
        button_style = excluded.button_style,
        layout_mode = excluded.layout_mode,
        welcome_title = excluded.welcome_title,
        welcome_message = excluded.welcome_message,
        confirmation_message = excluded.confirmation_message,
        is_public = excluded.is_public,
        passcode = excluded.passcode,
        accepting_responses = excluded.accepting_responses,
        response_limit = excluded.response_limit,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        pass_percentage = excluded.pass_percentage,
        show_results_immediately = excluded.show_results_immediately`
    ).run(
      formId,
      settings.themeName,
      settings.primaryColor,
      settings.backgroundColor,
      settings.headerImage,
      settings.fontStyle,
      settings.buttonStyle,
      settings.layoutMode,
      settings.welcomeTitle,
      settings.welcomeMessage,
      settings.confirmationMessage,
      settings.isPublic ? 1 : 0,
      settings.passcode || null,
      settings.acceptingResponses ? 1 : 0,
      settings.responseLimit ? Number(settings.responseLimit) : null,
      settings.startDate || null,
      settings.endDate || null,
      Number(settings.passPercentage ?? 70),
      settings.showResultsImmediately ? 1 : 0
    );

    db.prepare('DELETE FROM questions WHERE form_id = ?').run(formId);
    const insertQ = db.prepare(
      `INSERT INTO questions (id, form_id, order_index, type, title, description, image_url, required, options_json, points, correct_answer_json, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    questions.forEach((q, idx) => {
      const qId = q.id && String(q.id).trim() ? String(q.id) : `q_${nanoid(8)}`;
      insertQ.run(
        qId,
        formId,
        idx,
        q.type,
        String(q.title ?? '').trim() || 'Untitled Question',
        String(q.description ?? ''),
        q.imageUrl || null,
        q.required ? 1 : 0,
        JSON.stringify(q.options || {}),
        Number(q.points ?? 1),
        q.correctAnswer !== null && q.correctAnswer !== undefined ? JSON.stringify(q.correctAnswer) : null,
        String(q.explanation ?? '')
      );
    });
  });

  tx();
  const updated = getFormFullById(formId, userId);
  res.json({ form: updated });
});

apiRouter.patch('/forms/:id/meta', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const formId = String(req.params.id);
  const existing = db.prepare('SELECT id FROM forms WHERE id = ? AND user_id = ?').get(formId, userId);
  if (!existing) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (typeof req.body?.isStarred === 'boolean') {
    updates.push('is_starred = ?');
    params.push(req.body.isStarred ? 1 : 0);
  }
  if (typeof req.body?.isTrashed === 'boolean') {
    updates.push('is_trashed = ?');
    params.push(req.body.isTrashed ? 1 : 0);
  }
  if (req.body?.status === 'draft' || req.body?.status === 'published') {
    updates.push('status = ?');
    params.push(req.body.status);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(formId, userId);
    db.prepare(`UPDATE forms SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
  }

  const updated = getFormFullById(formId, userId);
  res.json({ form: updated });
});

apiRouter.post('/forms/:id/duplicate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orig = getFormFullById(String(req.params.id), userId);
  if (!orig) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }

  const newId = `form_${nanoid(8)}`;
  const newSlug = `${orig.slug.slice(0, 28)}-copy-${nanoid(4)}`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO forms (id, user_id, title, description, slug, status, is_starred, is_trashed, is_quiz, response_count, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 0, 0, ?, 0, 0, ?, ?)`
    ).run(newId, userId, `${orig.title} (Copy)`, orig.description, newSlug, orig.isQuiz ? 1 : 0, now, now);

    const s = orig.settings;
    db.prepare(
      `INSERT INTO form_settings (
        form_id, theme_name, primary_color, background_color, header_image, font_style, button_style, layout_mode,
        welcome_title, welcome_message, confirmation_message, is_public, passcode, accepting_responses,
        response_limit, start_date, end_date, pass_percentage, show_results_immediately
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId,
      s.themeName,
      s.primaryColor,
      s.backgroundColor,
      s.headerImage,
      s.fontStyle,
      s.buttonStyle,
      s.layoutMode,
      s.welcomeTitle,
      s.welcomeMessage,
      s.confirmationMessage,
      s.isPublic ? 1 : 0,
      s.passcode,
      s.acceptingResponses ? 1 : 0,
      s.responseLimit,
      s.startDate,
      s.endDate,
      s.passPercentage,
      s.showResultsImmediately ? 1 : 0
    );

    const insertQ = db.prepare(
      `INSERT INTO questions (id, form_id, order_index, type, title, description, image_url, required, options_json, points, correct_answer_json, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    orig.questions.forEach((q, idx) => {
      insertQ.run(
        `q_${nanoid(8)}`,
        newId,
        idx,
        q.type,
        q.title,
        q.description,
        q.imageUrl,
        q.required ? 1 : 0,
        JSON.stringify(q.options),
        q.points,
        q.correctAnswer !== null ? JSON.stringify(q.correctAnswer) : null,
        q.explanation
      );
    });
  });

  tx();
  res.status(201).json({ form: getFormFullById(newId, userId) });
});

apiRouter.delete('/forms/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const result = db.prepare('DELETE FROM forms WHERE id = ? AND user_id = ?').run(String(req.params.id), userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }
  res.json({ deleted: true });
});

// ------------------- RESPONSES, EXPORTS & ANALYTICS -------------------

function loadResponsesForForm(formId: string): FormResponse[] {
  const rows = db
    .prepare('SELECT * FROM responses WHERE form_id = ? ORDER BY submitted_at DESC')
    .all(formId) as Record<string, unknown>[];

  const quizRows = db.prepare('SELECT * FROM quiz_results WHERE form_id = ?').all(formId) as Record<string, unknown>[];
  const quizMap = new Map<string, FormResponse['quizResult']>();
  for (const qr of quizRows) {
    let breakdown: QuizQuestionBreakdown[] = [];
    try {
      breakdown = JSON.parse(String(qr.breakdown_json || '[]'));
    } catch {
      breakdown = [];
    }
    quizMap.set(String(qr.response_id), {
      id: String(qr.id),
      responseId: String(qr.response_id),
      earnedScore: Number(qr.earned_score),
      maxScore: Number(qr.max_score),
      percentage: Number(qr.percentage),
      passed: Boolean(qr.passed),
      breakdown,
    });
  }

  return rows.map((r) => {
    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(String(r.answers_json || '{}'));
    } catch {
      answers = {};
    }
    return {
      id: String(r.id),
      formId: String(r.form_id),
      answers,
      respondentEmail: r.respondent_email ? String(r.respondent_email) : null,
      durationSeconds: Number(r.duration_seconds ?? 0),
      submittedAt: String(r.submitted_at),
      quizResult: quizMap.get(String(r.id)) ?? null,
    };
  });
}

apiRouter.get('/forms/:id/responses', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const form = getFormFullById(String(req.params.id), req.user!.id);
  if (!form) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }

  const q = String(req.query.q ?? '').trim().toLowerCase();
  const statusFilter = String(req.query.status ?? 'all');
  let responses = loadResponsesForForm(form.id);

  if (q) {
    responses = responses.filter((resp) => {
      const emailMatch = (resp.respondentEmail || '').toLowerCase().includes(q);
      const ansMatch = JSON.stringify(resp.answers).toLowerCase().includes(q);
      return emailMatch || ansMatch;
    });
  }

  if (statusFilter === 'passed') {
    responses = responses.filter((r) => r.quizResult?.passed === true);
  } else if (statusFilter === 'failed') {
    responses = responses.filter((r) => r.quizResult?.passed === false);
  }

  res.json({ responses });
});

apiRouter.delete('/forms/:id/responses/:responseId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const form = getFormFullById(String(req.params.id), req.user!.id);
  if (!form) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }
  const del = db
    .prepare('DELETE FROM responses WHERE id = ? AND form_id = ?')
    .run(String(req.params.responseId), form.id);

  if (del.changes === 0) {
    res.status(404).json({ error: 'Response not found.' });
    return;
  }

  const cnt = db.prepare('SELECT COUNT(*) as cnt FROM responses WHERE form_id = ?').get(form.id) as { cnt: number };
  db.prepare('UPDATE forms SET response_count = ? WHERE id = ?').run(cnt.cnt, form.id);

  res.json({ deleted: true, responseCount: cnt.cnt });
});

function formatAnswerForExport(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object' && val !== null && 'name' in val) {
    const f = val as { name?: string; url?: string };
    return f.name ? `${f.name} (${f.url || ''})` : JSON.stringify(val);
  }
  return String(val);
}

apiRouter.get('/forms/:id/export/:format', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const form = getFormFullById(String(req.params.id), req.user!.id);
  if (!form) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }
  const format = String(req.params.format).toLowerCase();
  const responses = loadResponsesForForm(form.id);
  const questions = form.questions.filter((q) => q.type !== 'section_break');

  const rows = responses.map((resp) => {
    const obj: Record<string, string | number> = {
      'Response ID': resp.id,
      'Submitted At': new Date(resp.submittedAt).toISOString(),
      'Duration (sec)': resp.durationSeconds,
      'Respondent Email': resp.respondentEmail || '',
    };
    if (form.isQuiz) {
      obj['Quiz Score'] = resp.quizResult ? `${resp.quizResult.earnedScore}/${resp.quizResult.maxScore}` : '';
      obj['Percentage (%)'] = resp.quizResult ? resp.quizResult.percentage : '';
      obj['Status'] = resp.quizResult ? (resp.quizResult.passed ? 'Passed' : 'Failed') : '';
    }
    for (const q of questions) {
      obj[q.title] = formatAnswerForExport(resp.answers[q.id]);
    }
    return obj;
  });

  const safeSlug = form.slug.replace(/[^a-z0-9-_]/gi, '_');

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Message: 'No responses yet' }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Responses');
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}-responses.xlsx"`);
    res.send(buf);
    return;
  }

  // CSV fallback / primary
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['Response ID', 'Submitted At', ...questions.map((q) => q.title)];
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(',')),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}-responses.csv"`);
  res.send(csvLines.join('\n'));
});

apiRouter.get('/forms/:id/analytics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const form = getFormFullById(String(req.params.id), req.user!.id);
  if (!form) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }

  const responses = loadResponsesForForm(form.id);
  const totalResponses = responses.length;
  const viewCount = Math.max(form.viewCount, totalResponses);
  const completionRate = viewCount > 0 ? Math.min(100, Math.round((totalResponses / viewCount) * 100)) : 0;
  const avgDurationSeconds =
    totalResponses > 0
      ? Math.round(responses.reduce((acc, r) => acc + (r.durationSeconds || 0), 0) / totalResponses)
      : 0;

  // Daily trends over last 14 days
  const trendMap = new Map<string, number>();
  for (let d = 13; d >= 0; d--) {
    const dt = new Date(Date.now() - d * 86400000);
    const key = dt.toISOString().slice(0, 10);
    trendMap.set(key, 0);
  }
  for (const r of responses) {
    const dayKey = r.submittedAt.slice(0, 10);
    if (trendMap.has(dayKey)) {
      trendMap.set(dayKey, (trendMap.get(dayKey) || 0) + 1);
    }
  }
  const trends = Array.from(trendMap.entries()).map(([date, count]) => ({
    date: date.slice(5),
    count,
  }));

  // Per-question analytics
  const questionStats: QuestionAnalytics[] = form.questions
    .filter((q) => q.type !== 'section_break')
    .map((q) => {
      const answeredVals = responses
        .map((r) => r.answers[q.id])
        .filter((v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0));

      const totalAnswered = answeredVals.length;
      const distributionMap = new Map<string, number>();

      if (q.type === 'multiple_choice' || q.type === 'dropdown') {
        for (const c of q.options.choices || []) {
          distributionMap.set(c, 0);
        }
        for (const v of answeredVals) {
          const key = String(v);
          distributionMap.set(key, (distributionMap.get(key) || 0) + 1);
        }
      } else if (q.type === 'checkboxes') {
        for (const c of q.options.choices || []) {
          distributionMap.set(c, 0);
        }
        for (const v of answeredVals) {
          if (Array.isArray(v)) {
            for (const item of v) {
              const key = String(item);
              distributionMap.set(key, (distributionMap.get(key) || 0) + 1);
            }
          }
        }
      } else if (q.type === 'linear_scale' || q.type === 'rating') {
        const min = q.type === 'rating' ? 1 : (q.options.scaleMin ?? 1);
        const max = q.type === 'rating' ? (q.options.ratingMax ?? 5) : (q.options.scaleMax ?? 10);
        for (let n = min; n <= max; n++) {
          distributionMap.set(String(n), 0);
        }
        for (const v of answeredVals) {
          const key = String(v);
          distributionMap.set(key, (distributionMap.get(key) || 0) + 1);
        }
      }

      let averageValue: number | null = null;
      let minValue: number | null = null;
      let maxValue: number | null = null;

      if (q.type === 'linear_scale' || q.type === 'rating' || q.type === 'number') {
        const nums = answeredVals.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
        if (nums.length > 0) {
          averageValue = Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
          minValue = Math.min(...nums);
          maxValue = Math.max(...nums);
        }
      }

      const recentTexts =
        q.type === 'short_answer' || q.type === 'paragraph' || q.type === 'email' || q.type === 'phone'
          ? answeredVals.slice(0, 6).map((v) => String(v))
          : undefined;

      let correctRate: number | null = null;
      if (form.isQuiz && q.points > 0) {
        const graded = responses
          .map((r) => r.quizResult?.breakdown.find((b) => b.questionId === q.id))
          .filter((b): b is QuizQuestionBreakdown => Boolean(b));
        if (graded.length > 0) {
          const correctCount = graded.filter((b) => b.isCorrect).length;
          correctRate = Math.round((correctCount / graded.length) * 100);
        }
      }

      const distribution = Array.from(distributionMap.entries()).map(([label, count]) => ({
        label,
        count,
        percentage: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0,
      }));

      return {
        questionId: q.id,
        title: q.title,
        type: q.type,
        totalAnswered,
        distribution,
        averageValue,
        minValue,
        maxValue,
        recentTexts,
        correctRate,
      };
    });

  let quizStats: FormAnalytics['quizStats'] = null;
  if (form.isQuiz) {
    const results = responses.map((r) => r.quizResult).filter((qr): qr is NonNullable<typeof qr> => Boolean(qr));
    if (results.length > 0) {
      const avgScore = Number((results.reduce((s, r) => s + r.earnedScore, 0) / results.length).toFixed(1));
      const avgPct = Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length);
      const passedCount = results.filter((r) => r.passed).length;
      const highestScore = Math.max(...results.map((r) => r.earnedScore));
      quizStats = {
        averageScore: avgScore,
        averagePercentage: avgPct,
        passRate: Math.round((passedCount / results.length) * 100),
        highestScore,
      };
    }
  }

  const analytics: FormAnalytics = {
    totalResponses,
    viewCount,
    completionRate,
    avgDurationSeconds,
    trends,
    questionStats,
    quizStats,
  };

  res.json({ analytics });
});

// ------------------- PUBLIC FORM ACCESS & SUBMISSION -------------------

function checkAvailability(formRow: Record<string, unknown>, settings: FormSettings): { ok: boolean; reason?: string } {
  if (Number(formRow.is_trashed) === 1 || formRow.status !== 'published') {
    return { ok: false, reason: 'This form is not currently published.' };
  }
  if (!settings.acceptingResponses) {
    return { ok: false, reason: 'This form is no longer accepting responses.' };
  }
  const now = Date.now();
  if (settings.startDate && new Date(settings.startDate).getTime() > now) {
    return { ok: false, reason: `This form opens on ${new Date(settings.startDate).toLocaleString()}.` };
  }
  if (settings.endDate && new Date(settings.endDate).getTime() < now) {
    return { ok: false, reason: 'The deadline for this form has passed.' };
  }
  if (settings.responseLimit && Number(formRow.response_count) >= settings.responseLimit) {
    return { ok: false, reason: 'This form has reached its maximum response limit.' };
  }
  return { ok: true };
}

apiRouter.get('/public/forms/:slug', (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');
  const formRow = db.prepare('SELECT * FROM forms WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  if (!formRow) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }

  const settingsRow = db.prepare('SELECT * FROM form_settings WHERE form_id = ?').get(String(formRow.id)) as Record<string, unknown> | undefined;
  const settings = mapSettingsRow(settingsRow);

  const avail = checkAvailability(formRow, settings);
  if (!avail.ok) {
    res.status(403).json({
      error: avail.reason,
      closed: true,
      title: String(formRow.title),
    });
    return;
  }

  const providedPasscode = String(req.query.passcode ?? '');
  if (!settings.isPublic && settings.passcode && providedPasscode !== settings.passcode) {
    res.json({
      requiresPasscode: true,
      title: String(formRow.title),
      description: String(formRow.description ?? ''),
    });
    return;
  }

  db.prepare('UPDATE forms SET view_count = view_count + 1 WHERE id = ?').run(String(formRow.id));

  const questionRows = db
    .prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY order_index ASC')
    .all(String(formRow.id)) as Record<string, unknown>[];

  // Sanitize settings (never leak passcode) and sanitize questions (never leak quiz answer keys)
  const safeSettings: FormSettings = { ...settings, passcode: null };

  res.json({
    form: {
      id: String(formRow.id),
      title: String(formRow.title),
      description: String(formRow.description ?? ''),
      slug: String(formRow.slug),
      isQuiz: Boolean(formRow.is_quiz),
      settings: safeSettings,
      questions: questionRows.map((q) => mapQuestionRow(q, false)),
    },
  });
});

function isAnswerEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim().length === 0;
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') return Object.keys(val).length === 0;
  return false;
}

function normalizeQuizVal(val: unknown): string {
  return String(val ?? '').trim().toLowerCase();
}

apiRouter.post('/public/forms/:slug/submit', publicSubmitLimiter, (req: Request, res: Response) => {
  // Honeypot anti-spam trap
  if (req.body?._hp && String(req.body._hp).trim().length > 0) {
    res.status(400).json({ error: 'Spam detected.' });
    return;
  }

  const slug = String(req.params.slug || '');
  const formRow = db.prepare('SELECT * FROM forms WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  if (!formRow) {
    res.status(404).json({ error: 'Form not found.' });
    return;
  }

  const formId = String(formRow.id);
  const settingsRow = db.prepare('SELECT * FROM form_settings WHERE form_id = ?').get(formId) as Record<string, unknown> | undefined;
  const settings = mapSettingsRow(settingsRow);

  const avail = checkAvailability(formRow, settings);
  if (!avail.ok) {
    res.status(403).json({ error: avail.reason });
    return;
  }

  const providedPasscode = String(req.body?.passcode ?? '');
  if (!settings.isPublic && settings.passcode && providedPasscode !== settings.passcode) {
    res.status(403).json({ error: 'Invalid access passcode.' });
    return;
  }

  const questionRows = db
    .prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY order_index ASC')
    .all(formId) as Record<string, unknown>[];
  const questions = questionRows.map((q) => mapQuestionRow(q, true));

  const answers: Record<string, unknown> = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const durationSeconds = Math.max(0, Math.min(86400, Number(req.body?.durationSeconds ?? 0) || 0));

  const fieldErrors: Record<string, string> = {};
  let detectedEmail: string | null = null;

  for (const q of questions) {
    if (q.type === 'section_break') continue;
    const val = answers[q.id];

    if (q.required && isAnswerEmpty(val)) {
      fieldErrors[q.id] = 'This question is required.';
      continue;
    }

    if (isAnswerEmpty(val)) continue;

    if (q.type === 'email') {
      const emailStr = String(val).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
        fieldErrors[q.id] = 'Please enter a valid email address.';
      } else if (!detectedEmail) {
        detectedEmail = emailStr;
      }
    } else if (q.type === 'phone') {
      const phoneStr = String(val).trim();
      if (!/^[+\d\s().-]{7,24}$/.test(phoneStr)) {
        fieldErrors[q.id] = 'Please enter a valid phone number.';
      }
    } else if (q.type === 'number') {
      const num = Number(val);
      if (Number.isNaN(num)) {
        fieldErrors[q.id] = 'Please enter a valid number.';
      } else {
        if (q.options.minNumber !== null && q.options.minNumber !== undefined && num < q.options.minNumber) {
          fieldErrors[q.id] = `Value must be at least ${q.options.minNumber}.`;
        }
        if (q.options.maxNumber !== null && q.options.maxNumber !== undefined && num > q.options.maxNumber) {
          fieldErrors[q.id] = `Value must be at most ${q.options.maxNumber}.`;
        }
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: 'Please fix the highlighted fields.', fieldErrors });
    return;
  }

  const responseId = `resp_${nanoid(10)}`;
  const now = new Date().toISOString();
  const ipHash = crypto.createHash('sha256').update(String(req.ip || 'unknown')).digest('hex').slice(0, 16);

  let quizResultPayload: {
    earnedScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    breakdown: QuizQuestionBreakdown[];
  } | null = null;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO responses (id, form_id, answers_json, respondent_email, duration_seconds, ip_hash, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(responseId, formId, JSON.stringify(answers), detectedEmail, durationSeconds, ipHash, now);

    db.prepare('UPDATE forms SET response_count = response_count + 1 WHERE id = ?').run(formId);

    if (Boolean(formRow.is_quiz)) {
      const breakdown: QuizQuestionBreakdown[] = [];
      let earnedScore = 0;
      let maxScore = 0;

      for (const q of questions) {
        if (q.type === 'section_break' || q.points <= 0 || q.correctAnswer === null || q.correctAnswer === undefined) {
          continue;
        }
        maxScore += q.points;
        const userAnswer = answers[q.id];
        let isCorrect = false;

        if (Array.isArray(q.correctAnswer)) {
          const expectedSet = new Set(q.correctAnswer.map(normalizeQuizVal));
          const userArr = Array.isArray(userAnswer) ? userAnswer.map(normalizeQuizVal) : [];
          isCorrect = expectedSet.size === userArr.length && userArr.every((v) => expectedSet.has(v));
        } else {
          isCorrect = normalizeQuizVal(userAnswer) === normalizeQuizVal(q.correctAnswer);
        }

        const pointsEarned = isCorrect ? q.points : 0;
        earnedScore += pointsEarned;

        breakdown.push({
          questionId: q.id,
          title: q.title,
          userAnswer: userAnswer ?? null,
          correctAnswer: q.correctAnswer,
          isCorrect,
          pointsEarned,
          pointsPossible: q.points,
          explanation: q.explanation,
        });
      }

      const percentage = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 100;
      const passed = percentage >= settings.passPercentage;

      db.prepare(
        `INSERT INTO quiz_results (id, response_id, form_id, earned_score, max_score, percentage, passed, breakdown_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(`qr_${nanoid(8)}`, responseId, formId, earnedScore, maxScore, percentage, passed ? 1 : 0, JSON.stringify(breakdown));

      quizResultPayload = {
        earnedScore,
        maxScore,
        percentage,
        passed,
        breakdown,
      };
    }
  });

  tx();

  res.status(201).json({
    submitted: true,
    responseId,
    confirmationMessage: settings.confirmationMessage,
    quizResult: settings.showResultsImmediately ? quizResultPayload : null,
  });
});
