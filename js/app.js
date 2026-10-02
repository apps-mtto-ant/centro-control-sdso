import { initOfflineLayer, getLastSyncLabel } from './offline.js';
import { api } from './api.js';
import { auth } from './auth.js';

const APP_CONFIG = globalThis.SDSO_CONFIG;
const titles = Object.freeze({
  inicio: 'Inicio',
  compresores: 'Compresores',
  'centro-informe': 'Centro Informe',
  apps: 'Aplicaciones SDSO',
  powerbi: 'Power BI',
  informes: 'Informes / herramientas'
});

let deferredInstallPrompt = null;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function svgIcon(name) {
  const icons = {
    inicio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    compresores: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
    informe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/></svg>',
    apps: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>',
    powerbi: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="3" height="8"/><rect x="10.5" y="7" width="3" height="12"/><rect x="16" y="4" width="3" height="15"/></svg>',
    tools: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5a4 4 0 0 0 4.8 5.8l-7.9 7.9-3.6-3.6 7.9-7.9a4 4 0 0 0-1.2-2.2z"/></svg>'
  };
  return icons[name] || '';
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function currentSectionFromHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  return titles[raw] ? raw : 'inicio';
}

function setDrawer(open) {
  const sidebar = $('#sidebar');
  const overlay = $('#drawerOverlay');
  sidebar.classList.toggle('is-open', open);
  overlay.hidden = !open;
  $('#menuToggle').setAttribute('aria-expanded', String(open));
  if (window.matchMedia('(max-width: 820px)').matches) sidebar.inert = !open;
  else sidebar.inert = false;
}

function renderSection(section) {
  if (!titles[section]) section = 'inicio';
  $$('.view').forEach(view => view.classList.toggle('is-visible', view.dataset.view === section));
  $$('.nav-item').forEach(link => {
    const active = link.dataset.section === section;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('#pageTitle').textContent = titles[section];
  $('#content').focus({ preventScroll: true });
  setDrawer(false);
}

function updateConnectivity() {
  const online = navigator.onLine;
  const states = $$('.connection-badge');
  states.forEach(badge => { badge.dataset.state = online ? 'online' : 'offline'; });
  $$('.connection-text').forEach(el => { el.textContent = online ? 'EN LÍNEA' : 'SIN CONEXIÓN'; });
  $('#heroConnection').textContent = online ? 'En línea' : 'Sin conexión';
  const sync = getLastSyncLabel();
  $$('.last-sync').forEach(el => { el.textContent = sync; });
  $('#heroSync').textContent = sync === 'Sin sincronizar' ? sync : `Última sincronización: ${sync}`;
}

function isSafeHttps(url) {
  if (!url) return false;
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

function configureExternalLink(anchor, linkConfig, pendingLabel) {
  anchor.replaceChildren();
  if (isSafeHttps(linkConfig.url)) {
    anchor.href = linkConfig.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = 'Abrir ↗';
    anchor.classList.remove('is-disabled');
    anchor.removeAttribute('aria-disabled');
    anchor.removeAttribute('tabindex');
  } else {
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    anchor.textContent = pendingLabel;
    anchor.classList.add('is-disabled');
    anchor.setAttribute('aria-disabled', 'true');
    anchor.setAttribute('tabindex', '-1');
  }
}

function configureExternalLinks() {
  const compressors = APP_CONFIG.links.compressors;
  const report = APP_CONFIG.links.turnReport;
  configureExternalLink($('#compressorsExternalLink'), compressors, 'URL pendiente');
  $('#compressorsExternalLink').textContent = isSafeHttps(compressors.url) ? 'Abrir App Compresores ↗' : 'URL pendiente';
  configureExternalLink($('#turnReportExternalLink'), report, 'URL pendiente');
  $('#turnReportExternalLink').textContent = isSafeHttps(report.url) ? 'Abrir Centro Informe ↗' : 'URL pendiente';
  $('#centroInformeHint').hidden = isSafeHttps(report.url);
}

function appendResourceCard(root, app) {
  const article = document.createElement('article');
  article.className = 'resource-card';

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = 'APP SDSO';

  const title = document.createElement('h3');
  title.textContent = app.name;

  const description = document.createElement('p');
  description.textContent = app.description;

  const action = document.createElement('a');
  action.className = 'primary-btn';
  configureExternalLink(action, app, 'URL pendiente');

  article.append(badge, title, description, action);
  root.append(article);
}

function renderAppsCatalog() {
  const root = $('#appsCatalog');
  root.replaceChildren();
  Object.values(APP_CONFIG.links).forEach(app => appendResourceCard(root, app));
}

function decorateIcons() {
  const map = {
    inicio: 'inicio', compresores: 'compresores', 'centro-informe': 'informe',
    apps: 'apps', powerbi: 'powerbi', informes: 'tools'
  };
  $$('.nav-item').forEach(item => {
    const target = $('.nav-icon', item);
    target.innerHTML = svgIcon(map[item.dataset.section]);
  });
  $$('[data-module-icon]').forEach(el => { el.innerHTML = svgIcon(el.dataset.moduleIcon); });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
  } catch (error) {
    console.error('No fue posible registrar el Service Worker:', error);
  }
}

function bindEvents() {
  $('#menuToggle').addEventListener('click', () => setDrawer(!$('#sidebar').classList.contains('is-open')));
  $('#drawerOverlay').addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setDrawer(false); });
  window.addEventListener('hashchange', () => renderSection(currentSectionFromHash()));
  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 820px)').matches) setDrawer(false);
  });

  $('#refreshButton').addEventListener('click', () => {
    updateConnectivity();
    showToast(navigator.onLine ? 'Conexión disponible' : 'No hay conexión disponible');
  });
  window.addEventListener('online', () => { updateConnectivity(); showToast('Conexión restablecida'); });
  window.addEventListener('offline', () => { updateConnectivity(); showToast('Centro operando sin conexión'); });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('#installButton').hidden = false;
  });
  $('#installButton').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#installButton').hidden = true;
  });
}

function boot() {
  document.documentElement.dataset.appVersion = APP_CONFIG.version;
  $('#versionLabel').textContent = `VERSIÓN ${APP_CONFIG.version}`;
  decorateIcons();
  configureExternalLinks();
  renderAppsCatalog();
  bindEvents();
  initOfflineLayer();
  updateConnectivity();
  renderSection(currentSectionFromHash());

  // Contratos preparados; v0.1.1 no fuerza backend ni autenticación.
  void api;
  void auth;

  registerServiceWorker();
}

boot();
