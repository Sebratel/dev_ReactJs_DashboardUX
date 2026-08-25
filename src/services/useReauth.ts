import { useCallback, useRef, useState } from 'react';
import { fetchReauthStatus, startReauth, stopReauth } from './reauth';

const POLL_INTERVAL_MS = 2000;

export type ReauthState = {
  status: 'idle' | 'waiting-login' | 'logged-in' | 'failed';
  message: string;
};

const initialState: ReauthState = { status: 'idle', message: '' };

/**
 * Abre a tela de login remoto (noVNC) numa NOVA ABA - propositalmente
 * (nao um iframe): a Matrix bloqueia ser embutida via
 * X-Frame-Options/CSP frame-ancestors, e mesmo que nao bloqueasse, o
 * cookie de sessao fica no dominio da Matrix, ilegivel por JS desta
 * origem. A aba nova ainda e "so o browser" - nao abre nenhum app externo.
 */
export function useReauth() {
  const [state, setState] = useState<ReauthState>(initialState);
  const stopPollingRef = useRef(false);

  const begin = useCallback(async () => {
    stopPollingRef.current = false;
    setState({ status: 'waiting-login', message: 'Aguardando login...' });

    try {
      const { novncUrl } = await startReauth();
      window.open(novncUrl, '_blank', 'noopener,noreferrer');

      while (!stopPollingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (stopPollingRef.current) return;

        const status = await fetchReauthStatus();
        if (status.loggedIn) {
          setState({ status: 'logged-in', message: 'Login concluído com sucesso.' });
          return;
        }
        if (!status.active) {
          setState({ status: 'failed', message: 'A sessão de reautenticação foi encerrada.' });
          return;
        }
      }
    } catch (error) {
      if (stopPollingRef.current) return;
      setState({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Falha ao iniciar a reautenticação.',
      });
    }
  }, []);

  const cancel = useCallback(() => {
    stopPollingRef.current = true;
    setState(initialState);
    void stopReauth();
  }, []);

  return { ...state, begin, cancel };
}
