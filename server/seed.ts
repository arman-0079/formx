import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export const DEMO_EMAIL = 'demo@formx.io';
export const DEMO_PASSWORD = 'DemoUser123!';

export function ensureDemoSeed(db: Database.Database): string {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as { id: string } | undefined;
  let demoUserId = existing?.id;

  if (!demoUserId) {
    demoUserId = 'user_demo_formx';
    const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(demoUserId, 'Elena Vance', DEMO_EMAIL, hash, '#4F46E5', new Date(Date.now() - 30 * 86400000).toISOString());
  }

  const formCount = db.prepare('SELECT COUNT(*) as cnt FROM forms WHERE user_id = ?').get(demoUserId) as { cnt: number };
  if (formCount.cnt > 0) {
    return demoUserId;
  }

  seedDemoForms(db, demoUserId);
  return demoUserId;
}

export function seedDemoForms(db: Database.Database, userId: string) {
  const now = Date.now();
  const daysAgo = (d: number, hoursOffset = 0) =>
    new Date(now - d * 86400000 + hoursOffset * 3600000).toISOString();

  // 1. Customer Experience & NPS Survey (Published, Classic, 18 responses)
  const form1Id = `form_nps_${nanoid(6)}`;
  const form1Slug = 'product-experience-nps';
  db.prepare(
    `INSERT INTO forms (id, user_id, title, description, slug, status, is_starred, is_trashed, is_quiz, response_count, view_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'published', 1, 0, 0, 18, 24, ?, ?)`
  ).run(
    form1Id,
    userId,
    '2026 Product Experience & NPS Survey',
    'Help our product and engineering teams prioritize what we build next. Takes under 2 minutes.',
    form1Slug,
    daysAgo(16),
    daysAgo(1)
  );

  db.prepare(
    `INSERT INTO form_settings (
      form_id, theme_name, primary_color, background_color, header_image, font_style, button_style, layout_mode,
      welcome_title, welcome_message, confirmation_message, is_public, passcode, accepting_responses,
      response_limit, start_date, end_date, pass_percentage, show_results_immediately
    ) VALUES (?, 'swiss', '#4F46E5', '#FAFAFA', 'preset:swiss_grid', 'sans', 'rounded', 'classic',
      'We value your perspective', 'Share honest feedback on your recent workflow experience.',
      'Thank you for helping shape our 2026 roadmap!', 1, NULL, 1, NULL, NULL, NULL, 70, 1)`
  ).run(form1Id);

  const f1q = [
    {
      id: `q_${nanoid(8)}`,
      order: 0,
      type: 'multiple_choice',
      title: 'Which workspace plan best describes your team?',
      desc: 'Select the tier your organization currently uses.',
      req: 1,
      opts: { choices: ['Starter (1–5 seats)', 'Growth (6–25 seats)', 'Enterprise (25+ seats)', 'Solo Consultant'] },
    },
    {
      id: `q_${nanoid(8)}`,
      order: 1,
      type: 'linear_scale',
      title: 'How likely are you to recommend FormX to a colleague?',
      desc: '0 = Not at all likely, 10 = Extremely likely',
      req: 1,
      opts: { scaleMin: 1, scaleMax: 10, scaleMinLabel: 'Unlikely', scaleMaxLabel: 'Definitely' },
    },
    {
      id: `q_${nanoid(8)}`,
      order: 2,
      type: 'rating',
      title: 'Rate the speed and reliability of the editor',
      desc: '',
      req: 1,
      opts: { ratingMax: 5, ratingIcon: 'star' },
    },
    {
      id: `q_${nanoid(8)}`,
      order: 3,
      type: 'checkboxes',
      title: 'Which capabilities do you rely on every week?',
      desc: 'Select all that apply.',
      req: 0,
      opts: { choices: ['Drag-and-drop builder', 'Conversational mode', 'CSV & Excel exports', 'Quiz auto-grading', 'Custom themes'] },
    },
    {
      id: `q_${nanoid(8)}`,
      order: 4,
      type: 'short_answer',
      title: 'What is the single highest-impact improvement we could ship next?',
      desc: '',
      req: 0,
      opts: { placeholder: 'e.g., Conditional logic branching' },
    },
    {
      id: `q_${nanoid(8)}`,
      order: 5,
      type: 'paragraph',
      title: 'Tell us about a workflow that saved your team time',
      desc: 'Optional open feedback reviewed weekly by product leadership.',
      req: 0,
      opts: { placeholder: 'Share details or specific use cases...' },
    },
    {
      id: `q_${nanoid(8)}`,
      order: 6,
      type: 'email',
      title: 'Work email (if you are open to a 15-minute research chat)',
      desc: '',
      req: 0,
      opts: { placeholder: 'alex@company.com' },
    },
  ];

  const insertQ = db.prepare(
    `INSERT INTO questions (id, form_id, order_index, type, title, description, image_url, required, options_json, points, correct_answer_json, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const q of f1q) {
    insertQ.run(q.id, form1Id, q.order, q.type, q.title, q.desc, null, q.req, JSON.stringify(q.opts), 1, null, '');
  }

  const plans = ['Growth (6–25 seats)', 'Growth (6–25 seats)', 'Enterprise (25+ seats)', 'Starter (1–5 seats)', 'Solo Consultant'];
  const features = [
    ['Drag-and-drop builder', 'CSV & Excel exports'],
    ['Conversational mode', 'Custom themes', 'Drag-and-drop builder'],
    ['Quiz auto-grading', 'CSV & Excel exports'],
    ['Drag-and-drop builder', 'Conversational mode'],
  ];
  const shortTexts = [
    'Conditional logic branching',
    'Slack instant webhook alerts',
    'Multi-language form translations',
    'Custom domain CNAME support',
    'PDF certificate generation for quizzes',
    'Scheduled weekly digest reports',
  ];

  const insertResp = db.prepare(
    `INSERT INTO responses (id, form_id, answers_json, respondent_email, duration_seconds, ip_hash, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (let i = 0; i < 18; i++) {
    const dayOffset = Math.floor((i * 13) / 18);
    const email = i % 2 === 0 ? `participant${i + 1}@acme-studio.com` : null;
    const answers: Record<string, unknown> = {
      [f1q[0].id]: plans[i % plans.length],
      [f1q[1].id]: [8, 9, 10, 7, 9, 10, 8, 6, 9, 10][i % 10],
      [f1q[2].id]: [4, 5, 5, 4, 5, 3, 5, 4][i % 8],
      [f1q[3].id]: features[i % features.length],
      [f1q[4].id]: shortTexts[i % shortTexts.length],
      [f1q[5].id]: i % 3 === 0 ? 'Switching our onboarding questionnaires to conversational mode doubled completion rates within the first week.' : '',
      [f1q[6].id]: email || '',
    };
    insertResp.run(
      `resp_${nanoid(10)}`,
      form1Id,
      JSON.stringify(answers),
      email,
      64 + ((i * 19) % 110),
      `seed_hash_${i}`,
      daysAgo(dayOffset, i % 10)
    );
  }

  // 2. Frontend Architecture & TypeScript Quiz (Published, Quiz Mode, Conversational, 12 responses)
  const form2Id = `form_quiz_${nanoid(6)}`;
  db.prepare(
    `INSERT INTO forms (id, user_id, title, description, slug, status, is_starred, is_trashed, is_quiz, response_count, view_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'published', 1, 0, 1, 12, 15, ?, ?)`
  ).run(
    form2Id,
    userId,
    'Frontend Architecture & TypeScript Quiz',
    'Technical assessment covering TypeScript narrowing, React rendering, and web security fundamentals.',
    'frontend-architecture-quiz',
    daysAgo(11),
    daysAgo(0)
  );

  db.prepare(
    `INSERT INTO form_settings (
      form_id, theme_name, primary_color, background_color, header_image, font_style, button_style, layout_mode,
      welcome_title, welcome_message, confirmation_message, is_public, passcode, accepting_responses,
      response_limit, start_date, end_date, pass_percentage, show_results_immediately
    ) VALUES (?, 'indigo', '#4338CA', '#F4F6FB', 'preset:indigo_waves', 'display', 'rounded', 'conversational',
      'Ready to test your architecture skills?', '6 curated questions · Passing score is 70% · Instant graded breakdown.',
      'Assessment submitted! Review your graded score below.', 1, NULL, 1, NULL, NULL, NULL, 70, 1)`
  ).run(form2Id);

  const f2q = [
    {
      id: `q_${nanoid(8)}`,
      order: 0,
      type: 'email',
      title: 'Candidate email address',
      desc: 'Used to record your assessment attempt.',
      req: 1,
      opts: { placeholder: 'candidate@engineering.dev' },
      points: 0,
      correct: null,
      exp: '',
    },
    {
      id: `q_${nanoid(8)}`,
      order: 1,
      type: 'multiple_choice',
      title: 'Which TypeScript utility type constructs a type with all properties of Type set to optional?',
      desc: '',
      req: 1,
      opts: { choices: ['Partial<Type>', 'Required<Type>', 'Pick<Type, Keys>', 'Record<Keys, Type>'] },
      points: 20,
      correct: 'Partial<Type>',
      exp: 'Partial<T> maps every property in T to optional using mapped type modifiers.',
    },
    {
      id: `q_${nanoid(8)}`,
      order: 2,
      type: 'multiple_choice',
      title: 'Which HTTP header prevents browsers from MIME-sniffing a response away from its declared Content-Type?',
      desc: '',
      req: 1,
      opts: { choices: ['X-Content-Type-Options: nosniff', 'Cache-Control: no-store', 'Access-Control-Allow-Origin', 'Referrer-Policy: same-origin'] },
      points: 20,
      correct: 'X-Content-Type-Options: nosniff',
      exp: 'nosniff instructs the browser to strictly follow the declared Content-Type header.',
    },
    {
      id: `q_${nanoid(8)}`,
      order: 3,
      type: 'checkboxes',
      title: 'Which CSS properties can be animated on the GPU compositor thread without triggering layout recalculation?',
      desc: 'Select all correct options.',
      req: 1,
      opts: { choices: ['transform', 'opacity', 'margin-top', 'width'] },
      points: 30,
      correct: ['transform', 'opacity'],
      exp: 'transform and opacity are handled by the compositor without invalidating layout geometry.',
    },
    {
      id: `q_${nanoid(8)}`,
      order: 4,
      type: 'dropdown',
      title: 'What is the recommended WCAG AA minimum contrast ratio for normal body text?',
      desc: '',
      req: 1,
      opts: { choices: ['3.0 : 1', '4.5 : 1', '7.0 : 1', '2.1 : 1'] },
      points: 15,
      correct: '4.5 : 1',
      exp: 'WCAG 2.1 AA requires at least 4.5:1 contrast for standard body text and 3:1 for large text.',
    },
    {
      id: `q_${nanoid(8)}`,
      order: 5,
      type: 'number',
      title: 'What HTTP status code represents "Too Many Requests" for rate limiting?',
      desc: 'Enter the 3-digit status code.',
      req: 1,
      opts: { minNumber: 100, maxNumber: 599, placeholder: 'e.g., 429' },
      points: 15,
      correct: '429',
      exp: 'HTTP 429 Too Many Requests indicates the user has sent too many requests in a given timeframe.',
    },
  ];

  for (const q of f2q) {
    insertQ.run(
      q.id,
      form2Id,
      q.order,
      q.type,
      q.title,
      q.desc,
      null,
      q.req,
      JSON.stringify(q.opts),
      q.points,
      q.correct !== null ? JSON.stringify(q.correct) : null,
      q.exp
    );
  }

  const insertQuizRes = db.prepare(
    `INSERT INTO quiz_results (id, response_id, form_id, earned_score, max_score, percentage, passed, breakdown_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (let i = 0; i < 12; i++) {
    const respId = `resp_qz_${nanoid(8)}`;
    const email = `engineer${i + 1}@techcorp.io`;
    const q1Ans = i % 5 === 0 ? 'Required<Type>' : 'Partial<Type>';
    const q2Ans = i % 4 === 0 ? 'Cache-Control: no-store' : 'X-Content-Type-Options: nosniff';
    const q3Ans = i % 3 === 0 ? ['transform'] : ['transform', 'opacity'];
    const q4Ans = i % 6 === 0 ? '3.0 : 1' : '4.5 : 1';
    const q5Ans = i % 5 === 1 ? '403' : '429';

    const answers = {
      [f2q[0].id]: email,
      [f2q[1].id]: q1Ans,
      [f2q[2].id]: q2Ans,
      [f2q[3].id]: q3Ans,
      [f2q[4].id]: q4Ans,
      [f2q[5].id]: q5Ans,
    };

    const breakdown = [
      { questionId: f2q[1].id, title: f2q[1].title, userAnswer: q1Ans, correctAnswer: f2q[1].correct, isCorrect: q1Ans === 'Partial<Type>', pointsEarned: q1Ans === 'Partial<Type>' ? 20 : 0, pointsPossible: 20, explanation: f2q[1].exp },
      { questionId: f2q[2].id, title: f2q[2].title, userAnswer: q2Ans, correctAnswer: f2q[2].correct, isCorrect: q2Ans === 'X-Content-Type-Options: nosniff', pointsEarned: q2Ans === 'X-Content-Type-Options: nosniff' ? 20 : 0, pointsPossible: 20, explanation: f2q[2].exp },
      { questionId: f2q[3].id, title: f2q[3].title, userAnswer: q3Ans, correctAnswer: f2q[3].correct, isCorrect: q3Ans.length === 2, pointsEarned: q3Ans.length === 2 ? 30 : 0, pointsPossible: 30, explanation: f2q[3].exp },
      { questionId: f2q[4].id, title: f2q[4].title, userAnswer: q4Ans, correctAnswer: f2q[4].correct, isCorrect: q4Ans === '4.5 : 1', pointsEarned: q4Ans === '4.5 : 1' ? 15 : 0, pointsPossible: 15, explanation: f2q[4].exp },
      { questionId: f2q[5].id, title: f2q[5].title, userAnswer: q5Ans, correctAnswer: f2q[5].correct, isCorrect: q5Ans === '429', pointsEarned: q5Ans === '429' ? 15 : 0, pointsPossible: 15, explanation: f2q[5].exp },
    ];
    const earned = breakdown.reduce((s, b) => s + b.pointsEarned, 0);
    const maxScore = 100;
    const pct = Math.round((earned / maxScore) * 100);

    insertResp.run(respId, form2Id, JSON.stringify(answers), email, 115 + ((i * 23) % 140), `seed_qz_${i}`, daysAgo(i % 10, i % 8));
    insertQuizRes.run(`qr_${nanoid(8)}`, respId, form2Id, earned, maxScore, pct, pct >= 70 ? 1 : 0, JSON.stringify(breakdown));
  }

  // 3. Design Systems Summit Registration (Published, Section breaks + Date/Time/Phone/Dropdown/File, 7 responses)
  const form3Id = `form_evt_${nanoid(6)}`;
  db.prepare(
    `INSERT INTO forms (id, user_id, title, description, slug, status, is_starred, is_trashed, is_quiz, response_count, view_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'published', 0, 0, 0, 7, 11, ?, ?)`
  ).run(
    form3Id,
    userId,
    'Design Systems Summit 2026 — Registration',
    'Reserve your seat for workshops, architectural reviews, and keynote sessions in San Francisco.',
    'design-summit-2026',
    daysAgo(8),
    daysAgo(2)
  );

  db.prepare(
    `INSERT INTO form_settings (
      form_id, theme_name, primary_color, background_color, header_image, font_style, button_style, layout_mode,
      welcome_title, welcome_message, confirmation_message, is_public, passcode, accepting_responses,
      response_limit, start_date, end_date, pass_percentage, show_results_immediately
    ) VALUES (?, 'emerald', '#059669', '#F3FAF7', 'preset:botanical_studio', 'sans', 'pill', 'classic',
      'Reserve your summit badge', 'Complete both sections to confirm workshop allocation.',
      'You are registered! Calendar invite and QR badge details are on the way.', 1, NULL, 1, 250, NULL, NULL, 70, 1)`
  ).run(form3Id);

  const f3q = [
    { id: `q_${nanoid(8)}`, order: 0, type: 'short_answer', title: 'Full Name', desc: 'Printed on your conference badge.', req: 1, opts: { placeholder: 'Jordan Mercer' } },
    { id: `q_${nanoid(8)}`, order: 1, type: 'email', title: 'Email Address', desc: '', req: 1, opts: { placeholder: 'jordan@studio.co' } },
    { id: `q_${nanoid(8)}`, order: 2, type: 'phone', title: 'Mobile Phone (SMS Day-of Updates)', desc: '', req: 0, opts: { placeholder: '+1 (415) 555-0142' } },
    { id: `q_${nanoid(8)}`, order: 3, type: 'section_break', title: 'Workshop & Arrival Preferences', desc: 'Help us coordinate room capacity and catering.', req: 0, opts: {} },
    { id: `q_${nanoid(8)}`, order: 4, type: 'dropdown', title: 'Primary Track Selection', desc: '', req: 1, opts: { choices: ['Design Tokens & Tooling', 'Accessible Component APIs', 'Motion & Micro-interactions', 'Enterprise Governance'] } },
    { id: `q_${nanoid(8)}`, order: 5, type: 'date', title: 'Preferred Workshop Date', desc: '', req: 1, opts: {} },
    { id: `q_${nanoid(8)}`, order: 6, type: 'time', title: 'Estimated Check-in Time', desc: '', req: 0, opts: {} },
    { id: `q_${nanoid(8)}`, order: 7, type: 'number', title: 'Years of Design Systems Experience', desc: '', req: 0, opts: { minNumber: 0, maxNumber: 40, placeholder: '4' } },
    { id: `q_${nanoid(8)}`, order: 8, type: 'file_upload', title: 'Optional: Upload Component Audit or Talk Proposal (PDF/PNG)', desc: '', req: 0, opts: { maxFileSizeMb: 10, allowedFileTypes: ['.pdf', '.png', '.jpg'] } },
  ];
  for (const q of f3q) {
    insertQ.run(q.id, form3Id, q.order, q.type, q.title, q.desc, null, q.req, JSON.stringify(q.opts), 1, null, '');
  }

  const tracks = ['Design Tokens & Tooling', 'Accessible Component APIs', 'Motion & Micro-interactions', 'Enterprise Governance'];
  const names = ['Maya Lin', 'Liam O\'Connor', 'Priya Nair', 'Jonas Weber', 'Chloe Park', 'Mateo Silva', 'Hannah Abbott'];
  for (let i = 0; i < 7; i++) {
    const email = `${names[i].toLowerCase().replace(/[^a-z]/g, '')}@designops.io`;
    const answers = {
      [f3q[0].id]: names[i],
      [f3q[1].id]: email,
      [f3q[2].id]: `+1 415 555 01${10 + i}`,
      [f3q[4].id]: tracks[i % tracks.length],
      [f3q[5].id]: '2026-11-20',
      [f3q[6].id]: `0${8 + (i % 2)}:${i % 2 === 0 ? '30' : '45'}`,
      [f3q[7].id]: 2 + (i % 6),
    };
    insertResp.run(`resp_ev_${nanoid(8)}`, form3Id, JSON.stringify(answers), email, 85 + i * 12, `seed_ev_${i}`, daysAgo(i % 6, i));
  }

  // 4. Draft Form
  const form4Id = `form_drf_${nanoid(6)}`;
  db.prepare(
    `INSERT INTO forms (id, user_id, title, description, slug, status, is_starred, is_trashed, is_quiz, response_count, view_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', 0, 0, 0, 0, 0, ?, ?)`
  ).run(
    form4Id,
    userId,
    'Q4 Engineering Sprint Retrospective',
    'Internal team pulse check before planning the next quarter.',
    `q4-retro-${nanoid(4)}`,
    daysAgo(3),
    daysAgo(0)
  );
  db.prepare(
    `INSERT INTO form_settings (form_id) VALUES (?)`
  ).run(form4Id);
  insertQ.run(`q_${nanoid(8)}`, form4Id, 0, 'rating', 'How smooth was the release cycle this sprint?', '', null, 1, JSON.stringify({ ratingMax: 5, ratingIcon: 'star' }), 1, null, '');
  insertQ.run(`q_${nanoid(8)}`, form4Id, 1, 'paragraph', 'What should we keep doing or refine next sprint?', '', null, 0, JSON.stringify({ placeholder: 'Share candid notes...' }), 1, null, '');
}

export function createStarterFormForUser(db: Database.Database, userId: string) {
  const formId = `form_${nanoid(8)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO forms (id, user_id, title, description, slug, status, is_starred, is_trashed, is_quiz, response_count, view_count, created_at, updated_at)
     VALUES (?, ?, 'Untitled Feedback Form', 'Collect quick feedback or customize questions below.', ?, 'draft', 0, 0, 0, 0, 0, ?, ?)`
  ).run(formId, userId, `form-${nanoid(6)}`, now, now);
  db.prepare(`INSERT INTO form_settings (form_id) VALUES (?)`).run(formId);
  db.prepare(
    `INSERT INTO questions (id, form_id, order_index, type, title, description, image_url, required, options_json, points, correct_answer_json, explanation)
     VALUES (?, ?, 0, 'short_answer', 'What is your name?', '', NULL, 1, '{"placeholder":"Enter your full name"}', 1, NULL, '')`
  ).run(`q_${nanoid(8)}`, formId);
}
