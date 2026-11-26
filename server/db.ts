import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Form, FormSettings, Question, QuestionOptions, QuestionType } from '../src/types/form.ts';

const dataDir = path.resolve(process.cwd(), 'data');
const uploadsDir = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const UPLOADS_DIR = uploadsDir;
export const DATA_DIR = dataDir;

export const db = new Database(path.join(dataDir, 'formx.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#4F46E5',
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      is_starred INTEGER NOT NULL DEFAULT 0,
      is_trashed INTEGER NOT NULL DEFAULT 0,
      is_quiz INTEGER NOT NULL DEFAULT 0,
      response_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS form_settings (
      form_id TEXT PRIMARY KEY,
      theme_name TEXT NOT NULL DEFAULT 'swiss',
      primary_color TEXT NOT NULL DEFAULT '#4F46E5',
      background_color TEXT NOT NULL DEFAULT '#FAFAFA',
      header_image TEXT,
      font_style TEXT NOT NULL DEFAULT 'sans',
      button_style TEXT NOT NULL DEFAULT 'rounded',
      layout_mode TEXT NOT NULL DEFAULT 'classic',
      welcome_title TEXT NOT NULL DEFAULT '',
      welcome_message TEXT NOT NULL DEFAULT '',
      confirmation_message TEXT NOT NULL DEFAULT 'Thank you! Your response has been recorded.',
      is_public INTEGER NOT NULL DEFAULT 1,
      passcode TEXT,
      accepting_responses INTEGER NOT NULL DEFAULT 1,
      response_limit INTEGER,
      start_date TEXT,
      end_date TEXT,
      pass_percentage INTEGER NOT NULL DEFAULT 70,
      show_results_immediately INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      required INTEGER NOT NULL DEFAULT 0,
      options_json TEXT NOT NULL DEFAULT '{}',
      points INTEGER NOT NULL DEFAULT 1,
      correct_answer_json TEXT,
      explanation TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      respondent_email TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_results (
      id TEXT PRIMARY KEY,
      response_id TEXT NOT NULL UNIQUE,
      form_id TEXT NOT NULL,
      earned_score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      breakdown_json TEXT NOT NULL,
      FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_forms_user ON forms(user_id);
    CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
    CREATE INDEX IF NOT EXISTS idx_questions_form ON questions(form_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_responses_form ON responses(form_id, submitted_at);
  `);
}

export function defaultFormSettings(): FormSettings {
  return {
    themeName: 'swiss',
    primaryColor: '#4F46E5',
    backgroundColor: '#FAFAFA',
    headerImage: null,
    fontStyle: 'sans',
    buttonStyle: 'rounded',
    layoutMode: 'classic',
    welcomeTitle: '',
    welcomeMessage: '',
    confirmationMessage: 'Thank you! Your response has been recorded.',
    isPublic: true,
    passcode: null,
    acceptingResponses: true,
    responseLimit: null,
    startDate: null,
    endDate: null,
    passPercentage: 70,
    showResultsImmediately: true,
  };
}

export function mapSettingsRow(row: Record<string, unknown> | undefined): FormSettings {
  if (!row) return defaultFormSettings();
  return {
    themeName: String(row.theme_name ?? 'swiss'),
    primaryColor: String(row.primary_color ?? '#4F46E5'),
    backgroundColor: String(row.background_color ?? '#FAFAFA'),
    headerImage: row.header_image ? String(row.header_image) : null,
    fontStyle: (row.font_style as FormSettings['fontStyle']) || 'sans',
    buttonStyle: (row.button_style as FormSettings['buttonStyle']) || 'rounded',
    layoutMode: (row.layout_mode as FormSettings['layoutMode']) || 'classic',
    welcomeTitle: String(row.welcome_title ?? ''),
    welcomeMessage: String(row.welcome_message ?? ''),
    confirmationMessage: String(row.confirmation_message ?? 'Thank you! Your response has been recorded.'),
    isPublic: Boolean(row.is_public),
    passcode: row.passcode ? String(row.passcode) : null,
    acceptingResponses: Boolean(row.accepting_responses),
    responseLimit: row.response_limit !== null && row.response_limit !== undefined ? Number(row.response_limit) : null,
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    passPercentage: Number(row.pass_percentage ?? 70),
    showResultsImmediately: Boolean(row.show_results_immediately),
  };
}

export function mapQuestionRow(row: Record<string, unknown>, includeQuizKeys = true): Question {
  let options: QuestionOptions = {};
  try {
    options = JSON.parse(String(row.options_json || '{}'));
  } catch {
    options = {};
  }

  let correctAnswer: string | string[] | null = null;
  if (includeQuizKeys && row.correct_answer_json) {
    try {
      correctAnswer = JSON.parse(String(row.correct_answer_json));
    } catch {
      correctAnswer = null;
    }
  }

  return {
    id: String(row.id),
    formId: String(row.form_id),
    orderIndex: Number(row.order_index),
    type: String(row.type) as QuestionType,
    title: String(row.title),
    description: String(row.description ?? ''),
    imageUrl: row.image_url ? String(row.image_url) : null,
    required: Boolean(row.required),
    options,
    points: Number(row.points ?? 1),
    correctAnswer,
    explanation: includeQuizKeys ? String(row.explanation ?? '') : '',
  };
}

export function getFormFullById(formId: string, userId?: string): Form | null {
  const formRow = (userId
    ? db.prepare('SELECT * FROM forms WHERE id = ? AND user_id = ?').get(formId, userId)
    : db.prepare('SELECT * FROM forms WHERE id = ?').get(formId)) as Record<string, unknown> | undefined;

  if (!formRow) return null;

  const settingsRow = db.prepare('SELECT * FROM form_settings WHERE form_id = ?').get(formId) as Record<string, unknown> | undefined;
  const questionRows = db.prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY order_index ASC').all(formId) as Record<string, unknown>[];

  return {
    id: String(formRow.id),
    userId: String(formRow.user_id),
    title: String(formRow.title),
    description: String(formRow.description ?? ''),
    slug: String(formRow.slug),
    status: (formRow.status as 'draft' | 'published') || 'draft',
    isStarred: Boolean(formRow.is_starred),
    isTrashed: Boolean(formRow.is_trashed),
    isQuiz: Boolean(formRow.is_quiz),
    responseCount: Number(formRow.response_count ?? 0),
    viewCount: Number(formRow.view_count ?? 0),
    createdAt: String(formRow.created_at),
    updatedAt: String(formRow.updated_at),
    settings: mapSettingsRow(settingsRow),
    questions: questionRows.map((q) => mapQuestionRow(q, true)),
  };
}
