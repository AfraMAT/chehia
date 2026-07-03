"use client";

import { useEffect, useId } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

/**
 * Styled, keyboard-accessible replacement for window.confirm() on destructive
 * actions. Overlay + card matching the design system; Escape closes, the
 * confirm button is auto-focused, role="dialog" aria-modal for screen readers.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  /** Optional heading; defaults to the body when omitted. */
  title?: string;
  body: string;
  /** Defaults to common.delete (this is the destructive-action dialog). */
  confirmLabel?: string;
  /** Defaults to common.cancel. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const bodyId = useId();
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : bodyId}
        aria-describedby={bodyId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] bg-card border border-line rounded-2xl shadow-xl p-5 flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          {title && (
            <span id={titleId} className="font-display font-extrabold text-lg text-ink">
              {title}
            </span>
          )}
          <span id={bodyId} className="text-[13.5px] text-muted leading-relaxed">
            {body}
          </span>
        </div>
        <div className="flex gap-2.5 justify-end">
          <Button variant="outline" className="min-h-10 text-[14px]" onClick={onCancel}>
            {cancelLabel ?? t.common.cancel}
          </Button>
          <Button variant="danger-ghost" className="min-h-10 text-[14px]" autoFocus onClick={onConfirm}>
            {confirmLabel ?? t.common.delete}
          </Button>
        </div>
      </div>
    </div>
  );
}
