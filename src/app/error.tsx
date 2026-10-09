"use client";

import { ErrorState } from "@/components/error-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4">
      <ErrorState reset={reset} digest={error.digest} />
    </main>
  );
}
