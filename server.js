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

// Body parsers for JSON and uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static files (supports both root directory and public/assets folders)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/assets', express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Image Upload Endpoint for Stream Photo / Rich Presence
app.post('/api/upload-stream-image', async (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const ext = (filename && path.extname(filename)) || '.jpg';
    const savedName = `stream_${Date.now()}${ext}`;
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, savedName);
    fs.writeFileSync(filePath, buffer);

    // Sync to stream.jpg so default stream previews update
    try { fs.writeFileSync(path.join(__dirname, 'stream.jpg'), buffer); } catch(e) {}
    try { fs.writeFileSync(path.join(__dirname, 'public', 'stream.jpg'), buffer); } catch(e) {}
    try {
      const assetsDir = path.join(__dirname, 'assets');
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(path.join(assetsDir, 'stream.jpg'), buffer);
    } catch(e) {}

    // If Discord client is online, upload directly to Discord to get a permanent CDN URL
    let discordCdnUrl = null;
    if (discordClient && discordClient.user) {
      discordCdnUrl = await uploadToDiscordCdn(discordClient, buffer, savedName);
    }

    const localUrl = `/uploads/${savedName}`;
    const finalUrl = discordCdnUrl || localUrl;

    if (botState.streamConfig) {
      botState.streamConfig.photo = finalUrl;
    }

    res.json({
      success: true,
      url: finalUrl,
      localUrl: localUrl,
      isDiscordCdn: !!discordCdnUrl
    });
  } catch (err) {
    console.error('[UPLOAD] Image upload error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// Default configuration
const DEFAULT_TOKEN = 'MTA5MDIyNjg0NTU0MDE1OTQ5MQ.GJ4mKJ.MQ-f9Aq6fjiBym90CaEOsLC8FayoqEaumEqKgg';
const TARGET_USER_NAME = 'Ayan1924C';

// State management
let discordClient = null;
let currentVoiceConnection = null;
let currentAudioPlayer = null;
let currentStreamConnection = null;
let isStreaming = false;
let reconnectToken = DEFAULT_TOKEN;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 15;
const SESSION_FILE = path.join(__dirname, '.session.json');

let botState = {
  loggedIn: false,
  username: TARGET_USER_NAME,
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
  dmChannels: [],
  customActivity: null,
  streamConfig: {
    title: '^ ANE WALA STAR !!',
    photo: '/stream.jpg',
    streamUrl: 'https://twitch.tv/discord',
    details: 'Screen Share (Go-Live)',
    state: ''
  }
};

let uptimeInterval = null;
let startTime = null;
let heartbeatInterval = null;
let memoryInterval = null;

// Anti-Ban Discord Client Factory
function createDiscordClient() {
  return new Client({
    checkUpdate: false,
    patchVoice: true,
    sweepers: {
      messages: { interval: 300, lifetime: 60 },
      users: { interval: 300, filter: () => user => user.id !== discordClient?.user?.id }
    },
    ws: {
      properties: {
        os: 'Windows',
        browser: 'Discord Client',
        release_channel: 'stable',
        client_version: '1.0.9168',
        os_version: '10.0.19045',
        os_arch: 'x64',
        system_locale: 'en-US',
        client_build_number: 335600
      }
    }
  });
}

// Load saved session if exists
function loadSavedSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      if (data && data.streamConfig) {
        botState.streamConfig = { ...botState.streamConfig, ...data.streamConfig };
      }
      if (data && data.customActivity) {
        botState.customActivity = data.customActivity;
      }
      if (data && data.token) return data;
    }
  } catch (e) {
    console.error('[CONFIG] Error reading session file:', e.message);
  }
  return {
    token: DEFAULT_TOKEN,
    savedAt: Date.now(),
    streamConfig: botState.streamConfig,
    customActivity: botState.customActivity
  };
}

