import { useMemo, useState } from 'react';
import { Card, ColumnChart, RateBadge, MiniTrack } from './primitives';
import { pctOf, nf, sumHsm, sortDateKeys, classifyHsmStatus, type HsmAgg, type HsmMsg } from './csvParsing';

const SEM_MOTIVO = '(motivo não informado no relatório)';

export function HsmView({
  agg,
  msgs,
  mode,
}: {
  agg: HsmAgg[];
  msgs: HsmMsg[];
  mode: 'analitico' | 'agregado' | null;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tpl, setTpl] = useState('');
  const [failSel, setFailSel] = useState<number>(-1);

  const templates = useMemo(() => [...new Set(agg.map((r) => r.hsm))].sort(), [agg]);

  const rows = useMemo(
    () =>
      agg.filter((r) => {
        if (tpl && r.hsm !== tpl) return false;
        if (from || to) {
          const d = new Date(r.data.split('/').reverse().join('-'));
          if (isNaN(d.getTime())) return false;
          if (from && d < new Date(from)) return false;
          if (to && d > new Date(to + 'T23:59:59')) return false;
        }
        return true;
      }),
    [agg, tpl, from, to]
  );

  const relevantMsgKeys = useMemo(() => new Set(rows.map((r) => r.data + '||' + r.hsm)), [rows]);
  const relevantMsgs = useMemo(() => msgs.filter((m) => relevantMsgKeys.has(m.data + '||' + m.hsm)), [msgs, relevantMsgKeys]);

  if (!agg.length) {
    return (
      <section className="dash-view">
        <div className="dash-hsm-empty">
          Nenhum relatório HSM carregado ainda.
          <br />
          Suba o CSV para acompanhar Enviadas → Entregues → Lidas e os motivos de não entrega, por data e por template.
        </div>
      </section>
    );
  }

  const T = sumHsm(rows);

  const failCounts = computeFailCounts(mode, relevantMsgs);
  const failEntries = [...failCounts.entries()].sort((a, b) => b[1] - a[1]);
  const failTotal = failEntries.reduce((a, [, v]) => a + v, 0);
  const failMax = failEntries[0]?.[1] || 1;

  const statusCounts = new Map<string, number>();
  relevantMsgs.forEach((m) => statusCounts.set(m.raw, (statusCounts.get(m.raw) || 0) + 1));
  const statusEntries = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);
  const statusTot = relevantMsgs.length || 1;
  const STATUS_COL: Record<string, string> = { respondida: '#6d28d9', lida: '#0f766e', entregue: 'var(--color-success)', falha: 'var(--color-danger)', enviada: '#2563eb', outros: 'var(--color-nodata)' };

  const byTpl = groupHsm(rows, (r) => r.hsm);
  const byDate = groupHsm(rows, (r) => r.data);
  const byTplSorted = [...byTpl.entries()].sort((a, b) => b[1].enviadas - a[1].enviadas);
  const byDateSorted = [...byDate.entries()].sort((a, b) => sortDateKeys(a[0], b[0]));

  const dateChartData = new Map<string, { enviadas: number; entregues: number; lidas: number }>();
  rows.forEach((r) => {
    if (!dateChartData.has(r.data)) dateChartData.set(r.data, { enviadas: 0, entregues: 0, lidas: 0 });
    const d = dateChartData.get(r.data)!;
    d.enviadas += r.enviadas;
    d.entregues += r.entregues;
    d.lidas += r.lidas;
  });
  const dateKeys = [...dateChartData.keys()].sort(sortDateKeys);

  const failReasons = failEntries.slice(0, 20).map(([r]) => r);
  const selDetailRows = failSel >= 0 ? relevantMsgs.filter((m) => m.st === 'falha' && (m.motivo || SEM_MOTIVO) === failReasons[failSel]) : [];

  return (
    <section className="dash-view">
      <div className="dash-view-head">
        <h2>Acompanhamento Mensagens Analíticas HSM</h2>
        <p>Status de entrega das mensagens ativas — Enviadas → Entregues → Lidas, com o motivo de cada não entrega.</p>
      </div>

      <div className="dash-filters-bar">
        <span className="dash-fl">Período</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <span className="dash-fl" style={{ marginLeft: 6 }}>
          Template
        </span>
        <select value={tpl} onChange={(e) => setTpl(e.target.value)}>
          <option value="">Todos os templates</option>
          {templates.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          className="dash-mkt-clear-btn"
          onClick={() => {
            setFrom('');
            setTo('');
            setTpl('');
          }}
        >
          ✕ limpar
        </button>
        <div style={{ flex: 1 }} />
        <span className="dash-fl">
          {mode === 'analitico' ? 'Relatório analítico · 1 linha por mensagem' : 'Relatório agregado · analytics HSM'} · {templates.length} template(s)
        </span>
      </div>

      <div className="dash-kpi-row">
        <StaticKpi label="Enviadas" val={T.enviadas} sub="total de disparos no período" color="var(--color-foreground)" />
        <StaticKpi label="Entregues" val={T.entregues} sub={`${pctOf(T.entregues, T.enviadas).toFixed(1)}% de taxa de entrega`} color="var(--color-success)" />
        <StaticKpi label="Lidas" val={T.lidas} sub={`${pctOf(T.lidas, T.enviadas).toFixed(1)}% do enviado · ${pctOf(T.lidas, T.entregues).toFixed(1)}% do entregue`} color="#0f766e" />
        <StaticKpi label="Não entregues" val={T.falhas} sub={`${pctOf(T.falhas, T.enviadas).toFixed(1)}% de falha`} color="var(--color-danger)" />
        {mode === 'analitico' ? (
          <StaticKpi label="Respondidas" val={T.respondidas} sub={`${pctOf(T.respondidas, T.entregues).toFixed(1)}% do entregue`} color="#6d28d9" />
        ) : (
          <StaticKpi label="Dias com envio" val={new Set(rows.map((r) => r.data)).size} sub="datas presentes no relatório" color="#6d28d9" />
        )}
      </div>

      <div className="dash-grid">
        <Card title="Funil de Entrega" full>
          <div className="dash-funnel">
            {[
              { lbl: 'Enviadas', v: T.enviadas, col: '#2563eb' },
              { lbl: 'Entregues', v: T.entregues, col: 'var(--color-success)' },
              { lbl: 'Lidas', v: T.lidas, col: '#0f766e' },
              ...(T.respondidas ? [{ lbl: 'Respondidas', v: T.respondidas, col: '#6d28d9' }] : []),
              ...(T.falhas ? [{ lbl: 'Não entregues', v: T.falhas, col: 'var(--color-danger)' }] : []),
            ].map((st) => {
              const p = pctOf(st.v, T.enviadas);
              return (
                <div key={st.lbl} className="dash-fn-row">
                  <div className="dash-fn-lbl">{st.lbl}</div>
                  <div className="dash-fn-track">
                    <div className="dash-fn-fill" style={{ width: `${Math.max(Math.min(p, 100), 3).toFixed(1)}%`, background: st.col }}>
                      {nf(st.v)}
                    </div>
                  </div>
                  <div className="dash-fn-pct">
                    <b>{p.toFixed(1)}%</b> do enviado
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Desempenho por Template (HSM)" full>
          <HsmGroupTable entries={byTplSorted} label="Template (HSM)" />
        </Card>

        <Card title="Evolução por Data" full>
          <div className="dash-chart-legend">
            <span className="dash-legend-item">
              <i style={{ background: '#2563eb' }} />
              Enviadas
            </span>
            <span className="dash-legend-item">
              <i style={{ background: 'var(--color-success)' }} />
              Entregues
            </span>
            <span className="dash-legend-item">
              <i style={{ background: '#0f766e' }} />
              Lidas
            </span>
          </div>
          <ColumnChart
            cols={dateKeys.map((k) => {
              const v = dateChartData.get(k)!;
              return {
                label: k.slice(0, 5),
                value: v.enviadas,
                title: `${k} — ${nf(v.enviadas)} enviadas · ${nf(v.entregues)} entregues · ${nf(v.lidas)} lidas`,
                stacked: [
                  { value: v.enviadas, color: '#2563eb' },
                  { value: v.entregues, color: 'var(--color-success)' },
                  { value: v.lidas, color: '#0f766e' },
                ],
              };
            })}
          />
          <div style={{ marginTop: 16 }}>
            <HsmGroupTable entries={byDateSorted} label="Data" />
          </div>
        </Card>

        {failEntries.length > 0 && (
          <Card title="Motivos de Não Entrega" full>
            <div className="dash-hint-box">
              <b>{nf(failTotal)}</b> mensagens não entregues no período. Clique em um motivo para ver as mensagens.
            </div>
            {failEntries.slice(0, 20).map(([reason, v], i) => (
              <div key={reason} className="dash-bar-row is-clickable" onClick={() => setFailSel(failSel === i ? -1 : i)}>
                <div className="dash-bar-lbl dash-bar-lbl--wide" title={reason}>
                  {reason}
                </div>
                <div className="dash-bar-track">
                  <div className="dash-bar-fill" style={{ width: `${((v / failMax) * 100).toFixed(1)}%`, background: 'var(--color-danger)' }} />
                </div>
                <div className="dash-bar-num">{nf(v)}</div>
                <div className="dash-bar-pct">{((v / failTotal) * 100).toFixed(0)}%</div>
              </div>
            ))}
            {failSel >= 0 && (
              <div style={{ marginTop: 12 }}>
                <table className="dash-cxe-table dash-cxe-detail">
                  <thead>
                    <tr>
                      <th className="tleft">Data</th>
                      <th className="tleft">Template</th>
                      <th className="tleft">Destino</th>
                      <th className="tleft">Status</th>
                      <th className="tleft">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selDetailRows.slice(0, 200).map((m, i) => (
                      <tr key={i}>
                        <td className="tleft">{m.data}</td>
                        <td className="tleft">{m.hsm}</td>
                        <td className="tleft mono">{m.fone || '—'}</td>
                        <td className="tleft">{m.raw}</td>
                        <td className="tleft">{m.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {mode === 'analitico' && (
          <Card title="Distribuição por Status da Mensagem" full>
            {statusEntries.map(([raw, v]) => (
              <div key={raw} className="dash-bar-row">
                <div className="dash-bar-lbl" title={raw}>
                  {raw}
                </div>
                <div className="dash-bar-track">
                  <div className="dash-bar-fill" style={{ width: `${((v / statusTot) * 100).toFixed(1)}%`, background: STATUS_COL[classifyHsmStatus(raw)] }} />
                </div>
                <div className="dash-bar-num">{nf(v)}</div>
                <div className="dash-bar-pct">{((v / statusTot) * 100).toFixed(0)}%</div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </section>
  );
}

function computeFailCounts(mode: 'analitico' | 'agregado' | null, msgs: HsmMsg[]) {
  const c = new Map<string, number>();
  if (mode !== 'analitico') return c;
  msgs.forEach((m) => {
    if (m.st !== 'falha') return;
    const k = m.motivo || SEM_MOTIVO;
    c.set(k, (c.get(k) || 0) + 1);
  });
  return c;
}

function groupHsm(rows: HsmAgg[], keyFn: (r: HsmAgg) => string) {
  const g = new Map<string, { enviadas: number; entregues: number; lidas: number; falhas: number }>();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (!g.has(k)) g.set(k, { enviadas: 0, entregues: 0, lidas: 0, falhas: 0 });
    const v = g.get(k)!;
    v.enviadas += r.enviadas;
    v.entregues += r.entregues;
    v.lidas += r.lidas;
    v.falhas += r.falhas;
  });
  return g;
}

function HsmGroupTable({ entries, label }: { entries: [string, { enviadas: number; entregues: number; lidas: number; falhas: number }][]; label: string }) {
  if (!entries.length) return <div className="dash-empty">Nenhum dado para os filtros selecionados.</div>;
  const tot = { enviadas: 0, entregues: 0, lidas: 0, falhas: 0 };
  entries.forEach(([, v]) => {
    tot.enviadas += v.enviadas;
    tot.entregues += v.entregues;
    tot.lidas += v.lidas;
    tot.falhas += v.falhas;
  });
  return (
    <table className="dash-cxe-table">
      <thead>
        <tr>
          <th className="tleft">{label}</th>
          <th>Enviadas</th>
          <th>Entregues</th>
          <th>Taxa entrega</th>
          <th>Lidas</th>
          <th>Taxa leitura</th>
          <th>Não entregues</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => {
          const pe = pctOf(v.entregues, v.enviadas);
          const pl = pctOf(v.lidas, v.enviadas);
          return (
            <tr key={k}>
              <td className="tleft" title={k}>
                {k}
              </td>
              <td>{nf(v.enviadas)}</td>
              <td className="dash-cxe-ok">{nf(v.entregues)}</td>
              <td>
                <MiniTrack v={pe} color="var(--color-success)" />
                <RateBadge v={pe} />
              </td>
              <td style={{ color: '#0f766e' }}>{nf(v.lidas)}</td>
              <td>
                <MiniTrack v={pl} color="#0f766e" />
                <RateBadge v={pl} />
              </td>
              <td className="dash-cxe-nok">{v.falhas ? nf(v.falhas) : '—'}</td>
            </tr>
          );
        })}
        <tr className="dash-cxe-total">
          <td className="tleft">Total</td>
          <td>{nf(tot.enviadas)}</td>
          <td className="dash-cxe-ok">{nf(tot.entregues)}</td>
          <td>
            <RateBadge v={pctOf(tot.entregues, tot.enviadas)} />
          </td>
          <td style={{ color: '#0f766e' }}>{nf(tot.lidas)}</td>
          <td>
            <RateBadge v={pctOf(tot.lidas, tot.enviadas)} />
          </td>
          <td className="dash-cxe-nok">{nf(tot.falhas)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function StaticKpi({ label, val, sub, color }: { label: string; val: number; sub: string; color: string }) {
  return (
    <div className="dash-kpi dash-kpi--static" style={{ borderLeftColor: color }}>
      <label>{label}</label>
      <div className="dash-kpi-val" style={{ color }}>
        {nf(val)}
      </div>
      <div className="dash-kpi-sub">{sub}</div>
    </div>
  );
}
