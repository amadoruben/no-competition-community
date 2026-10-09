/**
 * `fetch` with an upper bound on time: aborts after `ms` (as well as on the
 * caller's own signal). Every call to an external service goes through one, so
 * a request can never hang until the platform kills it.
 */
export function timedFetch(ms: number, base?: typeof fetch): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return (base ?? globalThis.fetch)(input, { ...init, signal });
  };
}

/** Upper bound for one call to Supabase Auth (sign-up includes sending the confirmation email). */
export const authTimeoutMs = (env: NodeJS.ProcessEnv = process.env) => Number(env.AUTH_TIMEOUT_MS || 15_000);
