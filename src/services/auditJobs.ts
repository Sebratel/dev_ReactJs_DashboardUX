export type AuditStep = {
  percent: number;
  message: string;
  timestamp: string;
};

export type AuditJob = {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  percent: number;
  message: string;
  downloadUrl: string | null;
  pid: number;
  createdAt: string;
  elapsedSeconds: number;
  steps: AuditStep[];
  /** Chave do relatório ("atendimento"/"hsm") -> URL relativa para baixar o CSV bruto já concluído. */
  reportDownloadUrls: Record<string, string>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const JOBS_URL = `${API_BASE_URL}/reports/jobs`;

export function resolveDownloadUrl(relativeUrl: string): string {
  // O backend devolve paths relativos (ex.: "/api/reports/jobs/{id}/download/hsm"),
  // relativos a origem do BFF - nao a origem do Vite em dev. Ver mesma regra
  // em reportGeneration.ts. API_BASE_URL pode ser absoluto ou relativo (ex.:
  // "/api") - o segundo argumento de URL() resolve o relativo contra a
  // origem atual e e ignorado quando API_BASE_URL ja e absoluto.
  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
  return `${apiOrigin}${relativeUrl}`;
}

export async function fetchAuditJobs(): Promise<AuditJob[]> {
  const response = await fetch(JOBS_URL);

  if (!response.ok) {
    throw new Error('Falha ao consultar os jobs de auditoria.');
  }

  return response.json();
}
