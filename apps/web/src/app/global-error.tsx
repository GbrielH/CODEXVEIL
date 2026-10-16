'use client';

/** Último recurso quando o próprio layout raiz falha (não há estilos globais disponíveis). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#171719', color: '#E7E4DD', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: 480, margin: '20vh auto', padding: 16, textAlign: 'center' }}>
          <h1 style={{ color: '#E4D8BD', fontSize: 24 }}>O Codexveil encontrou um erro</h1>
          <p style={{ color: '#B8B8BC', lineHeight: 1.6 }}>
            Recarregue a página. Se o problema continuar, tente novamente mais tarde.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '12px 20px',
              borderRadius: 6,
              border: '1px solid #853244',
              background: '#571F2B',
              color: '#E4D8BD',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
