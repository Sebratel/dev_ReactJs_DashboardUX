import { useEffect, useState } from 'react';
import { AuditPanel } from './components/AuditPanel/AuditPanel';
import { ReportRequestPage } from './components/ReportRequestPage/ReportRequestPage';
import { Dashboard } from './components/Dashboard/Dashboard';
import { StatusCards, type StatusCardItem } from './components/StatusCards/StatusCards';
import { useReportGeneration } from './services/useReportGeneration';
import { resolveReportDownloadUrl, type ReportMode } from './services/reportGeneration';

const REQUIRED_REPORTS = ['atendimento', 'hsm', 'hsmPosInstalacao'] as const;

const REPORT_LABELS: Record<string, string> = {
  atendimento: 'Relatório de Atendimento',
  hsm: 'Relatório Analítico de Mensagens HSM',
  hsmPosInstalacao: 'HSM CX Pós-Instalação',
};

function formatBr(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

type DashboardCsvs = { atendimento: string; hsm: string; envCx: string };

function App() {
  const reportGeneration = useReportGeneration();
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const [dashboardCsvs, setDashboardCsvs] = useState<DashboardCsvs | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleGenerate = (dataInicio: string, dataFim: string, modo: ReportMode) => {
    setPeriodo({ inicio: dataInicio, fim: dataFim });
    setDashboardCsvs(null);
    setLoadError(null);
    reportGeneration.generate(dataInicio, dataFim, modo);
  };

  // Assim que PELO MENOS UM dos 3 relatorios concorrentes termina de baixar
  // (ver HttpReportJobRunner.java/reportDefinitions.js), busca o CSV bruto
  // dele (endpoints /download/{report}) para montar a tela de dashboard -
  // relatorios que falharam ficam de fora (string vazia), e aparecem como
  // aviso via StatusCards em vez de travar a tela toda esperando os 3.
  useEffect(() => {
    if (reportGeneration.status !== 'done' || dashboardCsvs) return;

    const urls = reportGeneration.reportDownloadUrls;
    const availableKeys = REQUIRED_REPORTS.filter((key) => Boolean(urls[key]));
    if (availableKeys.length === 0) return;

    let cancelled = false;
    setLoadingDashboard(true);
    setLoadError(null);

    Promise.all(availableKeys.map((key) => fetch(resolveReportDownloadUrl(urls[key])).then((r) => r.text())))
      .then((texts) => {
        if (cancelled) return;
        const csvByKey = Object.fromEntries(availableKeys.map((key, i) => [key, texts[i]]));
        setDashboardCsvs({
          atendimento: csvByKey.atendimento ?? '',
          hsm: csvByKey.hsm ?? '',
          envCx: csvByKey.hsmPosInstalacao ?? '',
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError('Falha ao carregar os dados para montar o dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoadingDashboard(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportGeneration.status, reportGeneration.reportDownloadUrls, dashboardCsvs]);

  // Avisos pontuais no topo da tela (nao bloqueiam nada): um por relatorio
  // que falhou, mais o erro de rede/chamada da ultima tentativa, se houver.
  // Ver StatusCards - cada um pode ser dispensado individualmente.
  const statusCardItems: StatusCardItem[] = [
    ...Object.entries(reportGeneration.errors).map(([key, message]) => ({
      id: `report-error-${key}`,
      title: REPORT_LABELS[key] ?? key,
      message,
    })),
    ...(reportGeneration.requestError
      ? [{ id: 'request-error', title: 'Falha de comunicação', message: reportGeneration.requestError }]
      : []),
  ];

  const handleVoltar = () => {
    setDashboardCsvs(null);
    setPeriodo(null);
    reportGeneration.reset();
  };

  if (dashboardCsvs && periodo) {
    return (
      <>
        <StatusCards items={statusCardItems} />
        <Dashboard
          atendimentoCsv={dashboardCsvs.atendimento}
          hsmCsv={dashboardCsvs.hsm}
          envCxCsv={dashboardCsvs.envCx}
          periodoLabel={`${formatBr(periodo.inicio)} – ${formatBr(periodo.fim)}`}
          onVoltar={handleVoltar}
        />
        <AuditPanel />
      </>
    );
  }

  return (
    <>
      <StatusCards items={statusCardItems} />
      <ReportRequestPage
        status={reportGeneration.status}
        percent={reportGeneration.percent}
        message={
          loadingDashboard
            ? 'Montando o dashboard com os dados baixados...'
            : loadError ?? reportGeneration.message
        }
        downloadUrl={reportGeneration.downloadUrl}
        reportDownloadUrls={reportGeneration.reportDownloadUrls}
        generate={handleGenerate}
      />
      <AuditPanel />
    </>
  );
}

export default App;
