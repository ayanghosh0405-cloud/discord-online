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
const clearActivityBtn = document.getElementById('clear-activity-btn');
const streamingOptions = document.getElementById('streaming-options');
const activityStreamUrl = document.getElementById('activity-stream-url');
const activityDetails = document.getElementById('activity-details');
const activityState = document.getElementById('activity-state');
const activityImageUrl = document.getElementById('activity-image-url');
const activityPhotoFileInput = document.getElementById('activity-photo-file-input');
const btnUploadPhoto = document.getElementById('btn-upload-photo');
const btnUseStreamJpg = document.getElementById('btn-use-stream-jpg');
const uploadStatus = document.getElementById('upload-status');
const activityLiveBadge = document.getElementById('activity-live-badge');
const activityCleanBadge = document.getElementById('activity-clean-badge');
const currentStatusBadge = document.getElementById('current-status-badge');

// Discord Card Preview Elements
const previewActivityImg = document.getElementById('preview-activity-img');
const previewImagePlaceholder = document.getElementById('preview-image-placeholder');
const previewActivityName = document.getElementById('preview-activity-name');
const previewActivityDetails = document.getElementById('preview-activity-details');
const previewActivityState = document.getElementById('preview-activity-state');
const previewActivityTimer = document.getElementById('preview-activity-timer');
const discordActivePreview = document.getElementById('discord-active-preview');
const discordCleanPreview = document.getElementById('discord-clean-preview');
const cleanPreviewAvatar = document.getElementById('clean-preview-avatar');
const cleanPreviewUsername = document.getElementById('clean-preview-username');

// Keep-Alive Elements
const keepaliveStatusBadge = document.getElementById('keepalive-status-badge');
const btnTestPing = document.getElementById('btn-test-ping');
const keepaliveUrlInput = document.getElementById('keepalive-url-input');
const btnCopyPingUrl = document.getElementById('btn-copy-ping-url');
const keepalivePingTime = document.getElementById('keepalive-ping-time');

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

