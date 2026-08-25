import { KpiRow } from './KpiRow';
import { EfetividadeCard } from './EfetividadeCard';
import { JourneyCard } from './JourneyCard';
import { TagsCard } from './TagsCard';
import { Card, BarList, ColumnChart, type BarItem } from './primitives';
import { PAL, isEncerramentoISA, hasTag, isMktTag, parseDateEntry, fmtSecs, type Row } from './csvParsing';

const MKT_PAL = ['#15803d', '#2563eb', '#be185d', '#c2410c', '#6d28d9', '#b45309', '#0f766e', '#0891b2', '#9333ea', '#dc2626'];

type MktRange = { from: string; to: string };

export function AtendimentoView({
  rows,
  mktRange,
  onMktRangeChange,
  onOpenDrawer,
}: {
  rows: Row[];
  mktRange: MktRange;
  onMktRangeChange: (r: MktRange) => void;
  onOpenDrawer: (title: string, pred: (r: Row) => boolean) => void;
}) {
  const supportCount = rows.filter((r) => r.went_support).length;

  /* ── ISA breakdown ── */
  const isaItems: BarItem[] = [
    { key: 'c1', label: 'Suporte Técnico · Encerramento', pred: (r: Row) => hasTag(r, 'ISA_SUPORTE_TÉCNICO_ENCERRAMENTO'), dot: '#6d28d9' },
    { key: 'c2', label: 'Suporte Técnico · Encerr. Inatividade', pred: (r: Row) => hasTag(r, 'ISA_SUPORTE_TÉCNICO_ENCERRAMENTO_INATIVIDADE'), dot: '#c2410c' },
    { key: 'c3', label: '2ª Via Boletos + Encerramento Geral', pred: (r: Row) => hasTag(r, 'ISA_SEGUNDA_VIA_BOLETOS') && hasTag(r, 'ISA_GERAL_ENCERRAMENTO'), dot: '#15803d' },
    { key: 'c4', label: 'Desbloqueio Confiança + Encerr. Geral', pred: (r: Row) => hasTag(r, 'ISA_DESBLOQUEIO_CONFIANÇA') && hasTag(r, 'ISA_GERAL_ENCERRAMENTO'), dot: '#2563eb' },
  ].map((it: any) => ({
    key: it.key,
    label: it.label,
    value: rows.filter(it.pred).length,
    color: it.dot,
    onClick: () => onOpenDrawer('ISA · ' + it.label, it.pred),
  }));
  const isaTotal = rows.filter(isEncerramentoISA).length;

  /* ── MKT ── */
  const mktRows = rows.filter((r) => {
    if (!r.tag_list.some((t) => isMktTag(t))) return false;
    if (mktRange.from || mktRange.to) {
      const d = parseDateEntry(r.entrada);
      if (!d) return false;
      if (mktRange.from && d < new Date(mktRange.from)) return false;
      if (mktRange.to && d > new Date(mktRange.to + 'T23:59:59')) return false;
    }
    return true;
  });
  const mktTagCounts = new Map<string, number>();
  mktRows.forEach((r) => r.tag_list.filter(isMktTag).forEach((t) => mktTagCounts.set(t, (mktTagCounts.get(t) || 0) + 1)));
  const mktSorted = [...mktTagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const mktItems: BarItem[] = mktSorted.map(([tag, v], i) => ({
    key: tag,
    label: tag,
    value: v,
    pct: mktRows.length ? (v / mktRows.length) * 100 : 0,
    color: MKT_PAL[i % MKT_PAL.length],
    onClick: () => onOpenDrawer(`Tag: ${tag}`, (r) => r.tag_list.includes(tag)),
  }));

  /* ── Donut (status) ── */
  const statusCounts = new Map<string, number>();
  rows.forEach((r) => statusCounts.set(r.status, (statusCounts.get(r.status) || 0) + 1));
  const statusSorted = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);
  const donutTotal = statusSorted.reduce((a, [, v]) => a + v, 0) || 1;

  /* ── Hours ── */
  const hoursMap = new Map<number, number>();
  rows.forEach((r) => hoursMap.set(r.hora, (hoursMap.get(r.hora) || 0) + 1));
  const hours = [...hoursMap.keys()].filter((h) => h >= 0).sort((a, b) => a - b);
  const minH = hours[0];
  const maxH = hours[hours.length - 1];
  const hourCols = [] as { h: number; v: number }[];
  for (let h = minH; h <= maxH && hours.length; h++) hourCols.push({ h, v: hoursMap.get(h) || 0 });

  /* ── Recorrência pills ── */
  const recCounts = new Map<string, number>();
  rows.forEach((r) => {
    if (r.recorrencia === '-') return;
    recCounts.set(r.recorrencia, (recCounts.get(r.recorrencia) || 0) + 1);
  });
  const recSorted = [...recCounts.entries()].sort((a, b) => b[1] - a[1]);
  const recTotal = recSorted.reduce((a, [, v]) => a + v, 0) || 1;
  const recColors = ['#6d28d9', '#2563eb', '#0f766e'];

  /* ── Canal / Tipo ── */
  const canalCounts = new Map<string, number>();
  rows.forEach((r) => canalCounts.set(r.canal, (canalCounts.get(r.canal) || 0) + 1));
  const canalItems: BarItem[] = [...canalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lbl, v], i) => ({ key: lbl, label: lbl, value: v, pct: (v / (rows.length || 1)) * 100, color: PAL[i % PAL.length], onClick: () => onOpenDrawer(lbl, (r) => r.canal === lbl) }));

  const tipoCounts = new Map<string, number>();
  rows.forEach((r) => tipoCounts.set(r.tipo, (tipoCounts.get(r.tipo) || 0) + 1));
  const tipoItems: BarItem[] = [...tipoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lbl, v], i) => ({ key: lbl, label: lbl, value: v, pct: (v / (rows.length || 1)) * 100, color: PAL[i % PAL.length], onClick: () => onOpenDrawer(lbl, (r) => r.tipo === lbl) }));

  /* ── Avg time by status ── */
  const byStatusSecs = new Map<string, number[]>();
  rows.forEach((r) => {
    if (r.atend_secs > 0) {
      if (!byStatusSecs.has(r.status)) byStatusSecs.set(r.status, []);
      byStatusSecs.get(r.status)!.push(r.atend_secs);
    }
  });
  const avgEntries = [...byStatusSecs.entries()]
    .map(([s, arr]) => [s, Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const avgCols = ['#dc2626', '#b45309', '#15803d'];

  /* ── Insights ── */
  const total = rows.length || 1;
  const inativNoturno = rows.filter((r) => r.status === 'Finalizado por inatividade' && r.hora >= 0 && r.hora < 7).length;
  const support = rows.filter((r) => r.went_support).length;
  const semTag = rows.filter((r) => r.sem_tag).length;
  const reincRech = rows.filter((r) => r.recorrencia === 'Reincidente' || r.recorrencia === 'Rechamada').length;
  const autoAtend = rows.filter((r) => r.tipo === 'Automático').length;
  const pctAuto = ((autoAtend / total) * 100).toFixed(1);
  const avgInativArr = byStatusSecs.get('Finalizado por inatividade') || [];
  const avgInativ = avgInativArr.length ? Math.round(avgInativArr.reduce((a, b) => a + b, 0) / avgInativArr.length) : 0;

  const insights = [
    { color: 'var(--color-danger)', head: 'Inatividade Noturna', body: `${inativNoturno} atendimentos 0h–6h finalizados por inatividade. Clientes somem fora do horário comercial.`, fn: (r: Row) => r.status === 'Finalizado por inatividade' && r.hora < 7 },
    { color: '#6d28d9', head: 'Cliques em Suporte', body: `${support} clientes passaram pelo Suporte/Financeiro no bot antes de encerrar.`, fn: (r: Row) => r.went_support },
    { color: 'var(--color-primary)', head: 'Resolução Automática', body: `${autoAtend} atendimentos (${pctAuto}%) com Tipo Automático. Indica efetividade do bot sem intervenção humana.`, fn: (r: Row) => r.tipo === 'Automático' },
    { color: '#2563eb', head: 'Sem Tag: Gap de Análise', body: `${semTag} atendimentos sem tag — o bot não categorizou. Dificulta entender o motivo real do contato.`, fn: (r: Row) => r.sem_tag },
    { color: '#0f766e', head: 'Reincidência Alta', body: `${reincRech} contatos são reincidentes ou rechamadas (${Math.round((reincRech / total) * 100)}%). Problema não resolvido na 1ª interação.`, fn: (r: Row) => r.recorrencia === 'Reincidente' || r.recorrencia === 'Rechamada' },
    { color: '#c2410c', head: 'Custo da Inatividade', body: `Inatividade tem média de ${fmtSecs(avgInativ)} por atendimento — tempo de bot ocupado sem resolução.`, fn: (r: Row) => r.status === 'Finalizado por inatividade' && r.atend_secs > 0 },
  ];

  return (
    <section className="dash-view">
      <div className="dash-view-head">
        <h2>Relatório Analítico de Atendimento</h2>
        <p>Visão operacional da fila: status, tipo, canal, jornada no bot, recorrência e tempo de atendimento.</p>
      </div>

      <div className="dash-info-banner">
        <span>
          <b>{supportCount}</b> clientes passaram por Suporte/Financeiro
        </span>
        <span className="dash-info-sep">·</span>
        <span>Clique em qualquer card para ver a lista detalhada</span>
      </div>

      <KpiRow rows={rows} onOpenDrawer={onOpenDrawer} />

      <div className="dash-two-col">
        <div className="dash-compact-dark-card" onClick={() => onOpenDrawer('Encerramentos ISA (Total)', isEncerramentoISA)}>
          <div className="dash-cdc-header">
            <div className="dash-cdc-label">Encerramentos ISA · Suporte Técnico</div>
            <div className="dash-cdc-total">{isaTotal}</div>
            <div className="dash-cdc-sub">{((isaTotal / total) * 100).toFixed(1)}% dos atendimentos encerrados automaticamente pela ISA</div>
          </div>
          <div className="dash-cdc-list">
            {isaItems.map((it) => (
              <div
                key={it.key}
                className="dash-cdc-item"
                onClick={(e) => {
                  e.stopPropagation();
                  it.onClick?.();
                }}
              >
                <div className="dash-cdc-dot" style={{ background: it.color }} />
                <div className="dash-cdc-item-lbl">{it.label}</div>
                <div className="dash-cdc-item-val">{it.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-compact-dark-card dash-compact-dark-card--green">
          <div className="dash-cdc-header dash-cdc-header--row">
            <div style={{ flex: 1 }}>
              <div className="dash-cdc-label">Marketing &amp; MelhorPlano</div>
              <div className="dash-cdc-total is-clickable" onClick={() => onOpenDrawer('Marketing & MelhorPlano (total)', (r) => r.tag_list.some(isMktTag))}>
                {mktRows.length}
              </div>
              <div className="dash-cdc-sub">
                {total ? ((mktRows.length / total) * 100).toFixed(1) : '0.0'}% dos atendimentos · tags marketing* e MelhorPlano
                {mktRange.from || mktRange.to ? ` · ${mktRange.from || '?'} → ${mktRange.to || '?'}` : ''}
              </div>
            </div>
            <div className="dash-mkt-date-filter">
              <input type="date" value={mktRange.from} onChange={(e) => onMktRangeChange({ ...mktRange, from: e.target.value })} title="Data inicial" />
              <span>→</span>
              <input type="date" value={mktRange.to} onChange={(e) => onMktRangeChange({ ...mktRange, to: e.target.value })} title="Data final" />
              <button className="dash-mkt-clear-btn" onClick={() => onMktRangeChange({ from: '', to: '' })}>
                ✕
              </button>
            </div>
          </div>
          <div className="dash-cdc-list">
            {mktItems.length ? (
              mktItems.map((it) => (
                <div key={it.key} className="dash-cdc-item" onClick={it.onClick}>
                  <div className="dash-cdc-dot" style={{ background: it.color }} />
                  <div className="dash-cdc-item-lbl" title={it.label}>
                    {it.label}
                  </div>
                  <div className="dash-cdc-item-val">{it.value}</div>
                  <div className="dash-cdc-item-pct">{it.pct?.toFixed(0)}%</div>
                </div>
              ))
            ) : (
              <div className="dash-empty">Nenhuma tag encontrada no período.</div>
            )}
          </div>
        </div>
      </div>

      <EfetividadeCard rows={rows} onOpenDrawer={onOpenDrawer} />

      <div className="dash-grid">
        <TagsCard rows={rows} onOpenDrawer={onOpenDrawer} />

        <Card title="Status dos Atendimentos" onClick={() => onOpenDrawer('Todos os Atendimentos', () => true)}>
          <div className="dash-donut-wrap">
            <svg width={120} height={120} viewBox="0 0 120 120">
              <Donut data={statusSorted} total={donutTotal} />
            </svg>
            <div className="dash-dleg">
              {statusSorted.map(([lbl, v], i) => (
                <div
                  key={lbl}
                  className="dash-dleg-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDrawer(lbl, (r) => r.status === lbl);
                  }}
                >
                  <div className="dash-dleg-dot" style={{ background: PAL[i % PAL.length] }} />
                  <span className="dash-dleg-name">{lbl}</span>
                  <span className="dash-dleg-num">{v}</span>
                  <span className="dash-dleg-pct">{((v / donutTotal) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Volume de Entradas por Hora" full hint="clique na barra para filtrar hora">
          <ColumnChart
            cols={hourCols.map((c) => ({
              label: `${c.h}h`,
              value: c.v,
              color: c.v > 100 ? '#1f2937' : c.v > 40 ? 'var(--color-primary)' : c.v > 10 ? '#0f766e' : 'var(--color-success)',
              title: `${c.h}h — ${c.v} atendimentos`,
              onClick: () => onOpenDrawer(`Entradas às ${c.h}h`, (r) => r.hora === c.h),
            }))}
          />
        </Card>

        <JourneyCard rows={rows} onOpenDrawer={onOpenDrawer} />

        <Card title="Perfil de Recorrência" onClick={() => onOpenDrawer('Perfil de Recorrência', (r) => r.recorrencia !== '-')}>
          <div className="dash-pill-list">
            {recSorted.map(([lbl, v], i) => (
              <div
                key={lbl}
                className="dash-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDrawer(lbl, (r) => r.recorrencia === lbl);
                }}
              >
                <div className="dash-pill-ic" style={{ color: recColors[i % recColors.length] }}>
                  ↺
                </div>
                <div>
                  <div className="dash-pill-lbl">{lbl}</div>
                  <div className="dash-pill-v">{v}</div>
                </div>
                <div className="dash-pill-p" style={{ color: recColors[i % recColors.length] }}>
                  {((v / recTotal) * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="dash-card-title">Canal &amp; Tipo de Atendimento</div>
          <div className="dash-subhead">Canal</div>
          <BarList items={canalItems} />
          <div className="dash-subhead" style={{ marginTop: 15 }}>
            Tipo
          </div>
          <BarList items={tipoItems} />
        </Card>

        <Card title="Tempo Médio de Atendimento por Status" full onClick={() => onOpenDrawer('Com Tempo de Atendimento', (r) => r.atend_secs > 0)}>
          <div className="dash-avg-chart">
            {avgEntries.map(([lbl, v], i) => (
              <div
                key={lbl}
                className="dash-avg-row"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDrawer(lbl + ' (com tempo)', (r) => r.status === lbl && r.atend_secs > 0);
                }}
              >
                <div className="dash-avg-lbl">{lbl}</div>
                <div className="dash-avg-track">
                  <div className="dash-avg-fill" style={{ width: `${((v / (avgEntries[0]?.[1] || 1)) * 100).toFixed(1)}%`, background: avgCols[i % avgCols.length] }} />
                </div>
                <div className="dash-avg-val">{fmtSecs(v)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Análise & Insights" full>
          <div className="dash-insight-grid">
            {insights.map((i) => (
              <div key={i.head} className="dash-ins" style={{ borderLeftColor: i.color }} onClick={() => onOpenDrawer(i.head, i.fn)}>
                <div className="dash-ins-head" style={{ color: i.color }}>
                  {i.head}
                </div>
                <div className="dash-ins-body">{i.body}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function Donut({ data, total }: { data: [string, number][]; total: number }) {
  const cx = 60;
  const cy = 60;
  const R = 46;
  const ri = 28;
  let a = -Math.PI / 2;
  return (
    <>
      {data.map(([, v], i) => {
        const sw = (v / total) * 2 * Math.PI;
        const x1 = cx + R * Math.cos(a);
        const y1 = cy + R * Math.sin(a);
        a += sw;
        const x2 = cx + R * Math.cos(a);
        const y2 = cy + R * Math.sin(a);
        const xi1 = cx + ri * Math.cos(a - sw);
        const yi1 = cy + ri * Math.sin(a - sw);
        const xi2 = cx + ri * Math.cos(a);
        const yi2 = cy + ri * Math.sin(a);
        const lg = sw > Math.PI ? 1 : 0;
        return (
          <path
            key={i}
            d={`M${x1},${y1} A${R},${R} 0 ${lg},1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${lg},0 ${xi1},${yi1} Z`}
            fill={PAL[i % PAL.length]}
          />
        );
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--color-foreground)" fontSize={15} fontFamily="var(--font-sans)" fontWeight={800}>
        {total}
      </text>
    </>
  );
}
