import { useCallback, useRef, useState } from 'react';
import { createReportJob, fetchReportJobStatus, type ReportMode, type ReportProgress } from './reportGeneration';

const POLL_INTERVAL_MS = 2000;

export type ReportGenerationState = {
  status: 'idle' | 'running' | 'done' | 'failed';
  percent: number;
  message: string;
  downloadUrl: string | null;
  reportDownloadUrls: Record<string, string>;
};

const initialState: ReportGenerationState = {
  status: 'idle',
  percent: 0,
  message: '',
  downloadUrl: null,
  reportDownloadUrls: {},
};

export function useReportGeneration() {
  const [state, setState] = useState<ReportGenerationState>(initialState);
  const stopRef = useRef(false);

  const generate = useCallback(async (dataInicio: string, dataFim: string, mode: ReportMode = 'api') => {
    stopRef.current = false;
    setState({ status: 'running', percent: 0, message: '', downloadUrl: null, reportDownloadUrls: {} });

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
        });
      } while (progress.status === 'running');
    } catch (error) {
      if (stopRef.current) return;
      setState((current) => ({
        ...current,
        status: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'Falha ao gerar o relatório. Por favor, tente novamente.',
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
