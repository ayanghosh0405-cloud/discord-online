// ===== Discord Online Controller - Frontend App =====
const socket = io();

// ===== DOM Elements =====
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const tokenInput = document.getElementById('token-input');
const rememberTokenCheck = document.getElementById('remember-token');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const toggleToken = document.getElementById('toggle-token');
const logoutBtn = document.getElementById('logout-btn');

// User info
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userTag = document.getElementById('user-tag');
const statusDot = document.getElementById('status-dot');

// Navigation & Panels
const navBtns = document.querySelectorAll('.nav-btn');
const contentPanels = document.querySelectorAll('.content-panel');
const pageTitle = document.getElementById('page-title');

// Stats Cards
const statUptime = document.getElementById('stat-uptime');
const statServers = document.getElementById('stat-servers');
const statVc = document.getElementById('stat-vc');
const statStream = document.getElementById('stat-stream');
const uptimeText = document.getElementById('uptime-text');
const memoryText = document.getElementById('memory-text');

// Status & Activity
const statusButtons = document.querySelectorAll('.status-btn');
const activityType = document.getElementById('activity-type');
const activityText = document.getElementById('activity-text');
const setActivityBtn = document.getElementById('set-activity-btn');

// Servers & Channels
const guildSelector = document.getElementById('guild-selector');
const voiceChannels = document.getElementById('voice-channels');
const serverList = document.getElementById('server-list');
const serversGrid = document.getElementById('servers-grid');
const serverSearch = document.getElementById('server-search');
const serverCountBadge = document.getElementById('server-count-badge');

// Messaging
const msgGuildSelector = document.getElementById('msg-guild-selector');
const textChannelSelector = document.getElementById('text-channel-selector');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const messageList = document.getElementById('message-list');

// Voice Controls
const vcInfo = document.getElementById('vc-info');
const vcStatusBadge = document.getElementById('vc-status-badge');
const btnMute = document.getElementById('btn-mute');
const btnDeafen = document.getElementById('btn-deafen');
const btnStream = document.getElementById('btn-stream');
const btnLeaveVc = document.getElementById('btn-leave-vc');
const streamPreview = document.getElementById('stream-preview');

// Quick VC Sidebar
const vcQuickStatus = document.getElementById('vc-quick-status');
const vcQuickName = document.getElementById('vc-quick-name');
const vcQuickGuild = document.getElementById('vc-quick-guild');
const quickMute = document.getElementById('quick-mute');
const quickDeafen = document.getElementById('quick-deafen');
const quickLeave = document.getElementById('quick-leave');

// Settings & System
const avatarUrlInput = document.getElementById('avatar-url-input');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const refreshStatsBtn = document.getElementById('refresh-stats-btn');
const sysStatus = document.getElementById('sys-status');
const sysRam = document.getElementById('sys-ram');
const sysUptime = document.getElementById('sys-uptime');
const sysBotUptime = document.getElementById('sys-bot-uptime');
const sysGuilds = document.getElementById('sys-guilds');
const sysUserid = document.getElementById('sys-userid');

// Overlays & Mobile
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const reconnectOverlay = document.getElementById('reconnect-overlay');
const reconnectInfo = document.getElementById('reconnect-info');
const reconnectStatus = document.getElementById('reconnect-status');

// ===== State =====
let currentGuildId = null;
let currentMsgGuildId = null;
let currentState = {
  loggedIn: false,
  guilds: []
};

// Load saved token from localStorage
const TOKEN_STORAGE_KEY = 'discord_controller_token';
const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
if (savedToken) {
  tokenInput.value = savedToken;
  if (rememberTokenCheck) rememberTokenCheck.checked = true;
}

// ===== Utility Functions =====
function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close">✕</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function switchScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  if (loading) {
    if (text) text.style.display = 'none';
    if (loader) loader.style.display = 'flex';
    btn.disabled = true;
  } else {
    if (text) text.style.display = '';
    if (loader) loader.style.display = 'none';
    btn.disabled = false;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Token Toggle =====
toggleToken.addEventListener('click', () => {
  tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
});

// ===== Login =====
loginBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (!token) {
    loginError.textContent = 'Please enter your Discord token';
    return;
  }
  loginError.textContent = '';
  setLoading(loginBtn, true);

  // Remember token if checked
  if (rememberTokenCheck && rememberTokenCheck.checked) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  socket.emit('login', token, {
    remember: rememberTokenCheck ? rememberTokenCheck.checked : false
  });
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// ===== Logout =====
logoutBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to disconnect?')) {
    socket.emit('logout');
    switchScreen(loginScreen);
    showToast('Logged out successfully', 'info');
  }
});