// Load saved token from localStorage or use default
const DEFAULT_TOKEN = 'MTA5MDIyNjg0NTU0MDE1OTQ5MQ.GJ4mKJ.MQ-f9Aq6fjiBym90CaEOsLC8FayoqEaumEqKgg';
const TOKEN_STORAGE_KEY = 'discord_controller_token';
const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY) || DEFAULT_TOKEN;
if (tokenInput) {
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

// ===== Custom Activity & Streaming Presence =====
let streamTimerInterval = null;
let streamTimerSeconds = 0;

function updateDiscordPreview() {
  const type = activityType ? activityType.value : 'NONE';
  const name = (activityText && activityText.value.trim()) || '';
  const rawDetails = (activityDetails && activityDetails.value.trim()) || '';
  const details = (rawDetails && rawDetails !== 'Screen Share (Go-Live)') ? rawDetails : '';
  const state = (activityState && activityState.value.trim()) || '';
  const photo = (activityImageUrl && activityImageUrl.value.trim()) || '';

  // If type is NONE or user cleared activity, show the Clean Profile Preview (no play button)
  if (type === 'NONE' || (!name && type !== 'STREAMING')) {
    if (streamingOptions) streamingOptions.style.display = 'none';
    if (discordActivePreview) discordActivePreview.style.display = 'none';
    if (discordCleanPreview) discordCleanPreview.style.display = 'flex';
    if (activityCleanBadge) activityCleanBadge.style.display = 'inline-flex';
    if (activityLiveBadge) activityLiveBadge.style.display = 'none';
    if (cleanPreviewUsername) cleanPreviewUsername.textContent = currentState.username || 'Ayan1924C';
    if (cleanPreviewAvatar && currentState.avatar) cleanPreviewAvatar.src = currentState.avatar;
    return;
  }

  // Otherwise, show active Rich Presence / Streaming card
  if (streamingOptions) streamingOptions.style.display = 'flex';
  if (discordActivePreview) discordActivePreview.style.display = 'block';
  if (discordCleanPreview) discordCleanPreview.style.display = 'none';
  if (activityCleanBadge) activityCleanBadge.style.display = 'none';
  if (activityLiveBadge) activityLiveBadge.style.display = (type === 'STREAMING') ? 'inline-flex' : 'none';

  if (previewActivityName) previewActivityName.textContent = name || '^ ANE WALA STAR !!';
  if (previewActivityDetails) {
    if (details) {
      previewActivityDetails.textContent = details;
      previewActivityDetails.style.display = 'block';
    } else {
      previewActivityDetails.textContent = '';
      previewActivityDetails.style.display = 'none';
    }
  }

  if (previewActivityState) {
    if (state) {
      previewActivityState.textContent = state;
      previewActivityState.style.display = 'block';
    } else {
      previewActivityState.style.display = 'none';
    }
  }

  // Photo preview
  if (previewActivityImg && previewImagePlaceholder) {
    if (photo) {
      previewActivityImg.src = photo;
      previewActivityImg.style.display = 'block';
      previewImagePlaceholder.style.display = 'none';
    } else {
      previewActivityImg.src = '/stream.jpg';
      previewActivityImg.style.display = 'block';
      previewImagePlaceholder.style.display = 'none';
    }
  }

  // Update card header text & live indicators
  const cardHeader = document.querySelector('.discord-activity-header');
  if (cardHeader) {
    cardHeader.textContent = type === 'STREAMING' ? 'STREAMING' : (type === 'PLAYING' ? 'PLAYING A GAME' : type);
  }

  const previewBadgeStatus = document.querySelector('.preview-badge-status');
  if (previewBadgeStatus) {
    if (type === 'STREAMING') {
      previewBadgeStatus.innerHTML = '<span class="purple-stream-dot"></span> Streaming';
      previewBadgeStatus.style.display = 'inline-flex';
    } else {
      previewBadgeStatus.innerHTML = `<span class="badge-dot ${type.toLowerCase()}"></span> ${type}`;
      previewBadgeStatus.style.display = 'inline-flex';
    }
  }
}

function startPreviewTimer() {
  if (streamTimerInterval) clearInterval(streamTimerInterval);
  streamTimerSeconds = 0;
  streamTimerInterval = setInterval(() => {
    streamTimerSeconds++;
    const mins = Math.floor(streamTimerSeconds / 60).toString().padStart(2, '0');
    const secs = (streamTimerSeconds % 60).toString().padStart(2, '0');
    if (previewActivityTimer) {
      previewActivityTimer.textContent = `${mins}:${secs} elapsed`;
    }
  }, 1000);
}

// Live typing sync to preview card
if (activityText) activityText.addEventListener('input', updateDiscordPreview);
if (activityDetails) activityDetails.addEventListener('input', updateDiscordPreview);
if (activityState) activityState.addEventListener('input', updateDiscordPreview);
if (activityImageUrl) activityImageUrl.addEventListener('input', updateDiscordPreview);

// Photo Upload Handler (Upload file from device directly to server & Discord)
if (btnUploadPhoto && activityPhotoFileInput) {
  btnUploadPhoto.addEventListener('click', () => {
    activityPhotoFileInput.click();
  });

  // Listen for socket upload confirmations
  if (typeof socket !== 'undefined' && socket) {
    socket.on('upload_photo_result', (res) => {
      if (res && res.success && res.url) {
        if (activityImageUrl) activityImageUrl.value = res.url;
        if (uploadStatus) {
          uploadStatus.textContent = res.isDiscordCdn
            ? '✅ Uploaded to Discord CDN! Ready for stream.'
            : '✅ Photo uploaded successfully! Ready for stream.';
          uploadStatus.className = 'upload-status-text success';
        }
        updateDiscordPreview();
      }
    });
  }

  activityPhotoFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, GIF, WebP)', 'error');
      return;
    }

    if (uploadStatus) {
      uploadStatus.textContent = '⏳ Processing and uploading photo...';
      uploadStatus.className = 'upload-status-text';
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      
      // Set image URL to base64 immediately for instantaneous local use
      if (activityImageUrl) activityImageUrl.value = base64;
      if (previewActivityImg) {
        previewActivityImg.src = base64;
        previewActivityImg.style.display = 'block';
        if (previewImagePlaceholder) previewImagePlaceholder.style.display = 'none';
      }
      updateDiscordPreview();

      // Emit over WebSocket immediately
      try {
        if (typeof socket !== 'undefined' && socket && socket.connected) {
          socket.emit('upload_stream_photo', {
            image: base64,
            filename: file.name
          });
        }
      } catch (e) {
        console.warn('Socket upload emit error:', e);
      }

      // Also POST to HTTP endpoint in parallel
      try {
        const response = await fetch('/api/upload-stream-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            filename: file.name
          })
        });
        const result = await response.json();
        if (result.success && result.url) {
          if (activityImageUrl) activityImageUrl.value = result.url;
          if (uploadStatus) {
            uploadStatus.textContent = result.isDiscordCdn 
              ? '✅ Uploaded to Discord CDN! Ready for stream.'
              : '✅ Photo uploaded successfully! Ready for stream.';
            uploadStatus.className = 'upload-status-text success';
          }
          showToast('Photo uploaded successfully!', 'success');
          updateDiscordPreview();
        } else {
          if (uploadStatus) {
            uploadStatus.textContent = '✅ Photo loaded! Ready to stream.';
            uploadStatus.className = 'upload-status-text success';
          }
        }
      } catch (err) {
        console.warn('HTTP Upload note:', err);
        if (uploadStatus) {
          uploadStatus.textContent = '✅ Photo loaded! Ready to stream.';
          uploadStatus.className = 'upload-status-text success';
        }
      }
    };
    reader.readAsDataURL(file);
  });
}

