const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { Client } = require('discord.js-selfbot-v13');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  entersState,
  StreamType
} = require('@discordjs/voice');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// Serve static files (supports both root directory and public/assets folders)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/assets', express.static(__dirname));

// Explicit route for homepage
app.get('/', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  res.status(404).send('index.html not found');
});

// State management
let discordClient = null;
let currentVoiceConnection = null;
let currentAudioPlayer = null;
let currentStreamConnection = null;
let isStreaming = false;
let reconnectToken = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 15;
const SESSION_FILE = path.join(__dirname, '.session.json');

let botState = {
  loggedIn: false,
  username: '',
  discriminator: '',
  avatar: '',
  userId: '',
  status: 'online',
  guilds: [],
  currentVC: null,
  isMuted: false,
  isDeafened: false,
  isStreaming: false,
  uptime: 0,
  friends: [],
  dmChannels: []
};

let uptimeInterval = null;
let startTime = null;
let heartbeatInterval = null;
let memoryInterval = null;

// Load saved session if exists
function loadSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      return data;
    }
  } catch (e) {
    console.error('[CONFIG] Error reading session file:', e.message);
  }
  return null;
}

// Save session
function saveSession(token, vcData = null) {
  try {
    const data = {
      token: token || reconnectToken,
      lastVC: vcData !== undefined ? vcData : botState.currentVC,
      savedAt: Date.now()
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[CONFIG] Error saving session file:', e.message);
  }
}

// Clear session
function clearSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch (e) {}
}

// Create silent audio resource for VC keepalive
function createSilentResource() {
  const { Readable } = require('stream');
  // Opus silence frame (0xF8, 0xFF, 0xFE)
  const silenceFrame = Buffer.from([0xF8, 0xFF, 0xFE]);
  const silenceStream = new Readable({
    read() {
      this.push(silenceFrame);
    }
  });
  return createAudioResource(silenceStream, {
    inputType: StreamType.Opus,
    inlineVolume: false
  });
}

// Start silence keepalive on voice connection
function startVoiceKeepAlive(connection) {
  try {
    if (currentAudioPlayer) {
      try { currentAudioPlayer.stop(); } catch (e) {}
    }
    currentAudioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });
    const resource = createSilentResource();
    currentAudioPlayer.play(resource);
    connection.subscribe(currentAudioPlayer);
    console.log('[BOT] Voice silence keep-alive active (prevents AFK timeout)');
  } catch (err) {
    console.warn('[BOT] Voice keep-alive notice:', err.message);
  }
}

