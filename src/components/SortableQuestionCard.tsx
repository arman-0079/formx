import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckSquare,
  Copy,
  GripVertical,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { QUESTION_TYPE_CATALOG, getQuestionTypeMeta } from './QuestionTypeMeta';
import { QuestionFieldInput } from './QuestionFieldInput';
import { useToast } from '../context/ToastContext';
import { getAuthToken } from '../lib/api';
import type { FormSettings, Question, QuestionType } from '../types/form';

interface SortableQuestionCardProps {
  question: Question;
  index: number;
  isSelected: boolean;
  isQuiz: boolean;
  settings: FormSettings;
  onSelect: () => void;
  onChange: (updated: Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SortableQuestionCard({
  question,
  index,
  isSelected,
  isQuiz,
  settings,
  onSelect,
  onChange,
  onDuplicate,
  onDelete,
}: SortableQuestionCardProps) {
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const typeMeta = getQuestionTypeMeta(question.type);
  const TypeIcon = typeMeta.icon;
  const isSection = question.type === 'section_break';
  const hasChoices =
    question.type === 'multiple_choice' ||
    question.type === 'checkboxes' ||
    question.type === 'dropdown';

  const handleTypeChange = (newType: QuestionType) => {
    const nextOptions = { ...question.options };
    if (
      (newType === 'multiple_choice' || newType === 'checkboxes' || newType === 'dropdown') &&
      (!nextOptions.choices || nextOptions.choices.length === 0)
    ) {
      nextOptions.choices = ['Option 1', 'Option 2'];
    }
    if (newType === 'linear_scale') {
      nextOptions.scaleMin = nextOptions.scaleMin ?? 1;
      nextOptions.scaleMax = nextOptions.scaleMax ?? 5;
    }
    if (newType === 'rating') {
      nextOptions.ratingMax = nextOptions.ratingMax ?? 5;
      nextOptions.ratingIcon = nextOptions.ratingIcon ?? 'star';
    }
    onChange({
      ...question,
      type: newType,
      options: nextOptions,
      correctAnswer: newType === 'checkboxes' ? [] : null,
      required: newType === 'section_break' ? false : question.required,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
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
      if (!res.ok) throw new Error(data.error || 'Image upload failed');
      onChange({ ...question, imageUrl: data.url });
      toast('Question image attached', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to upload image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const updateChoice = (idx: number, text: string) => {
    const next = [...(question.options.choices || [])];
    const oldVal = next[idx];
    next[idx] = text;

    let nextCorrect = question.correctAnswer;
    if (typeof nextCorrect === 'string' && nextCorrect === oldVal) {
      nextCorrect = text;
    } else if (Array.isArray(nextCorrect)) {
      nextCorrect = nextCorrect.map((c) => (c === oldVal ? text : c));
    }

    onChange({
      ...question,
      options: { ...question.options, choices: next },
      correctAnswer: nextCorrect,
    });
  };

  const addChoice = () => {
    const current = question.options.choices || [];
    onChange({
      ...question,
      options: { ...question.options, choices: [...current, `Option ${current.length + 1}`] },
    });
  };

  const removeChoice = (idx: number) => {
    const current = question.options.choices || [];
    if (current.length <= 1) return;
    const removed = current[idx];
    const next = current.filter((_, i) => i !== idx);
    let nextCorrect = question.correctAnswer;
    if (typeof nextCorrect === 'string' && nextCorrect === removed) nextCorrect = null;
    if (Array.isArray(nextCorrect)) nextCorrect = nextCorrect.filter((c) => c !== removed);

    onChange({
      ...question,
      options: { ...question.options, choices: next },
      correctAnswer: nextCorrect,
    });
  };

  const toggleQuizCheckboxCorrect = (choice: string) => {
    const current = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    const next = current.includes(choice)
      ? current.filter((c) => c !== choice)
      : [...current, choice];
    onChange({ ...question, correctAnswer: next });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`rounded-xl border transition-colors bg-white dark:bg-zinc-900 ${
        isSelected
          ? 'border-indigo-500 ring-1 ring-indigo-500/30'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            aria-label="Drag to reorder question"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono-data text-zinc-400 w-5">{index + 1}.</span>
          <div className="relative inline-flex items-center">
            <TypeIcon className="w-3.5 h-3.5 text-zinc-500 mr-1.5" />
            <select
              value={question.type}
              onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
              className="text-xs font-medium bg-transparent text-zinc-700 dark:text-zinc-200 focus:outline-none cursor-pointer pr-2"
            >
              {QUESTION_TYPE_CATALOG.map((item) => (
                <option key={item.type} value={item.type} className="bg-white dark:bg-zinc-900">
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isSection && (
            <>
              <label className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{uploadingImage ? 'Uploading...' : 'Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={handleImageUpload}
                />
              </label>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ ...question, required: !question.required });
                }}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  question.required
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {question.required ? 'Required' : 'Optional'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Duplicate question"
            aria-label="Duplicate question"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            title="Delete question"
            aria-label="Delete question"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <input
            type="text"
            value={question.title}
            onChange={(e) => onChange({ ...question, title: e.target.value })}
            placeholder={isSection ? 'Section heading...' : 'Question title...'}
            className={`w-full bg-transparent text-zinc-900 dark:text-zinc-50 focus:outline-none border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 pb-1 ${
              isSection ? 'text-lg font-semibold' : 'text-base font-medium'
            }`}
          />
          <input
            type="text"
            value={question.description}
            onChange={(e) => onChange({ ...question, description: e.target.value })}
            placeholder="Add helper description (optional)"
            className="w-full bg-transparent text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none border-b border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 pb-1"
          />
        </div>

        {question.imageUrl && (
          <div className="relative inline-block">
            <img
              src={question.imageUrl}
              alt="Question attachment"
              referrerPolicy="no-referrer"
              className="max-h-52 rounded-lg border border-zinc-200 dark:border-zinc-800 object-cover"
            />
            <button
              type="button"
              onClick={() => onChange({ ...question, imageUrl: null })}
              className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-black"
              aria-label="Remove question image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Type-Specific Configuration */}
        {hasChoices && (
          <div className="space-y-2">
            {(question.options.choices || []).map((choice, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-mono-data text-zinc-400 w-5">{idx + 1}.</span>
                <input
                  type="text"
                  value={choice}
                  onChange={(e) => updateChoice(idx, e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
                {(question.options.choices || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChoice(idx)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600"
                    aria-label="Remove option"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addChoice}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Option
            </button>
          </div>
        )}

        {question.type === 'linear_scale' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Min</label>
              <select
                value={question.options.scaleMin ?? 1}
                onChange={(e) =>
                  onChange({ ...question, options: { ...question.options, scaleMin: Number(e.target.value) } })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Max</label>
              <select
                value={question.options.scaleMax ?? 5}
                onChange={(e) =>
                  onChange({ ...question, options: { ...question.options, scaleMax: Number(e.target.value) } })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              >
                {[3, 4, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Min Label</label>
              <input
                type="text"
                value={question.options.scaleMinLabel || ''}
                onChange={(e) =>
                  onChange({ ...question, options: { ...question.options, scaleMinLabel: e.target.value } })
                }
                placeholder="Low"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Max Label</label>
              <input
                type="text"
                value={question.options.scaleMaxLabel || ''}
                onChange={(e) =>
                  onChange({ ...question, options: { ...question.options, scaleMaxLabel: e.target.value } })
                }
                placeholder="High"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
          </div>
        )}

        {question.type === 'rating' && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Scale Max</label>
              <select
                value={question.options.ratingMax ?? 5}
                onChange={(e) =>
                  onChange({ ...question, options: { ...question.options, ratingMax: Number(e.target.value) } })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              >
                {[3, 4, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} Icons
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Icon Style</label>
              <select
                value={question.options.ratingIcon ?? 'star'}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: { ...question.options, ratingIcon: e.target.value as 'star' | 'heart' | 'thumb' },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              >
                <option value="star">Stars</option>
                <option value="heart">Hearts</option>
                <option value="thumb">Thumbs Up</option>
              </select>
            </div>
          </div>
        )}

        {question.type === 'number' && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Min Value (optional)</label>
              <input
                type="number"
                value={question.options.minNumber ?? ''}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: { ...question.options, minNumber: e.target.value === '' ? null : Number(e.target.value) },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Max Value (optional)</label>
              <input
                type="number"
                value={question.options.maxNumber ?? ''}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: { ...question.options, maxNumber: e.target.value === '' ? null : Number(e.target.value) },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
              />
            </div>
          </div>
        )}

        {(question.type === 'short_answer' ||
          question.type === 'paragraph' ||
          question.type === 'email' ||
          question.type === 'phone') && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Placeholder text</label>
            <input
              type="text"
              value={question.options.placeholder || ''}
              onChange={(e) =>
                onChange({ ...question, options: { ...question.options, placeholder: e.target.value } })
              }
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
            />
          </div>
        )}

        {/* Inline Live Field Preview (Disabled preview) */}
        {!isSection && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="text-[11px] font-medium text-zinc-400 mb-2">Respondent Preview</div>
            <div className="pointer-events-none opacity-80">
              <QuestionFieldInput
                question={question}
                value={question.type === 'checkboxes' ? [] : ''}
                onChange={() => {}}
                primaryColor={settings.primaryColor}
                buttonStyle={settings.buttonStyle}
                disabled
              />
            </div>
          </div>
        )}

        {/* Quiz Answer Key Panel */}
        {isQuiz && !isSection && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <CheckSquare className="w-3.5 h-3.5" />
                Quiz Grading Key
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500">Points:</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={question.points}
                  onChange={(e) => onChange({ ...question, points: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-16 px-2 py-1 text-xs font-mono-data rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                />
              </div>
            </div>

            {question.points > 0 && (
              <>
                {question.type === 'multiple_choice' || question.type === 'dropdown' ? (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Correct Answer</label>
                    <select
                      value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                      onChange={(e) => onChange({ ...question, correctAnswer: e.target.value || null })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                    >
                      <option value="">Not graded / select answer</option>
                      {(question.options.choices || []).map((c, idx) => (
                        <option key={idx} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : question.type === 'checkboxes' ? (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Correct Answers (select all)</label>
                    <div className="flex flex-wrap gap-2">
                      {(question.options.choices || []).map((c, idx) => {
                        const selected =
                          Array.isArray(question.correctAnswer) && question.correctAnswer.includes(c);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleQuizCheckboxCorrect(c)}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                              selected
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Expected Answer (case-insensitive)</label>
                    <input
                      type="text"
                      value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                      onChange={(e) => onChange({ ...question, correctAnswer: e.target.value || null })}
                      placeholder="Leave blank if ungraded"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Answer Explanation (shown after submit)</label>
                  <input
                    type="text"
                    value={question.explanation}
                    onChange={(e) => onChange({ ...question, explanation: e.target.value })}
                    placeholder="Explain why this answer is correct..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
