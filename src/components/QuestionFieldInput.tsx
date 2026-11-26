import React, { useState } from 'react';
import { Check, FileText, Heart, Star, ThumbsUp, UploadCloud, X } from 'lucide-react';
import type { FormSettings, Question } from '../types/form';

interface QuestionFieldInputProps {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  primaryColor?: string;
  buttonStyle?: FormSettings['buttonStyle'];
  error?: string;
  disabled?: boolean;
  formSlug?: string;
  isPreview?: boolean;
}

export function QuestionFieldInput({
  question,
  value,
  onChange,
  primaryColor = '#4F46E5',
  buttonStyle = 'rounded',
  error,
  disabled = false,
  formSlug,
  isPreview = false,
}: QuestionFieldInputProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const radiusClass =
    buttonStyle === 'pill' ? 'rounded-full' : buttonStyle === 'square' ? 'rounded-none' : 'rounded-lg';

  const inputBase =
    'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 transition-shadow placeholder:text-zinc-400';

  if (question.type === 'section_break') {
    return (
      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Section divider</p>
      </div>
    );
  }

  if (question.type === 'short_answer' || question.type === 'email' || question.type === 'phone') {
    const htmlType = question.type === 'email' ? 'email' : question.type === 'phone' ? 'tel' : 'text';
    return (
      <input
        type={htmlType}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.options.placeholder || 'Your answer...'}
        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        className={`${inputBase} ${radiusClass} ${error ? 'border-rose-500' : ''}`}
      />
    );
  }

  if (question.type === 'number') {
    return (
      <input
        type="number"
        value={value === undefined || value === null ? '' : String(value)}
        disabled={disabled}
        min={question.options.minNumber ?? undefined}
        max={question.options.maxNumber ?? undefined}
        onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value)}
        placeholder={question.options.placeholder || '0'}
        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        className={`${inputBase} ${radiusClass} font-mono-data ${error ? 'border-rose-500' : ''}`}
      />
    );
  }

  if (question.type === 'paragraph') {
    return (
      <textarea
        rows={4}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.options.placeholder || 'Write your detailed response...'}
        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        className={`${inputBase} ${radiusClass} resize-y ${error ? 'border-rose-500' : ''}`}
      />
    );
  }

  if (question.type === 'date') {
    return (
      <input
        type="date"
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        className={`${inputBase} ${radiusClass} max-w-xs font-mono-data ${error ? 'border-rose-500' : ''}`}
      />
    );
  }

  if (question.type === 'time') {
    return (
      <input
        type="time"
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        className={`${inputBase} ${radiusClass} max-w-xs font-mono-data ${error ? 'border-rose-500' : ''}`}
      />
    );
  }

  if (question.type === 'dropdown') {
    const choices = question.options.choices || [];
    return (
      <select
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        className={`${inputBase} ${radiusClass} ${error ? 'border-rose-500' : ''}`}
      >
        <option value="">Select an option...</option>
        {choices.map((choice, idx) => (
          <option key={`${choice}-${idx}`} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    );
  }

  if (question.type === 'multiple_choice') {
    const choices = question.options.choices || [];
    return (
      <div className="space-y-2">
        {choices.map((choice, idx) => {
          const selected = value === choice;
          return (
            <button
              key={`${choice}-${idx}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange(choice)}
              style={
                selected
                  ? { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm border transition-colors ${radiusClass} ${
                selected
                  ? 'text-zinc-900 dark:text-zinc-50 font-medium'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span
                style={selected ? { borderColor: primaryColor, backgroundColor: primaryColor } : undefined}
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  selected ? 'text-white' : 'border-zinc-300 dark:border-zinc-600'
                }`}
              >
                {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              <span className="flex-1">{choice}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === 'checkboxes') {
    const choices = question.options.choices || [];
    const current = Array.isArray(value) ? (value as string[]) : [];
    const toggleChoice = (choice: string) => {
      if (current.includes(choice)) {
        onChange(current.filter((c) => c !== choice));
      } else {
        onChange([...current, choice]);
      }
    };
    return (
      <div className="space-y-2">
        {choices.map((choice, idx) => {
          const checked = current.includes(choice);
          return (
            <button
              key={`${choice}-${idx}`}
              type="button"
              disabled={disabled}
              onClick={() => toggleChoice(choice)}
              style={
                checked
                  ? { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }
                  : undefined
              }
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm border transition-colors ${radiusClass} ${
                checked
                  ? 'text-zinc-900 dark:text-zinc-50 font-medium'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span
                style={checked ? { borderColor: primaryColor, backgroundColor: primaryColor } : undefined}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  checked ? 'text-white' : 'border-zinc-300 dark:border-zinc-600'
                }`}
              >
                {checked && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
              <span className="flex-1">{choice}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === 'linear_scale') {
    const min = question.options.scaleMin ?? 1;
    const max = question.options.scaleMax ?? 5;
    const steps: number[] = [];
    for (let n = min; n <= max; n++) steps.push(n);

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {steps.map((num) => {
            const active = Number(value) === num && value !== '' && value !== undefined && value !== null;
            return (
              <button
                key={num}
                type="button"
                disabled={disabled}
                onClick={() => onChange(num)}
                style={
                  active
                    ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#FFFFFF' }
                    : undefined
                }
                className={`min-w-[40px] h-10 px-3 border text-sm font-mono-data font-medium transition-colors ${radiusClass} ${
                  active
                    ? ''
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
        {(question.options.scaleMinLabel || question.options.scaleMaxLabel) && (
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{question.options.scaleMinLabel}</span>
            <span>{question.options.scaleMaxLabel}</span>
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'rating') {
    const max = question.options.ratingMax ?? 5;
    const iconType = question.options.ratingIcon ?? 'star';
    const currentVal = Number(value || 0);
    const displayVal = hoverRating ?? currentVal;

    const IconComp = iconType === 'heart' ? Heart : iconType === 'thumb' ? ThumbsUp : Star;

    return (
      <div className="flex items-center gap-2">
        {Array.from({ length: max }).map((_, idx) => {
          const ratingVal = idx + 1;
          const filled = ratingVal <= displayVal;
          return (
            <button
              key={ratingVal}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHoverRating(ratingVal)}
              onMouseLeave={() => setHoverRating(null)}
              onClick={() => onChange(ratingVal)}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform active:scale-95"
              aria-label={`Rate ${ratingVal} of ${max}`}
            >
              <IconComp
                className="w-7 h-7 transition-colors"
                style={{
                  color: filled ? primaryColor : undefined,
                  fill: filled ? primaryColor : 'transparent',
                }}
              />
            </button>
          );
        })}
        {currentVal > 0 && (
          <span className="ml-2 text-xs font-mono-data text-zinc-500 dark:text-zinc-400">
            {currentVal} / {max}
          </span>
        )}
      </div>
    );
  }

  if (question.type === 'file_upload') {
    const uploaded = value && typeof value === 'object' ? (value as { url: string; name: string; size?: number }) : null;

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError(null);

      if (isPreview || !formSlug) {
        onChange({ url: '#preview-file', name: file.name, size: file.size });
        return;
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/uploads/response-file/${encodeURIComponent(formSlug)}`, {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed.');
        }
        onChange(data);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="space-y-2">
        {uploaded ? (
          <div className={`flex items-center justify-between gap-3 px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 ${radiusClass}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
              <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{uploaded.name}</span>
              {uploaded.size ? (
                <span className="text-xs font-mono-data text-zinc-500 shrink-0">
                  {(uploaded.size / 1024).toFixed(0)} KB
                </span>
              ) : null}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="p-1 text-zinc-400 hover:text-rose-600"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center gap-1.5 px-4 py-6 border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer transition-colors ${radiusClass}`}
          >
            <UploadCloud className="w-5 h-5 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {uploading ? 'Uploading file...' : 'Click to attach a file'}
            </span>
            <span className="text-xs text-zinc-500">
              PDF, PNG, JPG, DOCX, TXT, CSV up to {question.options.maxFileSizeMb || 10} MB
            </span>
            <input
              type="file"
              className="hidden"
              disabled={disabled || uploading}
              onChange={handleFileSelect}
            />
          </label>
        )}
        {uploadError && <p className="text-xs text-rose-600">{uploadError}</p>}
      </div>
    );
  }

  return null;
}
