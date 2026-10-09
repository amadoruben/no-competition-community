"use client";

import clsx from "clsx";
import { Check, LoaderCircle } from "lucide-react";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass } from "./ui";

const FormCtx = createContext<{ state: ActionState; pending: boolean }>({ state: null, pending: false });

/**
 * Form bound to a server action. Submits without resetting fields (so input is
 * kept when validation fails), exposes pending state and per-field errors.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  onSuccess,
  showMessages = true,
  ...rest
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  showMessages?: boolean;
} & Omit<ComponentProps<"form">, "action" | "onSubmit">) {
  const [state, dispatch, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const lastAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state || state.at === lastAt.current) return;
    lastAt.current = state.at;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    } else if (state.fieldErrors) {
      const first = Object.keys(state.fieldErrors)[0];
      const el = first ? ref.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`) : null;
      el?.focus();
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <FormCtx.Provider value={{ state, pending }}>
      <form
        ref={ref}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (submitter?.name) fd.set(submitter.name, submitter.value);
          startTransition(() => dispatch(fd));
        }}
        {...rest}
      >
        {children}
        {showMessages && <FormMessage />}
      </form>
    </FormCtx.Provider>
  );
}

export function useFormState() {
  return useContext(FormCtx);
}

export function FormMessage({ className }: { className?: string }) {
  const { state } = useFormState();
  if (!state) return null;
  if (state.ok && !state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={clsx(
        "mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
        className,
      )}
    >
      {state.ok && <Check className="size-4" />}
      {state.ok ? state.message : state.error}
    </p>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  pendingLabel,
  ...props
}: ComponentProps<"button"> & { variant?: Parameters<typeof buttonClass>[0]; size?: Parameters<typeof buttonClass>[1]; pendingLabel?: string }) {
  const { pending } = useFormState();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)} {...props}>
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

const control =
  "w-full rounded-xl bg-surface px-3.5 text-[15px] text-ink ring-1 ring-line-strong ring-inset placeholder:text-faint transition-shadow focus:ring-2 focus:ring-ink focus:outline-none aria-[invalid=true]:ring-bad";

export function Field({
  name,
  label,
  hint,
  children,
  className,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { state } = useFormState();
  const error = state?.fieldErrors?.[name];
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={name} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-[13px] text-bad">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-muted">{hint}</p>
      )}
    </div>
  );
}

function useInvalid(name?: string) {
  const { state } = useFormState();
  const err = name ? state?.fieldErrors?.[name] : undefined;
  return err ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  const inv = useInvalid(props.name);
  return <input id={props.name} className={clsx(control, "h-11", className)} {...inv} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  const inv = useInvalid(props.name);
  return <textarea id={props.name} rows={4} className={clsx(control, "py-2.5 leading-relaxed", className)} {...inv} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  const inv = useInvalid(props.name);
  return (
    <select id={props.name} className={clsx(control, "h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23686d76' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...inv} {...props}>
      {children}
    </select>
  );
}

export { control as controlClass };
