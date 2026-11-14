import { getCreature, type CodexveilClient } from '@codexveil/database';
import { parseAssimilacaoStatBlock } from '@codexveil/rpg-systems/assimilacao';
import { parseDnd5eStatBlock } from '@codexveil/rpg-systems/dnd5e';
import { parseOrdem2CampaignRules, parseOrdem2StatBlock } from '@codexveil/rpg-systems/ordem2';
import { parseT20StatBlock } from '@codexveil/rpg-systems/tormenta20';
import { AssimilacaoThreatView } from '@/components/library/assimilacao-threat';
import { Ordem2CreatureView } from '@/components/library/ordem2-creature';
import { StatBlockView } from '@/components/library/stat-block-view';
import { T20ThreatView } from '@/components/library/t20-threat';

/**
 * Ficha completa de uma criatura (NPC ou monstro) no sistema da campanha, para telas do mestre
 * (roteiro da sessão). Mostra tudo, não só o que foi revelado aos jogadores. `null` quando a
 * criatura não existe, é de outra campanha ou não tem ficha.
 */
export async function CreatureSheet({
  client,
  campaign,
  creatureId,
}: {
  client: CodexveilClient;
  campaign: { id: string; systemId: string; characterRules: unknown };
  creatureId: string;
}) {
  const creature = await getCreature(client, creatureId, true).catch(() => null);
  if (!creature || creature.campaignId !== campaign.id || !creature.gm) return null;
  const stats = creature.gm.stats;
  // Ficha fora do formato esperado: o roteiro continua mostrando o nome e o link.
  const parse = <T,>(parser: (value: unknown) => T): T | null => {
    try {
      return parser(stats);
    } catch {
      return null;
    }
  };
  switch (campaign.systemId) {
    case 'ordem2': {
      const parsed = parse(parseOrdem2StatBlock);
      return parsed ? (
        <Ordem2CreatureView name={creature.name} stats={parsed} setting={parseOrdem2CampaignRules(campaign.characterRules).setting} />
      ) : null;
    }
    case 'assimilacao': {
      const parsed = parse(parseAssimilacaoStatBlock);
      return parsed ? <AssimilacaoThreatView name={creature.name} stats={parsed} /> : null;
    }
    case 'tormenta20': {
      const parsed = parse(parseT20StatBlock);
      return parsed ? <T20ThreatView name={creature.name} stats={parsed} /> : null;
    }
    case 'dnd5e': {
      const parsed = parse(parseDnd5eStatBlock);
      return parsed ? <StatBlockView name={creature.name} statBlock={parsed} /> : null;
    }
    default:
      return null;
  }
}
