'use client';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';

/** Demonstração dos componentes interativos (somente desenvolvimento). */
export function InteractiveDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => toast({ tone: 'success', title: 'Alterações salvas.' })}>
        Toast de sucesso
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({ tone: 'danger', title: 'Falha ao salvar', description: 'A alteração não foi persistida.' })
        }
      >
        Toast de erro
      </Button>
      <ConfirmDialog
        trigger={(open) => (
          <Button variant="danger" onClick={open}>
            Diálogo destrutivo
          </Button>
        )}
        title="Excluir exemplo?"
        description="Demonstração do diálogo de confirmação com digitação obrigatória."
        confirmLabel="Excluir"
        requireText="EXEMPLO"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 600));
          toast({ tone: 'info', title: 'Nada foi excluído: é só uma demonstração.' });
        }}
      />
    </div>
  );
}