// ===== Tab Navigation =====
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.dataset.panel;
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    contentPanels.forEach(p => p.classList.remove('active'));
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    const titleSpan = btn.querySelector('span');
    if (titleSpan && pageTitle) {
      pageTitle.textContent = titleSpan.textContent;
    }

    // Close mobile sidebar on navigate
    if (sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      const overlay = document.querySelector('.sidebar-overlay');
      if (overlay) overlay.classList.remove('active');
    }

    // Refresh stats if settings opened
    if (panelId === 'settings-panel-page') {
      fetchSystemStats();
    }
  });
});

// ===== Mobile Menu =====
menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active');
});

// ===== Online Status Buttons =====
statusButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const status = btn.dataset.status;
    socket.emit('set_status', status);
    statusButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showToast(`Status changed to ${status}`, 'success');
  });
});

// ===== Custom Activity =====
setActivityBtn.addEventListener('click', () => {
  const text = activityText.value.trim();
  const type = activityType.value;
  if (!text) {
    return showToast('Please enter activity text', 'error');
  }
  socket.emit('set_custom_status', { text, type });
  showToast('Activity updated!', 'success');
});

// ===== Server & Voice Selectors =====
guildSelector.addEventListener('change', () => {
  const guildId = guildSelector.value;
  if (guildId) {
    currentGuildId = guildId;
    socket.emit('get_channels', guildId);
    voiceChannels.innerHTML = '<p class="empty-text">Loading channels...</p>';
  } else {
    voiceChannels.innerHTML = '<p class="empty-text">Select a server to browse voice channels</p>';
  }
});

// ===== Voice Controls =====
btnMute.addEventListener('click', () => {
  socket.emit('toggle_mute');
});

btnDeafen.addEventListener('click', () => {
  socket.emit('toggle_deafen');
});

btnStream.addEventListener('click', () => {
  if (currentState.isStreaming) {
    socket.emit('stop_stream');
  } else {
    socket.emit('start_stream');
  }
});

btnLeaveVc.addEventListener('click', () => {
  socket.emit('leave_vc');
  showToast('Leaving voice channel...', 'info');
});

// Quick Sidebar VC Controls
if (quickMute) quickMute.addEventListener('click', () => socket.emit('toggle_mute'));
if (quickDeafen) quickDeafen.addEventListener('click', () => socket.emit('toggle_deafen'));
if (quickLeave) quickLeave.addEventListener('click', () => {
  socket.emit('leave_vc');
  showToast('Left voice channel', 'info');
});

// ===== Server Search (Servers Page) =====
if (serverSearch) {
  serverSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const cards = serversGrid.querySelectorAll('.server-grid-card');
    cards.forEach(card => {
      const name = card.dataset.name ? card.dataset.name.toLowerCase() : '';
      if (name.includes(query)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// ===== Messages Page =====
if (msgGuildSelector) {
  msgGuildSelector.addEventListener('change', () => {
    const guildId = msgGuildSelector.value;
    if (guildId) {
      currentMsgGuildId = guildId;
      socket.emit('get_channels', guildId);
      textChannelSelector.innerHTML = '<option value="">Loading text channels...</option>';
    } else {
      textChannelSelector.innerHTML = '<option value="">Select a server first...</option>';
    }
  });
}

if (textChannelSelector) {
  textChannelSelector.addEventListener('change', () => {
    const channelId = textChannelSelector.value;
    if (channelId) {
      socket.emit('get_messages', channelId);
      messageList.innerHTML = '<p class="empty-text">Loading messages...</p>';
    }
  });
}

if (sendMessageBtn) {
  sendMessageBtn.addEventListener('click', () => {
    const channelId = textChannelSelector.value;
    const content = messageInput.value.trim();
    if (!channelId) return showToast('Please select a text channel first', 'error');
    if (!content) return;

    socket.emit('send_message', { channelId, content });
    messageInput.value = '';
  });
}

if (messageInput) {
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessageBtn.click();
  });
}

// ===== Settings Page =====
if (changeAvatarBtn) {
  changeAvatarBtn.addEventListener('click', () => {
    const url = avatarUrlInput.value.trim();
    if (!url) return showToast('Please enter an image URL', 'error');
    socket.emit('change_avatar', url);
    showToast('Updating avatar...', 'info');
  });
}

if (refreshStatsBtn) {
  refreshStatsBtn.addEventListener('click', () => {
    fetchSystemStats();
    showToast('System stats refreshed', 'info');
  });
}

async function fetchSystemStats() {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const data = await res.json();
      if (sysStatus) sysStatus.textContent = data.loggedIn ? 'Connected (24/7)' : 'Idle';
      if (sysRam) sysRam.textContent = `${data.rss} MB`;
      if (sysUptime) sysUptime.textContent = formatUptime(data.uptime);
      if (sysBotUptime) sysBotUptime.textContent = formatUptime(data.botUptime);
      if (sysGuilds) sysGuilds.textContent = data.guilds;
      if (sysUserid) sysUserid.textContent = currentState.userId || '--';
      if (memoryText) memoryText.textContent = `${data.rss}MB`;
    }
  } catch (e) {
    console.warn('Stats fetch error:', e);
  }
}

