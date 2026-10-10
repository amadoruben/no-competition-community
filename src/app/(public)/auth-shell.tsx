import { Brand } from "@/components/brand";

export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Brand />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-ink-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="pointer-events-none absolute -right-32 -bottom-32 size-[560px] rounded-full border-[32px] border-volt/15" aria-hidden />
        <div className="relative flex h-full flex-col justify-center p-14 text-white">{aside}</div>
      </div>
    </div>
  );
}
