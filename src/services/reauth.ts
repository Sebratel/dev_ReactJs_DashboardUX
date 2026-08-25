const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const REAUTH_URL = `${API_BASE_URL}/reports/reauth`;

export type ReauthStatus = {
  active: boolean;
  loggedIn: boolean;
  novncUrl: string;
};

async function call(path: string): Promise<ReauthStatus> {
  const response = await fetch(`${REAUTH_URL}${path}`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('Falha ao acessar o fluxo de reautenticação.');
  }
  return response.json();
}

export function startReauth(): Promise<ReauthStatus> {
  return call('/start');
}

export function stopReauth(): Promise<ReauthStatus> {
  return call('/stop');
}

export async function fetchReauthStatus(): Promise<ReauthStatus> {
  const response = await fetch(`${REAUTH_URL}/status`);
  if (!response.ok) {
    throw new Error('Falha ao consultar o status da reautenticação.');
  }
  return response.json();
}
