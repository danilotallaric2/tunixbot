const statusEl = document.getElementById('activityStatus');
const retryBtn = document.getElementById('retryBtn');
const openDashboardBtn = document.getElementById('openDashboardBtn');

const ACTIVITY_TOKEN_STORAGE_KEY = 'tunixbot_activity_auth';

window.addEventListener('error', (event) => {
  setStatus(`Activity error: ${event?.message || 'Unknown error'}`, 'error');
  setRetryVisible(true);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const message = typeof reason === 'string' ? reason : reason?.message || 'Unknown promise rejection';
  setStatus(`Activity error: ${message}`, 'error');
  setRetryVisible(true);
});

const setStatus = (message, kind = 'info') => {
  if (!statusEl) return;
  statusEl.textContent = String(message || '');
  statusEl.classList.remove('ok', 'error');
  if (kind === 'ok') statusEl.classList.add('ok');
  if (kind === 'error') statusEl.classList.add('error');
};

const setRetryVisible = (visible) => {
  if (!retryBtn) return;
  retryBtn.classList.toggle('hidden', !visible);
};

const setDashboardLink = (url) => {
  if (!openDashboardBtn) return;
  openDashboardBtn.href = url || '/';
  openDashboardBtn.classList.remove('hidden');
};

const api = async (url, options = {}) => {
  const res = await fetch(url, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  return payload;
};

const isLikelyDiscordActivityContext = () => {
  const params = new URLSearchParams(window.location.search);
  const frameId = String(params.get('frame_id') || '').trim();
  if (frameId.length > 0) return true;

  // activity=1 is not enough to start Embedded SDK auth flow:
  // DiscordSDK requires frame_id from a real Discord Activity launch URL.
  return false;
};

const randomHex = (bytes = 16) => {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return [...array].map((v) => v.toString(16).padStart(2, '0')).join('');
};

const redirectToDashboard = (token) => {
  if (token) {
    sessionStorage.setItem(ACTIVITY_TOKEN_STORAGE_KEY, token);
  }

  const url = new URL('/', window.location.origin);
  const saved = token || sessionStorage.getItem(ACTIVITY_TOKEN_STORAGE_KEY) || '';
  if (saved) url.searchParams.set('activity_auth', saved);
  url.searchParams.set('activity', '1');
  window.location.replace(url.toString());
};

const launch = async () => {
  setRetryVisible(false);
  setStatus('Loading configuration...');

  const config = await api('/api/activity/config');
  setDashboardLink(config.dashboardUrl || '/');

  if (!isLikelyDiscordActivityContext()) {
    setStatus('This page must be opened from Discord Activity (missing frame_id).', 'error');
    return;
  }

  setStatus('Connecting to Discord Activity SDK...');
  const { DiscordSDK } = await import('/vendor/embedded-app-sdk/index.mjs');
  const discordSdk = new DiscordSDK(config.clientId);

  await discordSdk.ready();
  setStatus('Authorizing Discord user...');

  const { code } = await discordSdk.commands.authorize({
    client_id: config.clientId,
    response_type: 'code',
    state: randomHex(16),
    prompt: 'consent',
    scope: ['identify', 'guilds'],
    redirect_uri: config.redirectUri
  });

  if (!code) throw new Error('Discord authorization did not return a valid code.');

  setStatus('Creating dashboard session...');
  const auth = await api('/api/activity/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  if (!auth?.token) throw new Error('Missing activity auth token from server.');

  setStatus('Session ready. Opening dashboard...', 'ok');
  redirectToDashboard(auth.token);
};

retryBtn?.addEventListener('click', () => {
  launch().catch((error) => {
    setStatus(error.message || String(error), 'error');
    setRetryVisible(true);
  });
});

launch().catch((error) => {
  setStatus(error.message || String(error), 'error');
  setRetryVisible(true);
});
