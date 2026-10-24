// Importa os pacotes de livros na conta do responsável, como ele faria em "Meus livros".
// Usa a chave administrativa só para abrir uma sessão da própria conta (link mágico verificado
// aqui); a importação roda com essa sessão, sob as regras de acesso (RLS) de sempre.
// Uso: SUPABASE_URL=... SERVICE_KEY=... ANON_KEY=... node import-books.mjs <email> <pasta> <arquivo...>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const [email, folder, ...files] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const admin = createClient(url, process.env.SERVICE_KEY, { auth: { persistSession: false } });
const user = createClient(url, process.env.ANON_KEY, { auth: { persistSession: false } });

const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (linkError) throw linkError;
const { data: session, error: otpError } = await user.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (otpError) throw otpError;
const ownerId = session.user.id;
console.log('sessão aberta para', email);
if (files.length === 0) process.exit(0);

for (const file of files) {
  const pack = JSON.parse(readFileSync(`${folder}/${file}`, 'utf8'));
  const systemId = pack.format === 'codexveil.tormenta20.book' ? 'tormenta20' : 'dnd5e';
  const { error: removeError } = await user.from('book_packs').delete().eq('owner_id', ownerId).eq('book_key', pack.book.id);
  if (removeError) throw removeError;
  const { data: created, error } = await user
    .from('book_packs')
    .insert({ system_id: systemId, book_key: pack.book.id, name: pack.book.name, category: pack.book.category, edition: pack.book.edition, origin: pack.book.origin })
    .select('id')
    .single();
  if (error) throw error;
  const counts = {};
  let batch = [];
  let bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    const { error: insertError } = await user.from('book_entries').insert(batch);
    if (insertError) throw insertError;
    batch = [];
    bytes = 0;
  };
  for (const [index, entry] of pack.entries.entries()) {
    const size = JSON.stringify(entry.data ?? {}).length + entry.name.length + 100;
    if (batch.length && (bytes + size > 900_000 || batch.length >= 400)) await flush();
    batch.push({ pack_id: created.id, kind: entry.kind, key: entry.key, name: entry.name, data: entry.data ?? {}, sort_order: index });
    bytes += size;
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  }
  await flush();
  const { error: finishError } = await user.rpc('finish_book_import', { p_pack_id: created.id, p_entry_counts: counts });
  if (finishError) throw finishError;
  console.log('importado', pack.book.name, JSON.stringify(counts));
}
