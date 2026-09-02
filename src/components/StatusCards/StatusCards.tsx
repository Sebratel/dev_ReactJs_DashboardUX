import { useState } from 'react';
import './StatusCards.css';

export type StatusCardItem = {
  id: string;
  title: string;
  message: string;
};

type StatusCardsProps = {
  items: StatusCardItem[];
};

// Avisos pontuais (falha parcial de um relatorio, erro de rede durante o
// polling) - NUNCA bloqueiam a tela, so informam. Dispensavel um a um: uma
// vez fechado, um card com o mesmo id nao reaparece nesta sessao mesmo que
// o polling continue reportando o mesmo erro.
export function StatusCards({ items }: StatusCardsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = items.filter((item) => !dismissed.has(item.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => setDismissed((current) => new Set(current).add(id));

  return (
    <div className="status-cards">
      {visible.map((item) => (
        <div key={item.id} className="status-card">
          <div className="status-card__body">
            <p className="status-card__title">{item.title}</p>
            <p className="status-card__message">{item.message}</p>
          </div>
          <button
            type="button"
            className="status-card__dismiss"
            onClick={() => dismiss(item.id)}
            aria-label="Dispensar aviso"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
