"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormState } from "./form";
import { buttonClass } from "./ui";

/**
 * Modal built on the native <dialog>: focus is moved inside and restored on
 * close, Esc closes, the page behind is inert. No portal or focus-trap library.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={clsx(
        "m-auto w-[calc(100%-2rem)] rounded-2xl bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-md",
        size === "lg" && "max-w-2xl",
      )}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Fechar" className="-m-1 grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
          {description && (
            <p id={descId} className="mt-2 text-[15px] text-ink-2">
              {description}
            </p>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/**
 * A submit button that asks for confirmation first. Must be inside an
 * <ActionForm>; on confirm it submits the form with its own name/value.
 */
export function ConfirmSubmit({
  title,
  description,
  confirmLabel,
  tone = "primary",
  children,
  name,
  value,
  ...buttonProps
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger" | "accent";
  name?: string;
  value?: string;
} & Omit<ComponentProps<"button">, "type" | "name" | "value">) {
  const [open, setOpen] = useState(false);
  const { pending } = useFormState();
  const hidden = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" {...buttonProps} disabled={pending || buttonProps.disabled} onClick={() => setOpen(true)}>
        {children}
      </button>
      {/* Hidden real submitter so the form receives name/value like a normal button. */}
      <button ref={hidden} type="submit" name={name} value={value} hidden tabIndex={-1} aria-hidden />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size="sm"
        footer={
          <>
            <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              autoFocus
              className={buttonClass(tone === "danger" ? "danger" : tone === "accent" ? "accent" : "primary")}
              onClick={() => {
                setOpen(false);
                hidden.current?.form?.requestSubmit(hidden.current);
              }}
            >
              {confirmLabel}
            </button>
          </>
        }
      />
    </>
  );
}

/** Slide-in panel (mobile navigation, filters). */
export function Drawer({ open, onClose, title, children, side = "left" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: "left" | "right" }) {
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
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={clsx(
        "fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(320px,85vw)] max-w-none bg-surface p-0 shadow-[var(--shadow-pop)] backdrop:bg-ink/40",
        side === "left" ? "left-0" : "right-0 left-auto",
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <span className="font-semibold">{title}</span>
            <button type="button" onClick={onClose} aria-label="Fechar menu" className="grid size-9 place-items-center rounded-full hover:bg-sunken">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Accessible tooltip: shown on hover and keyboard focus, described via aria-describedby. */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group/tt relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-60 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-center text-[12px] leading-snug text-white opacity-0 shadow-[var(--shadow-pop)] transition-opacity group-focus-within/tt:visible group-focus-within/tt:opacity-100 group-hover/tt:visible group-hover/tt:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}

/** On/off control posted as "on" when checked (like a checkbox). */
export function Switch({ name, defaultChecked, label, description }: { name: string; defaultChecked?: boolean; label: string; description?: string }) {
  const [on, setOn] = useState(!!defaultChecked);
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={clsx("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors", on ? "bg-ink" : "bg-line-strong")}
      >
        <span className={clsx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} />
      </button>
      {on && <input type="hidden" name={name} value="on" />}
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="block text-[13px] text-muted">{description}</span>}
      </label>
    </div>
  );
}
