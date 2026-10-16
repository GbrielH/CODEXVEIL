import { describe, expect, it } from 'vitest';
import {
  canEditCharacterPlayState,
  canEditCharacterSheet,
  canPerform,
  canViewCharacter,
  defaultCampaignSettings,
  type CampaignAccessContext,
  type CampaignAction,
  type CharacterAccessInput,
} from './permissions';

const owner = { role: 'gm', isOwner: true } as const;
const coGm = { role: 'gm', isOwner: false } as const;
const player = { role: 'player', isOwner: false } as const;

const active = (membership: CampaignAccessContext['membership']): CampaignAccessContext => ({
  membership,
  status: 'active',
});
const archived = (membership: CampaignAccessContext['membership']): CampaignAccessContext => ({
  membership,
  status: 'archived',
});

describe('canPerform', () => {
  it('nega tudo para quem não participa da campanha', () => {
    const actions: CampaignAction[] = ['campaign.view', 'members.view', 'notes.create'];
    for (const action of actions) {
      expect(canPerform(active(null), action)).toBe(false);
    }
  });

  it('jogador participa, mas não administra', () => {
    expect(canPerform(active(player), 'campaign.view')).toBe(true);
    expect(canPerform(active(player), 'characters.create')).toBe(true);
    expect(canPerform(active(player), 'members.leave')).toBe(true);
    expect(canPerform(active(player), 'campaign.edit')).toBe(false);
    expect(canPerform(active(player), 'members.invite')).toBe(false);
    expect(canPerform(active(player), 'sessions.manage')).toBe(false);
    expect(canPerform(active(player), 'secrets.view')).toBe(false);
  });

  it('co-mestre administra conteúdo, mas não outros mestres nem o arquivamento', () => {
    expect(canPerform(active(coGm), 'campaign.edit')).toBe(true);
    expect(canPerform(active(coGm), 'members.invite')).toBe(true);
    expect(canPerform(active(coGm), 'members.removePlayer')).toBe(true);
    expect(canPerform(active(coGm), 'secrets.view')).toBe(true);
    expect(canPerform(active(coGm), 'members.removeGm')).toBe(false);
    expect(canPerform(active(coGm), 'members.changeRole')).toBe(false);
    expect(canPerform(active(coGm), 'campaign.archive')).toBe(false);
  });

  it('mestre responsável controla a campanha, mas não pode simplesmente sair dela', () => {
    expect(canPerform(active(owner), 'campaign.archive')).toBe(true);
    expect(canPerform(active(owner), 'campaign.delete')).toBe(true);
    expect(canPerform(active(owner), 'members.changeRole')).toBe(true);
    expect(canPerform(active(owner), 'members.leave')).toBe(false);
  });

  it('campanha arquivada é somente leitura, exceto desarquivar e excluir', () => {
    expect(canPerform(archived(owner), 'campaign.view')).toBe(true);
    expect(canPerform(archived(owner), 'secrets.view')).toBe(true);
    expect(canPerform(archived(owner), 'campaign.unarchive')).toBe(true);
    expect(canPerform(archived(owner), 'campaign.delete')).toBe(true);
    expect(canPerform(archived(owner), 'campaign.edit')).toBe(false);
    expect(canPerform(archived(owner), 'sessions.manage')).toBe(false);
    expect(canPerform(archived(player), 'characters.create')).toBe(false);
  });
});

describe('acesso a personagens', () => {
  const base: CharacterAccessInput = {
    isCharacterOwner: false,
    membership: null,
    campaignStatus: 'active',
    settings: defaultCampaignSettings,
  };

  it('o dono sempre vê a própria ficha', () => {
    expect(canViewCharacter({ ...base, isCharacterOwner: true })).toBe(true);
  });

  it('quem não participa da campanha não vê a ficha', () => {
    expect(canViewCharacter(base)).toBe(false);
  });

  it('jogadores veem fichas do grupo somente se a campanha permitir', () => {
    expect(canViewCharacter({ ...base, membership: player })).toBe(true);
    expect(
      canViewCharacter({
        ...base,
        membership: player,
        settings: { ...defaultCampaignSettings, partySheetsVisible: false },
      }),
    ).toBe(false);
    expect(
      canViewCharacter({
        ...base,
        membership: coGm,
        settings: { ...defaultCampaignSettings, partySheetsVisible: false },
      }),
    ).toBe(true);
  });

  it('jogador não edita a ficha de outro jogador', () => {
    expect(canEditCharacterSheet({ ...base, membership: player })).toBe(false);
    expect(canEditCharacterPlayState({ ...base, membership: player })).toBe(false);
  });

  it('mestre edita fichas da campanha; dono edita conforme a regra da campanha', () => {
    expect(canEditCharacterSheet({ ...base, membership: coGm })).toBe(true);
    expect(canEditCharacterSheet({ ...base, isCharacterOwner: true, membership: player })).toBe(
      true,
    );
    const locked = { ...defaultCampaignSettings, playersCanEditSheets: false };
    expect(
      canEditCharacterSheet({
        ...base,
        isCharacterOwner: true,
        membership: player,
        settings: locked,
      }),
    ).toBe(false);
    // Vida, recursos e inventário continuam editáveis pelo dono.
    expect(
      canEditCharacterPlayState({
        ...base,
        isCharacterOwner: true,
        membership: player,
        settings: locked,
      }),
    ).toBe(true);
  });

  it('personagem sem campanha é controlado apenas pelo dono', () => {
    const solo = { ...base, campaignStatus: null };
    expect(canEditCharacterSheet({ ...solo, isCharacterOwner: true })).toBe(true);
    expect(canEditCharacterSheet(solo)).toBe(false);
  });

  it('fichas de campanhas arquivadas ficam somente leitura', () => {
    const frozen = { ...base, campaignStatus: 'archived' as const, isCharacterOwner: true };
    expect(canViewCharacter(frozen)).toBe(true);
    expect(canEditCharacterSheet(frozen)).toBe(false);
    expect(canEditCharacterPlayState({ ...frozen, membership: owner })).toBe(false);
  });
});
