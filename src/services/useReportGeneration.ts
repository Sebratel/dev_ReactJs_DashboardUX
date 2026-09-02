import { useCallback, useRef, useState } from 'react';
import { createReportJob, fetchReportJobStatus, type ReportMode, type ReportProgress } from './reportGeneration';

const POLL_INTERVAL_MS = 2000;

export type ReportGenerationState = {
  // 'failed' so quando NENHUM relatorio ficou disponivel - com falha
  // parcial (alguns relatorios ok, outros nao) o status vira 'done' mesmo
  // assim, e os relatorios que falharam aparecem em `errors` (cards de
  // aviso, ver StatusCards) em vez de travar a tela inteira.
  status: 'idle' | 'running' | 'done' | 'failed';
  percent: number;
  message: string;
  downloadUrl: string | null;
  reportDownloadUrls: Record<string, string>;
  errors: Record<string, string>;
  // Erro de rede/chamada (ex.: BFF fora do ar no meio do polling) - distinto
  // de `errors` (erros por relatorio que o backend reportou) porque aqui a
  // falha e nossa, ao tentar falar com o backend, nao um relatorio
  // especifico que falhou la.
  requestError: string | null;
};

const initialState: ReportGenerationState = {
  status: 'idle',
  percent: 0,
  message: '',
  downloadUrl: null,
  reportDownloadUrls: {},
  errors: {},
  requestError: null,
};

export function useReportGeneration() {
  const [state, setState] = useState<ReportGenerationState>(initialState);
  const stopRef = useRef(false);

  const generate = useCallback(async (dataInicio: string, dataFim: string, mode: ReportMode = 'api') => {
    stopRef.current = false;
    setState({ ...initialState, status: 'running' });

    try {
      const jobId = await createReportJob(dataInicio, dataFim, mode);

      let progress: ReportProgress;
      do {
        if (stopRef.current) return;

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (stopRef.current) return;

        progress = await fetchReportJobStatus(jobId);
        setState({
          status: progress.status,
          percent: progress.percent,
          message: progress.message,
          downloadUrl: progress.downloadUrl,
          reportDownloadUrls: progress.reportDownloadUrls,
          errors: progress.errors,
          requestError: null,
        });
      } while (progress.status === 'running');
    } catch (error) {
      if (stopRef.current) return;
      const requestError =
        error instanceof Error
          ? error.message
          : 'Falha ao gerar o relatório. Por favor, tente novamente.';

      // Se algum relatorio ja tinha ficado pronto antes da chamada falhar
      // (ex.: BFF caiu no meio do polling, depois de alguns relatorios
      // concluidos), mantem o que ja deu certo visivel em vez de travar a
      // tela inteira - o erro de rede vira so mais um card de aviso.
      setState((current) => ({
        ...current,
        status: Object.keys(current.reportDownloadUrls).length > 0 ? 'done' : 'failed',
        requestError,
      }));
    }
  }, []);

  const cancel = useCallback(() => {
    stopRef.current = true;
  }, []);

  const reset = useCallback(() => {
    stopRef.current = true;
    setState(initialState);
  }, []);

  return { ...state, generate, cancel, reset };
}
