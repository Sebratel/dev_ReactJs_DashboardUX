import { useMemo, useState } from 'react';
import { Card, Ring, RateBadge } from './primitives';
import {
  isCsOk,
  isCsNok,
  csDateKey,
  parseDateEntry,
  inDateRange,
  pctOf,
  nf,
  envCxEnriched,
  fmtTsCurto,
  type Row,
  type HsmAgg,
  type HsmMsg,
  type EnvCxRow,
} from './csvParsing';

type CsRange = { from: string; to: string };

function isCxSurveyHsm(name: string): boolean {
  return /cscx|cs[_ -]?cx|72\s?hrs?/i.test(name || '');
}

export function CxView({
  rows,
  hsmAgg,
  hsmLoaded,
  hsmByProto,
  envcxRows,
  envcxLoaded,
  envcxSemCabecalho,
  csRange,
  onCsRangeChange,
  onOpenDrawer,
}: {
  rows: Row[];
  hsmAgg: HsmAgg[];
  hsmLoaded: boolean;
  hsmByProto: Map<string, HsmMsg>;
  envcxRows: EnvCxRow[];
  envcxLoaded: boolean;
  envcxSemCabecalho: boolean;
  csRange: CsRange;
  onCsRangeChange: (r: CsRange) => void;
  onOpenDrawer: (title: string, pred: (r: Row) => boolean) => void;
}) {
  const [cxOnly, setCxOnly] = useState(true);
  const [busca, setBusca] = useState('');
  const [cidadeSel, setCidadeSel] = useState('');
  const [resultado, setResultado] = useState('');
  const [errSel, setErrSel] = useState('');

  const csInRange = (r: Row) => inDateRange(parseDateEntry(r.entrada), csRange.from, csRange.to);

  const ok = rows.filter((r) => isCsOk(r) && csInRange(r)).length;
  const nok = rows.filter((r) => isCsNok(r) && csInRange(r)).length;
  const totalCx = ok + nok;
  const score = totalCx ? (ok / totalCx) * 100 : 0;
  const ringCol = !totalCx ? 'var(--color-nodata)' : score >= 80 ? 'var(--color-success)' : score >= 50 ? '#b45309' : 'var(--color-danger)';

  const byDate = new Map<string, { ok: number; nok: number; sortKey: number }>();
  rows.forEach((r) => {
    if (!(isCsOk(r) || isCsNok(r)) || !csInRange(r)) return;
    const d = parseDateEntry(r.entrada);
    const key = csDateKey(r);
    if (!byDate.has(key)) byDate.set(key, { ok: 0, nok: 0, sortKey: d ? d.getTime() : 0 });
    const v = byDate.get(key)!;
    if (isCsOk(r)) v.ok++;
    if (isCsNok(r)) v.nok++;
  });
  const segs = [...byDate.entries()].sort((a, b) => a[1].sortKey - b[1].sortKey);

  /* cx-kpis */
  const cxEnvioAgg = useMemo(() => {
    const env = new Map<string, { enviadas: number; entregues: number; lidas: number }>();
    if (!hsmLoaded) return env;
    hsmAgg.forEach((r) => {
      if (cxOnly && !isCxSurveyHsm(r.hsm)) return;
      if (!inDateRange(parseDateEntry(r.data), csRange.from, csRange.to)) return;
      if (!env.has(r.data)) env.set(r.data, { enviadas: 0, entregues: 0, lidas: 0 });
      const v = env.get(r.data)!;
      v.enviadas += r.enviadas;
      v.entregues += r.entregues;
      v.lidas += r.lidas;
    });
    return env;
  }, [hsmAgg, hsmLoaded, cxOnly, csRange]);

  const envTotals = [...cxEnvioAgg.values()].reduce(
    (a, e) => {
      a.enviadas += e.enviadas;
      a.entregues += e.entregues;
      a.lidas += e.lidas;
      return a;
    },
    { enviadas: 0, entregues: 0, lidas: 0 }
  );
  const base = envTotals.entregues || envTotals.enviadas;
  const taxa = base ? (totalCx / base) * 100 : null;
  const scoreColor = !totalCx ? 'var(--color-muted)' : score >= 80 ? 'var(--color-success)' : score >= 50 ? '#b45309' : 'var(--color-danger)';

  /* cx-tags */
  const cxTagCounts = new Map<string, number>();
  rows.forEach((r) => {
    if (!csInRange(r)) return;
    r.tag_list.forEach((t) => {
      if (/^cs[_ -]|cx/i.test(t)) cxTagCounts.set(t, (cxTagCounts.get(t) || 0) + 1);
    });
  });
  const cxTagEntries = [...cxTagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const cxTagMax = cxTagEntries[0]?.[1] || 1;

  /* cx-envio-table (by date) */
  const respByDate = new Map<string, { ok: number; nok: number }>();
  rows.forEach((r) => {
    if (!(isCsOk(r) || isCsNok(r)) || !csInRange(r)) return;
    const key = csDateKey(r);
    if (!respByDate.has(key)) respByDate.set(key, { ok: 0, nok: 0 });
    const v = respByDate.get(key)!;
    if (isCsOk(r)) v.ok++;
    if (isCsNok(r)) v.nok++;
  });
  const envioKeys = [...new Set([...cxEnvioAgg.keys(), ...respByDate.keys()])].sort((a, b) => (parseDateEntry(a)?.getTime() || 0) - (parseDateEntry(b)?.getTime() || 0));

  /* envcx enriched */
  const enriched = useMemo(() => envCxEnriched(envcxRows, rows, hsmByProto, csRange.from, csRange.to), [envcxRows, rows, hsmByProto, csRange]);

  const gerados = enriched.filter((d) => d.gerado);
  const erros = enriched.filter((d) => !d.gerado);
  const respOk = enriched.filter((d) => d.res === 'ok' && d.primeiro).length;
  const respNok = enriched.filter((d) => d.res === 'nok' && d.primeiro).length;
  const respostas = respOk + respNok;
  const cidades = new Set(enriched.map((d) => d.cidade)).size;
  const envScore = respostas ? (respOk / respostas) * 100 : 0;

  const cidadeOptions = [...new Set(enriched.map((d) => d.cidade))].sort();

  const detalheFiltrado = enriched.filter((d) => {
    if (cidadeSel && d.cidade !== cidadeSel) return false;
    if (resultado === 'gerado' && !d.gerado) return false;
    if (resultado === 'nao' && d.gerado) return false;
    if (resultado === 'ok' && d.res !== 'ok') return false;
    if (resultado === 'nok' && d.res !== 'nok') return false;
    if (resultado === 'semresp' && (d.res === 'ok' || d.res === 'nok')) return false;
    const q = busca.toLowerCase();
    if (q && ![d.nome, d.telefone, d.protocolo, d.cod, d.contrato, d.bairro, d.cidade, d.msg].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  const errGroups = new Map<string, { n: number; codigos: Set<string> }>();
  erros.forEach((d) => {
    const k = d.motivoErro || d.msg;
    if (!errGroups.has(k)) errGroups.set(k, { n: 0, codigos: new Set() });
    const g = errGroups.get(k)!;
    g.n++;
    if (d.codigoErro) g.codigos.add(d.codigoErro);
  });
  const errEntries = [...errGroups.entries()].sort((a, b) => b[1].n - a[1].n);
  const errMax = errEntries[0]?.[1].n || 1;
  const errosFiltrados = errSel ? erros.filter((d) => (d.motivoErro || d.msg) === errSel) : erros;

  const comTs = enriched.filter((d) => d.ts);
  const ini = comTs[0]?.ts || null;
  const fim = comTs[comTs.length - 1]?.ts || null;
  const localizados = enriched.filter((d) => d.atend);
  const viasMap = new Map<string, number>();
  localizados.forEach((d) => viasMap.set(d.via, (viasMap.get(d.via) || 0) + 1));
  const viaTxt = [...viasMap.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => `${nf(n)} por ${v}`).join(' · ') || 'nenhum';

  return (
    <section className="dash-view">
      <div className="dash-view-head">
        <h2>CX Atendimento Pós-Instalação</h2>
        <p>
          Pesquisa de satisfação disparada após a instalação, baseada nas tags <b>CS_CX_72HRS_OK</b> e <b>CS_CX_72HRS_NOK</b>, cruzada com os envios de HSM.
        </p>
        <div className="dash-mkt-date-filter">
          <input type="date" value={csRange.from} onChange={(e) => onCsRangeChange({ ...csRange, from: e.target.value })} />
          <span>→</span>
          <input type="date" value={csRange.to} onChange={(e) => onCsRangeChange({ ...csRange, to: e.target.value })} />
          <button className="dash-mkt-clear-btn" onClick={() => onCsRangeChange({ from: '', to: '' })}>
            ✕
          </button>
        </div>
      </div>

      <div className="dash-kpi-row">
        <StaticKpiClickable label="Avaliações CX" val={nf(totalCx)} sub="respostas OK + NOK" color="var(--color-foreground)" onClick={() => onOpenDrawer('CX · Todas as avaliações', (r) => (isCsOk(r) || isCsNok(r)) && csInRange(r))} />
        <StaticKpiClickable label="CX Score" val={totalCx ? score.toFixed(1) + '%' : '–'} sub="satisfação pós-instalação" color={scoreColor} />
        <StaticKpiClickable label="CX OK" val={nf(ok)} sub={totalCx ? `${pctOf(ok, totalCx).toFixed(1)}% das respostas` : 'sem respostas no período'} color="var(--color-success)" onClick={() => onOpenDrawer('CX OK', (r) => isCsOk(r) && csInRange(r))} />
        <StaticKpiClickable label="CX NOK" val={nf(nok)} sub={totalCx ? `${pctOf(nok, totalCx).toFixed(1)}% das respostas` : 'sem respostas no período'} color="var(--color-danger)" onClick={() => onOpenDrawer('CX NOK', (r) => isCsNok(r) && csInRange(r))} />
        <StaticKpiClickable label="Taxa de Resposta" val={taxa === null ? '–' : taxa.toFixed(1) + '%'} sub={taxa === null ? 'suba o relatório HSM' : `${nf(totalCx)} respostas / ${nf(base)} ${envTotals.entregues ? 'entregues' : 'enviadas'}`} color="#0f766e" />
      </div>

      <div className="dash-efet-compact dash-efet-compact--col" onClick={() => onOpenDrawer('Customer Success · CX (OK + NOK)', (r) => (isCsOk(r) || isCsNok(r)) && csInRange(r))}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="dash-efet-label">Customer Success · CX Score</div>
          <div style={{ flex: 1 }} />
          <div className="dash-card-click" style={{ position: 'static' }}>
            ver lista
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="dash-efet-left">
            <div className="dash-efet-pct">{totalCx ? score.toFixed(1) + '%' : '–'}</div>
            <div className="dash-efet-sub">{totalCx ? `${ok} OK · ${nok} NOK · ${totalCx} avaliações de CX` : 'Nenhuma avaliação de CX no período'}</div>
          </div>
          <div className="dash-efet-ring">
            <Ring pct={score} color={ringCol} label={totalCx ? score.toFixed(0) + '%' : '–'} />
          </div>
          <div className="dash-efet-breakdown">
            {[
              { lbl: 'CX OK', val: ok, pct: totalCx ? (ok / totalCx) * 100 : 0, color: 'var(--color-success)' },
              { lbl: 'CX NOK', val: nok, pct: totalCx ? (nok / totalCx) * 100 : 0, color: 'var(--color-danger)' },
            ].map((b) => (
              <div key={b.lbl} className="dash-efet-bloco">
                <div className="dash-eb-val" style={{ color: b.color }}>
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
        {segs.length > 0 && (
          <div className="dash-cs-segment">
            <div className="dash-cs-seg-title">
              Distribuição por data
              <span className="dash-legend-item">
                <i style={{ background: 'var(--color-success)' }} />
                OK
              </span>
              <span className="dash-legend-item">
                <i style={{ background: 'var(--color-danger)' }} />
                NOK
              </span>
            </div>
            {segs.map(([date, s]) => {
              const tot = s.ok + s.nok;
              const okPct = tot ? (s.ok / tot) * 100 : 0;
              const nokPct = tot ? (s.nok / tot) * 100 : 0;
              return (
                <div
                  key={date}
                  className="dash-cs-seg-row"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDrawer('Customer Success · ' + date, (r) => (isCsOk(r) || isCsNok(r)) && csDateKey(r) === date);
                  }}
                >
                  <div className="dash-cs-seg-date">{date.slice(0, 5)}</div>
                  <div className="dash-cs-seg-track">
                    <div className="dash-cs-seg-ok" style={{ width: `${okPct}%` }} />
                    <div className="dash-cs-seg-nok" style={{ width: `${nokPct}%` }} />
                  </div>
                  <div className="dash-cs-seg-num">
                    <b>{s.ok}</b> OK · <b>{s.nok}</b> NOK
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="dash-grid" style={{ marginTop: 11 }}>
        <Card title="Envios da Pesquisa × Respostas" full>
          <div className="dash-cx-envio-bar">
            <label className="dash-cx-envio-toggle">
              <input type="checkbox" checked={cxOnly} onChange={(e) => setCxOnly(e.target.checked)} /> Somente pesquisa CX (CSCX 72h)
            </label>
          </div>
          {!hsmLoaded && (
            <div className="dash-hint-box">Nenhum relatório HSM carregado — as colunas Enviadas / Entregues / Lidas ficam vazias.</div>
          )}
          {envioKeys.length ? (
            <table className="dash-cxe-table">
              <thead>
                <tr>
                  <th className="tleft">Data</th>
                  <th>Enviadas</th>
                  <th>Entregues</th>
                  <th>Lidas</th>
                  <th>OK</th>
                  <th>NOK</th>
                  <th>Respostas</th>
                  <th>Taxa resposta</th>
                </tr>
              </thead>
              <tbody>
                {envioKeys.map((k) => {
                  const e = cxEnvioAgg.get(k) || { enviadas: 0, entregues: 0, lidas: 0 };
                  const o = respByDate.get(k) || { ok: 0, nok: 0 };
                  const resp = o.ok + o.nok;
                  const b = e.entregues || e.enviadas;
                  return (
                    <tr key={k}>
                      <td className="tleft">{k.slice(0, 5)}</td>
                      <td>{e.enviadas || '—'}</td>
                      <td>{e.entregues || '—'}</td>
                      <td>{e.lidas || '—'}</td>
                      <td className="dash-cxe-ok">{o.ok || '—'}</td>
                      <td className="dash-cxe-nok">{o.nok || '—'}</td>
                      <td>{resp || '—'}</td>
                      <td>{b ? <RateBadge v={pctOf(resp, b)} /> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="dash-empty">Nenhum dado para o período selecionado.</div>
          )}
        </Card>

        <Card title="Tags de Pós-Instalação (CS / CX)" full>
          {cxTagEntries.length ? (
            cxTagEntries.map(([t, v], i) => {
              const col = /nok/i.test(t) ? 'var(--color-danger)' : /_ok\b|ok$/i.test(t) ? 'var(--color-success)' : ['#2563eb', '#6d28d9', '#c2410c'][i % 3];
              return (
                <div key={t} className="dash-bar-row is-clickable" onClick={() => onOpenDrawer('Tag: ' + t, (r) => r.tag_list.includes(t) && csInRange(r))}>
                  <div className="dash-bar-lbl" title={t}>
                    {t}
                  </div>
                  <div className="dash-bar-track">
                    <div className="dash-bar-fill" style={{ width: `${((v / cxTagMax) * 100).toFixed(1)}%`, background: col }} />
                  </div>
                  <div className="dash-bar-num">{nf(v)}</div>
                  <div className="dash-bar-pct">{((v / (rows.length || 1)) * 100).toFixed(1)}%</div>
                </div>
              );
            })
          ) : (
            <div className="dash-empty">Nenhuma tag de CS/CX encontrada no período.</div>
          )}
        </Card>
      </div>

      <div className="dash-view-head" style={{ marginTop: 11 }}>
        <h2>Envios CX Pós-Instalação · Data Hub</h2>
        <p>Sequência dos disparos da pesquisa e os erros com motivo e código.</p>
      </div>

      {!envcxLoaded ? (
        <div className="dash-hsm-empty">Nenhum relatório de envios carregado.</div>
      ) : (
        <>
          <div className="dash-kpi-row">
            <StaticKpiClickable label="Envios processados" val={nf(enriched.length)} sub={`${cidades} cidade(s) no arquivo`} color="var(--color-foreground)" />
            <StaticKpiClickable label="Atendimento gerado" val={nf(gerados.length)} sub={`${pctOf(gerados.length, enriched.length).toFixed(1)}% dos envios`} color="var(--color-success)" />
            <StaticKpiClickable label="Erros no disparo" val={nf(erros.length)} sub={`${pctOf(erros.length, enriched.length).toFixed(1)}% dos envios`} color="var(--color-danger)" />
            <StaticKpiClickable label="Responderam a pesquisa" val={nf(respostas)} sub={`${pctOf(respostas, gerados.length).toFixed(1)}% dos gerados · ${respOk} OK · ${respNok} NOK`} color="#0f766e" />
            <StaticKpiClickable label="CX Score do disparo" val={respostas ? envScore.toFixed(1) + '%' : '–'} sub={respostas ? 'entre quem respondeu' : 'nenhuma resposta cruzada'} color={!respostas ? 'var(--color-muted)' : envScore >= 80 ? 'var(--color-success)' : envScore >= 50 ? '#b45309' : 'var(--color-danger)'} />
          </div>

          <div className="dash-grid">
            <Card title="Sequência dos Envios" full>
              <div className="dash-seq-resumo">
                <div className="dash-seq-item">
                  <div className="dash-sv">{nf(enriched.length)}</div>
                  <div className="dash-sl">envios na sequência</div>
                </div>
                <div className="dash-seq-item">
                  <div className="dash-sv">{fmtTsCurto(ini)}</div>
                  <div className="dash-sl">primeiro envio</div>
                </div>
                <div className="dash-seq-item">
                  <div className="dash-sv">{fmtTsCurto(fim)}</div>
                  <div className="dash-sl">último envio</div>
                </div>
              </div>
              <div className="dash-hint-box">
                <b>{nf(localizados.length)}</b> de {nf(enriched.length)} envios localizados no relatório de atendimento ({viaTxt}).
                {envcxSemCabecalho && ' O CSV veio sem cabeçalho — assumimos a ordem padrão de colunas do Data Hub.'}
              </div>

              <div className="dash-filters-bar" style={{ boxShadow: 'none' }}>
                <input
                  type="text"
                  placeholder="Buscar nome, telefone, protocolo, contrato, bairro ou mensagem..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />
                <select value={cidadeSel} onChange={(e) => setCidadeSel(e.target.value)}>
                  <option value="">Todas as cidades</option>
                  {cidadeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select value={resultado} onChange={(e) => setResultado(e.target.value)}>
                  <option value="">Todos os resultados</option>
                  <option value="gerado">Atendimento gerado</option>
                  <option value="nao">Não gerado (erro)</option>
                  <option value="ok">Respondeu OK</option>
                  <option value="nok">Respondeu NOK</option>
                  <option value="semresp">Sem resposta</option>
                </select>
                <button
                  className="dash-mkt-clear-btn"
                  onClick={() => {
                    setBusca('');
                    setCidadeSel('');
                    setResultado('');
                  }}
                >
                  ✕ limpar
                </button>
              </div>

              {detalheFiltrado.length ? (
                <div className="dash-tbl-scroll">
                  <table className="dash-cxe-table dash-cxe-detail">
                    <thead>
                      <tr>
                        <th className="tleft">#</th>
                        <th className="tleft">Data / Hora</th>
                        <th className="tleft">Protocolo</th>
                        <th className="tleft">Cliente</th>
                        <th className="tleft">Contrato</th>
                        <th className="tleft">Cidade / Bairro</th>
                        <th className="tleft">Disparo</th>
                        <th className="tleft">Resposta CX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalheFiltrado.slice(0, 300).map((d, i) => (
                        <tr key={i}>
                          <td className="tleft">{i + 1}</td>
                          <td className="tleft">{d.tsLbl}</td>
                          <td className="tleft mono">{d.protocolo || '—'}</td>
                          <td className="tleft">
                            {d.nome}
                            <br />
                            <span className="mono">{d.telefone}</span>
                          </td>
                          <td className="tleft mono">{d.contrato || '—'}</td>
                          <td className="tleft">
                            {d.cidade}
                            <br />
                            <span style={{ fontSize: 11 }}>{d.bairro}</span>
                          </td>
                          <td className="tleft">
                            <span className="dash-pill-tag" style={{ background: d.gerado ? 'var(--color-success-soft)' : 'var(--color-danger-soft)', color: d.gerado ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              {d.gerado ? 'gerado' : 'erro'}
                            </span>
                          </td>
                          <td className="tleft">
                            <ResTag res={d.res} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="dash-empty">Nenhum envio para os filtros selecionados.</div>
              )}
            </Card>

            <Card title="Cobertura por Cidade" full>
              <GroupTable dados={enriched} keyFn={(d) => d.cidade} label="Cidade" />
            </Card>

            <Card title="Bairros com Mais Envios" full>
              <GroupTable dados={enriched} keyFn={(d) => d.bairro + ' · ' + d.cidade} label="Bairro · Cidade" limit={20} />
            </Card>

            <Card title="Erros do Disparo" full>
              {erros.length ? (
                <>
                  <div className="dash-hint-box">
                    <b>{nf(erros.length)}</b> envio(s) não geraram atendimento. Clique em um motivo para filtrar a lista abaixo.
                  </div>
                  {errEntries.map(([motivo, v]) => (
                    <div key={motivo} className="dash-bar-row is-clickable" onClick={() => setErrSel(errSel === motivo ? '' : motivo)}>
                      <div className="dash-bar-lbl dash-bar-lbl--wide" title={motivo}>
                        {[...v.codigos].map((c) => (
                          <span key={c} className="dash-err-code">
                            {c}
                          </span>
                        ))}
                        {motivo}
                      </div>
                      <div className="dash-bar-track">
                        <div className="dash-bar-fill" style={{ width: `${((v.n / errMax) * 100).toFixed(1)}%`, background: 'var(--color-danger)' }} />
                      </div>
                      <div className="dash-bar-num">{nf(v.n)}</div>
                      <div className="dash-bar-pct">{((v.n / erros.length) * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    <table className="dash-cxe-table dash-cxe-detail">
                      <thead>
                        <tr>
                          <th className="tleft">Data / Hora</th>
                          <th className="tleft">Cliente</th>
                          <th className="tleft">Telefone</th>
                          <th className="tleft">Cidade / Bairro</th>
                          <th className="tleft">Código</th>
                          <th className="tleft">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errosFiltrados.slice(0, 300).map((d, i) => (
                          <tr key={i}>
                            <td className="tleft">{d.tsLbl}</td>
                            <td className="tleft">{d.nome}</td>
                            <td className="tleft mono">{d.telefone}</td>
                            <td className="tleft">
                              {d.cidade}
                              <br />
                              <span style={{ fontSize: 11 }}>{d.bairro}</span>
                            </td>
                            <td className="tleft">{d.codigoErro ? <span className="dash-err-code">{d.codigoErro}</span> : '—'}</td>
                            <td className="tleft" style={{ color: 'var(--color-danger)' }}>
                              {d.motivoErro || d.msg}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="dash-empty" style={{ color: 'var(--color-success)' }}>
                  Nenhum erro no disparo — todos os envios geraram atendimento.
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

function ResTag({ res }: { res: 'ok' | 'nok' | 'semresp' | 'naoachado' }) {
  const map: Record<string, [string, string, string]> = {
    ok: ['var(--color-success-soft)', 'var(--color-success)', 'OK'],
    nok: ['var(--color-danger-soft)', 'var(--color-danger)', 'NOK'],
    semresp: ['var(--color-nodata-soft)', 'var(--color-muted)', 'sem resposta'],
    naoachado: ['var(--color-card)', 'var(--color-nodata)', 'não localizado'],
  };
  const c = map[res];
  return (
    <span className="dash-pill-tag" style={{ background: c[0], color: c[1] }}>
      {c[2]}
    </span>
  );
}

function GroupTable({
  dados,
  keyFn,
  label,
  limit,
}: {
  dados: ReturnType<typeof envCxEnriched>;
  keyFn: (d: ReturnType<typeof envCxEnriched>[number]) => string;
  label: string;
  limit?: number;
}) {
  const g = new Map<string, { total: number; gerado: number; nao: number; ok: number; nok: number }>();
  dados.forEach((d) => {
    const k = keyFn(d);
    if (!g.has(k)) g.set(k, { total: 0, gerado: 0, nao: 0, ok: 0, nok: 0 });
    const v = g.get(k)!;
    v.total++;
    if (d.gerado) v.gerado++;
    else v.nao++;
    if (d.res === 'ok' && d.primeiro) v.ok++;
    if (d.res === 'nok' && d.primeiro) v.nok++;
  });
  let entries = [...g.entries()].sort((a, b) => b[1].total - a[1].total);
  const cortou = limit ? entries.length > limit : false;
  if (limit) entries = entries.slice(0, limit);
  if (!entries.length) return <div className="dash-empty">Sem dados.</div>;

  return (
    <table className="dash-cxe-table">
      <thead>
        <tr>
          <th className="tleft">{label}</th>
          <th>Envios</th>
          <th>Gerados</th>
          <th>Erros</th>
          <th>OK</th>
          <th>NOK</th>
          <th>CX Score</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => {
          const resp = v.ok + v.nok;
          return (
            <tr key={k}>
              <td className="tleft">{k}</td>
              <td>{nf(v.total)}</td>
              <td className="dash-cxe-ok">{nf(v.gerado)}</td>
              <td className="dash-cxe-nok">{v.nao ? nf(v.nao) : '—'}</td>
              <td className="dash-cxe-ok">{v.ok || '—'}</td>
              <td className="dash-cxe-nok">{v.nok || '—'}</td>
              <td>{resp ? <RateBadge v={(v.ok / resp) * 100} /> : '—'}</td>
            </tr>
          );
        })}
      </tbody>
      {cortou && (
        <tfoot>
          <tr>
            <td colSpan={7} className="tleft" style={{ color: 'var(--color-muted)', fontSize: 11 }}>
              + outros itens com menor volume
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function StaticKpiClickable({ label, val, sub, color, onClick }: { label: string; val: string; sub: string; color: string; onClick?: () => void }) {
  return (
    <div className={`dash-kpi${onClick ? '' : ' dash-kpi--static'}`} style={{ borderLeftColor: color }} onClick={onClick}>
      {onClick && <div className="dash-kpi-hint">ver →</div>}
      <label>{label}</label>
      <div className="dash-kpi-val" style={{ color }}>
        {val}
      </div>
      <div className="dash-kpi-sub">{sub}</div>
    </div>
  );
}
