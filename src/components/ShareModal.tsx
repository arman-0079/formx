import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Lock,
  Mail,
  QrCode,
  X,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import type { Form } from '../types/form';

interface ShareModalProps {
  form: Form;
  onClose: () => void;
  onPublishNow: () => Promise<void>;
  onUpdateSettings: (patch: Partial<Form['settings']>) => void;
}

export function ShareModal({ form, onClose, onPublishNow, onUpdateSettings }: ShareModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'link' | 'qr' | 'embed' | 'access'>('link');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const publicUrl = `${window.location.origin}/f/${form.slug}`;
  const iframeSnippet = `<iframe src="${publicUrl}" width="100%" height="720" frameborder="0" style="border: 1px solid #e4e4e7; border-radius: 12px;"></iframe>`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Please complete: ${form.title}`)}&body=${encodeURIComponent(
    `Hi,\n\nI'd appreciate your input on "${form.title}".\n\nOpen the form here: ${publicUrl}\n`
  )}`;

  const copyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast(`${label} copied to clipboard`, 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast('Could not copy automatically. Please copy manually.', 'error');
    }
  };

  const downloadQrSvg = () => {
    const svg = qrWrapperRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast('QR code downloaded', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Share & Access</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-md">{form.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {form.status !== 'published' && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 flex items-center justify-between gap-3">
            <span className="text-xs text-amber-800 dark:text-amber-300">
              This form is currently a Draft. Publish it so respondents can open the public link.
            </span>
            <button
              type="button"
              onClick={onPublishNow}
              className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md shrink-0 whitespace-nowrap"
            >
              Publish Now
            </button>
          </div>
        )}

        <div className="px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1">
          {[
            { id: 'link', label: 'Link & Email', icon: Globe },
            { id: 'qr', label: 'QR Code', icon: QrCode },
            { id: 'embed', label: 'Embed', icon: Code2 },
            { id: 'access', label: 'Limits & Privacy', icon: Lock },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 space-y-5">
          {tab === 'link' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Public Form URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="flex-1 px-3 py-2 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(publicUrl, 'url', 'Public link')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shrink-0"
                  >
                    {copiedKey === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    title="Open public form in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Share via Email</div>
                  <div className="text-xs text-zinc-500">Launch your email client with a pre-filled invite</div>
                </div>
                <a
                  href={mailtoUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Compose Email Invite
                </a>
              </div>
            </>
          )}

          {tab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <div
                ref={qrWrapperRef}
                className="p-4 bg-white rounded-xl border border-zinc-200 inline-flex items-center justify-center"
              >
                <QRCodeSVG value={publicUrl} size={180} level="M" includeMargin />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Scan to open form</p>
                <p className="text-xs text-zinc-500 font-mono-data">{publicUrl}</p>
              </div>
              <button
                type="button"
                onClick={downloadQrSvg}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Download SVG QR Code
              </button>
            </div>
          )}

          {tab === 'embed' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                HTML iframe Embed Snippet
              </label>
              <textarea
                readOnly
                rows={4}
                value={iframeSnippet}
                className="w-full p-3 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => copyText(iframeSnippet, 'embed', 'Embed code')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {copiedKey === 'embed' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Embed Code
                </button>
              </div>
            </div>
          )}

          {tab === 'access' && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">Accepting Responses</div>
                  <div className="text-xs text-zinc-500">Temporarily pause or resume new submissions</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ acceptingResponses: !form.settings.acceptingResponses })
                  }
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    form.settings.acceptingResponses
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {form.settings.acceptingResponses ? 'Open' : 'Paused'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">Visibility</div>
                  <div className="text-xs text-zinc-500">Require a passcode for private forms</div>
                </div>
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ isPublic: true })}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium ${
                      form.settings.isPublic
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-500'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ isPublic: false })}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium ${
                      !form.settings.isPublic
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-500'
                    }`}
                  >
                    Private
                  </button>
                </div>
              </div>

              {!form.settings.isPublic && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Access Passcode
                  </label>
                  <input
                    type="text"
                    value={form.settings.passcode || ''}
                    onChange={(e) => onUpdateSettings({ passcode: e.target.value })}
                    placeholder="Set a passcode..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Response Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.settings.responseLimit ?? ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        responseLimit: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Unlimited"
                    className="w-full px-2.5 py-1.5 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.settings.startDate ? form.settings.startDate.slice(0, 16) : ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        startDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.settings.endDate ? form.settings.endDate.slice(0, 16) : ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        endDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono-data rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Changes to limits and privacy are saved when you click Save or Publish in the editor.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
