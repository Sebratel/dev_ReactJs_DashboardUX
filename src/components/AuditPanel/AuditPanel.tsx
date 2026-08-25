import { useCallback, useEffect, useState } from 'react';
import { fetchAuditJobs, resolveDownloadUrl, type AuditJob } from '../../services/auditJobs';
import './AuditPanel.css';

// Rotulos amigaveis por chave de relatorio (ver REPORT_DEFINITIONS no
// automation) - usados so para exibir o nome completo no botao de download,
// quando a chave crua ("atendimento"/"hsm") nao é autoexplicativa o suficiente.
const REPORT_LABELS: Record<string, string> = {
  atendimento: 'Relatório de Atendimento',
  hsm: 'Relatório Analítico de Mensagens HSM',
  hsmPosInstalacao: 'HSM CX Pós-Instalação',
};

// Duracao da transicao de abertura do painel (ver transition em .audit-panel
// no CSS) - o fade-in do conteudo comeca em 80% desse tempo, para acontecer
// "quando o painel ja cobriu ~80% da pagina" durante o deslizar.
const PANEL_TRANSITION_MS = 550;
const CONTENT_FADE_DELAY_MS = PANEL_TRANSITION_MS * 0.8;
const REFRESH_INTERVAL_MS = 4000;

const STATUS_LABEL: Record<AuditJob['status'], string> = {
  PENDING: 'Pendente',
  RUNNING: 'Em execução',
  DONE: 'Concluído',
  FAILED: 'Falhou',
};

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR');
}

type StepRow = {
  key: string;
  reportLabel: string | null;
  text: string;
  percent: number;
  timestamp: string;
};

// O backend ainda manda uma unica mensagem combinada quando os 2
// relatorios rodam em paralelo, ex.:
// "[Relatório de Atendimento] Exportando periodo 1/8: ... | [Relatório Analítico de Mensagens HSM] Exportando periodo 2/8: ..."
// Esse regex separa cada "[Rótulo] texto" em sua propria linha, sem
// alterar o backend - so o jeito como a Auditoria exibe o mesmo dado.
const REPORT_SEGMENT_REGEX = /\[([^\]]+)\]\s*([^|]*)/g;

function splitStepIntoRows(step: AuditJob['steps'][number], stepIndex: number): StepRow[] {
  const matches = [...step.message.matchAll(REPORT_SEGMENT_REGEX)];

  if (matches.length === 0) {
    return [
      {
        key: `${stepIndex}-0`,
        reportLabel: null,
        text: step.message.trim(),
        percent: step.percent,
        timestamp: step.timestamp,
      },
    ];
  }

  return matches.map((match, segmentIndex) => ({
    key: `${stepIndex}-${segmentIndex}`,
    reportLabel: match[1].trim(),
    text: match[2].trim(),
    percent: step.percent,
    timestamp: step.timestamp,
  }));
}

function reportBadgeModifier(reportLabel: string) {
  if (/pós-instalação|pos-instalacao/i.test(reportLabel)) return 'hsm-pos-instalacao';
  if (/hsm/i.test(reportLabel)) return 'hsm';
  if (/atendimento/i.test(reportLabel)) return 'atendimento';
  return 'default';
}

