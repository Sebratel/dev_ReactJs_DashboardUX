export type ReportProgress = {
  // 'done' significa "pelo menos um relatorio ja pode ser exibido" - tanto
  // sucesso total quanto parcial (ver fetchReportJobStatus). 'failed' so
  // ocorre quando NENHUM relatorio ficou disponivel.
  status: 'running' | 'done' | 'failed';
  percent: number;
  message: string;
  downloadUrl: string | null;
  reportDownloadUrls: Record<string, string>;
  // Erro de cada relatorio que falhou (chave = "atendimento"/"hsm"/
  // "hsmPosInstalacao"), mesmo quando o job como um todo virou 'done' por
  // causa dos outros relatorios terem dado certo - usado pra render dos
  // cards de aviso no topo da tela, ver StatusCards.
  errors: Record<string, string>;
};

type ReportJobCreatedResponse = {
  jobId: string;
};

type ReportJobStatusResponse = {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  percent: number;
  message: string;
  downloadUrl: string | null;
  reportDownloadUrls?: Record<string, string>;
  errors?: Record<string, string>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const JOBS_URL = `${API_BASE_URL}/reports/jobs`;

// O backend devolve paths relativos (ex.: "/api/reports/jobs/{id}/download/hsm"),
// relativos a origem do BFF - nao a origem do Vite em dev. Mesma regra em
// services/auditJobs.ts. API_BASE_URL pode ser absoluto (URL completa) ou
// relativo (ex.: "/api", quando o BFF esta atras do mesmo proxy do
// frontend) - o segundo argumento de URL() resolve o relativo contra a
// origem atual e e ignorado quando API_BASE_URL ja e absoluto.
export function resolveReportDownloadUrl(relativeUrl: string): string {
  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
  return `${apiOrigin}${relativeUrl}`;
}

export type ReportMode = 'api' | 'novnc';

export async function createReportJob(
  dataInicio: string,
  dataFim: string,
  mode: ReportMode = 'api',
): Promise<string> {
  const response = await fetch(JOBS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataInicio, dataFim, mode }),
  });

  if (!response.ok) {
    throw new Error('Falha ao iniciar a geração do relatório.');
  }

  const created: ReportJobCreatedResponse = await response.json();
  return created.jobId;
}

export async function fetchReportJobStatus(jobId: string): Promise<ReportProgress> {
  const response = await fetch(`${JOBS_URL}/${jobId}`);

  if (!response.ok) {
    throw new Error('Falha ao consultar o status do relatório.');
  }

  const job: ReportJobStatusResponse = await response.json();
  const reportDownloadUrls = job.reportDownloadUrls ?? {};

  // FAILED com pelo menos um relatorio disponivel = falha PARCIAL - nao
  // trata como erro fatal (nao lanca), so repassa os erros por relatorio
  // pra virarem cards de aviso; a tela segue pro dashboard com o que deu
  // certo. So quando NENHUM relatorio ficou disponivel e que e falha total.
  const hasAnyReport = Object.keys(reportDownloadUrls).length > 0;
  if (job.status === 'FAILED' && !hasAnyReport) {
    throw new Error(job.message);
  }

  return {
    status: job.status === 'DONE' || (job.status === 'FAILED' && hasAnyReport) ? 'done' : 'running',
    percent: job.percent,
    message: job.message,
    // Construido a partir do jobId, e nao do downloadUrl relativo que o
    // BFF devolve - aquele path e relativo a origem do BFF (ex: :8081),
    // que e diferente da origem do Vite em dev (ex: :5173).
    downloadUrl: job.status === 'DONE' ? `${JOBS_URL}/${job.jobId}/download` : null,
    reportDownloadUrls,
    errors: job.errors ?? {},
  };
}
