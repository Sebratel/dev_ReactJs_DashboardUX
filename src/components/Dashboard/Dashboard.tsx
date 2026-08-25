import { useMemo, useState } from 'react';
import { TabBar } from './TabBar';
import { AtendimentoView } from './AtendimentoView';
import { HsmView } from './HsmView';
import { CxView } from './CxView';
import { DrawerTable } from './DrawerTable';
import { parseCSV, buildRows, parseHsmCsv, parseEnvCxCsv, isCsOk, isCsNok, nf, type Row } from './csvParsing';
import type { TabKey, DrawerState } from './types';
import './Dashboard.css';

export type DashboardProps = {
  atendimentoCsv: string;
  hsmCsv: string;
  envCxCsv: string;
  periodoLabel: string;
  onVoltar?: () => void;
};

const VIEW_TITLES: Record<TabKey, string> = {
  atendimento: 'Relatório Analítico de Atendimento',
  hsm: 'Acompanhamento Mensagens Analíticas HSM',
  cx: 'CX Atendimento Pós-Instalação',
};

export function Dashboard({ atendimentoCsv, hsmCsv, envCxCsv, periodoLabel, onVoltar }: DashboardProps) {
  const [tab, setTab] = useState<TabKey>('atendimento');
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const [mktRange, setMktRange] = useState({ from: '', to: '' });
  const [csRange, setCsRange] = useState({ from: '', to: '' });

  const rows: Row[] = useMemo(() => {
    if (!atendimentoCsv) return [];
    try {
      return buildRows(parseCSV(atendimentoCsv));
    } catch {
      return [];
    }
  }, [atendimentoCsv]);

  const hsmParsed = useMemo(() => {
    if (!hsmCsv) return null;
    try {
      return parseHsmCsv(hsmCsv);
    } catch {
      return null;
    }
  }, [hsmCsv]);

  const envcxParsed = useMemo(() => {
    if (!envCxCsv) return null;
    try {
      return parseEnvCxCsv(envCxCsv);
    } catch {
      return null;
    }
  }, [envCxCsv]);

  const conta = useMemo(() => {
    if (!atendimentoCsv) return '';
    try {
      const parsed = parseCSV(atendimentoCsv);
      return parsed[0]?.['Conta'] || '';
    } catch {
      return '';
    }
  }, [atendimentoCsv]);

  const openDrawer = (title: string, predicate: (r: Row) => boolean) => setDrawer({ title, predicate });

  const totalAtend = rows.length;
  const totalHsm = hsmParsed ? hsmParsed.agg.reduce((a, r) => a + r.enviadas, 0) : 0;
  const totalCx = rows.filter((r) => isCsOk(r) || isCsNok(r)).length;

  const badges: Record<TabKey, string> = {
    atendimento: totalAtend ? nf(totalAtend) : '',
    hsm: totalHsm ? nf(totalHsm) : '',
    cx: totalCx ? nf(totalCx) : '',
  };

  return (
    <div className="dashboard-root">
      <div className="dash-header-stack">
        <div className="dash-topbar">
          <div className="dash-topbar-title">
            <h1>{VIEW_TITLES[tab]}</h1>
            <p>{conta || periodoLabel}</p>
          </div>
          <div className="dash-topbar-right">
            <span className="dash-hdr-badge">{periodoLabel}</span>
            {onVoltar && (
              <button className="dash-reload-btn" onClick={onVoltar}>
                ↩ Voltar
              </button>
            )}
          </div>
        </div>
        <TabBar active={tab} onChange={setTab} badges={badges} />
      </div>

      <div className="dash-page-inner">
        {tab === 'atendimento' && <AtendimentoView rows={rows} mktRange={mktRange} onMktRangeChange={setMktRange} onOpenDrawer={openDrawer} />}
        {tab === 'hsm' && <HsmView agg={hsmParsed?.agg || []} msgs={hsmParsed?.msgs || []} mode={hsmParsed?.mode || null} />}
        {tab === 'cx' && (
          <CxView
            rows={rows}
            hsmAgg={hsmParsed?.agg || []}
            hsmLoaded={!!hsmParsed}
            hsmByProto={hsmParsed?.byProto || new Map()}
            envcxRows={envcxParsed?.rows || []}
            envcxLoaded={!!envcxParsed}
            envcxSemCabecalho={envcxParsed?.semCabecalho || false}
            csRange={csRange}
            onCsRangeChange={setCsRange}
            onOpenDrawer={openDrawer}
          />
        )}
        <div className="dash-footer">Gerado a partir dos relatórios baixados — Sebratel Dashboard</div>
      </div>

      <DrawerTable drawer={drawer} allRows={rows} onClose={() => setDrawer(null)} />
    </div>
  );
}
