import type { TabKey } from './types';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'atendimento', label: 'Relatório Analítico de Atendimento' },
  { key: 'hsm', label: 'Acompanhamento Mensagens Analíticas HSM' },
  { key: 'cx', label: 'CX Atendimento Pós-Instalação' },
];

export function TabBar({
  active,
  onChange,
  badges,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  badges: Record<TabKey, string>;
}) {
  return (
    <nav className="dash-tabbar">
      {TABS.map((t) => (
        <button key={t.key} className={`dash-tab${active === t.key ? ' is-active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
          {badges[t.key] && <span className="dash-tab-badge">{badges[t.key]}</span>}
        </button>
      ))}
    </nav>
  );
}
