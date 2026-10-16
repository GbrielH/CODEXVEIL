import type { ContentLicense } from '../types';

/**
 * As regras usadas pelo módulo D&D 5e vêm do SRD 5.2, publicado sob CC-BY-4.0.
 * O Codexveil usa apenas mecânicas (atributos, perícias, tabelas de progressão e nomes
 * de condições); os resumos e textos de interface foram escritos para o projeto.
 * Nenhum conteúdo de livros comerciais é reproduzido. Ver docs/CONTENT_LICENSES.md.
 */
export const srd52License: ContentLicense = {
  work: 'System Reference Document 5.2',
  licenseName: 'Creative Commons Attribution 4.0 International (CC-BY-4.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
  sourceUrl: 'https://www.dndbeyond.com/srd',
  attribution:
    'This work includes material from the System Reference Document 5.2 ("SRD 5.2") by ' +
    'Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is ' +
    'licensed under the Creative Commons Attribution 4.0 International License, available ' +
    'at https://creativecommons.org/licenses/by/4.0/legalcode.',
};