export function AuditPanel() {
  const [open, setOpen] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [jobs, setJobs] = useState<AuditJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchAuditJobs();
      // Defensivo contra um BFF antigo ainda no ar sem os campos novos
      // (pid/steps/elapsedSeconds) - evita crash caso o backend nao tenha
      // sido reiniciado com a versao mais recente do contrato.
      const normalized = data.map((job) => ({
        ...job,
        pid: job.pid ?? 0,
        elapsedSeconds: job.elapsedSeconds ?? 0,
        steps: job.steps ?? [],
        reportDownloadUrls: job.reportDownloadUrls ?? {},
      }));
      setJobs(normalized.reverse());
      setError(null);
    } catch {
      setError('Não foi possível carregar os jobs de auditoria.');
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    loadJobs();
    const interval = setInterval(loadJobs, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, loadJobs]);

  // O fade-in do conteudo comeca perto do final do deslizar do painel (ver
  // PANEL_TRANSITION_MS/CONTENT_FADE_DELAY_MS acima), nao no instante do
  // clique - por isso um efeito separado, disparado pela mudanca de `open`,
  // em vez de logica dentro do proprio setState.
  useEffect(() => {
    if (!open) {
      setContentVisible(false);
      return;
    }

    const timeout = setTimeout(() => setContentVisible(true), CONTENT_FADE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  const handleToggle = () => setOpen((current) => !current);

  return (
    <>
      <button
        type="button"
        className={`audit-tab${open ? ' audit-tab--panel-open' : ''}`}
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls="audit-panel"
      >
        <span className="audit-tab__arrow">‹</span>
        <span>Auditoria</span>
      </button>

      <aside id="audit-panel" className={`audit-panel${open ? ' audit-panel--open' : ''}`}>
        <div className={`audit-panel__content${contentVisible ? ' audit-panel__content--visible' : ''}`}>
          <div className="audit-panel__header">
            <h2>Auditoria de jobs</h2>
            <button type="button" className="audit-panel__close" onClick={handleToggle}>
              Fechar ✕
            </button>
          </div>

          {error && <p className="audit-panel__empty">{error}</p>}
          {!error && jobs.length === 0 && (
            <p className="audit-panel__empty">Nenhum job encontrado ainda.</p>
          )}

          <div className="audit-panel__list">
            {jobs.map((job) => (
              <article className="audit-job" key={job.jobId}>
                <div className="audit-job__summary">
                  <span className="audit-job__id">{job.jobId.slice(0, 8)}</span>
                  <span className={`audit-badge audit-badge--${job.status.toLowerCase()}`}>
                    {STATUS_LABEL[job.status]}
                  </span>
                  <span className="audit-job__field">
                    PID: <strong>{job.pid > 0 ? job.pid : '—'}</strong>
                  </span>
                  <span className="audit-job__field">
                    Progresso: <strong>{job.percent}%</strong>
                  </span>
                  <span className="audit-job__field">
                    Tempo de execução: <strong>{formatDuration(job.elapsedSeconds)}</strong>
                  </span>
                  <span className="audit-job__field">
                    Etapas: <strong>{job.steps.flatMap(splitStepIntoRows).length}</strong>
                  </span>
                </div>

                {Object.keys(job.reportDownloadUrls).length > 0 && (
                  <div className="audit-job__downloads">
                    <span className="audit-job__downloads-label">Relatórios concluídos:</span>
                    {Object.entries(job.reportDownloadUrls).map(([report, relativeUrl]) => (
                      <a
                        key={report}
                        className={`audit-download-button audit-download-button--${reportBadgeModifier(REPORT_LABELS[report] ?? report)}`}
                        href={resolveDownloadUrl(relativeUrl)}
                        download
                      >
                        ⬇ {REPORT_LABELS[report] ?? report}
                      </a>
                    ))}
                  </div>
                )}

                {job.steps.length > 0 && (
                  <div className="audit-job__steps">
                    {job.steps.map((step, stepIndex) => (
                      // Cada `step` e UMA atualizacao de progresso recebida do
                      // backend (um "poll") - pode conter varias linhas (uma
                      // por relatorio) depois de separada por splitStepIntoRows.
                      // O divisor entre grupos deixa claro onde uma atualizacao
                      // termina e a proxima comeca.
                      <div className="audit-job__poll-group" key={stepIndex}>
                        {stepIndex > 0 && (
                          <div className="audit-job__poll-divider">
                            <span>atualização #{stepIndex + 1}</span>
                          </div>
                        )}
                        {splitStepIntoRows(step, stepIndex).map((row) => (
                          <div className="audit-job__step" key={row.key}>
                            <time>{formatTimestamp(row.timestamp)}</time>
                            <span className="audit-job__step-percent">{row.percent}%</span>
                            {row.reportLabel && (
                              <span className={`audit-report-badge audit-report-badge--${reportBadgeModifier(row.reportLabel)}`}>
                                {row.reportLabel}
                              </span>
                            )}
                            <span>{row.text}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