// Periodic memory polling every 10s
setInterval(fetchSystemStats, 10000);

// ===== Socket Events =====
socket.on('login_success', (state) => {
  setLoading(loginBtn, false);
  switchScreen(dashboardScreen);
  updateUI(state);
  showToast(`Connected as ${state.username}!`, 'success');
  if (reconnectOverlay) reconnectOverlay.classList.add('hidden');
  fetchSystemStats();
});

socket.on('login_error', (msg) => {
  setLoading(loginBtn, false);
  loginError.textContent = msg;
  showToast(msg, 'error');
});

socket.on('state_update', (state) => {
  currentState = state;
  if (state.loggedIn && loginScreen.classList.contains('active')) {
    switchScreen(dashboardScreen);
  }
  updateUI(state);
  if (state.loggedIn && reconnectOverlay) {
    reconnectOverlay.classList.add('hidden');
  }
});

socket.on('uptime_update', (uptime) => {
  const formatted = formatUptime(uptime);
  statUptime.textContent = formatted;
  uptimeText.textContent = formatted;
});

socket.on('channels_list', (data) => {
  renderVoiceChannels(data.voiceChannels, data.guildId);
  renderTextChannels(data.textChannels);
});

socket.on('vc_joined', (vc) => {
  showToast(`Joined voice channel: ${vc.channelName}`, 'success');
});

socket.on('vc_left', () => {
  showToast('Disconnected from voice channel', 'info');
});

socket.on('stream_started', () => {
  showToast('Screen share live with static image', 'success');
  if (streamPreview) streamPreview.classList.remove('hidden');
});

socket.on('stream_stopped', () => {
  showToast('Screen share stopped', 'info');
  if (streamPreview) streamPreview.classList.add('hidden');
});

socket.on('messages_list', (data) => {
  renderMessages(data.messages);
});

socket.on('message_sent', () => {
  showToast('Message sent!', 'success');
  const channelId = textChannelSelector.value;
  if (channelId) socket.emit('get_messages', channelId);
});

socket.on('avatar_changed', () => {
  showToast('Avatar updated successfully!', 'success');
  if (avatarUrlInput) avatarUrlInput.value = '';
});

socket.on('logged_out', () => {
  switchScreen(loginScreen);
  showToast('Logged out', 'info');
});

socket.on('bot_error', (msg) => {
  showToast(msg, 'error');
});

socket.on('bot_reconnecting', (data) => {
  if (reconnectOverlay) {
    reconnectOverlay.classList.remove('hidden');
    if (reconnectInfo) {
      reconnectInfo.textContent = `Attempting to reconnect (${data.attempt}/${data.maxAttempts})...`;
    }
  }
  if (reconnectStatus) {
    reconnectStatus.classList.remove('hidden');
  }
});

socket.on('connect', () => {
  const connStatus = document.getElementById('connection-status');
  if (connStatus) {
    connStatus.querySelector('.conn-dot').style.background = 'var(--green)';
    connStatus.querySelector('.conn-text').textContent = 'Connected';
    connStatus.style.borderColor = 'rgba(59, 165, 93, 0.25)';
    connStatus.style.background = 'rgba(59, 165, 93, 0.1)';
    connStatus.style.color = 'var(--green)';
  }
});

socket.on('disconnect', () => {
  const connStatus = document.getElementById('connection-status');
  if (connStatus) {
    connStatus.querySelector('.conn-dot').style.background = 'var(--red)';
    connStatus.querySelector('.conn-text').textContent = 'Reconnecting...';
    connStatus.style.borderColor = 'rgba(237, 66, 69, 0.25)';
    connStatus.style.background = 'rgba(237, 66, 69, 0.1)';
    connStatus.style.color = 'var(--red)';
  }
});

