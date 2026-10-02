const LAST_SYNC_KEY = 'sdso:lastSync';

function pad(value) {
  return String(value).padStart(2, '0');
}

export function markSuccessfulSync(date = new Date()) {
  localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
}

export function getLastSyncLabel() {
  const value = localStorage.getItem(LAST_SYNC_KEY);
  if (!value) return 'Sin sincronizar';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin sincronizar';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function initOfflineLayer() {
  // v0.1.1: no se inventa una sincronización. Solo api.js podrá marcarla tras una respuesta real del backend.
  // IndexedDB y cola offline se incorporarán en una etapa posterior.
}
