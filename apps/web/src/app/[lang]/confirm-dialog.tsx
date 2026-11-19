"use client";

import { useEffect, useRef } from "react";

import { btnQuiet } from "./ui";

/**
 * Asks before a destructive step. A bottom sheet on phones (thumb reach in the
 * gym), a centred dialog on wider screens. Escape, tapping outside and Cancel
 * all cancel; focus starts on Cancel so a stray tap never confirms.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      className="mx-auto mt-auto mb-0 w-full max-w-xl rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-fg backdrop:bg-[#050506]/75 sm:m-auto sm:max-w-sm sm:rounded-3xl"
      onClose={() => {
        if (open) onCancel(); // Escape
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel(); // tap outside
      }}
    >
      <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
      <p id="confirm-title" className="text-lg font-semibold">
        {title}
      </p>
      {body && <p className="mt-1.5 text-sm text-muted">{body}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" autoFocus onClick={onCancel} className={btnQuiet}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-danger-solid px-5 text-base font-semibold text-white transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] cursor-pointer"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