// Preset button: Use stream.jpg
if (btnUseStreamJpg) {
  btnUseStreamJpg.addEventListener('click', () => {
    if (activityImageUrl) activityImageUrl.value = '/stream.jpg';
    if (uploadStatus) {
      uploadStatus.textContent = '✅ Selected default stream.jpg';
      uploadStatus.className = 'upload-status-text success';
    }
    updateDiscordPreview();
    showToast('Selected default stream.jpg!', 'info');
  });
}

// Initial preview setup
setTimeout(updateDiscordPreview, 100);

// Set Activity Button Handler
if (setActivityBtn) {
  setActivityBtn.addEventListener('click', () => {
    let type = activityType ? activityType.value : 'STREAMING';
    if (type === 'NONE') {
      type = 'STREAMING';
      if (activityType) activityType.value = 'STREAMING';
    }
    const text = (activityText && activityText.value.trim()) || '^ ANE WALA STAR !!';
    if (activityText && !activityText.value.trim()) {
      activityText.value = text;
    }

    const payload = {
      text: text,
      name: text,
      type: type,
      streamUrl: (activityStreamUrl && activityStreamUrl.value.trim()) || 'https://twitch.tv/discord',
      details: (activityDetails && activityDetails.value.trim() && activityDetails.value.trim() !== 'Screen Share (Go-Live)') ? activityDetails.value.trim() : '',
      state: (activityState && activityState.value.trim()) || '',
      photo: (activityImageUrl && activityImageUrl.value.trim()) || '',
      largeImage: (activityImageUrl && activityImageUrl.value.trim()) || ''
    };

    socket.emit('set_custom_status', payload);
    if (activityLiveBadge) activityLiveBadge.style.display = 'inline-flex';
    if (activityCleanBadge) activityCleanBadge.style.display = 'none';
    startPreviewTimer();
    updateDiscordPreview();
    showToast(type === 'STREAMING' ? '🟣 Streaming activity set with custom photo & purple play badge!' : 'Activity updated!', 'success');
  });
}

