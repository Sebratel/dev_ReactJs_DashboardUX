import { useEffect, useState } from 'react';
import { AuditPanel } from './components/AuditPanel/AuditPanel';
import { ReportRequestPage } from './components/ReportRequestPage/ReportRequestPage';
import { Dashboard } from './components/Dashboard/Dashboard';
import { useReportGeneration } from './services/useReportGeneration';
import { resolveReportDownloadUrl } from './services/reportGeneration';

const REQUIRED_REPORTS = ['atendimento', 'hsm', 'hsmPosInstalacao'] as const;

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

  const handleGenerate = (dataInicio: string, dataFim: string) => {
    setPeriodo({ inicio: dataInicio, fim: dataFim });
    setDashboardCsvs(null);
    setLoadError(null);
    reportGeneration.generate(dataInicio, dataFim);
  };

  // Assim que os 3 relatorios concorrentes terminam de baixar (ver
  // NodeProcessReportJobRunner.java/reportDefinitions.js), busca o CSV bruto
  // de cada um (endpoints /download/{report}) para montar a tela de
  // dashboard - a consolidacao em UM arquivo final ainda nao existe, mas
  // para a dashboard isso nao importa: ela so precisa dos 3 textos crus.
  useEffect(() => {
    if (reportGeneration.status !== 'done' || dashboardCsvs) return;

    const urls = reportGeneration.reportDownloadUrls;
    const hasAllReports = REQUIRED_REPORTS.every((key) => Boolean(urls[key]));
    if (!hasAllReports) return;

    let cancelled = false;
    setLoadingDashboard(true);
    setLoadError(null);

    Promise.all(
      REQUIRED_REPORTS.map((key) => fetch(resolveReportDownloadUrl(urls[key])).then((r) => r.text())),
    )
      .then(([atendimento, hsm, envCx]) => {
        if (!cancelled) setDashboardCsvs({ atendimento, hsm, envCx });
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

  const handleVoltar = () => {
    setDashboardCsvs(null);
    setPeriodo(null);
    reportGeneration.reset();
  };

  if (dashboardCsvs && periodo) {
    return (
      <>
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