// Save session
function saveSession(token, vcData = null, streamConfig = null, customActivity = null) {
  try {
    const existing = loadSavedSession() || {};
    const data = {
      token: token || reconnectToken || DEFAULT_TOKEN,
      lastVC: vcData !== undefined ? vcData : botState.currentVC,
      streamConfig: streamConfig || botState.streamConfig || existing.streamConfig,
      customActivity: customActivity !== undefined ? customActivity : (botState.customActivity || existing.customActivity),
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

// Upload buffer/file to Discord channel to get permanent native Discord CDN URL
async function uploadToDiscordCdn(client, bufferOrPath, filename = 'stream.jpg') {
  if (!client || !client.user) return null;
  try {
    let targetChannel = null;
    // 1. Try finding DM channel
    for (const ch of client.channels.cache.values()) {
      if (ch.type === 'DM' || ch.type === 'GROUP_DM') {
        targetChannel = ch;
        break;
      }
    }
    // 2. Try guild text channels with SEND_MESSAGES & ATTACH_FILES permissions
    if (!targetChannel) {
      for (const guild of client.guilds.cache.values()) {
        const ch = guild.channels.cache.find(c =>
          (c.type === 'GUILD_TEXT' || c.isText?.()) &&
          c.permissionsFor?.(client.user)?.has('SEND_MESSAGES') &&
          c.permissionsFor?.(client.user)?.has('ATTACH_FILES')
        );
        if (ch) {
          targetChannel = ch;
          break;
        }
      }
    }
    if (targetChannel) {
      const sent = await targetChannel.send({
        files: [{ attachment: bufferOrPath, name: filename }]
      });
      const url = sent.attachments?.first?.()?.url;
      try { await sent.delete(); } catch(e) {}
      if (url) {
        console.log('[BOT] Stream photo uploaded to Discord CDN:', url);
        return url;
      }
    }
  } catch (err) {
    console.warn('[BOT] Discord CDN upload notice:', err.message);
  }
  return null;
}

// Resolve any image URL or local path into Discord Gateway Rich Presence format (mp:attachments/... or asset ID)
async function resolveRichPresenceImage(client, photoInput, appId = '383226320970055681') {
  if (!photoInput || typeof photoInput !== 'string') return null;
  let trimmed = photoInput.trim();
  if (!trimmed) return null;

  // Handle local path (/stream.jpg, /uploads/...)
  if (trimmed.startsWith('/') || (!trimmed.startsWith('http') && !trimmed.startsWith('mp:') && fs.existsSync(path.join(__dirname, trimmed)))) {
    const localFile = trimmed.startsWith('/') ? path.join(__dirname, 'public', trimmed) : path.join(__dirname, trimmed);
    const fallbackFile = path.join(__dirname, 'stream.jpg');
    const targetFile = fs.existsSync(localFile) ? localFile : fallbackFile;
    if (fs.existsSync(targetFile) && client && client.user) {
      const cdnUrl = await uploadToDiscordCdn(client, targetFile, path.basename(targetFile));
      if (cdnUrl) {
        trimmed = cdnUrl;
      }
    }
  }

  // Discord CDN or media link -> convert to mp:
  if (trimmed.includes('cdn.discordapp.com/') || trimmed.includes('media.discordapp.net/')) {
    return trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:');
  }

  // Already prefixed format
  if (trimmed.startsWith('mp:') || trimmed.startsWith('external/')) {
    return trimmed.startsWith('mp:') ? trimmed : `mp:${trimmed}`;
  }

  // Asset ID (numeric snowflake)
  if (/^[0-9]{17,19}$/.test(trimmed)) {
    return trimmed;
  }

  // External URL -> try Discord external-assets proxy endpoint
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (client && client.token) {
      try {
        const { RichPresence } = require('discord.js-selfbot-v13');
        const ext = await RichPresence.getExternal(client, appId, trimmed);
        if (ext && ext.length && ext[0].external_asset_path) {
          console.log('[BOT] External image proxied via Discord RPC:', ext[0].external_asset_path);
          return `mp:${ext[0].external_asset_path}`;
        }
      } catch (err) {
        console.warn('[BOT] External asset API note:', err.message);
      }
    }

    // Secondary fallback: fetch buffer and upload to Discord channel
    if (client && client.user) {
      try {
        const https = require('https');
        const http = require('http');
        const getter = trimmed.startsWith('https:') ? https : http;
        const buffer = await new Promise((resolve, reject) => {
          getter.get(trimmed, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
          }).on('error', reject);
        });
        const cdnUrl = await uploadToDiscordCdn(client, buffer, 'stream_photo.jpg');
        if (cdnUrl) {
          return cdnUrl.replace('https://cdn.discordapp.com/', 'mp:');
        }
      } catch (e) {
        console.warn('[BOT] External image download fallback notice:', e.message);
      }
    }
  }

  return trimmed;
}

// Apply streaming Rich Presence with custom title and photo
async function applyStreamingPresence(client, options) {
  if (!client || !client.user) return;
  const { name, details, state, url, largeImage, largeText, smallImage, smallText } = options;

  const activity = {
    name: name || '^ ANE WALA STAR !!',
    type: 1, // STREAMING
    url: url || 'https://twitch.tv/discord',
    flags: 1
  };

  if (details) activity.details = details;
  if (state) activity.state = state;

  if (largeImage || largeText || smallImage || smallText) {
    activity.assets = {};
    if (largeImage) activity.assets.large_image = largeImage;
    if (largeText) activity.assets.large_text = largeText;
    if (smallImage) activity.assets.small_image = smallImage;
    if (smallText) activity.assets.small_text = smallText;
  }

  activity.timestamps = {
    start: Date.now()
  };

  try {
    client.user.setPresence({
      activities: [activity],
      status: botState.status || 'online',
      afk: false
    });
  } catch (e) {
    console.warn('[BOT] client.user.setPresence notice:', e.message);
  }

  if (client.ws) {
    try {
      client.ws.broadcast({
        op: 3,
        d: {
          since: 0,
          activities: [activity],
          status: botState.status || 'online',
          afk: false
        }
      });
    } catch (e) {}
  }
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

  // Send default / saved session info
  const saved = loadSavedSession();
  socket.emit('saved_session_found', {
    hasSavedSession: true,
    defaultToken: DEFAULT_TOKEN,
    targetUser: TARGET_USER_NAME
  });

  // ========== LOGIN ==========
  socket.on('login', async (token, options = {}) => {
    const tokenToUse = token || DEFAULT_TOKEN;

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
      discordClient = createDiscordClient();
      saveSession(tokenToUse);
      setupClientEvents(tokenToUse, options.autoJoinVC);
      await discordClient.login(tokenToUse);
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
      botState.status = status;
      // 1. setStatus
      try { await discordClient.user.setStatus(status); } catch (e) {}
      // 2. setPresence
      try {
        await discordClient.user.setPresence({
          status: status,
          activities: discordClient.user.presence?.activities || []
        });
      } catch (e) {}
      // 3. Direct Discord Gateway Opcode 3
      if (discordClient.ws) {
        discordClient.ws.broadcast({
          op: 3,
          d: {
            since: status === 'idle' ? Date.now() : 0,
            activities: discordClient.user.presence?.activities || [],
            status: status,
            afk: status === 'idle'
          }
        });
      }
      io.emit('state_update', botState);
      socket.emit('status_updated', { status });
    } catch (err) {
      socket.emit('bot_error', 'Failed to set status: ' + err.message);
    }
  });

  // ========== SET CUSTOM ACTIVITY ==========
  socket.on('set_custom_status', async (data) => {
    if (!discordClient || !discordClient.user) return;
    try {
      if (data.type === 'NONE' || (!data.text && !data.name)) {
        try {
          await discordClient.user.setActivity(null);
        } catch (e) {}
        if (discordClient.ws) {
          discordClient.ws.broadcast({
            op: 3,
            d: {
              since: botState.status === 'idle' ? Date.now() : 0,
              activities: [],
              status: botState.status,
              afk: botState.status === 'idle'
            }
          });
        }
        botState.customActivity = null;
        saveSession(reconnectToken, botState.currentVC, botState.streamConfig, null);
        io.emit('status_updated', { text: '', type: 'NONE' });
        io.emit('state_update', botState);
        console.log('[BOT] Custom activity cleared');
        return;
      }

      const activityName = (data.text || data.name || '^ ANE WALA STAR !!').trim();
      const activityType = data.type || 'STREAMING';
      const streamUrl = data.streamUrl || data.url || 'https://twitch.tv/discord';
      const photoInput = data.largeImage || data.photo || data.imageUrl || '';
      const details = data.details || 'Screen Share (Go-Live)';
      const state = data.state || '';

      botState.streamConfig = {
        title: activityName,
        photo: photoInput,
        streamUrl: streamUrl,
        details: details,
        state: state
      };
      botState.customActivity = {
        text: activityName,
        name: activityName,
        type: activityType,
        streamUrl: streamUrl,
        details: details,
        state: state,
        photo: photoInput,
        largeImage: photoInput
      };
      saveSession(reconnectToken, botState.currentVC, botState.streamConfig, botState.customActivity);

      if (activityType === 'STREAMING') {
        const resolvedImage = await resolveRichPresenceImage(discordClient, photoInput);
        await applyStreamingPresence(discordClient, {
          name: activityName,
          details: details,
          state: state,
          url: streamUrl,
          largeImage: resolvedImage,
          largeText: data.largeText || activityName
        });
      } else {
        const resolvedImage = photoInput ? await resolveRichPresenceImage(discordClient, photoInput) : null;
        const activityPayload = {
          name: activityName,
          type: activityType
        };
        if (details) activityPayload.details = details;
        if (state) activityPayload.state = state;
        if (resolvedImage) {
          activityPayload.assets = {
            large_image: resolvedImage,
            large_text: data.largeText || activityName
          };
        }
        try {
          await discordClient.user.setPresence({
            activities: [activityPayload],
            status: botState.status || 'online',
            afk: botState.status === 'idle'
          });
        } catch (e) {
          await discordClient.user.setActivity(activityName, { type: activityType });
        }
      }

      io.emit('status_updated', botState.customActivity);
      io.emit('state_update', botState);
      console.log(`[BOT] Custom activity set: ${activityType} "${activityName}" (Photo: ${photoInput ? 'Yes' : 'No'})`);
    } catch (err) {
      console.error('[BOT] Failed to set custom status:', err);
      socket.emit('bot_error', 'Failed to set custom status: ' + err.message);
    }
  });

  // ========== CLEAR CUSTOM ACTIVITY ==========
  socket.on('clear_custom_status', async () => {
    if (!discordClient || !discordClient.user) return;
    try {
      try {
        await discordClient.user.setActivity(null);
      } catch (e) {}
      if (discordClient.ws) {
        discordClient.ws.broadcast({
          op: 3,
          d: {
            since: botState.status === 'idle' ? Date.now() : 0,
            activities: [],
            status: botState.status,
            afk: botState.status === 'idle'
          }
        });
      }
      botState.customActivity = null;
      saveSession(reconnectToken, botState.currentVC, botState.streamConfig, null);
      io.emit('status_updated', { text: '', type: 'NONE' });
      io.emit('state_update', botState);
      console.log('[BOT] Custom activity cleared');
    } catch (err) {
      socket.emit('bot_error', 'Failed to clear custom status: ' + err.message);
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

      // 1. Immediately update UI state so Mute/Deafen/Stream buttons unlock right away!
      botState.currentVC = {
        guildId, channelId,
        channelName: channel.name,
        guildName: guild.name
      };
      saveSession(reconnectToken, botState.currentVC);
      io.emit('state_update', botState);
      io.emit('vc_joined', botState.currentVC);
      console.log(`[BOT] Joining VC: ${channel.name} (${guild.name})`);

      // 2. Direct Discord Gateway Voice State Update (Opcode 4)
      if (discordClient.ws) {
        discordClient.ws.broadcast({
          op: 4,
          d: {
            guild_id: guildId,
            channel_id: channelId,
            self_mute: botState.isMuted,
            self_deaf: botState.isDeafened
          }
        });
      }

      // 3. Setup voice keep-alive connection via @discordjs/voice (in background)
      try {
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
          startVoiceKeepAlive(currentVoiceConnection);
        });

        currentVoiceConnection.on('error', (err) => {
          console.warn('[VOICE] Voice connection notice:', err.message);
        });
      } catch (voiceErr) {
        console.warn('[VOICE] Keepalive notice:', voiceErr.message);
      }

    } catch (err) {
      socket.emit('bot_error', 'Failed to join VC: ' + err.message);
    }
  });

  // ========== LEAVE VOICE CHANNEL ==========
  socket.on('leave_vc', () => {
    // 1. Discord Gateway Opcode 4 (channel_id: null disconnects from VC)
    if (discordClient && discordClient.ws && botState.currentVC) {
      discordClient.ws.broadcast({
        op: 4,
        d: {
          guild_id: botState.currentVC.guildId,
          channel_id: null,
          self_mute: false,
          self_deaf: false
        }
      });
    }

    if (currentAudioPlayer) {
      try { currentAudioPlayer.stop(); } catch (e) {}
      currentAudioPlayer = null;
    }
    if (currentVoiceConnection) {
      if (isStreaming) stopStream();
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
    // Broadcast via Discord Gateway Opcode 4
    if (botState.currentVC && discordClient && discordClient.ws) {
      discordClient.ws.broadcast({
        op: 4,
        d: {
          guild_id: botState.currentVC.guildId,
          channel_id: botState.currentVC.channelId,
          self_mute: botState.isMuted,
          self_deaf: botState.isDeafened
        }
      });
    }
    if (currentVoiceConnection) {
      try {
        currentVoiceConnection.rejoin({
          selfMute: botState.isMuted,
          selfDeaf: botState.isDeafened
        });
      } catch (e) {}
    }
    io.emit('state_update', botState);
  });

  // ========== TOGGLE DEAFEN ==========
  socket.on('toggle_deafen', () => {
    botState.isDeafened = !botState.isDeafened;
    if (botState.isDeafened) botState.isMuted = true;
    // Broadcast via Discord Gateway Opcode 4
    if (botState.currentVC && discordClient && discordClient.ws) {
      discordClient.ws.broadcast({
        op: 4,
        d: {
          guild_id: botState.currentVC.guildId,
          channel_id: botState.currentVC.channelId,
          self_mute: botState.isMuted,
          self_deaf: botState.isDeafened
        }
      });
    }
    if (currentVoiceConnection) {
      try {
        currentVoiceConnection.rejoin({
          selfMute: botState.isMuted,
          selfDeaf: botState.isDeafened
        });
      } catch (e) {}
    }
    io.emit('state_update', botState);
  });

  // ========== START SCREEN SHARE ==========
  socket.on('start_stream', async (customStreamData) => {
    if (!botState.currentVC) {
      return socket.emit('bot_error', 'You must be in a voice channel to stream');
    }

    try {
      if (discordClient && discordClient.ws) {
        // Signal Go-Live stream via Discord Gateway Opcode 18
        discordClient.ws.broadcast({
          op: 18, // STREAM_CREATE
          d: {
            type: 'guild',
            guild_id: botState.currentVC.guildId,
            channel_id: botState.currentVC.channelId,
            preferred_region: null
          }
        });

        // Use custom stream config if set, otherwise fallback
        const cfg = customStreamData || botState.streamConfig || {};
        const streamTitle = cfg.title || cfg.text || (botState.customActivity?.text) || '^ ANE WALA STAR !!';
        const streamPhoto = cfg.photo || cfg.largeImage || (botState.customActivity?.photo) || '/stream.jpg';
        const streamUrl = cfg.streamUrl || cfg.url || 'https://twitch.tv/discord';
        const streamDetails = cfg.details || 'Screen Share (Go-Live)';
        const streamState = cfg.state || (botState.currentVC ? botState.currentVC.channelName : '');

        // Resolve photo asset into Discord Gateway format
        const resolvedImage = await resolveRichPresenceImage(discordClient, streamPhoto);

        // Apply rich streaming presence with custom title and photo
        await applyStreamingPresence(discordClient, {
          name: streamTitle,
          details: streamDetails,
          state: streamState,
          url: streamUrl,
          largeImage: resolvedImage,
          largeText: streamTitle
        });

        botState.isStreaming = true;
        isStreaming = true;
        io.emit('state_update', botState);
        io.emit('stream_started');
        console.log(`[BOT] Screen share / Go-Live started with custom title: "${streamTitle}" and photo: ${streamPhoto ? 'Yes' : 'No'}`);
      }
    } catch (err) {
      console.error('[BOT] Stream error:', err);
      socket.emit('bot_error', 'Failed to start stream: ' + err.message);
    }
  });

  // ========== STOP SCREEN SHARE ==========
  socket.on('stop_stream', async () => {
    stopStream();
    try {
      if (discordClient?.user) {
        // If there was an active non-streaming custom activity, restore it; otherwise clear
        if (botState.customActivity && botState.customActivity.type && botState.customActivity.type !== 'NONE' && botState.customActivity.type !== 'STREAMING') {
          await discordClient.user.setActivity(botState.customActivity.text, {
            type: botState.customActivity.type
          });
        } else {
          await discordClient.user.setActivity(null);
        }
      }
    } catch (e) {}
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

    // Voice State Syncer - checks every guild to see if account is in a VC
    function syncVoiceState() {
      if (!discordClient || !discordClient.user) return;
      try {
        let activeVC = null;
        for (const guild of discordClient.guilds.cache.values()) {
          const vs = guild.voiceStates?.cache?.get(discordClient.user.id);
          const channelId = vs?.channelId || guild.members?.me?.voice?.channelId || guild.members?.cache?.get(discordClient.user.id)?.voice?.channelId;
          if (channelId) {
            const ch = guild.channels.cache.get(channelId);
            activeVC = {
              guildId: guild.id,
              channelId: channelId,
              channelName: ch?.name || vs?.channel?.name || 'Voice Channel',
              guildName: guild.name
            };
            botState.isMuted = vs ? (!!vs.selfMute || !!vs.serverMute) : (!!botState.isMuted);
            botState.isDeafened = vs ? (!!vs.selfDeaf || !!vs.serverDeaf) : (!!botState.isDeafened);
            break;
          }
        }

        if (activeVC) {
          if (!botState.currentVC || botState.currentVC.channelId !== activeVC.channelId) {
            console.log(`[BOT] Active voice channel detected: ${activeVC.channelName} (${activeVC.guildName})`);
            botState.currentVC = activeVC;
            saveSession(reconnectToken, botState.currentVC);
            io.emit('state_update', botState);
            io.emit('vc_joined', botState.currentVC);
          }
        }
      } catch (e) {
        console.warn('[BOT] Voice sync check notice:', e.message);
      }
    }

    syncVoiceState();
    setInterval(syncVoiceState, 2500);

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

    // Auto-apply saved custom activity / streaming status if present
    if (botState.customActivity && botState.customActivity.type && botState.customActivity.type !== 'NONE') {
      setTimeout(async () => {
        try {
          const act = botState.customActivity;
          if (act.type === 'STREAMING') {
            const resolvedImg = await resolveRichPresenceImage(discordClient, act.photo || act.largeImage);
            await applyStreamingPresence(discordClient, {
              name: act.name || act.text || '^ ANE WALA STAR !!',
              details: act.details,
              state: act.state,
              url: act.streamUrl || 'https://twitch.tv/discord',
              largeImage: resolvedImg,
              largeText: act.largeText || act.name
            });
          } else {
            await discordClient.user.setActivity(act.text || act.name, { type: act.type });
          }
        } catch (e) {
          console.warn('[BOT] Auto-apply saved activity notice:', e.message);
        }
      }, 1000);
    }

    io.emit('login_success', botState);
    io.emit('state_update', botState);
  });

  // Native Discord Gateway voice state listener
  discordClient.on('voiceStateUpdate', (oldState, newState) => {
    const myId = discordClient?.user?.id;
    if (!myId) return;
    if (newState.id === myId || newState.member?.id === myId || oldState.id === myId) {
      if (newState.channelId) {
        const ch = newState.channel || newState.guild?.channels?.cache?.get(newState.channelId);
        botState.currentVC = {
          guildId: newState.guild?.id || (ch && ch.guild?.id),
          channelId: newState.channelId,
          channelName: ch?.name || 'Voice Channel',
          guildName: newState.guild?.name || 'Server'
        };
        botState.isMuted = !!newState.selfMute || !!newState.serverMute;
        botState.isDeafened = !!newState.selfDeaf || !!newState.serverDeaf;
        saveSession(reconnectToken, botState.currentVC);
        io.emit('vc_joined', botState.currentVC);
      } else {
        botState.currentVC = null;
        botState.isStreaming = false;
        isStreaming = false;
        saveSession(reconnectToken, null);
        io.emit('vc_left');
      }
      io.emit('state_update', botState);
    }
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
      discordClient = createDiscordClient();
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
  const tokenToUse = envToken || (saved && saved.token) || DEFAULT_TOKEN;

  if (tokenToUse) {
    console.log('[BOT] Starting auto-login with default/saved token...');
    try {
      discordClient = createDiscordClient();
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
