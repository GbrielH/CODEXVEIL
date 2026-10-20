/**
 * Datas das sessões no horário de Brasília (UTC−3, sem horário de verão desde 2019), como
 * no site. No app, a data e a hora são digitadas em campos separados ("dd/mm/aaaa", "hh:mm").
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO → { date: "dd/mm/aaaa", time: "hh:mm" } em Brasília; vazio quando não há data. */
export function isoToBrasilia(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };
  const local = new Date(parsed.getTime() - 3 * 60 * 60 * 1000);
  return {
    date: `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

/**
 * "dd/mm/aaaa" + "hh:mm" (Brasília) → ISO. `null` sem data; `undefined` quando o texto não é
 * uma data válida. Sem hora, usa 19:00 (horário comum de sessão).
 */
export function brasiliaToIso(date: string, time: string): string | null | undefined {
  const dateText = date.trim();
  if (!dateText) return null;
  const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateText);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim() || '19:00');
  if (!dateMatch || !timeMatch) return undefined;
  const [day, month, year] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hours, minutes] = [Number(timeMatch[1]), Number(timeMatch[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59)
    return undefined;
  const value = new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00-03:00`,
  );
  if (
    Number.isNaN(value.getTime()) ||
    isoToBrasilia(value.toISOString()).date !== `${pad(day)}/${pad(month)}/${year}`
  )
    return undefined;
  return value.toISOString();
}

/** "sábado, 18 de outubro, 19:00" (Brasília). */
export function formatSessionDate(iso: string | null): string {
  if (!iso) return 'Sem data';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
