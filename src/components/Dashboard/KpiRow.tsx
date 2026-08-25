import { KpiCard } from './primitives';
import type { Row } from './csvParsing';

export function KpiRow({ rows, onOpenDrawer }: { rows: Row[]; onOpenDrawer: (title: string, pred: (r: Row) => boolean) => void }) {
  const total = rows.length;
  const fin = rows.filter((r) => r.status === 'Finalizado').length;
  const inativ = rows.filter((r) => r.status === 'Finalizado por inatividade').length;
  const auto = rows.filter((r) => r.status === 'Automático').length;
  const pesq = rows.filter((r) => r.status === 'Em pesquisa').length;

  const kpis = [
    { label: 'Total na Fila', val: total, sub: 'todos os contatos', color: 'var(--color-foreground)', fn: () => true, gauge: undefined as number | undefined },
    { label: 'Finalizados', val: fin, sub: `${total ? ((fin / total) * 100).toFixed(1) : '0.0'}% do total`, color: 'var(--color-success)', fn: (r: Row) => r.status === 'Finalizado', gauge: undefined },
    { label: 'Inatividade', val: inativ, sub: 'cliente não respondeu', color: '#b45309', fn: (r: Row) => r.status === 'Finalizado por inatividade', gauge: undefined },
    { label: 'Automático', val: auto, sub: 'resolvidos pelo bot', color: 'var(--color-foreground)', fn: (r: Row) => r.status === 'Automático', gauge: total ? (auto / Math.max(total, 1)) * 100 : 0 },
    { label: 'Em Pesquisa', val: pesq, sub: 'aguardando retorno', color: 'var(--color-danger)', fn: (r: Row) => r.status === 'Em pesquisa', gauge: undefined },
  ];

  return (
    <div className="dash-kpi-row">
      {kpis.map((k) => (
        <KpiCard key={k.label} label={k.label} value={k.val} sub={k.sub} color={k.color} onClick={() => onOpenDrawer(k.label, k.fn)} gaugePct={k.gauge} />
      ))}
    </div>
  );
}
