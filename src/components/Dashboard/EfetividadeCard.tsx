import { Ring } from './primitives';
import type { Row } from './csvParsing';

export function EfetividadeCard({ rows, onOpenDrawer }: { rows: Row[]; onOpenDrawer: (title: string, pred: (r: Row) => boolean) => void }) {
  const total = rows.length || 1;
  const auto = rows.filter((r) => r.tipo === 'Automático').length;
  const misto = rows.filter((r) => r.tipo === 'Misto').length;
  const humano = rows.filter((r) => r.tipo === 'Humano').length;
  const outros = total - auto - misto - humano;
  const pctAuto = (auto / total) * 100;

  const blocos = [
    { lbl: 'Automático', val: auto, pct: (auto / total) * 100, color: 'var(--color-primary)', text: '#854d0e', fn: (r: Row) => r.tipo === 'Automático' },
    { lbl: 'Misto', val: misto, pct: (misto / total) * 100, color: '#2563eb', text: '#1d4ed8', fn: (r: Row) => r.tipo === 'Misto' },
    { lbl: 'Humano', val: humano, pct: (humano / total) * 100, color: '#6d28d9', text: '#5b21b6', fn: (r: Row) => r.tipo === 'Humano' },
  ];
  if (outros > 0) {
    blocos.push({
      lbl: 'Outros',
      val: outros,
      pct: (outros / total) * 100,
      color: 'var(--color-nodata)',
      text: 'var(--color-muted)',
      fn: (r: Row) => !['Automático', 'Misto', 'Humano'].includes(r.tipo),
    });
  }

  return (
    <div className="dash-efet-compact" onClick={() => onOpenDrawer('Atendimentos Automáticos', (r) => r.tipo === 'Automático')}>
      <div className="dash-efet-left">
        <div className="dash-efet-label">Efetividade Automática</div>
        <div className="dash-efet-pct">{pctAuto.toFixed(1)}%</div>
        <div className="dash-efet-sub">
          {auto} de {rows.length} automáticos
        </div>
      </div>
      <div className="dash-efet-ring">
        <Ring pct={pctAuto} color="var(--color-primary)" label={`${pctAuto.toFixed(0)}%`} />
      </div>
      <div className="dash-efet-breakdown">
        {blocos.map((b) => (
          <div
            key={b.lbl}
            className="dash-efet-bloco"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawer(`Tipo: ${b.lbl}`, b.fn);
            }}
          >
            <div className="dash-eb-val" style={{ color: b.text }}>
              {b.val}
            </div>
            <div className="dash-eb-track">
              <div className="dash-eb-fill" style={{ width: `${Math.min(b.pct, 100).toFixed(1)}%`, background: b.color }} />
            </div>
            <div className="dash-eb-lbl">
              {b.lbl} · {b.pct.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
