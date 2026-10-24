/**
 * Conteúdo de livros ativo nas regras de criação e de subida de nível.
 *
 * As regras (`creation/`, `level-up.ts`) consultam o SRD e, além dele, o conteúdo dos livros
 * que o mestre liberou na campanha. Esse conteúdo vem do banco e muda de uma campanha para
 * outra, então fica num registro único que cada tela define antes de usar as regras:
 *
 * - no navegador e no app, `useDnd5eBookContent`/`setActiveDnd5eBookContent` ao abrir a tela;
 * - no servidor, `withDnd5eBookContent(conteúdo, () => ...)`, que restaura o anterior ao terminar.
 *   As regras são síncronas, então duas requisições nunca se misturam dentro dessa chamada.
 *
 * Este módulo só depende de tipos, para que os módulos do SRD possam importá-lo sem ciclos.
 */
import type {
  BackgroundDefinition,
  ClassDefinition,
  FeatDefinition,
  SpeciesDefinition,
  SrdSpell,
  SubclassDefinition,
} from '../srd/types';

export interface BookRef {
  id: string;
  name: string;
}

/** Magia de livro (ou do SRD com listas a mais) no formato das regras. */
export interface BookSpell extends SrdSpell {
  /** Parágrafos da descrição (vazio nas magias do SRD, cujo texto fica no catálogo). */
  description?: readonly string[];
  /** Livro de onde veio; ausente nas magias do SRD. */
  book?: BookRef;
}

export interface BookSubclass extends SubclassDefinition {
  classId: string;
}

export interface Dnd5eBookContent {
  books: readonly BookRef[];
  classes: readonly ClassDefinition[];
  subclasses: readonly BookSubclass[];
  species: readonly SpeciesDefinition[];
  backgrounds: readonly BackgroundDefinition[];
  feats: readonly FeatDefinition[];
  /** Magias dos livros, já sem as que repetem o SRD. */
  spells: readonly BookSpell[];
  /** Listas de classe acrescentadas às magias do SRD (nome original → listas). */
  srdSpellLists: Readonly<Record<string, readonly string[]>>;
}

export const EMPTY_DND5E_BOOK_CONTENT: Dnd5eBookContent = {
  books: [],
  classes: [],
  subclasses: [],
  species: [],
  backgrounds: [],
  feats: [],
  spells: [],
  srdSpellLists: {},
};

let active: Dnd5eBookContent = EMPTY_DND5E_BOOK_CONTENT;

export function activeDnd5eBookContent(): Dnd5eBookContent {
  return active;
}

/** Define o conteúdo usado pelas regras a partir de agora (telas do navegador e do app). */
export function setActiveDnd5eBookContent(content: Dnd5eBookContent | null | undefined): void {
  active = content ?? EMPTY_DND5E_BOOK_CONTENT;
}

/** Executa `run` com o conteúdo indicado e restaura o anterior (uso no servidor). */
export function withDnd5eBookContent<T>(
  content: Dnd5eBookContent | null | undefined,
  run: () => T,
): T {
  const previous = active;
  active = content ?? EMPTY_DND5E_BOOK_CONTENT;
  try {
    return run();
  } finally {
    active = previous;
  }
}
