import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDownCircle,
  Clock,
  Hash,
  ListChecks,
  Mail,
  Minus,
  Phone,
  SlidersHorizontal,
  Star,
  Type,
  UploadCloud,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import type { Question, QuestionType } from '../types/form';

export interface QuestionTypeDefinition {
  type: QuestionType;
  label: string;
  category: 'text' | 'choice' | 'scale' | 'data' | 'layout';
  icon: typeof Type;
}

export const QUESTION_TYPE_CATALOG: QuestionTypeDefinition[] = [
  { type: 'short_answer', label: 'Short Answer', category: 'text', icon: Type },
  { type: 'paragraph', label: 'Paragraph', category: 'text', icon: AlignLeft },
  { type: 'multiple_choice', label: 'Multiple Choice', category: 'choice', icon: ListChecks },
  { type: 'checkboxes', label: 'Checkboxes', category: 'choice', icon: CheckSquare },
  { type: 'dropdown', label: 'Dropdown', category: 'choice', icon: ChevronDownCircle },
  { type: 'linear_scale', label: 'Linear Scale', category: 'scale', icon: SlidersHorizontal },
  { type: 'rating', label: 'Rating', category: 'scale', icon: Star },
  { type: 'date', label: 'Date', category: 'data', icon: Calendar },
  { type: 'time', label: 'Time', category: 'data', icon: Clock },
  { type: 'file_upload', label: 'File Upload', category: 'data', icon: UploadCloud },
  { type: 'email', label: 'Email', category: 'data', icon: Mail },
  { type: 'number', label: 'Number', category: 'data', icon: Hash },
  { type: 'phone', label: 'Phone Number', category: 'data', icon: Phone },
  { type: 'section_break', label: 'Section Break', category: 'layout', icon: Minus },
];

export function getQuestionTypeMeta(type: QuestionType): QuestionTypeDefinition {
  return QUESTION_TYPE_CATALOG.find((item) => item.type === type) || QUESTION_TYPE_CATALOG[0];
}

export function createDefaultQuestion(type: QuestionType, formId: string, orderIndex: number): Question {
  const id = `q_${nanoid(8)}`;
  switch (type) {
    case 'short_answer':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Short answer question',
        description: '',
        imageUrl: null,
        required: false,
        options: { placeholder: 'Type your answer...' },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'paragraph':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Long-form response',
        description: '',
        imageUrl: null,
        required: false,
        options: { placeholder: 'Share detailed feedback...' },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'multiple_choice':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Select one option',
        description: '',
        imageUrl: null,
        required: false,
        options: { choices: ['Option 1', 'Option 2', 'Option 3'] },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'checkboxes':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Select all that apply',
        description: '',
        imageUrl: null,
        required: false,
        options: { choices: ['Choice A', 'Choice B', 'Choice C'] },
        points: 1,
        correctAnswer: [],
        explanation: '',
      };
    case 'dropdown':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Choose from dropdown',
        description: '',
        imageUrl: null,
        required: false,
        options: { choices: ['First choice', 'Second choice', 'Third choice'] },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'linear_scale':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Rate on a linear scale',
        description: '',
        imageUrl: null,
        required: false,
        options: { scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Low', scaleMaxLabel: 'High' },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'rating':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Rate your experience',
        description: '',
        imageUrl: null,
        required: false,
        options: { ratingMax: 5, ratingIcon: 'star' },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'date':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Select a date',
        description: '',
        imageUrl: null,
        required: false,
        options: {},
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'time':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Select a time',
        description: '',
        imageUrl: null,
        required: false,
        options: {},
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'file_upload':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Upload supporting file',
        description: 'Accepted: PDF, PNG, JPG, DOCX up to 10 MB.',
        imageUrl: null,
        required: false,
        options: { maxFileSizeMb: 10, allowedFileTypes: ['.pdf', '.png', '.jpg', '.docx'] },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'email':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Email address',
        description: '',
        imageUrl: null,
        required: false,
        options: { placeholder: 'name@company.com' },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'number':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Numeric value',
        description: '',
        imageUrl: null,
        required: false,
        options: { minNumber: null, maxNumber: null, placeholder: '0' },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'phone':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'Phone number',
        description: '',
        imageUrl: null,
        required: false,
        options: { placeholder: '+1 (555) 000-0000' },
        points: 1,
        correctAnswer: null,
        explanation: '',
      };
    case 'section_break':
      return {
        id,
        formId,
        orderIndex,
        type,
        title: 'New Section',
        description: 'Optional instructions for this section.',
        imageUrl: null,
        required: false,
        options: {},
        points: 0,
        correctAnswer: null,
        explanation: '',
      };
  }
}