// ===== UI Update Logic =====
function updateUI(state) {
  if (!state.loggedIn) return;

  // Profile
  userAvatar.src = state.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
  userName.textContent = state.username;
  userTag.textContent = state.discriminator && state.discriminator !== '0' ? `#${state.discriminator}` : '';

  // Status dot
  statusDot.className = `status-dot ${state.status}`;

  // Active status button
  statusButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === state.status);
  });

  // Server count
  const guildCount = state.guilds ? state.guilds.length : 0;
  statServers.textContent = guildCount;
  if (serverCountBadge) serverCountBadge.textContent = `${guildCount} servers`;

  // Voice Channel Status
  if (state.currentVC) {
    statVc.textContent = state.currentVC.channelName;
    vcStatusBadge.textContent = 'Connected';
    vcStatusBadge.className = 'badge badge-green';
    vcInfo.innerHTML = `
      <div class="vc-connected-info">
        <div class="vc-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
        </div>
        <div class="vc-details">
          <div class="vc-channel-name">🔊 ${escapeHtml(state.currentVC.channelName)}</div>
          <div class="vc-guild-name">${escapeHtml(state.currentVC.guildName)}</div>
        </div>
      </div>
    `;
    btnMute.disabled = false;
    btnDeafen.disabled = false;
    btnStream.disabled = false;
    btnLeaveVc.disabled = false;

    // Sidebar quick VC widget
    if (vcQuickStatus) {
      vcQuickStatus.classList.remove('hidden');
      if (vcQuickName) vcQuickName.textContent = state.currentVC.channelName;
      if (vcQuickGuild) vcQuickGuild.textContent = state.currentVC.guildName;
    }
  } else {
    statVc.textContent = 'Not Connected';
    vcStatusBadge.textContent = 'Disconnected';
    vcStatusBadge.className = 'badge badge-red';
    vcInfo.innerHTML = '<p class="vc-not-connected">Select a server below and join a voice channel</p>';
    btnMute.disabled = true;
    btnDeafen.disabled = true;
    btnStream.disabled = true;
    btnLeaveVc.disabled = true;

    if (vcQuickStatus) {
      vcQuickStatus.classList.add('hidden');
    }
  }

  // Mute / Deafen button states
  btnMute.classList.toggle('active', state.isMuted);
  btnMute.classList.toggle('danger-active', state.isMuted);
  btnMute.querySelector('span').textContent = state.isMuted ? 'Unmute' : 'Mute';

  btnDeafen.classList.toggle('active', state.isDeafened);
  btnDeafen.classList.toggle('danger-active', state.isDeafened);
  btnDeafen.querySelector('span').textContent = state.isDeafened ? 'Undeafen' : 'Deafen';

  // Quick buttons active state
  if (quickMute) quickMute.classList.toggle('danger-active', state.isMuted);
  if (quickDeafen) quickDeafen.classList.toggle('danger-active', state.isDeafened);

  // Screen share button & preview
  btnStream.classList.toggle('active', state.isStreaming);
  btnStream.querySelector('span').textContent = state.isStreaming ? 'Stop Share' : 'Screen Share';
  statStream.textContent = state.isStreaming ? 'Live' : 'Off';
  if (streamPreview) {
    if (state.isStreaming) {
      streamPreview.classList.remove('hidden');
    } else {
      streamPreview.classList.add('hidden');
    }
  }

  // Populate server lists
  if (state.guilds && state.guilds.length > 0) {
    populateGuilds(state.guilds);
  }
}