// Clear Activity Button Handler
if (clearActivityBtn) {
  clearActivityBtn.addEventListener('click', () => {
    socket.emit('clear_custom_status');
    if (activityText) activityText.value = '';
    if (activityType) activityType.value = 'NONE';
    if (activityLiveBadge) activityLiveBadge.style.display = 'none';
    if (activityCleanBadge) activityCleanBadge.style.display = 'inline-flex';
    if (streamingOptions) streamingOptions.style.display = 'none';
    if (streamTimerInterval) clearInterval(streamTimerInterval);
    if (previewActivityTimer) previewActivityTimer.textContent = '00:00 elapsed';
    updateDiscordPreview();
    showToast('✨ Activity and play button removed! Profile restored to clean DND default state.', 'success');
  });
}

// Activity Type Dropdown Change
if (activityType) {
  activityType.addEventListener('change', () => {
    const val = activityType.value;
    if (val === 'NONE') {
      socket.emit('clear_custom_status');
      if (activityText) activityText.value = '';
      if (activityLiveBadge) activityLiveBadge.style.display = 'none';
      if (activityCleanBadge) activityCleanBadge.style.display = 'inline-flex';
      showToast('Activity cleared: Play button removed (Default DND)', 'info');
    }
    if (streamingOptions) {
      streamingOptions.style.display = val === 'NONE' ? 'none' : 'flex';
    }
    updateDiscordPreview();
  });
}

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
    const rawDetails = (activityDetails && activityDetails.value.trim()) || '';
    const details = (rawDetails && rawDetails !== 'Screen Share (Go-Live)') ? rawDetails : '';
    const streamConfig = {
      title: (activityText && activityText.value.trim()) || '^ ANE WALA STAR !!',
      photo: (activityImageUrl && activityImageUrl.value.trim()) || '/stream.jpg',
      details: details,
      state: (activityState && activityState.value.trim()) || (currentState.currentVC ? currentState.currentVC.channelName : ''),
      streamUrl: (activityStreamUrl && activityStreamUrl.value.trim()) || 'https://twitch.tv/discord'
    };
    socket.emit('start_stream', streamConfig);
    showToast('Starting Screen Share with custom title & photo...', 'info');
  }
});

btnLeaveVc.addEventListener('click', () => {
  currentState.currentVC = null;
  currentState.isStreaming = false;
  updateUI(currentState);
  socket.emit('leave_vc');
  showToast('Leaving voice channel...', 'info');
  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.remove('active');
    const b = el.querySelector('.join-btn');
    if (b) {
      b.classList.remove('connected');
      b.textContent = 'Join VC';
    }
  });
});

// Quick Sidebar VC Controls
if (quickMute) quickMute.addEventListener('click', () => socket.emit('toggle_mute'));
if (quickDeafen) quickDeafen.addEventListener('click', () => socket.emit('toggle_deafen'));
if (quickLeave) quickLeave.addEventListener('click', () => {
  currentState.currentVC = null;
  currentState.isStreaming = false;
  updateUI(currentState);
  socket.emit('leave_vc');
  showToast('Left voice channel', 'info');
  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.remove('active');
    const b = el.querySelector('.join-btn');
    if (b) {
      b.classList.remove('connected');
      b.textContent = 'Join VC';
    }
  });
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
  currentState.currentVC = vc;
  updateUI(currentState);
  showToast(`Joined voice channel: ${vc.channelName}`, 'success');
});

socket.on('vc_left', () => {
  currentState.currentVC = null;
  currentState.isStreaming = false;
  updateUI(currentState);
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
    connStatus.querySelector('.conn-text').textContent = 'Connected (24/7)';
    connStatus.style.borderColor = 'rgba(59, 165, 93, 0.25)';
    connStatus.style.background = 'rgba(59, 165, 93, 0.1)';
    connStatus.style.color = 'var(--green)';
  }

  // Auto-register public URL with server to enable 24/7 anti-sleep self-pinging!
  if (window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
    socket.emit('register_app_url', window.location.origin);
    if (keepaliveUrlInput) {
      keepaliveUrlInput.value = `${window.location.origin}/ping`;
    }
  }
});

