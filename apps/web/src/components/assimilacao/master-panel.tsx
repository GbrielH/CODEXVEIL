'use client';

import { saveAssimilacaoMaster, type AutosaveStatus } from '@codexveil/database';
import {
  REFUGE_ATTRIBUTES,
  REFUGE_RESOURCES,
  refugeLabels,
  type MasterActivation,
  type MasterConflict,
  type MasterObjective,
  type MasterRefuge,
  type MasterThreat,
} from '@codexveil/rpg-systems/assimilacao';
import {
  ArrowLeft,
  Beef,
  Droplets,
  Flag,
  Home,
  Minus,
  Plus,
  Shield,
  Skull,
  Smile,
  Swords,
  Trash2,
  Trees,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SaveStatus } from '@/components/ui/save-status';
import { useConfirm } from '@/components/ui/use-confirm';
import { cx } from '@/lib/cx';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const newId = () => crypto.randomUUID().slice(0, 12);
const inputClass =
  'w-full rounded-md border border-line bg-sunken px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-fg-brand focus:outline-none';

/** Salva a lista depois de uma pausa na digitação (sem botão de salvar, como no site de origem). */
function useAutosave<T>(campaignId: string, key: 'conflicts' | 'refuges', value: T[]) {
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus('pending');
    const timer = window.setTimeout(() => {
      setStatus('saving');
      saveAssimilacaoMaster(getSupabaseBrowserClient(), campaignId, { [key]: value })
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [campaignId, key, value]);
  return status;
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`Diminuir ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="min-w-8 text-center font-display text-lg text-fg">{value}</span>
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function SectionTitle({
  icon,
  title,
  action,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line pb-2">
      <span className="text-fg-accent">{icon}</span>
      <h3 className="flex-1 font-display text-base tracking-wide text-fg uppercase">{title}</h3>
      {action}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded p-1 text-fg-muted hover:bg-hover hover:text-ember-300"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** Lista de ativações (custo em símbolos + efeito), usada no Conflito e em cada Ameaça. */
function Activations({
  items,
  onChange,
}: {
  items: MasterActivation[];
  onChange: (next: MasterActivation[]) => void;
}) {
  const set = (id: string, changes: Partial<MasterActivation>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-2">
          <input
            value={item.cost}
            maxLength={20}
            onChange={(event) => set(item.id, { cost: event.target.value })}
            placeholder="Ex.: 2C"
            aria-label="Custo da ativação"
            className={cx(inputClass, 'w-20 text-center font-display')}
          />
          <textarea
            value={item.effect}
            maxLength={600}
            rows={1}
            onChange={(event) => set(item.id, { effect: event.target.value })}
            placeholder="Efeito da ativação (o que acontece?)"
            aria-label="Efeito da ativação"
            className={cx(inputClass, 'min-h-10 flex-1 resize-y')}
          />
          <RemoveButton
            label="Remover ativação"
            onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}
          />
        </div>
      ))}
      {items.length === 0 ? (
        <p className="text-xs text-fg-muted italic">Nenhuma ativação.</p>
      ) : null}
    </div>
  );
}

function ConflictEditor({
  conflict,
  onChange,
  onBack,
  status,
}: {
  conflict: MasterConflict;
  onChange: (next: MasterConflict) => void;
  onBack: () => void;
  status: AutosaveStatus;
}) {
  const setThreat = (id: string, changes: Partial<MasterThreat>) =>
    onChange({
      ...conflict,
      threats: conflict.threats.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    });
  const setObjective = (id: string, changes: Partial<MasterObjective>) =>
    onChange({
      ...conflict,
      objectives: conflict.objectives.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
          Acervo
        </Button>
        <input
          value={conflict.name}
          maxLength={120}
          onChange={(event) => onChange({ ...conflict, name: event.target.value })}
          aria-label="Nome do conflito"
          className="min-w-0 flex-1 border-b border-line bg-transparent font-display text-xl tracking-wide text-fg uppercase focus:border-fg-brand focus:outline-none"
        />
        <SaveStatus status={status} />
      </div>

      <section className="flex flex-col gap-2">
        <SectionTitle icon={<Flag className="h-4 w-4" />} title="Condicionantes da cena" />
        <textarea
          value={conflict.conditions}
          maxLength={3000}
          rows={3}
          onChange={(event) => onChange({ ...conflict, conditions: event.target.value })}
          placeholder="Ambiente, clima, terreno, o que limita ou favorece os Infectados…"
          className={inputClass}
        />
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle
          icon={<Zap className="h-4 w-4" />}
          title="Ativações do conflito"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                onChange({
                  ...conflict,
                  activations: [...conflict.activations, { id: newId(), cost: '', effect: '' }],
                })
              }
            >
              Adicionar
            </Button>
          }
        />
        <Activations
          items={conflict.activations}
          onChange={(activations) => onChange({ ...conflict, activations })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle
          icon={<Flag className="h-4 w-4" />}
          title="Objetivos (principais e secundários)"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                onChange({
                  ...conflict,
                  objectives: [
                    ...conflict.objectives,
                    { id: newId(), name: '', current: 0, max: 10, notes: '' },
                  ],
                })
              }
            >
              Novo
            </Button>
          }
        />
        {conflict.objectives.length === 0 ? (
          <p className="text-xs text-fg-muted italic">Nenhum objetivo ativo.</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {conflict.objectives.map((objective) => {
            const percent = Math.min(100, (objective.current / objective.max) * 100);
            return (
              <div
                key={objective.id}
                className="flex flex-col gap-2 rounded-lg bg-sunken/60 p-3 ring-1 ring-line"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={objective.name}
                    maxLength={120}
                    onChange={(event) => setObjective(objective.id, { name: event.target.value })}
                    placeholder="Nome do objetivo"
                    aria-label="Nome do objetivo"
                    className={cx(inputClass, 'flex-1 font-medium')}
                  />
                  <RemoveButton
                    label="Remover objetivo"
                    onClick={() =>
                      onChange({
                        ...conflict,
                        objectives: conflict.objectives.filter((item) => item.id !== objective.id),
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas ring-1 ring-line">
                    <div
                      className={cx(
                        'h-full rounded-full transition-[width]',
                        percent >= 100 ? 'bg-verdigris-400' : 'bg-amber-300',
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <Stepper
                    value={objective.current}
                    max={objective.max}
                    label="progresso"
                    onChange={(current) => setObjective(objective.id, { current })}
                  />
                  <span className="text-xs text-fg-muted">de</span>
                  <Stepper
                    value={objective.max}
                    min={1}
                    max={99}
                    label="meta"
                    onChange={(max) =>
                      setObjective(objective.id, { max, current: Math.min(objective.current, max) })
                    }
                  />
                </div>
                <textarea
                  value={objective.notes}
                  maxLength={1000}
                  rows={2}
                  onChange={(event) => setObjective(objective.id, { notes: event.target.value })}
                  placeholder="Recompensas e consequências se falhar…"
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle
          icon={<Skull className="h-4 w-4" />}
          title="Ameaças (inimigos)"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                onChange({
                  ...conflict,
                  threats: [
                    ...conflict.threats,
                    { id: newId(), name: '', notes: '', activations: [] },
                  ],
                })
              }
            >
              Nova
            </Button>
          }
        />
        {conflict.threats.length === 0 ? (
          <p className="text-xs text-fg-muted italic">Nenhuma ameaça no campo de batalha.</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {conflict.threats.map((threat) => (
            <div
              key={threat.id}
              className="flex flex-col gap-2 rounded-lg bg-ember-900/25 p-3 ring-1 ring-ember-400/30"
            >
              <div className="flex items-center gap-2">
                <Skull className="h-4 w-4 text-ember-300" aria-hidden="true" />
                <input
                  value={threat.name}
                  maxLength={120}
                  onChange={(event) => setThreat(threat.id, { name: event.target.value })}
                  placeholder="Nome da ameaça"
                  aria-label="Nome da ameaça"
                  className={cx(inputClass, 'flex-1 font-medium')}
                />
                <RemoveButton
                  label="Remover ameaça"
                  onClick={() =>
                    onChange({
                      ...conflict,
                      threats: conflict.threats.filter((item) => item.id !== threat.id),
                    })
                  }
                />
              </div>
              <textarea
                value={threat.notes}
                maxLength={2000}
                rows={3}
                onChange={(event) => setThreat(threat.id, { notes: event.target.value })}
                placeholder="Estatísticas, vida e anotações da ameaça…"
                className={inputClass}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-fg-secondary uppercase">Ativações</span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    setThreat(threat.id, {
                      activations: [...threat.activations, { id: newId(), cost: '', effect: '' }],
                    })
                  }
                >
                  Ativação
                </Button>
              </div>
              <Activations
                items={threat.activations}
                onChange={(activations) => setThreat(threat.id, { activations })}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const refugeIcons: Record<string, ReactNode> = {
  defesa: <Shield className="h-4 w-4" />,
  moral: <Smile className="h-4 w-4" />,
  mobilidade: <Truck className="h-4 w-4" />,
  beligerancia: <Swords className="h-4 w-4" />,
  agua: <Droplets className="h-4 w-4" />,
  alimento: <Beef className="h-4 w-4" />,
  madeira: <Trees className="h-4 w-4" />,
};

function RefugeCard({
  refuge,
  onChange,
  onRemove,
}: {
  refuge: MasterRefuge;
  onChange: (next: MasterRefuge) => void;
  onRemove: () => void;
}) {
  const full = refuge.capacity > 0 ? Math.min(100, (refuge.population / refuge.capacity) * 100) : 0;
  return (
    <article className="flex flex-col gap-3 rounded-xl bg-gradient-to-br from-verdigris-900/40 to-charcoal-900 p-4 ring-1 ring-verdigris-400/30">
      <div className="flex items-center gap-2">
        <Home className="h-5 w-5 text-verdigris-300" aria-hidden="true" />
        <input
          value={refuge.name}
          maxLength={120}
          onChange={(event) => onChange({ ...refuge, name: event.target.value })}
          aria-label="Nome do refúgio"
          className="min-w-0 flex-1 border-b border-line bg-transparent font-display text-lg tracking-wide text-fg uppercase focus:border-fg-brand focus:outline-none"
        />
        <RemoveButton label="Remover refúgio" onClick={onRemove} />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
          <Users className="h-4 w-4" aria-hidden="true" />
          População
          <Stepper
            value={refuge.population}
            label="população"
            onChange={(population) => onChange({ ...refuge, population })}
          />
          <span className="text-fg-muted">/ capacidade</span>
          <Stepper
            value={refuge.capacity}
            label="capacidade"
            onChange={(capacity) => onChange({ ...refuge, capacity })}
          />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-canvas ring-1 ring-line">
          <div
            className={cx('h-full rounded-full', full >= 100 ? 'bg-ember-400' : 'bg-verdigris-400')}
            style={{ width: `${full}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REFUGE_ATTRIBUTES.map((key) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1 rounded-lg bg-canvas/60 p-2 ring-1 ring-line"
          >
            <span className="flex items-center gap-1 text-xs text-fg-secondary uppercase">
              {refugeIcons[key]}
              {refugeLabels[key]}
            </span>
            <Stepper
              value={refuge[key]}
              label={refugeLabels[key]}
              onChange={(next) => onChange({ ...refuge, [key]: next })}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {REFUGE_RESOURCES.map((key) => (
          <div
            key={key}
            className="flex flex-col items-center gap-1 rounded-lg bg-canvas/60 p-2 ring-1 ring-line"
          >
            <span className="flex items-center gap-1 text-xs text-fg-secondary uppercase">
              {refugeIcons[key]}
              {refugeLabels[key]}
            </span>
            {key === 'agua' && refuge.infiniteWater ? (
              <span className="font-display text-lg text-arcane-300">∞</span>
            ) : (
              <Stepper
                value={refuge[key]}
                label={refugeLabels[key]}
                onChange={(next) => onChange({ ...refuge, [key]: next })}
              />
            )}
            {key === 'agua' ? (
              <label className="flex items-center gap-1 text-[0.7rem] text-fg-muted">
                <input
                  type="checkbox"
                  checked={refuge.infiniteWater}
                  onChange={(event) => onChange({ ...refuge, infiniteWater: event.target.checked })}
                />
                Fonte infinita
              </label>
            ) : null}
          </div>
        ))}
      </div>
      <textarea
        value={refuge.notes}
        maxLength={2000}
        rows={2}
        onChange={(event) => onChange({ ...refuge, notes: event.target.value })}
        placeholder="Anotações do refúgio (líderes, tensões, construções…)"
        className={inputClass}
      />
    </article>
  );
}

/**
 * Aba MASTER do Assimilação: as ferramentas do Assimilador para conduzir a mesa — o acervo de
 * Partituras de Conflito e os Refúgios do grupo. Salva sozinho a cada alteração.
 */
export function AssimilacaoMasterPanel({
  campaignId,
  initialConflicts,
  initialRefuges,
}: {
  campaignId: string;
  initialConflicts: MasterConflict[];
  initialRefuges: MasterRefuge[];
}) {
  const [conflicts, setConflicts] = useState(initialConflicts);
  const [refuges, setRefuges] = useState(initialRefuges);
  const [openId, setOpenId] = useState<string | null>(null);
  const conflictStatus = useAutosave(campaignId, 'conflicts', conflicts);
  const refugeStatus = useAutosave(campaignId, 'refuges', refuges);
  const open = conflicts.find((conflict) => conflict.id === openId) ?? null;
  const [confirm, confirmDialog] = useConfirm();

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
      <Card ornate>
        {open ? (
          <ConflictEditor
            conflict={open}
            status={conflictStatus}
            onBack={() => setOpenId(null)}
            onChange={(next) =>
              setConflicts((current) => current.map((item) => (item.id === next.id ? next : item)))
            }
          />
        ) : (
          <>
            <CardHeader
              icon={<Swords className="h-5 w-5" aria-hidden="true" />}
              title="Partituras de Conflito"
              description="O acervo de conflitos da campanha: condicionantes, ativações, objetivos e ameaças."
              action={
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    const conflict: MasterConflict = {
                      id: newId(),
                      name: 'Novo Conflito',
                      conditions: '',
                      activations: [],
                      threats: [],
                      objectives: [],
                    };
                    setConflicts((current) => [...current, conflict]);
                    setOpenId(conflict.id);
                  }}
                >
                  Criar conflito
                </Button>
              }
            />
            {conflicts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-fg-muted">
                Nenhum conflito no acervo. Crie a primeira partitura de batalha.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {conflicts.map((conflict) => (
                  <li key={conflict.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setOpenId(conflict.id)}
                      className="flex w-full flex-col gap-2 rounded-xl bg-gradient-to-br from-ember-900/50 to-charcoal-900 p-4 text-left ring-1 ring-ember-400/30 transition-transform hover:-translate-y-0.5"
                    >
                      <span className="truncate pr-6 font-display text-base tracking-wide text-fg uppercase">
                        {conflict.name || 'Sem nome'}
                      </span>
                      <span className="flex gap-3 text-xs text-fg-secondary">
                        <span className="flex items-center gap-1">
                          <Skull className="h-3.5 w-3.5 text-ember-300" aria-hidden="true" />
                          {conflict.threats.length} Ameaças
                        </span>
                        <span className="flex items-center gap-1">
                          <Flag className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                          {conflict.objectives.length} Objetivos
                        </span>
                      </span>
                    </button>
                    <span className="absolute top-3 right-3">
                      <RemoveButton
                        label={`Apagar ${conflict.name}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Apagar o conflito?',
                            description: `"${conflict.name}" e tudo o que há nele (ameaças, objetivos e ativações) serão apagados.`,
                            confirmLabel: 'Apagar',
                          });
                          if (ok)
                            setConflicts((current) =>
                              current.filter((item) => item.id !== conflict.id),
                            );
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <SaveStatus status={conflictStatus} className="mt-3" />
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<Home className="h-5 w-5" aria-hidden="true" />}
          title="Refúgios"
          description="Os abrigos do grupo: população, atributos e recursos."
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                setRefuges((current) => [
                  ...current,
                  {
                    id: newId(),
                    name: 'Novo Refúgio',
                    population: 0,
                    capacity: 10,
                    defesa: 0,
                    moral: 0,
                    mobilidade: 0,
                    beligerancia: 0,
                    agua: 0,
                    infiniteWater: false,
                    alimento: 0,
                    madeira: 0,
                    notes: '',
                  },
                ])
              }
            >
              Criar refúgio
            </Button>
          }
        />
        {refuges.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-fg-muted">
            Nenhum refúgio ainda.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {refuges.map((refuge) => (
              <RefugeCard
                key={refuge.id}
                refuge={refuge}
                onChange={(next) =>
                  setRefuges((current) =>
                    current.map((item) => (item.id === next.id ? next : item)),
                  )
                }
                onRemove={async () => {
                  const ok = await confirm({
                    title: 'Apagar o refúgio?',
                    description: `"${refuge.name}" será apagado com a população, os atributos e os recursos.`,
                    confirmLabel: 'Apagar',
                  });
                  if (ok) setRefuges((current) => current.filter((item) => item.id !== refuge.id));
                }}
              />
            ))}
          </div>
        )}
        <SaveStatus status={refugeStatus} className="mt-3" />
      </Card>
    </div>
  );
}