// ========================
// Socket.IO Handler
// ========================
io.on('connection', (socket) => {
  console.log('[WEB] Client connected');

  // Send current state on connect
  socket.emit('state_update', botState);

  // Send saved session info if exists
  const saved = loadSavedSession();
  if (saved && saved.token) {
    socket.emit('saved_session_found', { hasSavedSession: true });
  }

  // ========== LOGIN ==========
  socket.on('login', async (token, options = {}) => {
    if (!token) return socket.emit('login_error', 'Token cannot be empty');

    if (discordClient) {
      try {
        if (currentVoiceConnection) {
          try { currentVoiceConnection.destroy(); } catch (e) {}
          currentVoiceConnection = null;
        }
        discordClient.destroy();
      } catch (e) {}
      discordClient = null;
      currentStreamConnection = null;
    }

    try {
      // Memory-optimized client configuration
      discordClient = new Client({
        checkUpdate: false,
        sweepers: {
          messages: { interval: 300, lifetime: 60 },
          users: { interval: 300, filter: () => user => user.id !== discordClient?.user?.id }
        },
        ws: {
          properties: {
            browser: 'Discord Client',
            os: 'Windows',
            device: ''
          }
        }
      });

      if (options.remember) {
        saveSession(token);
      }

      setupClientEvents(token, options.autoJoinVC);
      await discordClient.login(token);

    } catch (err) {
      console.error('[BOT] Login failed:', err.message);
      socket.emit('login_error', 'Login failed: ' + err.message);
    }
  });

  // ========== LOGOUT ==========
  socket.on('logout', () => {
    clearSavedSession();
    disconnectEverything();
    reconnectToken = null;
    reconnectAttempts = 0;
    io.emit('state_update', botState);
    io.emit('logged_out');
  });

  // ========== SET STATUS ==========
  socket.on('set_status', async (status) => {
    if (!discordClient || !discordClient.user) return;
    try {
      await discordClient.user.setStatus(status);
      botState.status = status;
      io.emit('state_update', botState);
    } catch (err) {
      socket.emit('bot_error', 'Failed to set status: ' + err.message);
    }
  });

  // ========== SET CUSTOM ACTIVITY ==========
  socket.on('set_custom_status', async (data) => {
    if (!discordClient || !discordClient.user) return;
    try {
      await discordClient.user.setActivity(data.text || 'Online 24/7', {
        type: data.type || 'PLAYING'
      });
      io.emit('status_updated', data);
    } catch (err) {
      socket.emit('bot_error', 'Failed to set custom status: ' + err.message);
    }
  });

  // ========== GET CHANNELS ==========
  socket.on('get_channels', (guildId) => {
    if (!discordClient) return;
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) return socket.emit('bot_error', 'Guild not found');

    const voiceChannels = guild.channels.cache
      .filter(c => c.type === 'GUILD_VOICE' || c.type === 'GUILD_STAGE_VOICE' || c.type === 2 || c.type === 13)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        userLimit: c.userLimit,
        members: c.members ? c.members.map(m => ({
          id: m.id,
          name: m.user.username,
          avatar: m.user.displayAvatarURL({ size: 32 })
        })) : []
      }));

    const textChannels = guild.channels.cache
      .filter(c => c.type === 'GUILD_TEXT' || c.type === 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      }));

    socket.emit('channels_list', { guildId, voiceChannels, textChannels });
  });

  // ========== JOIN VOICE CHANNEL ==========
  socket.on('join_vc', async (data) => {
    if (!discordClient) return;
    const { guildId, channelId } = data;

    try {
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) return socket.emit('bot_error', 'Guild not found');

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return socket.emit('bot_error', 'Channel not found');

      // Disconnect from previous VC
      if (currentVoiceConnection) {
        try { currentVoiceConnection.destroy(); } catch (e) {}
      }

      currentVoiceConnection = joinVoiceChannel({
        channelId: channelId,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfMute: botState.isMuted,
        selfDeaf: botState.isDeafened
      });

      currentVoiceConnection.on(VoiceConnectionStatus.Ready, () => {
        console.log(`[BOT] Joined VC: ${channel.name}`);
        botState.currentVC = {
          guildId, channelId,
          channelName: channel.name,
          guildName: guild.name
        };
        startVoiceKeepAlive(currentVoiceConnection);
        saveSession(reconnectToken, botState.currentVC);
        io.emit('state_update', botState);
        io.emit('vc_joined', botState.currentVC);
      });

      currentVoiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        // Try to reconnect automatically
        try {
          await Promise.race([
            entersState(currentVoiceConnection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(currentVoiceConnection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
          // Seems to be reconnecting
        } catch (error) {
          // Seems to be a disconnect
          if (currentAudioPlayer) {
            try { currentAudioPlayer.stop(); } catch (e) {}
            currentAudioPlayer = null;
          }
          botState.currentVC = null;
          botState.isStreaming = false;
          isStreaming = false;
          saveSession(reconnectToken, null);
          io.emit('state_update', botState);
        }
      });

      currentVoiceConnection.on('error', (err) => {
        console.error('[BOT] VC Error:', err);
        socket.emit('bot_error', 'Voice connection error: ' + err.message);
      });

    } catch (err) {
      socket.emit('bot_error', 'Failed to join VC: ' + err.message);
    }
  });

  // ========== LEAVE VOICE CHANNEL ==========
  socket.on('leave_vc', () => {
    if (currentAudioPlayer) {
      try { currentAudioPlayer.stop(); } catch (e) {}
      currentAudioPlayer = null;
    }
    if (currentVoiceConnection) {
      // Stop stream first
      if (isStreaming) {
        stopStream();
      }
      try { currentVoiceConnection.destroy(); } catch (e) {}
      currentVoiceConnection = null;
    }
    botState.currentVC = null;
    botState.isStreaming = false;
    isStreaming = false;
    saveSession(reconnectToken, null);
    io.emit('state_update', botState);
    io.emit('vc_left');
  });

  // ========== TOGGLE MUTE ==========
  socket.on('toggle_mute', () => {
    botState.isMuted = !botState.isMuted;
    if (currentVoiceConnection) {
      try {
        currentVoiceConnection.rejoin({
          selfMute: botState.isMuted,
          selfDeaf: botState.isDeafened
        });
      } catch (e) {
        console.error('[BOT] Mute error:', e.message);
      }
    }
    io.emit('state_update', botState);
  });

  // ========== TOGGLE DEAFEN ==========
  socket.on('toggle_deafen', () => {
    botState.isDeafened = !botState.isDeafened;
    if (botState.isDeafened) botState.isMuted = true;
    if (currentVoiceConnection) {
      try {
        currentVoiceConnection.rejoin({
          selfMute: botState.isMuted,
          selfDeaf: botState.isDeafened
        });
      } catch (e) {
        console.error('[BOT] Deafen error:', e.message);
      }
    }
    io.emit('state_update', botState);
  });

  // ========== START SCREEN SHARE ==========
  socket.on('start_stream', async () => {
    if (!currentVoiceConnection || !botState.currentVC) {
      return socket.emit('bot_error', 'You must be in a voice channel to stream');
    }

    try {
      // Use Discord Gateway to signal Go Live
      if (discordClient && discordClient.user) {
        // Signal stream create via gateway
        discordClient.ws.broadcast({
          op: 18, // STREAM_CREATE
          d: {
            type: 'guild',
            guild_id: botState.currentVC.guildId,
            channel_id: botState.currentVC.channelId,
            preferred_region: '',
          }
        });

        botState.isStreaming = true;
        isStreaming = true;
        io.emit('state_update', botState);
        io.emit('stream_started');
        console.log('[BOT] Screen share started (static image mode)');
      }
    } catch (err) {
      console.error('[BOT] Stream error:', err);
      socket.emit('bot_error', 'Failed to start stream: ' + err.message);
    }
  });

  // ========== STOP SCREEN SHARE ==========
  socket.on('stop_stream', () => {
    stopStream();
    io.emit('state_update', botState);
    io.emit('stream_stopped');
  });

  // ========== SEND MESSAGE ==========
  socket.on('send_message', async (data) => {
    if (!discordClient) return;
    try {
      const channel = discordClient.channels.cache.get(data.channelId);
      if (channel) {
        await channel.send(data.content);
        socket.emit('message_sent');
      }
    } catch (err) {
      socket.emit('bot_error', 'Failed to send message: ' + err.message);
    }
  });

  // ========== GET MESSAGES ==========
  socket.on('get_messages', async (channelId) => {
    if (!discordClient) return;
    try {
      const channel = discordClient.channels.cache.get(channelId);
      if (channel && channel.messages) {
        const messages = await channel.messages.fetch({ limit: 50 });
        const msgList = messages.map(m => ({
          id: m.id,
          content: m.content,
          author: m.author.username,
          authorAvatar: m.author.displayAvatarURL({ size: 32 }),
          timestamp: m.createdTimestamp,
          isBot: m.author.bot
        })).reverse();
        socket.emit('messages_list', { channelId, messages: msgList });
      }
    } catch (err) {
      socket.emit('bot_error', 'Failed to get messages: ' + err.message);
    }
  });

  // ========== GET FRIENDS ==========
  socket.on('get_friends', async () => {
    if (!discordClient) return;
    try {
      const relationships = discordClient.relationships.cache;
      const friends = [];
      relationships.forEach((rel, userId) => {
        if (rel.type === 1) { // Friend
          const user = discordClient.users.cache.get(userId);
          if (user) {
            friends.push({
              id: user.id,
              username: user.username,
              discriminator: user.discriminator,
              avatar: user.displayAvatarURL({ size: 64 }),
              status: user.presence?.status || 'offline'
            });
          }
        }
      });
      socket.emit('friends_list', friends);
    } catch (err) {
      socket.emit('bot_error', 'Failed to get friends: ' + err.message);
    }
  });

  // ========== GET DMs ==========
  socket.on('get_dms', async () => {
    if (!discordClient) return;
    try {
      const dmChannels = discordClient.channels.cache
        .filter(c => c.type === 'DM' || c.type === 1)
        .map(c => ({
          id: c.id,
          recipient: c.recipient ? {
            id: c.recipient.id,
            username: c.recipient.username,
            avatar: c.recipient.displayAvatarURL({ size: 32 })
          } : null
        }))
        .filter(c => c.recipient);

      socket.emit('dm_list', dmChannels);
    } catch (err) {
      socket.emit('bot_error', 'Failed to get DMs: ' + err.message);
    }
  });

  // ========== SEND DM ==========
  socket.on('send_dm', async (data) => {
    if (!discordClient) return;
    try {
      const user = await discordClient.users.fetch(data.userId);
      if (user) {
        const dmChannel = await user.createDM();
        await dmChannel.send(data.content);
        socket.emit('dm_sent');
      }
    } catch (err) {
      socket.emit('bot_error', 'Failed to send DM: ' + err.message);
    }
  });

  // ========== CHANGE AVATAR ==========
  socket.on('change_avatar', async (avatarUrl) => {
    if (!discordClient || !discordClient.user) return;
    try {
      await discordClient.user.setAvatar(avatarUrl);
      botState.avatar = discordClient.user.displayAvatarURL({ size: 256 });
      io.emit('state_update', botState);
      socket.emit('avatar_changed');
    } catch (err) {
      socket.emit('bot_error', 'Failed to change avatar: ' + err.message);
    }
  });

  // ========== CHANGE USERNAME ==========
  socket.on('change_username', async (data) => {
    if (!discordClient || !discordClient.user) return;
    try {
      await discordClient.user.setUsername(data.username, data.password);
      botState.username = discordClient.user.username;
      io.emit('state_update', botState);
      socket.emit('username_changed');
    } catch (err) {
      socket.emit('bot_error', 'Failed to change username: ' + err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('[WEB] Client disconnected');
  });
});

// ========================
// Helper Functions
// ========================
function setupClientEvents(token, targetVC = null) {
  reconnectToken = token;

  discordClient.on('ready', () => {
    console.log(`[BOT] Logged in as ${discordClient.user.tag}`);
    reconnectAttempts = 0;

    startTime = Date.now();
    botState.loggedIn = true;
    botState.username = discordClient.user.username;
    botState.discriminator = discordClient.user.discriminator;
    botState.avatar = discordClient.user.displayAvatarURL({ size: 256 });
    botState.userId = discordClient.user.id;
    botState.status = 'online';

    // Get guilds
    botState.guilds = discordClient.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ size: 64 }) || null,
      memberCount: g.memberCount
    }));

    // Update uptime
    if (uptimeInterval) clearInterval(uptimeInterval);
    uptimeInterval = setInterval(() => {
      botState.uptime = Math.floor((Date.now() - startTime) / 1000);
      io.emit('uptime_update', botState.uptime);
    }, 1000);

    // Heartbeat for keep-alive
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (discordClient && discordClient.user) {
        console.log(`[HEARTBEAT] ${new Date().toLocaleTimeString()} - Online as ${discordClient.user.tag}`);
      }
    }, 300000); // Every 5 minutes

    // Auto-rejoin VC if specified
    const vcToJoin = targetVC || loadSavedSession()?.lastVC;
    if (vcToJoin && vcToJoin.guildId && vcToJoin.channelId) {
      setTimeout(async () => {
        try {
          const guild = discordClient.guilds.cache.get(vcToJoin.guildId);
          const channel = guild?.channels?.cache?.get(vcToJoin.channelId);
          if (guild && channel) {
            console.log(`[BOT] Auto-rejoining VC: ${channel.name} in ${guild.name}`);
            currentVoiceConnection = joinVoiceChannel({
              channelId: vcToJoin.channelId,
              guildId: vcToJoin.guildId,
              adapterCreator: guild.voiceAdapterCreator,
              selfMute: botState.isMuted,
              selfDeaf: botState.isDeafened
            });
            currentVoiceConnection.on(VoiceConnectionStatus.Ready, () => {
              botState.currentVC = {
                guildId: vcToJoin.guildId,
                channelId: vcToJoin.channelId,
                channelName: channel.name,
                guildName: guild.name
              };
              startVoiceKeepAlive(currentVoiceConnection);
              io.emit('state_update', botState);
              io.emit('vc_joined', botState.currentVC);
            });
          }
        } catch (e) {
          console.warn('[BOT] Auto-join VC error:', e.message);
        }
      }, 1500);
    }

    io.emit('login_success', botState);
    io.emit('state_update', botState);
  });

  discordClient.on('error', (err) => {
    console.error('[BOT] Error:', err.message);
    io.emit('bot_error', err.message);
  });

  discordClient.on('disconnect', () => {
    console.log('[BOT] Disconnected');
    botState.loggedIn = false;
    botState.status = 'offline';
    io.emit('state_update', botState);

    // Auto-reconnect
    attemptReconnect();
  });

  discordClient.on('invalidated', () => {
    console.log('[BOT] Session invalidated');
    attemptReconnect();
  });
}