// 24/7 Keep-Alive Listeners
socket.on('keepalive_info', (data) => {
  if (data && data.publicUrl) {
    if (keepaliveUrlInput) keepaliveUrlInput.value = `${data.publicUrl}/ping`;
    if (keepaliveStatusBadge) {
      keepaliveStatusBadge.textContent = '🟢 Active (Self-Ping)';
      keepaliveStatusBadge.className = 'badge badge-green';
    }
    if (keepalivePingTime && data.lastPing) {
      keepalivePingTime.textContent = new Date(data.lastPing).toLocaleTimeString();
    }
  } else if (window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
    if (keepaliveUrlInput) keepaliveUrlInput.value = `${window.location.origin}/ping`;
  }
});

socket.on('keepalive_update', (data) => {
  if (keepalivePingTime && data.lastPing) {
    keepalivePingTime.textContent = `${new Date(data.lastPing).toLocaleTimeString()} (Ping #${data.pingCount})`;
  }
  if (keepaliveStatusBadge) {
    keepaliveStatusBadge.textContent = '🟢 Active (Self-Ping)';
    keepaliveStatusBadge.className = 'badge badge-green';
  }
});

socket.on('activity_cleared', () => {
  if (activityText) activityText.value = '';
  if (activityType) activityType.value = 'NONE';
  if (activityLiveBadge) activityLiveBadge.style.display = 'none';
  if (activityCleanBadge) activityCleanBadge.style.display = 'inline-flex';
  if (streamingOptions) streamingOptions.style.display = 'none';
  if (streamTimerInterval) clearInterval(streamTimerInterval);
  updateDiscordPreview();
});

// Keep-Alive UI Buttons
if (btnTestPing) {
  btnTestPing.addEventListener('click', () => {
    btnTestPing.disabled = true;
    btnTestPing.textContent = '⏳ Testing...';
    socket.emit('test_self_ping', (res) => {
      btnTestPing.disabled = false;
      btnTestPing.textContent = '⚡ Test Ping';
      if (res && res.success) {
        showToast(`✅ Ping successful! Latency: ${res.latency}ms (24/7 Awake)`, 'success');
        if (keepalivePingTime) {
          keepalivePingTime.textContent = `${new Date().toLocaleTimeString()} (${res.latency}ms)`;
        }
      } else {
        showToast(`Ping notice: ${res?.error || 'Make sure public URL is active'}`, 'error');
      }
    });
  });
}

