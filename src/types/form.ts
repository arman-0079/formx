export type QuestionType =
  | 'short_answer'
  | 'paragraph'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'linear_scale'
  | 'rating'
  | 'date'
  | 'time'
  | 'file_upload'
  | 'email'
  | 'number'
  | 'phone'
  | 'section_break';

export interface QuestionOptions {
  choices?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  ratingMax?: number;
  ratingIcon?: 'star' | 'heart' | 'thumb';
  minNumber?: number | null;
  maxNumber?: number | null;
  maxFileSizeMb?: number;
  allowedFileTypes?: string[];
  placeholder?: string;
}

export interface Question {
  id: string;
  formId: string;
  orderIndex: number;
  type: QuestionType;
  title: string;
  description: string;
  imageUrl: string | null;
  required: boolean;
  options: QuestionOptions;
  points: number;
  correctAnswer: string | string[] | null;
  explanation: string;
}

export interface FormSettings {
  themeName: string;
  primaryColor: string;
  backgroundColor: string;
  headerImage: string | null;
  fontStyle: 'sans' | 'display' | 'serif' | 'mono';
  buttonStyle: 'rounded' | 'pill' | 'square';
  layoutMode: 'classic' | 'conversational';
  welcomeTitle: string;
  welcomeMessage: string;
  confirmationMessage: string;
  isPublic: boolean;
  passcode: string | null;
  acceptingResponses: boolean;
  responseLimit: number | null;
  startDate: string | null;
  endDate: string | null;
  passPercentage: number;
  showResultsImmediately: boolean;
}

export interface Form {
  id: string;
  userId: string;
  title: string;
  description: string;
  slug: string;
  status: 'draft' | 'published';
  isStarred: boolean;
  isTrashed: boolean;
  isQuiz: boolean;
  responseCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  settings: FormSettings;
  questions: Question[];
}

export interface QuizQuestionBreakdown {
  questionId: string;
  title: string;
  userAnswer: unknown;
  correctAnswer: unknown;
  isCorrect: boolean;
  pointsEarned: number;
  pointsPossible: number;
  explanation: string;
}

export interface QuizResult {
  id: string;
  responseId: string;
  earnedScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  breakdown: QuizQuestionBreakdown[];
}

export interface FormResponse {
  id: string;
  formId: string;
  answers: Record<string, unknown>;
  respondentEmail: string | null;
  durationSeconds: number;
  submittedAt: string;
  quizResult: QuizResult | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  createdAt: string;
}

export interface QuestionAnalytics {
  questionId: string;
  title: string;
  type: QuestionType;
  totalAnswered: number;
  distribution: Array<{ label: string; count: number; percentage: number }>;
  averageValue?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  recentTexts?: string[];
  correctRate?: number | null;
}

export interface FormAnalytics {
  totalResponses: number;
  viewCount: number;
  completionRate: number;
  avgDurationSeconds: number;
  trends: Array<{ date: string; count: number }>;
  questionStats: QuestionAnalytics[];
  quizStats?: {
    averageScore: number;
    averagePercentage: number;
    passRate: number;
    highestScore: number;
  } | null;
}
