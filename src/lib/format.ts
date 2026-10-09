// Explicit formatting: ICU's pt-PT "short month" falls back to numeric dates.
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const pad = (n: number) => String(n).padStart(2, "0");

export const fmtDay = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const fmtDate = (d: Date) => `${fmtDay(d)} ${d.getFullYear()}`;
export const fmtDateTime = (d: Date) => `${fmtDay(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function timeAgo(d: Date, now = new Date()) {
  const s = Math.round((+now - +d) / 1000);
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  if (days < 30) return `há ${Math.round(days / 7)} sem`;
  return fmtDate(d);
}

/** "Faltam 12 dias", "Termina hoje", "Terminou há 3 dias". */
export function deadlineText(deadline: Date, now = new Date()) {
  const ms = +deadline - +now;
  const days = Math.ceil(ms / 864e5);
  if (ms < 0) {
    const ago = Math.max(1, Math.floor(-ms / 864e5));
    return `Terminou há ${ago} ${ago === 1 ? "dia" : "dias"}`;
  }
  if (ms < 864e5) {
    const h = Math.max(1, Math.floor(ms / 36e5));
    return `Termina em ${h} h`;
  }
  return `Faltam ${days} dias`;
}

export function daysUntil(d: Date, now = new Date()) {
  return Math.ceil((+d - +now) / 864e5);
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(1).replace(".", ","));
