/**
 * Conserta ordinais estragados na extração de PDFs dos livros importados: o "º" vira "0" e o
 * artigo "o" vira "0" ("atingir o 3º nível" → "atingir 0 30 nível"; "magia de 2º nível" →
 * "magia de 20 nível"). Só mexe antes de "nível" e "círculo" (no singular), onde um número
 * terminado em 0 não faz sentido sem o "º".
 */
export function fixBookOrdinals(text: string): string {
  return text
    .replace(/\b0 ([1-9]|1\d|20)0 (nível|círculo)(?![\p{L}])/gu, 'o $1º $2')
    .replace(/\b([1-9]|1\d|20)0 (nível|círculo)(?![\p{L}])/gu, '$1º $2');
}

/** Aplica `fixBookOrdinals` em todos os textos de um valor (objetos e listas). */
export function fixBookOrdinalsDeep<T>(value: T): T {
  if (typeof value === 'string') return fixBookOrdinals(value) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => fixBookOrdinalsDeep(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fixBookOrdinalsDeep(item)])) as T;
  }
  return value;
}
