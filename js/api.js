import { markSuccessfulSync } from './offline.js';

const config = globalThis.SDSO_CONFIG;
const DEFAULT_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = Object.freeze({
  get configured() {
    return Boolean(config?.backendUrl);
  },

  async health() {
    if (!config?.backendUrl) return { ok: false, configured: false };
    const response = await fetchWithTimeout(`${config.backendUrl}?action=health`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data?.ok) markSuccessfulSync();
    return data;
  }
});
