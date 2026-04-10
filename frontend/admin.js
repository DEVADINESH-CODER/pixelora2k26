const adminUnlock = document.getElementById('admin-unlock');
const adminRefresh = document.getElementById('admin-refresh');
const adminDownload = document.getElementById('admin-download');
const adminReset = document.getElementById('admin-reset');
const adminSecret = document.getElementById('admin-secret');
const adminViewFilter = document.getElementById('admin-view-filter');
const adminPageCode = document.getElementById('admin-page-code');
const adminOpenView = document.getElementById('admin-open-view');
const adminStatus = document.getElementById('admin-status');
const adminRegistrationBody = document.getElementById('admin-registration-body');
const adminTeamBody = document.getElementById('admin-team-body');
const adminFoodBody = document.getElementById('admin-food-body');
const adminFoodSummary = document.getElementById('admin-food-summary');
const adminViews = {
  registration: document.getElementById('admin-view-registration'),
  team: document.getElementById('admin-view-team'),
  food: document.getElementById('admin-view-food')
};

const APP_CONFIG = window.__PIXELORA_CONFIG__ || {};
const configuredApiBaseUrl = String(APP_CONFIG.apiBaseUrl || '').trim().replace(/\/+$/, '');
const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalHost ? '' : configuredApiBaseUrl;
const ADMIN_SHORTCUT_AUTH_KEY = 'pixelora-admin-shortcut-auth';

let unlockedSecret = '';
let cachedRegistrations = [];
let activeAdminView = 'registration';

const ADMIN_PAGE_CODES = {
  registration: ['REG', 'REGISTRATION', 'R'],
  team: ['TEAM', 'T'],
  food: ['FOOD', 'F']
};