function populateGuilds(guilds) {
  // Voice channel server dropdown
  const currentVal = guildSelector.value;
  guildSelector.innerHTML = '<option value="">Select a server...</option>';
  guilds.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    guildSelector.appendChild(opt);
  });
  if (currentVal) guildSelector.value = currentVal;

  // Messaging server dropdown
  if (msgGuildSelector) {
    const currentMsgVal = msgGuildSelector.value;
    msgGuildSelector.innerHTML = '<option value="">Select a server...</option>';
    guilds.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      msgGuildSelector.appendChild(opt);
    });
    if (currentMsgVal) msgGuildSelector.value = currentMsgVal;
  }

  // Server list in sidebar
  serverList.innerHTML = '';
  guilds.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'server-item';
    if (currentGuildId === g.id) btn.classList.add('active');

    const iconHtml = g.icon
      ? `<img src="${g.icon}" alt="${escapeHtml(g.name)}" class="server-icon">`
      : `<div class="server-icon-placeholder">${g.name.charAt(0).toUpperCase()}</div>`;

    btn.innerHTML = `${iconHtml}<span class="server-name">${escapeHtml(g.name)}</span>`;

    btn.addEventListener('click', () => {
      currentGuildId = g.id;
      guildSelector.value = g.id;
      guildSelector.dispatchEvent(new Event('change'));
      document.querySelectorAll('.server-item').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
    });

    serverList.appendChild(btn);
  });

  // Servers Page Grid
  if (serversGrid) {
    serversGrid.innerHTML = '';
    guilds.forEach(g => {
      const card = document.createElement('div');
      card.className = 'server-grid-card';
      card.dataset.name = g.name;

      const iconHtml = g.icon
        ? `<img src="${g.icon}" alt="${escapeHtml(g.name)}" class="server-grid-icon">`
        : `<div class="server-grid-icon placeholder">${g.name.charAt(0).toUpperCase()}</div>`;

      card.innerHTML = `
        ${iconHtml}
        <div class="server-grid-details">
          <h4 class="server-grid-name">${escapeHtml(g.name)}</h4>
          <span class="server-grid-members">👥 ${g.memberCount || 1} members</span>
        </div>
        <button class="btn btn-primary btn-sm browse-channels-btn">Browse VC</button>
      `;

      card.querySelector('.browse-channels-btn').addEventListener('click', () => {
        // Switch to voice tab and select this guild
        const voiceTabBtn = document.querySelector('.nav-btn[data-panel="voice-panel-page"]');
        if (voiceTabBtn) voiceTabBtn.click();
        guildSelector.value = g.id;
        guildSelector.dispatchEvent(new Event('change'));
      });

      serversGrid.appendChild(card);
    });
  }
}

function renderVoiceChannels(channels, guildId) {
  if (!channels || channels.length === 0) {
    voiceChannels.innerHTML = '<p class="empty-text">No voice channels found in this server</p>';
    return;
  }

  voiceChannels.innerHTML = '';
  channels.forEach(ch => {
    const item = document.createElement('div');
    item.className = 'channel-item';

    const membersCount = ch.members ? ch.members.length : 0;
    const limitText = ch.userLimit > 0 ? `${membersCount}/${ch.userLimit}` : `${membersCount}`;

    item.innerHTML = `
      <div class="channel-left">
        <span class="channel-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </span>
        <span class="channel-name">${escapeHtml(ch.name)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="channel-members">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          ${limitText}
        </span>
        <button class="join-btn" data-guild="${guildId}" data-channel="${ch.id}">Join</button>
      </div>
    `;

    item.querySelector('.join-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      socket.emit('join_vc', { guildId, channelId: ch.id });
      showToast(`Joining ${ch.name}...`, 'info');
    });

    voiceChannels.appendChild(item);
  });
}

function renderTextChannels(channels) {
  if (!textChannelSelector) return;
  const currentVal = textChannelSelector.value;
  textChannelSelector.innerHTML = '<option value="">Select a text channel...</option>';
  if (!channels || channels.length === 0) return;

  channels.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = `# ${ch.name}`;
    textChannelSelector.appendChild(opt);
  });
  if (currentVal) textChannelSelector.value = currentVal;
}

function renderMessages(messages) {
  if (!messageList) return;
  if (!messages || messages.length === 0) {
    messageList.innerHTML = '<p class="empty-text">No messages yet in this channel</p>';
    return;
  }

  messageList.innerHTML = '';
  messages.forEach(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item = document.createElement('div');
    item.className = 'msg-item';
    item.innerHTML = `
      <img src="${msg.authorAvatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="" class="msg-avatar">
      <div class="msg-content">
        <div class="msg-header">
          <span class="msg-author">${escapeHtml(msg.author)}</span>
          <span class="msg-time">${time}</span>
        </div>
        <div class="msg-text">${escapeHtml(msg.content)}</div>
      </div>
    `;
    messageList.appendChild(item);
  });

  messageList.scrollTop = messageList.scrollHeight;
}

// ===== Interactive Particles Background =====
(function initParticles() {
  const canvas = document.getElementById('particles-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particleCount = Math.min(Math.floor((width * height) / 25000), 45); // Lightweight
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.8 + 0.8,
      alpha: Math.random() * 0.4 + 0.2
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(88, 101, 242, ${p.alpha})`;
      ctx.fill();

      // Connect nearby particles with subtle lines
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(88, 101, 242, ${0.12 * (1 - dist / 110)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(render);
  }

  render();
})();
