import type { ContentLicense } from '../types';

/**
 * As regras usadas pelo módulo D&D 5e vêm do SRD 5.2.1, publicado sob CC-BY-4.0: mecânicas,
 * as condições (regras traduzidas) e, na criação de personagens, classes, espécies,
 * antecedentes, talentos, equipamento e o cabeçalho técnico das magias (pasta `srd/`). Nomes e
 * regras traduzidos, resumos próprios e medidas convertidas são alterações do Codexveil. Nenhum
 * conteúdo de livros comerciais é reproduzido. A atribuição segue o texto exigido na página
 * legal do SRD 5.2.1. Ver docs/CONTENT_LICENSES.md.
 */
export const srd52License: ContentLicense = {
  work: 'System Reference Document 5.2.1',
  licenseName: 'Creative Commons Attribution 4.0 International (CC-BY-4.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
  sourceUrl: 'https://www.dndbeyond.com/srd',
  attribution:
    'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by ' +
    'Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is ' +
    'licensed under the Creative Commons Attribution 4.0 International License, available ' +
    'at https://creativecommons.org/licenses/by/4.0/legalcode.',
};
