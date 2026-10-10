import type { Instrumentation } from "next";

/**
 * Runs once per server start. Validates configuration and, when
 * DB_AUTO_MIGRATE=1 (default outside production), applies pending migrations.
 * Production applies migrations as an explicit deploy step (npm run db:migrate).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { configIssues } = await import("./server/config");
  const issues = configIssues();
  if (issues.length) {
    // Keep serving: /api/health reports 503 with the variable names and pages
    // show "service unavailable" instead of crashing with an opaque 500.
    const { logger } = await import("./server/logger");
    logger.error("config.invalid", { issues });
    return;
  }
  const auto = process.env.DB_AUTO_MIGRATE ?? (process.env.NODE_ENV === "production" ? "0" : "1");
  if (auto === "1") {
    const { dbHandle, openDatabase } = await import("./db");
    const { runMigrations } = await import("./db/migrate");
    const { migrationDatabaseUrl, previewTargetsProduction } = await import("./lib/supabase-env");
    const blocked = previewTargetsProduction(process.env);
    if (blocked) {
      const { logger } = await import("./server/logger");
      logger.error("migrations.blocked", { reason: blocked });
      return;
    }
    // Prefer a session connection for DDL (explicit, or derived from a Supabase pooler URL).
    const migUrl = migrationDatabaseUrl(process.env);
    const direct = migUrl && migUrl !== process.env.DATABASE_URL ? migUrl : undefined;
    if (direct) {
      const h = openDatabase(direct);
      try {
        await runMigrations(h);
      } finally {
        await h.close();
      }
    } else await runMigrations(dbHandle());
  }
}

/** Server errors go to the structured log (collectable by any host or log drain). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import("./server/logger");
  logger.error("request.error", {
    error: err,
    digest: (err as { digest?: string }).digest,
    path: request.path,
    method: request.method,
    route: context.routePath,
    kind: context.routeType,
  });
};
