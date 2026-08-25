import type { ReactNode } from 'react';

/* ── Ring / donut-style progress SVG used by Efetividade + CS Score cards ── */
export function Ring({ pct, color, label, size = 68 }: { pct: number; color: string; label: string; size?: number }) {
  const cx = 50;
  const cy = 50;
  const R = 40;
  const circ = 2 * Math.PI * R;
  const dash = (Math.max(Math.min(pct, 100), 0) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--color-border)" strokeWidth={13} />
      <circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={13}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--color-foreground)" fontSize={13} fontFamily="var(--font-sans)" fontWeight={800}>
        {label}
      </text>
    </svg>
  );
}

/* ── Horizontal bar-chart list — used across Motivo do Contato, Canal, Tipo, MKT, CS/CX tags... ── */
export type BarItem = {
  key: string;
  label: string;
  value: number;
  pct?: number;
  color?: string;
  onClick?: () => void;
  extra?: ReactNode;
};

export function BarList({ items, wide }: { items: BarItem[]; wide?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="dash-barlist">
      {items.map((it) => (
        <div key={it.key} className={`dash-bar-row${it.onClick ? ' is-clickable' : ''}`} onClick={it.onClick} title={it.label}>
          <div className={`dash-bar-lbl${wide ? ' dash-bar-lbl--wide' : ''}`} title={it.label}>
            {it.label}
          </div>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${((it.value / max) * 100).toFixed(1)}%`, background: it.color || 'var(--color-primary)' }} />
          </div>
          <div className="dash-bar-num">{it.value.toLocaleString('pt-BR')}</div>
          {it.pct !== undefined && <div className="dash-bar-pct">{it.pct.toFixed(0)}%</div>}
          {it.extra}
        </div>
      ))}
      {!items.length && <div className="dash-empty">Nenhum dado disponível.</div>}
    </div>
  );
}

/* ── KPI card ── */
export function KpiCard({
  label,
  value,
  sub,
  color = 'var(--color-foreground)',
  onClick,
  gaugePct,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  onClick?: () => void;
  gaugePct?: number;
}) {
  return (
    <div className={`dash-kpi${onClick ? ' is-clickable' : ''}`} style={{ borderLeftColor: color }} onClick={onClick}>
      {onClick && <div className="dash-kpi-hint">ver →</div>}
      <label>{label}</label>
      <div className="dash-kpi-val" style={{ color }}>
        {value}
      </div>
      {sub && <div className="dash-kpi-sub">{sub}</div>}
      {gaugePct !== undefined && (
        <div className="dash-kpi-gauge">
          <div className="dash-kpi-gauge-fill" style={{ width: `${Math.min(gaugePct, 100).toFixed(1)}%` }} />
        </div>
      )}
    </div>
  );
}

/* ── Vertical bar chart (hours / dates) ── */
export type ColBar = { label: string; value: number; color?: string; title?: string; onClick?: () => void; stacked?: { value: number; color: string }[] };

export function ColumnChart({ cols }: { cols: ColBar[] }) {
  const max = Math.max(...cols.map((c) => (c.stacked ? Math.max(...c.stacked.map((s) => s.value)) : c.value)), 1);
  return (
    <div className="dash-hr-wrap">
      {cols.map((c, i) => (
        <div key={i} className="dash-hr-col" title={c.title} onClick={c.onClick} style={{ cursor: c.onClick ? 'pointer' : 'default' }}>
          <div className="dash-hr-bwrap">
            {c.stacked
              ? c.stacked.map((s, j) => (
                  <div key={j} className="dash-hr-b" style={{ height: `${Math.max((s.value / max) * 100, s.value ? 2 : 0)}%`, background: s.color }} />
                ))
              : (
                  <div className="dash-hr-b" style={{ height: `${Math.max((c.value / max) * 100, 2)}%`, background: c.color || 'var(--color-primary)' }} />
                )}
          </div>
          <div className="dash-hr-lbl">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export function RateBadge({ v }: { v: number }) {
  const cls = v >= 80 ? 'ok' : v >= 50 ? 'warn' : 'bad';
  return <span className={`dash-rate dash-rate--${cls}`}>{v.toFixed(1)}%</span>;
}

export function MiniTrack({ v, color }: { v: number; color: string }) {
  return (
    <span className="dash-mini-track">
      <i style={{ width: `${Math.min(Math.max(v, 0), 100).toFixed(1)}%`, background: color }} />
    </span>
  );
}

export function Card({ title, icon, full, onClick, hint, children }: { title?: string; icon?: ReactNode; full?: boolean; onClick?: () => void; hint?: string; children: ReactNode }) {
  return (
    <div className={`dash-card${full ? ' dash-card--full' : ''}${onClick ? ' is-clickable' : ''}`} onClick={onClick}>
      {onClick && <div className="dash-card-click">{hint || 'ver lista'}</div>}
      {title && (
        <div className="dash-card-title">
          {icon && <div className="dash-card-ic">{icon}</div>}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