function buildApiUrl(path) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function setAdminStatus(message, type) {
  if (!adminStatus) return;
  adminStatus.textContent = message;
  adminStatus.classList.remove('ok', 'err');
  if (type) adminStatus.classList.add(type);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatAdminTeam(team) {
  if (!team) return '<span>None</span>';
  const members = Array.isArray(team.members) ? team.members.join(', ') : '';
  return `
    <div class="admin-team">
      <strong>${escapeHtml(team.teamName || '—')}</strong>
      <span>Leader: ${escapeHtml(team.teamLeader || '—')}</span>
      <span>Size: ${escapeHtml(team.teamSize || '—')}</span>
      <span>Members: ${escapeHtml(members || '—')}</span>
    </div>
  `;
}

function normalizeMemberRecord(member) {
  if (!member || typeof member !== 'object') {
    return {
      memberId: '',
      name: '',
      email: '',
      phone: '',
      food: '',
      technicalEvent: '',
      nonTechnicalEvent: ''
    };
  }

  return {
    memberId: String(member.memberId || '').trim(),
    name: String(member.name || '').trim(),
    email: String(member.email || '').trim(),
    phone: String(member.phone || '').trim(),
    food: String(member.food || '').trim(),
    technicalEvent: String(member.technicalEvent || '').trim(),
    nonTechnicalEvent: String(member.nonTechnicalEvent || '').trim()
  };
}

function getTeamMembers(registration) {
  if (!Array.isArray(registration?.teamMembers)) return [];
  return registration.teamMembers.map(normalizeMemberRecord).filter((member) => member.name || member.email || member.phone);
}

function getParticipants(registration) {
  const leader = {
    name: String(registration?.name || '').trim(),
    role: 'Leader',
    technicalEvent: String(registration?.technicalEvents || '').trim(),
    nonTechnicalEvent: String(registration?.nonTechnicalEvents || '').trim(),
    food: String(registration?.food || '').trim(),
    leaderName: String(registration?.name || '').trim()
  };

  const members = getTeamMembers(registration).map((member) => ({
    name: member.name || member.memberId || 'Member',
    role: 'Member',
    technicalEvent: member.technicalEvent,
    nonTechnicalEvent: member.nonTechnicalEvent,
    food: member.food,
    leaderName: String(registration?.name || '').trim()
  }));

  return [leader, ...members];
}

function filterRegistrationsByView(registrations) {
  const filter = String(adminViewFilter?.value || 'all').toLowerCase();
  if (filter === 'all') return registrations;

  return registrations.filter((registration) => {
    const hasTechnical = Boolean(String(registration?.technicalEvents || '').trim());
    const hasNonTechnical = Boolean(String(registration?.nonTechnicalEvents || '').trim());

    if (filter === 'technical') return hasTechnical;
    if (filter === 'nontechnical') return hasNonTechnical;
    if (filter === 'both') return hasTechnical && hasNonTechnical;
    return true;
  });
}

function renderRegistrationView(registrations) {
  if (!adminRegistrationBody) return;

  if (!registrations.length) {
    adminRegistrationBody.innerHTML = '<tr><td class="admin-empty" colspan="6">No registrations found.</td></tr>';
    return;
  }

  adminRegistrationBody.innerHTML = registrations.map((registration) => {
    const members = getTeamMembers(registration);
    const memberLines = members.length
      ? members.map((member) => `${member.name || 'Member'} (${member.food || 'N/A'})`).join(', ')
      : 'No members added';

    return `
    <tr>
      <td>
        <strong>${escapeHtml(registration.name)}</strong><br>
        <span style="opacity:.7">${escapeHtml(registration.email)}</span><br>
        <span style="opacity:.7">${escapeHtml(registration.whatsapp)}</span><br>
        <span style="opacity:.85">Food: ${escapeHtml(registration.food || 'N/A')}</span>
      </td>
      <td>${escapeHtml(registration.technicalEvents || '—')}</td>
      <td>${escapeHtml(registration.nonTechnicalEvents || '—')}</td>
      <td>${escapeHtml(memberLines)}</td>
      <td>${renderPaymentScreenshotCell(registration.paymentScreenshot)}</td>
      <td>${escapeHtml(registration.createdAt)}</td>
    </tr>
  `;
  }).join('');
}

function renderTeamView(registrations) {
  if (!adminTeamBody) return;

  const rows = [];
  registrations.forEach((registration) => {
    const members = getTeamMembers(registration);

    if (registration.technicalEvents) {
      const technicalMembers = members.filter((member) => member.technicalEvent === registration.technicalEvents);
      rows.push({
        category: 'Technical',
        event: registration.technicalEvents,
        leader: registration.name,
        members: technicalMembers.map((member) => `${member.name} (${member.food || 'N/A'})`).join(', ') || 'None',
        total: 1 + technicalMembers.length
      });
    }

    if (registration.nonTechnicalEvents) {
      const nonTechnicalMembers = members.filter((member) => member.nonTechnicalEvent === registration.nonTechnicalEvents);
      rows.push({
        category: 'Non-Technical',
        event: registration.nonTechnicalEvents,
        leader: registration.name,
        members: nonTechnicalMembers.map((member) => `${member.name} (${member.food || 'N/A'})`).join(', ') || 'None',
        total: 1 + nonTechnicalMembers.length
      });
    }
  });

  if (!rows.length) {
    adminTeamBody.innerHTML = '<tr><td class="admin-empty" colspan="5">No team/event data found.</td></tr>';
    return;
  }

  adminTeamBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.event)}</td>
      <td>${escapeHtml(row.leader)}</td>
      <td>${escapeHtml(row.members)}</td>
      <td>${escapeHtml(row.total)}</td>
    </tr>
  `).join('');
}

function renderFoodView(registrations) {
  if (!adminFoodBody || !adminFoodSummary) return;

  const participants = registrations.flatMap((registration) => getParticipants(registration));
  const vegCount = participants.filter((participant) => participant.food === 'Veg').length;
  const nonVegCount = participants.filter((participant) => participant.food === 'Non-Veg').length;
  const unassignedCount = participants.filter((participant) => !participant.food).length;

  adminFoodSummary.innerHTML = `
    <div class="admin-food-card"><span>Total Participants</span><strong>${participants.length}</strong></div>
    <div class="admin-food-card"><span>Veg</span><strong>${vegCount}</strong></div>
    <div class="admin-food-card"><span>Non-Veg</span><strong>${nonVegCount}</strong></div>
    <div class="admin-food-card"><span>Not Selected</span><strong>${unassignedCount}</strong></div>
  `;

  if (!participants.length) {
    adminFoodBody.innerHTML = '<tr><td class="admin-empty" colspan="6">No food data found.</td></tr>';
    return;
  }

  adminFoodBody.innerHTML = participants.map((participant) => `
    <tr>
      <td>${escapeHtml(participant.name || 'Unknown')}</td>
      <td>${escapeHtml(participant.role)}</td>
      <td>${escapeHtml(participant.technicalEvent || '—')}</td>
      <td>${escapeHtml(participant.nonTechnicalEvent || '—')}</td>
      <td>${escapeHtml(participant.food || 'Not selected')}</td>
      <td>${escapeHtml(participant.leaderName || '—')}</td>
    </tr>
  `).join('');
}

function renderAdminRegistrations(registrations) {
  const filteredRegistrations = filterRegistrationsByView(registrations);
  renderRegistrationView(filteredRegistrations);
  renderTeamView(filteredRegistrations);
  renderFoodView(filteredRegistrations);
}

function setAdminView(viewName) {
  const normalized = ['registration', 'team', 'food'].includes(viewName) ? viewName : 'registration';
  activeAdminView = normalized;
  Object.entries(adminViews).forEach(([key, element]) => {
    if (!element) return;
    element.classList.toggle('active', key === normalized);
  });
}

function resolveAdminViewFromCode(codeValue) {
  const code = String(codeValue || '').trim().toUpperCase();
  if (!code) return null;

  for (const [view, codes] of Object.entries(ADMIN_PAGE_CODES)) {
    if (codes.includes(code)) return view;
  }
  return null;
}

function openAdminViewByCode() {
  const resolved = resolveAdminViewFromCode(adminPageCode?.value || '');
  if (!resolved) {
    setAdminStatus('Invalid page code. Use REG, TEAM, or FOOD.', 'err');
    return;
  }

  setAdminView(resolved);
  setAdminStatus(`Opened ${resolved.toUpperCase()} view.`, 'ok');
}

function resolvePaymentScreenshotUrl(reference) {
  const value = String(reference || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return buildApiUrl(normalizedPath);
}

function renderPaymentScreenshotCell(reference) {
  const resolvedUrl = resolvePaymentScreenshotUrl(reference);
  if (!resolvedUrl) return '<span>Not uploaded</span>';

  return `<a href="${escapeHtml(resolvedUrl)}" target="_blank" rel="noopener noreferrer" class="admin-view-link">View Image</a>`;
}

function getSecretFromInput() {
  return adminSecret?.value?.trim() || '';
}

function getSecretFromStorage() {
  return (localStorage.getItem('pixelora-admin-secret') || '').trim();
}

function ensureUnlockedSecret() {
  if (unlockedSecret) return unlockedSecret;

  const typed = getSecretFromInput();
  if (typed) return typed;

  return '';
}

async function fetchRegistrations(secret) {
  const response = await fetch(buildApiUrl('/api/admin/registrations'), {
    headers: { 'X-Admin-Secret': secret }
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.detail || result.error || 'Unable to load registrations.');
  }

  return Array.isArray(result.registrations) ? result.registrations : [];
}

async function unlockAdminPortal() {
  const secret = getSecretFromInput();
  if (!secret) {
    setAdminStatus('Admin secret is required.', 'err');
    return;
  }

  setAdminStatus('Verifying admin secret...', null);

  try {
    const registrations = await fetchRegistrations(secret);
    cachedRegistrations = registrations;
    unlockedSecret = secret;
    localStorage.setItem('pixelora-admin-secret', secret);
    sessionStorage.setItem(ADMIN_SHORTCUT_AUTH_KEY, String(Date.now()));
    renderAdminRegistrations(registrations);
    setAdminStatus(`Loaded ${registrations.length} registrations.`, 'ok');
  } catch (error) {
    unlockedSecret = '';
    setAdminStatus(error.message || 'Invalid admin secret.', 'err');
    renderAdminRegistrations([]);
  }
}

async function loadAdminRegistrations() {
  const secret = ensureUnlockedSecret();
  if (!secret) {
    setAdminStatus('Enter admin secret and click Unlock first.', 'err');
    return;
  }

  setAdminStatus('Loading registrations...', null);

  try {
    const registrations = await fetchRegistrations(secret);
    cachedRegistrations = registrations;
    renderAdminRegistrations(registrations);
    setAdminStatus(`Loaded ${registrations.length} registrations.`, 'ok');
  } catch (error) {
    setAdminStatus(error.message || 'Unable to load registrations.', 'err');
  }
}

async function downloadAdminCsv() {
  const secret = ensureUnlockedSecret();
  if (!secret) {
    setAdminStatus('Enter admin secret and click Unlock first.', 'err');
    return;
  }

  setAdminStatus('Preparing CSV download...', null);

  try {
    const response = await fetch(buildApiUrl('/api/admin/registrations.csv'), {
      headers: { 'X-Admin-Secret': secret }
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.detail || result.error || 'Unable to download CSV.');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pixelora-registrations.csv';
    anchor.click();
    URL.revokeObjectURL(url);

    setAdminStatus('CSV download started.', 'ok');
  } catch (error) {
    setAdminStatus(error.message || 'Unable to download CSV.', 'err');
  }
}

async function resetAllRegistrations() {
  const secret = ensureUnlockedSecret();
  if (!secret) {
    setAdminStatus('Enter admin secret and click Unlock first.', 'err');
    return;
  }

  const confirmed = window.confirm('Delete all registrations and reset IPL slots back to 10?');
  if (!confirmed) return;

  setAdminStatus('Deleting all registration data...', null);

  try {
    const response = await fetch(buildApiUrl('/api/admin/registrations'), {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': secret }
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.detail || result.error || 'Unable to delete registrations.');
    }

    await loadAdminRegistrations();
    setAdminStatus('All registrations deleted. IPL slots are reset to 10.', 'ok');
  } catch (error) {
    setAdminStatus(error.message || 'Unable to delete registrations.', 'err');
  }
}

if (adminUnlock) {
  adminUnlock.addEventListener('click', unlockAdminPortal);
}

if (adminRefresh) {
  adminRefresh.addEventListener('click', loadAdminRegistrations);
}

if (adminDownload) {
  adminDownload.addEventListener('click', downloadAdminCsv);
}

if (adminReset) {
  adminReset.addEventListener('click', resetAllRegistrations);
}

if (adminViewFilter) {
  adminViewFilter.addEventListener('change', () => {
    renderAdminRegistrations(cachedRegistrations);
  });
}

if (adminOpenView) {
  adminOpenView.addEventListener('click', openAdminViewByCode);
}

if (adminPageCode) {
  adminPageCode.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      openAdminViewByCode();
    }
  });
}

if (adminSecret) {
  adminSecret.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      unlockAdminPortal();
    }
  });
}

if (adminSecret) {
  adminSecret.value = getSecretFromStorage();
}

if (sessionStorage.getItem(ADMIN_SHORTCUT_AUTH_KEY) && getSecretFromStorage()) {
  unlockAdminPortal();
} else {
  setAdminStatus('Enter admin secret and click Unlock to continue.', null);
}

setAdminView(activeAdminView);
