import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const attendancePrimary = 'inline-flex items-center justify-center rounded-xl bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#13497d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#185b9d] disabled:opacity-50 disabled:cursor-not-allowed';
export const attendanceSecondary = 'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#185b9d] disabled:opacity-50 disabled:cursor-not-allowed';
export const attendanceField = 'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185b9d]/30 focus:border-[#185b9d] disabled:opacity-50';
export const attendanceValue = (value: unknown): string => value === null || value === undefined || value === '' ? '—' : String(value);

// The shared confirmation modal cannot contain a form or enforce focus containment.
// This attendance-local dialog follows the approved Hall confirmation proportions.
export function AttendanceDialog({ title, busy, onClose, children, footer }: {
  title: string; busy: boolean; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef({ busy, onClose }); latest.current = { busy, onClose };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const wasInert = root?.hasAttribute('inert');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; root?.setAttribute('inert', '');
    const focusables = (): HTMLElement[] => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]') ?? []) as HTMLElement[];
    (panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? panel.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.busy) { event.preventDefault(); latest.current.onClose(); }
      if (event.key === 'Tab') {
        const items = focusables(), first = items[0], last = items[items.length - 1];
        if (!items.length) { event.preventDefault(); panel.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow;
      if (!wasInert) root?.removeAttribute('inert');
      window.requestAnimationFrame(() => {
        const target = previous?.isConnected && !previous.hasAttribute('disabled') ? previous : document.querySelector<HTMLElement>('#attendance-search, #attendance-hall');
        target?.focus();
      });
    };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-bold text-slate-900">{title}</h2>
          <button type="button" title="Close dialog" aria-label="Close dialog" disabled={busy} className={attendanceSecondary} onClick={onClose}><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 py-4">{children}</div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">{footer}</div>
      </div>
    </div>, document.body,
  );
}
