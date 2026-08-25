import { useForm } from 'react-hook-form';
import type { ReportGenerationState } from '../../services/useReportGeneration';
import './ReportRequestPage.css';

type FormValues = {
  dataInicio: string;
  dataFim: string;
};

// O backend combina o progresso dos 3 relatorios concorrentes numa unica
// string " | "-separada (ex.: "[Atendimento] ... | [HSM] ..."). Mostramos
// cada relatorio em sua propria linha, sem cortar o texto (ver .status-box).
function splitStatusMessage(message: string): string[] {
  if (!message.includes('|')) return [message];
  return message.split('|').map((part) => part.trim());
}

type ReportRequestPageProps = ReportGenerationState & {
  generate: (dataInicio: string, dataFim: string) => void;
};

export function ReportRequestPage({
  status,
  percent,
  message,
  downloadUrl,
  generate,
}: ReportRequestPageProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields },
  } = useForm<FormValues>({
    defaultValues: { dataInicio: '', dataFim: '' },
    mode: 'onChange',
  });

  const dataInicio = watch('dataInicio');
  const dataFim = watch('dataFim');
  const intervaloInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim);
  const isRunning = status === 'running';

  const onSubmit = handleSubmit(({ dataInicio, dataFim }) => {
    if (intervaloInvalido) return;
    generate(dataInicio, dataFim);
  });

  return (
    <div className="report-request-page">
      <form onSubmit={onSubmit}>
        <input type="date" {...register('dataInicio', { required: true })} />
        {errors.dataInicio && touchedFields.dataInicio && <span className="error">Campo obrigatório</span>}

        <input type="date" {...register('dataFim', { required: true })} />
        {intervaloInvalido && (touchedFields.dataInicio || touchedFields.dataFim) && (
          <span className="error">Data de início deve ser anterior à data de fim</span>
        )}

        <button type="submit" disabled={!dataInicio || !dataFim || intervaloInvalido || isRunning}>
          Gerar Relatório
        </button>
      </form>

      {status !== 'idle' && (
        <>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="status-box">
            {splitStatusMessage(message).map((line, index) => (
              <p
                key={index}
                className={`status-message${status === 'failed' ? ' status-message-error' : ''}`}
              >
                {line}
              </p>
            ))}
          </div>

          {status === 'done' && downloadUrl && (
            <a className="download-link" href={downloadUrl} download>
              Baixar CSV
            </a>
          )}
        </>
      )}
    </div>
  );
}
