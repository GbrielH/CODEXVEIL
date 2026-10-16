/**
 * Papéis e permissões dentro de uma campanha.
 *
 * O papel pertence à participação (campaign_members), nunca ao perfil: o mesmo usuário
 * pode ser mestre em uma campanha e jogador em outra.
 *
 * IMPORTANTE: estas regras servem para a interface decidir o que oferecer ao usuário.
 * A autorização real é aplicada no banco (policies RLS e funções em supabase/migrations),
 * que espelham esta mesma matriz — e os testes de RLS verificam essa correspondência.
 */

export const CAMPAIGN_ROLES = ['gm', 'player'] as const;
export type CampaignRole = (typeof CAMPAIGN_ROLES)[number];

export const campaignRoleLabels: Record<CampaignRole, string> = {
  gm: 'Mestre',
  player: 'Jogador',
};

export const CAMPAIGN_STATUSES = ['active', 'archived'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  active: 'Em andamento',
  archived: 'Arquivada',
};

export interface CampaignMembership {
  role: CampaignRole;
  /** Mestre responsável pela campanha (campaigns.owner_id). Sempre tem papel `gm`. */
  isOwner: boolean;
}

export interface CampaignSettings {
  /** Jogadores podem consultar (somente leitura) as fichas dos demais personagens. */
  partySheetsVisible: boolean;
  /** Jogadores podem editar a construção da própria ficha (vida e recursos seguem editáveis). */
  playersCanEditSheets: boolean;
}

export const defaultCampaignSettings: CampaignSettings = {
  partySheetsVisible: true,
  playersCanEditSheets: true,
};

export interface CampaignAccessContext {
  /** `null` quando o usuário não participa da campanha. */
  membership: CampaignMembership | null;
  status: CampaignStatus;
}

export type CampaignAction =
  | 'campaign.view'
  | 'campaign.edit'
  | 'campaign.archive'
  | 'campaign.unarchive'
  | 'campaign.delete'
  | 'members.view'
  | 'members.invite'
  | 'members.removePlayer'
  | 'members.removeGm'
  | 'members.changeRole'
  | 'members.leave'
  | 'characters.create'
  | 'sessions.manage'
  | 'library.manage'
  | 'encounters.manage'
  | 'secrets.view'
  | 'notes.create';

type Requirement = 'member' | 'gm' | 'owner' | 'nonOwnerMember';

interface ActionRule {
  requires: Requirement;
  /** Ações que alteram dados exigem campanha ativa (arquivadas são somente leitura). */
  requiresActive: boolean;
}

const rules: Record<CampaignAction, ActionRule> = {
  'campaign.view': { requires: 'member', requiresActive: false },
  'campaign.edit': { requires: 'gm', requiresActive: true },
  'campaign.archive': { requires: 'owner', requiresActive: true },
  'campaign.unarchive': { requires: 'owner', requiresActive: false },
  'campaign.delete': { requires: 'owner', requiresActive: false },
  'members.view': { requires: 'member', requiresActive: false },
  'members.invite': { requires: 'gm', requiresActive: true },
  'members.removePlayer': { requires: 'gm', requiresActive: true },
  'members.removeGm': { requires: 'owner', requiresActive: true },
  'members.changeRole': { requires: 'owner', requiresActive: true },
  'members.leave': { requires: 'nonOwnerMember', requiresActive: false },
  'characters.create': { requires: 'member', requiresActive: true },
  'sessions.manage': { requires: 'gm', requiresActive: true },
  'library.manage': { requires: 'gm', requiresActive: true },
  'encounters.manage': { requires: 'gm', requiresActive: true },
  'secrets.view': { requires: 'gm', requiresActive: false },
  'notes.create': { requires: 'member', requiresActive: true },
};

function satisfies(requirement: Requirement, membership: CampaignMembership): boolean {
  switch (requirement) {
    case 'member':
      return true;
    case 'gm':
      return membership.role === 'gm';
    case 'owner':
      return membership.isOwner;
    case 'nonOwnerMember':
      return !membership.isOwner;
  }
}

/** Indica se o contexto permite executar a ação na campanha. */
export function canPerform(context: CampaignAccessContext, action: CampaignAction): boolean {
  const { membership, status } = context;
  if (!membership) return false;
  const rule = rules[action];
  if (rule.requiresActive && status !== 'active') return false;
  return satisfies(rule.requires, membership);
}

export function isGameMaster(membership: CampaignMembership | null): boolean {
  return membership?.role === 'gm';
}

/** Regras de acesso a personagens. */
export interface CharacterAccessInput {
  /** Usuário atual é o dono (jogador) do personagem. */
  isCharacterOwner: boolean;
  /** Participação do usuário na campanha do personagem; `null` se não participa ou sem campanha. */
  membership: CampaignMembership | null;
  /** Status da campanha; `null` para personagens sem campanha. */
  campaignStatus: CampaignStatus | null;
  settings: CampaignSettings;
}

export function canViewCharacter(input: CharacterAccessInput): boolean {
  if (input.isCharacterOwner) return true;
  if (!input.membership) return false;
  return input.membership.role === 'gm' || input.settings.partySheetsVisible;
}

/** Edição da construção da ficha (atributos, perícias, dados básicos). */
export function canEditCharacterSheet(input: CharacterAccessInput): boolean {
  if (input.campaignStatus === 'archived') return false;
  if (input.membership?.role === 'gm') return true;
  if (!input.isCharacterOwner) return false;
  // Sem campanha, o dono controla a ficha livremente.
  if (input.campaignStatus === null) return true;
  return input.settings.playersCanEditSheets;
}

/**
 * Estado de jogo (vida, recursos, condições e inventário). Continua editável pelo dono
 * mesmo quando o mestre bloqueia a edição da construção da ficha.
 */
export function canEditCharacterPlayState(input: CharacterAccessInput): boolean {
  if (input.campaignStatus === 'archived') return false;
  return input.isCharacterOwner || input.membership?.role === 'gm';
}
