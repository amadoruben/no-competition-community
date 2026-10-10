"use client";

import clsx from "clsx";
import { Check, LoaderCircle } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { toast } from "./toaster";
import { buttonClass } from "./ui";

const FormCtx = createContext<{ state: ActionState; pending: boolean }>({ state: null, pending: false });

/** After this, the form says the server is slow; after DEADLINE it stops waiting and says so. */
const SLOW_MS = 8_000;
const DEADLINE_MS = 45_000;
const NO_ANSWER =
  "O servidor não respondeu a tempo. O pedido pode ainda estar a ser processado: aguarde um minuto e verifique (por exemplo, o seu email) antes de tentar de novo.";
const NETWORK = "Não foi possível contactar o servidor. Verifique a ligação à internet e tente novamente.";
const SERVER =
  "O serviço está temporariamente indisponível e não foi possível confirmar a operação. Recarregue a página para verificar antes de tentar de novo.";

class Deadline extends Error {}

/**
 * The server action's result, or a displayable error when it fails in transit
 * (network down), fails on the server (crash, platform timeout) or takes longer than
 * DEADLINE_MS. Never leaves the form pending forever. Next.js navigation
 * signals (redirect, notFound) are rethrown untouched.
 */
async function settle(run: Promise<ActionState>): Promise<ActionState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([run, new Promise<never>((_, rej) => (timer = setTimeout(() => rej(new Deadline()), DEADLINE_MS)))]);
  } catch (e) {
    unstable_rethrow(e);
    // fetch() rejects with a TypeError when the request never reached the server.
    return { ok: false, error: e instanceof Deadline ? NO_ANSWER : e instanceof TypeError ? NETWORK : SERVER, at: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}

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
  // Toast from inside the action so it fires even if this form unmounts when
  // the page re-renders into its next state (e.g. "enrol" → "enrolled").
  const [state, dispatch, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await settle(action(prev, fd));
    if (r?.ok && r.message) toast(r.message);
    return r;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  const lastAt = useRef<number | undefined>(undefined);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [pending]);

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
        {pending && slow && (
          <p role="status" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            Está a demorar mais do que o habitual. Aguarde, por favor — não feche esta página.
          </p>
        )}
        {showMessages && <FormMessage />}
      </form>
    </FormCtx.Provider>
  );
}

export function useFormState() {
  return useContext(FormCtx);
}

export function FormMessage({ className, showSuccess }: { className?: string; showSuccess?: boolean }) {
  const { state } = useFormState();
  if (!state || (state.ok && !(showSuccess && state.message))) return null;
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
  "w-full rounded-xl bg-surface px-3.5 text-[15px] text-ink ring-1 ring-line-strong ring-inset placeholder:text-muted transition-shadow focus:ring-2 focus:ring-ink focus:outline-none aria-[invalid=true]:ring-bad";

export function Field({
  name,
  id = name,
  label,
  hint,
  children,
  className,
}: {
  name: string;
  /** DOM id of the control, when the same field name appears twice on a page. */
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { state } = useFormState();
  const error = state?.fieldErrors?.[name];
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-bad">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-muted">{hint}</p>
      )}
    </div>
  );
}

function useInvalid(name?: string, id = name) {
  const { state } = useFormState();
  const err = name ? state?.fieldErrors?.[name] : undefined;
  return err ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  const inv = useInvalid(props.name, props.id);
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
