import { useForm } from 'react-hook-form';
import type { ReportGenerationState } from '../../services/useReportGeneration';
import type { ReportMode } from '../../services/reportGeneration';
import { useReauth } from '../../services/useReauth';
import './ReportRequestPage.css';

type FormValues = {
  dataInicio: string;
  dataFim: string;
  modo: ReportMode;
};

// O backend combina o progresso dos 3 relatorios concorrentes numa unica
// string " | "-separada (ex.: "[Atendimento] ... | [HSM] ..."). Mostramos
// cada relatorio em sua propria linha, sem cortar o texto (ver .status-box).
function splitStatusMessage(message: string): string[] {
  if (!message.includes('|')) return [message];
  return message.split('|').map((part) => part.trim());
}

type ReportRequestPageProps = ReportGenerationState & {
  generate: (dataInicio: string, dataFim: string, modo: ReportMode) => void;
};

function today(): string {
  return new Date().toLocaleDateString('sv-SE'); // yyyy-mm-dd, formato aceito por <input type="date">
}

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
    defaultValues: { dataInicio: today(), dataFim: today(), modo: 'api' },
    mode: 'onChange',
  });

  const dataInicio = watch('dataInicio');
  const dataFim = watch('dataFim');
  const modo = watch('modo');
  const intervaloInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim);
  const isRunning = status === 'running';

  const reauth = useReauth();

  const onSubmit = handleSubmit(({ dataInicio, dataFim, modo }) => {
    if (intervaloInvalido) return;
    generate(dataInicio, dataFim, modo);
  });

  return (
    <div className="report-request-page">
      <div className="report-request-page__brand">
        <img src="/sebratel-logo.svg" alt="" className="report-request-page__brand-mark" />
        <span className="report-request-page__brand-name">Sebratel Hub</span>
      </div>
      <span className="report-request-page__badge">Consolidador</span>
      <h2 className="report-request-page__title">Gerar relatório</h2>
      <p className="report-request-page__subtitle">
        Escolha o período e gere os relatórios consolidados do Matrix.
      </p>

      <fieldset className="mode-toggle">
        <legend className="mode-toggle__legend">Origem dos dados</legend>
        <label className="mode-toggle__option">
          <input type="radio" value="api" {...register('modo')} />
          API
        </label>
        <label className="mode-toggle__option">
          <input type="radio" value="novnc" {...register('modo')} />
          noVNC
        </label>
      </fieldset>

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

      {/* So faz sentido no modo noVNC: a sessao de browser (Playwright) que
          esse botao reautentica nao existe no modo "api" (matrixAuth.js se
          autentica sozinho via login/senha, sem sessao nenhuma). */}
      {modo === 'novnc' && (
        <div className="reauth-box">
          <button
            type="button"
            className="reauth-button"
            onClick={reauth.status === 'waiting-login' ? reauth.cancel : reauth.begin}
          >
            {reauth.status === 'waiting-login' ? 'Cancelar reautenticação' : 'Reautenticar'}
          </button>
          {reauth.status !== 'idle' && (
            <p className={`reauth-message${reauth.status === 'failed' ? ' status-message-error' : ''}`}>
              {reauth.message}
            </p>
          )}
        </div>
      )}

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
