const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' });

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatDateTime(value: string | Date): string {
  return dateTime.format(new Date(value));
}

export function formatDate(value: string | Date): string {
  return date.format(new Date(value));
}

/** "há 3 dias", "em 2 horas" etc. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const diffSeconds = (new Date(value).getTime() - now.getTime()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relative.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'agora mesmo';
}

/**
 * Datas de sessão são informadas e exibidas no horário de Brasília (sem horário de verão
 * desde 2019), o mesmo fuso usado em toda a formatação do site.
 */
const brasiliaInput = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO → valor de `<input type="datetime-local">` no horário de Brasília. */
export function toBrasiliaInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return brasiliaInput.format(date).replace(' ', 'T');
}

/** Valor de `<input type="datetime-local">` (Brasília) → ISO; `undefined` se inválido. */
export function fromBrasiliaInput(value: string): string | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