async function attemptReconnect() {
  if (!reconnectToken || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[BOT] Max reconnect attempts reached or no token');
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
  console.log(`[BOT] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  io.emit('bot_reconnecting', { attempt: reconnectAttempts, maxAttempts: MAX_RECONNECT_ATTEMPTS });

  setTimeout(async () => {
    try {
      if (discordClient) {
        try { discordClient.destroy(); } catch (e) {}
      }
      discordClient = new Client({
        checkUpdate: false,
        sweepers: {
          messages: { interval: 300, lifetime: 60 },
          users: { interval: 300, filter: () => user => user.id !== discordClient?.user?.id }
        },
        ws: { properties: { browser: 'Discord Client', os: 'Windows', device: '' } }
      });
      setupClientEvents(reconnectToken);
      await discordClient.login(reconnectToken);
    } catch (err) {
      console.error('[BOT] Reconnect failed:', err.message);
      attemptReconnect();
    }
  }, delay);
}

function stopStream() {
  try {
    if (discordClient && discordClient.ws && botState.currentVC) {
      discordClient.ws.broadcast({
        op: 19, // STREAM_DELETE
        d: {
          stream_key: `guild:${botState.currentVC?.guildId}:${botState.currentVC?.channelId}:${discordClient.user.id}`
        }
      });
    }
  } catch (e) {}
  botState.isStreaming = false;
  isStreaming = false;
}

function disconnectEverything() {
  if (currentVoiceConnection) {
    try { currentVoiceConnection.destroy(); } catch (e) {}
    currentVoiceConnection = null;
  }
  if (discordClient) {
    try { discordClient.destroy(); } catch (e) {}
    discordClient = null;
  }
  if (uptimeInterval) clearInterval(uptimeInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  currentStreamConnection = null;
  isStreaming = false;

  botState = {
    loggedIn: false, username: '', discriminator: '', avatar: '',
    userId: '', status: 'offline', guilds: [], currentVC: null,
    isMuted: false, isDeafened: false, isStreaming: false, uptime: 0,
    friends: [], dmChannels: []
  };
}

// ========================
// API Routes
// ========================
app.get('/ping', (req, res) => {
  res.send('pong');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: botState.uptime,
    loggedIn: botState.loggedIn,
    memoryUsage: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    cpuUptime: Math.floor(process.uptime())
  });
});

app.get('/api/stats', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    uptime: Math.floor(process.uptime()),
    botUptime: botState.uptime,
    guilds: botState.guilds.length,
    loggedIn: botState.loggedIn
  });
});

// ========================
// Auto-start from Session or ENV
// ========================
async function initAutoLogin() {
  const envToken = process.env.DISCORD_TOKEN;
  const saved = loadSavedSession();
  const tokenToUse = envToken || (saved && saved.token);

  if (tokenToUse) {
    console.log('[BOT] Found saved token/ENV, auto-logging in...');
    try {
      discordClient = new Client({
        checkUpdate: false,
        sweepers: {
          messages: { interval: 300, lifetime: 60 },
          users: { interval: 300, filter: () => user => user.id !== discordClient?.user?.id }
        },
        ws: {
          properties: {
            browser: 'Discord Client',
            os: 'Windows',
            device: ''
          }
        }
      });
      setupClientEvents(tokenToUse, saved?.lastVC);
      await discordClient.login(tokenToUse);
    } catch (err) {
      console.error('[BOT] Auto-login error:', err.message);
    }
  }
}

// ========================
// Start Server
// ========================
server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════╗
  ║     🎮 Discord Online Controller v2.0         ║
  ║                                                ║
  ║   Dashboard: http://localhost:${PORT}             ║
  ║   Status:    Running ✓                         ║
  ║   Memory:    ~${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB                             ║
  ╚════════════════════════════════════════════════╝
  `);
  // Try auto-login if token is available
  initAutoLogin();
});

// ========================
// Crash Protection
// ========================
process.on('uncaughtException', (err) => {
  console.error('[SYSTEM] Uncaught Exception:', err.message);
  // Don't crash - stay alive
});

process.on('unhandledRejection', (err) => {
  console.error('[SYSTEM] Unhandled Rejection:', err);
  // Don't crash - stay alive
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SYSTEM] SIGTERM received, shutting down...');
  disconnectEverything();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[SYSTEM] SIGINT received, shutting down...');
  disconnectEverything();
  server.close(() => process.exit(0));
});