if (btnCopyPingUrl) {
  btnCopyPingUrl.addEventListener('click', () => {
    const url = (keepaliveUrlInput && keepaliveUrlInput.value) ? keepaliveUrlInput.value : `${window.location.origin}/ping`;
    if (navigator.clipboard && url) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('📋 Ping URL copied to clipboard! Paste into UptimeRobot.com monitor.', 'success');
      }).catch(() => {
        showToast(`Ping URL: ${url}`, 'info');
      });
    } else {
      showToast(`Ping URL: ${url}`, 'info');
    }
  });
}

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

  // Status dot & buttons (default DND)
  const currentStatus = state.status || 'dnd';
  statusDot.className = `status-dot ${currentStatus}`;

  statusButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === currentStatus);
  });

  if (currentStatusBadge) {
    const statusLabels = {
      dnd: '⛔ DND Active (Default 24/7)',
      online: '🟢 Online Active',
      idle: '🌙 Idle Active',
      invisible: '⚪ Invisible Active'
    };
    currentStatusBadge.textContent = statusLabels[currentStatus] || `${currentStatus.toUpperCase()} Active`;
    currentStatusBadge.className = currentStatus === 'dnd' ? 'badge badge-red' : (currentStatus === 'online' ? 'badge badge-green' : 'badge badge-blue');
  }

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
      const streamImg = streamPreview.querySelector('img');
      if (streamImg) {
        const photo = (activityImageUrl && activityImageUrl.value) || state.streamConfig?.photo || '/stream.jpg';
        streamImg.src = photo;
      }
    } else {
      streamPreview.classList.add('hidden');
    }
  }

  // Custom activity & Stream config sync
  if (state.streamConfig) {
    if (activityText && (!activityText.value || activityText.value === '^ ANE WALA STAR !!')) {
      if (state.streamConfig.title) activityText.value = state.streamConfig.title;
    }
    if (activityImageUrl && !activityImageUrl.value) {
      if (state.streamConfig.photo) activityImageUrl.value = state.streamConfig.photo;
    }
    if (activityDetails) {
      if (state.streamConfig.details && state.streamConfig.details !== 'Screen Share (Go-Live)') {
        activityDetails.value = state.streamConfig.details;
      } else if (activityDetails.value === 'Screen Share (Go-Live)') {
        activityDetails.value = '';
      }
    }
    if (activityStreamUrl && (!activityStreamUrl.value || activityStreamUrl.value === 'https://twitch.tv/discord')) {
      if (state.streamConfig.streamUrl) activityStreamUrl.value = state.streamConfig.streamUrl;
    }
    updateDiscordPreview();
  }

  if (state.customActivity && state.customActivity.type && state.customActivity.type !== 'NONE') {
    if (activityLiveBadge) activityLiveBadge.style.display = 'inline-flex';
    if (activityCleanBadge) activityCleanBadge.style.display = 'none';
    if (activityType) activityType.value = state.customActivity.type;
    if (state.customActivity.name || state.customActivity.text) {
      activityText.value = state.customActivity.name || state.customActivity.text;
    }
    if (state.customActivity.photo && activityImageUrl) {
      activityImageUrl.value = state.customActivity.photo;
    }
    updateDiscordPreview();
    startPreviewTimer();
  } else {
    // Custom Activity is null or NONE - Clean default profile (no play button)
    if (activityLiveBadge) activityLiveBadge.style.display = 'none';
    if (activityCleanBadge) activityCleanBadge.style.display = 'inline-flex';
    if (activityType) activityType.value = 'NONE';
    if (streamTimerInterval) clearInterval(streamTimerInterval);
    updateDiscordPreview();
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
    const isCurrent = currentState.currentVC && currentState.currentVC.channelId === ch.id;
    const item = document.createElement('div');
    item.className = `channel-item ${isCurrent ? 'active' : ''}`;
    item.dataset.channelId = ch.id;

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
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="channel-members">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          ${limitText}
        </span>
        <button class="join-btn ${isCurrent ? 'connected' : ''}" data-guild="${guildId}" data-channel="${ch.id}">
          ${isCurrent ? 'Connected ✓' : 'Join VC'}
        </button>
      </div>
    `;

    item.addEventListener('click', () => {
      const currentGuildOpt = guildSelector ? guildSelector.options[guildSelector.selectedIndex] : null;
      const guildName = currentGuildOpt ? currentGuildOpt.text : 'Server';

      // 1. Optimistic UI update - immediately unlock Voice Control, Mute, Deafen, Stream, Leave
      currentState.currentVC = {
        guildId: guildId,
        channelId: ch.id,
        channelName: ch.name,
        guildName: guildName
      };
      updateUI(currentState);

      // 2. Highlight channel item & change button to Connected
      document.querySelectorAll('.channel-item').forEach(el => {
        el.classList.remove('active');
        const b = el.querySelector('.join-btn');
        if (b) {
          b.classList.remove('connected');
          b.textContent = 'Join VC';
        }
      });
      item.classList.add('active');
      const btn = item.querySelector('.join-btn');
      if (btn) {
        btn.classList.add('connected');
        btn.textContent = 'Connected ✓';
      }

      // 3. Emit join_vc to server
      socket.emit('join_vc', { guildId, channelId: ch.id });
      showToast(`Connected to ${ch.name}!`, 'success');
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

// ===================================================
// 🎨 MULTI-THEME ENGINE (Midnight, Neon, Crimson, Emerald, Ocean)
// ===================================================
const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');
const currentThemeName = document.getElementById('current-theme-name');
const themeOptions = document.querySelectorAll('.theme-option');

const THEME_NAMES = {
  default: 'Midnight',
  neon: 'Cyberpunk Neon',
  crimson: 'Crimson Blood',
  emerald: 'Matrix Emerald',
  ocean: 'Sapphire Ocean'
};

function applyTheme(themeKey) {
  if (themeKey === 'default') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', themeKey);
  }

  localStorage.setItem('discord_theme', themeKey);

  if (currentThemeName) {
    currentThemeName.textContent = THEME_NAMES[themeKey] || 'Midnight';
  }

  themeOptions.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === themeKey);
  });
}

// Load saved theme
const savedTheme = localStorage.getItem('discord_theme') || 'default';
applyTheme(savedTheme);

if (themeBtn && themeDropdown) {
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!themeDropdown.contains(e.target) && !themeBtn.contains(e.target)) {
      themeDropdown.classList.add('hidden');
    }
  });

  themeOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      applyTheme(theme);
      themeDropdown.classList.add('hidden');
      showToast(`Theme switched to ${THEME_NAMES[theme]}!`, 'success');
    });
  });
}

// ===================================================
// 🖱️ INTERACTIVE MOUSE CURSOR & FLUID AURA
// ===================================================
const cursorDot = document.getElementById('cursor-dot');
const cursorAura = document.getElementById('cursor-aura');

let mouseX = -100;
let mouseY = -100;
let auraX = -100;
let auraY = -100;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (cursorDot) {
    cursorDot.style.left = `${mouseX}px`;
    cursorDot.style.top = `${mouseY}px`;
  }
});

// Smooth fluid interpolation for the cursor aura
function updateCursorAura() {
  auraX += (mouseX - auraX) * 0.16;
  auraY += (mouseY - auraY) * 0.16;

  if (cursorAura) {
    cursorAura.style.left = `${auraX}px`;
    cursorAura.style.top = `${auraY}px`;
  }

  requestAnimationFrame(updateCursorAura);
}
requestAnimationFrame(updateCursorAura);

// Hover states for interactive elements
document.addEventListener('mouseover', (e) => {
  const target = e.target.closest('button, a, input, select, .server-item, .channel-item, .stat-card, .server-grid-card');
  if (target) {
    document.body.classList.add('cursor-hover');
  } else {
    document.body.classList.remove('cursor-hover');
  }
});

document.addEventListener('mousedown', () => {
  document.body.classList.add('cursor-click');
});

document.addEventListener('mouseup', () => {
  document.body.classList.remove('cursor-click');
});

// Click Ripple Animation
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn, .nav-btn, .status-btn, .vc-btn, .server-item');
  if (!btn) return;

  const circle = document.createElement('span');
  circle.classList.add('ripple-circle');

  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  circle.style.width = circle.style.height = `${size}px`;
  circle.style.left = `${e.clientX - rect.left - size / 2}px`;
  circle.style.top = `${e.clientY - rect.top - size / 2}px`;

  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 500);
});

// ===================================================
// 🌌 PARTICLES WITH MOUSE GRAVITY & CONNECTION
// ===================================================
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

  const particleCount = Math.min(Math.floor((width * height) / 22000), 50);
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 1.8 + 0.9,
      alpha: Math.random() * 0.45 + 0.25
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Get current theme accent color for particles
    const computedAccent = getComputedStyle(document.body).getPropertyValue('--accent-primary').trim() || '#5865f2';

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      // Mouse interaction (gentle attraction / line connect)
      const mdx = mouseX - p.x;
      const mdy = mouseY - p.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

      if (mdist < 140) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 * (1 - mdist / 140)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Slight magnetic drift toward cursor
        p.x += (mdx / mdist) * 0.2;
        p.y += (mdy / mdist) * 0.2;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = computedAccent;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Connect nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 115) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = computedAccent;
          ctx.globalAlpha = 0.14 * (1 - dist / 115);
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    requestAnimationFrame(render);
  }

  render();
})();
