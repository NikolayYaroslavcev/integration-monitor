const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const fullFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const rtf = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatFull = (iso: string) => fullFmt.format(new Date(iso));

export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return dayFmt.format(d);
}

export function formatRelative(iso: string, now = Date.now()): string {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return 'только что';
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86_400), 'day');
}

export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
