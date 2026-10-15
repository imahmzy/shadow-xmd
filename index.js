const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage } = require('@whiskeysockets/baileys');
const readline = require('readline');

const BOT_NAME = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';
const MAX_SESSIONS = 10;
const OWNER_JID = '2348166412988@s.whatsapp.net';
const BOT_START_TIME = Math.floor(Date.now() / 1000);

// === VV SAVE CONFIG - PER SESSION ===
const VV_TEMP_DIR = path.join(__dirname, 'temp', 'vv');
const VV_STATE_FILE = path.join(__dirname, 'data', 'vvsave.json');
const PER_SESSION_DATA_DIR = path.join(__dirname, 'data', 'per_session');
if(!fs.existsSync(path.join(__dirname,'temp'))) fs.mkdirSync(path.join(__dirname,'temp'),{recursive:true});
if(!fs.existsSync(VV_TEMP_DIR)) fs.mkdirSync(VV_TEMP_DIR,{recursive:true});
if(!fs.existsSync(path.join(__dirname,'data'))) fs.mkdirSync(path.join(__dirname,'data'),{recursive:true});
if(!fs.existsSync(PER_SESSION_DATA_DIR)) fs.mkdirSync(path.join(__dirname,'data','per_session'),{recursive:true});
if(!fs.existsSync(VV_STATE_FILE)) fs.writeFileSync(VV_STATE_FILE, JSON.stringify({enabled:false}, null, 2));
global.vvCache = global.vvCache || new Map();
global.groupNameCache = global.groupNameCache || new Map();

function getSessionJson(sessionName, fileName, defaultData){
  try{
    const safeName = sessionName || 'session1';
    const dir = path.join(PER_SESSION_DATA_DIR, safeName);
    if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
    const filePath = path.join(dir, fileName);
    if(!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultData,null,2));
    return JSON.parse(fs.readFileSync(filePath,'utf8'));
  }catch{ return defaultData; }
}
function setSessionJson(sessionName, fileName, data){
  try{
    const safeName = sessionName || 'session1';
    const dir = path.join(PER_SESSION_DATA_DIR, safeName);
    if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data,null,2));
  }catch{}
}
function isVVEnabled(sessionName){
  try{
    // Check per-session first (new 10 session method)
    if(sessionName){
      const per = getSessionJson(sessionName, 'vvsave.json', {enabled:false});
      if(per.enabled) return true;
    }
    // Fallback global
    return JSON.parse(fs.readFileSync(VV_STATE_FILE,'utf8')).enabled;
  }catch{return false;}
}

async function getChatDisplayName(sock, m){
  try{
    const remoteJid = m.key.remoteJid;
    const sender = m.key.participant || remoteJid;
    if(remoteJid.endsWith('@g.us')){
      if(global.groupNameCache.has(remoteJid)) return global.groupNameCache.get(remoteJid);
      try{
        const meta = await sock.groupMetadata(remoteJid);
        const name = meta.subject || remoteJid;
        global.groupNameCache.set(remoteJid, name);
        return name;
      }catch{ return remoteJid; }
    }else{
      const num = (sender || remoteJid).split('@')[0].replace('lid','');
      const pushName = m.pushName || '';
      if(pushName &&!/^\d+$/.test(pushName) && pushName.length>1) return `${pushName} (${num})`;
      return num;
    }
  }catch{ return m.key.remoteJid; }
}

function getViewOnce(message){
  if(!message) return null;
  try{
    if(message.viewOnceMessageV2?.message) return message.viewOnceMessageV2.message;
    if(message.viewOnceMessage?.message) return message.viewOnceMessage.message;
    if(message.viewOnceMessageV2Extension?.message) return message.viewOnceMessageV2Extension.message;
    if(message.imageMessage && (message.imageMessage.viewOnce===true || message.imageMessage.viewOnceV2===true)) return message;
    if(message.videoMessage && (message.videoMessage.viewOnce===true || message.videoMessage.viewOnceV2===true)) return message;
    if(message.audioMessage && (message.audioMessage.viewOnce===true || message.audioMessage.viewOnceV2===true)) return message;
    let stack = [message];
    let seen = new WeakSet();
    while(stack.length){
      const cur = stack.pop();
      if(!cur || typeof cur!== 'object') continue;
      if(seen.has(cur)) continue;
      seen.add(cur);
      if(cur.viewOnceMessageV2?.message) return cur.viewOnceMessageV2.message;
      if(cur.viewOnceMessage?.message) return cur.viewOnceMessage.message;
      if(cur.viewOnceMessageV2Extension?.message) return cur.viewOnceMessageV2Extension.message;
      if(cur.imageMessage && (cur.imageMessage.viewOnce===true || cur.imageMessage.viewOnceV2===true)) return cur;
      if(cur.videoMessage && (cur.videoMessage.viewOnce===true || cur.videoMessage.viewOnceV2===true)) return cur;
      if(cur.audioMessage && (cur.audioMessage.viewOnce===true || cur.audioMessage.viewOnceV2===true)) return cur;
      for(const k of Object.keys(cur)){
        const v = cur[k];
        if(v && typeof v==='object') stack.push(v);
      }
    }
  }catch{}
  return null;
}

// === NEW: DIRECT SEND (NO REACTION) ===
async function handleVVAuto(sock, m, sessionName){
  try{
    if(!isVVEnabled(sessionName)) return;

    const view = getViewOnce(m.message);
    if(!view) return;

    const type = Object.keys(view)[0];
    console.log(`\x1b[35m[VV DETECTED] ${type} in ${sessionName} Chat:${m.key.remoteJid}\x1b[0m`);

    if(!['imageMessage','videoMessage','audioMessage'].includes(type)) return;

    const inner = view[type] || {};
    const headerLen = Number(inner.fileLength || 0);
    if(headerLen > 15*1024*1024) return;

    const displayName = await getChatDisplayName(sock, m);

    const msgToDownload = {
      key: { remoteJid: m.key.remoteJid, id: m.key.id, participant: m.key.participant, fromMe: false },
      message: view
    };

    let buffer;
    try{
      buffer = await downloadMediaMessage(msgToDownload, 'buffer', {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
    }catch(e){
      console.log(`[VV DOWNLOAD FAILED] ${e.message}`);
      return;
    }
    if(!buffer) return;
    if(buffer.length > 15*1024*1024) return;

    // PER SESSION DM - send to THIS session's own JID
    const thisSessionJid = sock.user.id;
    let caption = `*🔓 VVSAVE ${sessionName}*\nFrom: ${displayName}\nChat: ${m.key.remoteJid}\nType: ${type}\nSize: ${(buffer.length/1024).toFixed(0)}KB`;

    if(type==='imageMessage'){
      await sock.sendMessage(thisSessionJid, { image: buffer, caption });
    } else if(type==='videoMessage'){
      await sock.sendMessage(thisSessionJid, { video: buffer, caption });
    } else if(type==='audioMessage'){
      await sock.sendMessage(thisSessionJid, { audio: buffer, ptt: inner.ptt || false });
    }

    console.log(`\x1b[32m[VVSAVE SENT TO ${sessionName} DM] ${displayName} | ${type} | ${(buffer.length/1024).toFixed(0)}KB\x1b[0m`);

  }catch(e){
    console.log('[VV AUTO ERR]', e.message);
  }
}

const SESSION1_ONLY_COMMANDS = ['addsession','addsessions','delsession','delsessions','listsession','listsessions','session','sessions','list','sessionlist','delsess','rmsession'];
const SUPER_ONLY_COMMANDS = ['addsession','addsessions','listsession','listsessions','delsession','delsessions','session'];
const COMMANDS_DIR = path.join(__dirname, 'commands');
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const TEMP_DIR = path.join(__dirname, 'temp');
const SUPER_OWNER_FILE = path.join(DATA_DIR, 'super_owner.json');
const SESSION_OWNERS_FILE = path.join(DATA_DIR, 'session_owners.json');
const NAME_CACHE_FILE = path.join(DATA_DIR, 'names.json');
for(const d of [DATA_DIR, SESSIONS_DIR, COMMANDS_DIR, TEMP_DIR, PER_SESSION_DATA_DIR]){ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); }
function ensureJson(f, def){ if(!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(def,null,2)); }
ensureJson(SUPER_OWNER_FILE, { number: null, gid: null });
ensureJson(SESSION_OWNERS_FILE, {});
ensureJson(NAME_CACHE_FILE, {});
function getSessionDataDir(sessionName){ const dir = path.join(PER_SESSION_DATA_DIR, sessionName); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); return dir; }
function getSessionFile(sessionName, fileName, defaultData){ const dir = getSessionDataDir(sessionName); const filePath = path.join(dir, fileName); if(!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultData,null,2)); return filePath; }
function getNamesCache(){ try{ if(!fs.existsSync(NAME_CACHE_FILE)) return {}; return JSON.parse(fs.readFileSync(NAME_CACHE_FILE,'utf8') || '{}'); }catch{ return {}; } }
function saveNameToCache(jid, pushName){ if(!jid ||!pushName) return; if(/^\d+$/.test(pushName)) return; if(pushName.length < 2) return; try{ let names = getNamesCache(); if(names[jid]!== pushName){ names[jid] = pushName; fs.writeFileSync(NAME_CACHE_FILE, JSON.stringify(names, null, 2)); } }catch{} }
const logger = pino({ level: 'silent' });
const runtimes = {};
let rl = null;
function getRL(){ if(!rl) rl = readline.createInterface({input: process.stdin, output: process.stdout}); return rl; }
function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }
function getSuperOwner(){ try{ const d = JSON.parse(fs.readFileSync(SUPER_OWNER_FILE,'utf8')); if(d.number) return normalizeNumber(d.number); if(d.gid) return normalizeNumber(d.gid); return null; }catch{ return null; } }
function setSuperOwner(jidOrNumber, fullJid = null){ const norm = normalizeNumber(jidOrNumber); const gid = fullJid || (norm? norm + '@s.whatsapp.net' : null); fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: norm, gid: gid }, null, 2)); }
function getSessionOwners(){ try{ return JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); }catch{ return {}; } }
function setSessionOwner(sessionName, num){ const owners = getSessionOwners(); owners[sessionName] = normalizeNumber(num); fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(owners, null, 2)); }
const loadedCommands = new Map();
function loadCommands(){ loadedCommands.clear(); if(!fs.existsSync(COMMANDS_DIR)) return; for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){ try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute){ loadedCommands.set(cmd.name.toLowerCase(), cmd); if(Array.isArray(cmd.aliases)) cmd.aliases.forEach(a=> loadedCommands.set(a.toLowerCase(), cmd)); } }catch(e){ console.log(`[LOADER FAILED] ${f}: ${e.message}`); } } console.log(`[${BOT_NAME}] Loaded ${loadedCommands.size} commands`); }
loadCommands();
function getPrefixForSession(sessionName){ const data = getSessionJson(sessionName, 'prefix.json', { prefix: '.' }); return data.prefix || '.'; }
function parseCommandForSession(text, sessionName){ const prefix = getPrefixForSession(sessionName); if(!text.startsWith(prefix)) return null; const without = text.slice(prefix.length).trim().split(/\s+/); let cmd = without.shift()?.toLowerCase(); if(!cmd) return null; return { command: cmd, args: without, prefix, fullText: text }; }
async function startSession(sessionName, phoneNumberForPairing = null){
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
  getSessionFile(sessionName, 'mode.json', { mode: 'public' });
  getSessionFile(sessionName, 'prefix.json', { prefix: '.' });
  getSessionFile(sessionName, 'sudo.json', []);
  getSessionFile(sessionName, 'auto.json', { autoview: false, autoreact: false });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{}
  const sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, logger, version, markOnlineOnConnect: true, syncFullHistory: false, });
  runtimes[sessionName] = { sock, connected: false };
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({type, messages})=>{
    if(type!== 'notify') return;
    for(const m of messages){
      if(!m.message) continue;
      const msgTime = Number(m.messageTimestamp || 0);
      if(msgTime && msgTime < BOT_START_TIME - 5) continue;

      // VVSAVE - DIRECT, NO REACTION
      handleVVAuto(sock, m, sessionName).catch(()=>{});

      if(m.key.remoteJid === 'status@broadcast') continue;
      const chatId = m.key.remoteJid;
      const senderRaw = m.key.participant || m.key.remoteJid;
      const senderNum = normalizeNumber(senderRaw);
      const isGroup = chatId.endsWith('@g.us');
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
      const pushName = m.pushName || 'Unknown';
      if(pushName && pushName!== 'Unknown'){ saveNameToCache(senderRaw, pushName); }

      if(!text) continue;
      const parsed = parseCommandForSession(text.trim(), sessionName);
      if(!parsed) continue;
      const handler = loadedCommands.get(parsed.command);
      if(!handler) continue;
      let superOwner = getSuperOwner();
      if(!superOwner && m.key.fromMe){ const myFullJid = sock.user?.id; const myNum = normalizeNumber(myFullJid || senderNum); if(myNum){ setSuperOwner(myNum, myFullJid); setSessionOwner(sessionName, myNum); superOwner = myNum; } }
      const sessionOwners = getSessionOwners();
      const isSuperOwner = (superOwner && senderNum === superOwner) || m.key.fromMe;
      const isSessionOwner = (sessionOwners[sessionName] && senderNum === sessionOwners[sessionName]) || isSuperOwner;
      const isFromMe = m.key.fromMe;
      const sudoList = getSessionJson(sessionName, 'sudo.json', []);
      const isSudo = sudoList.map(n=> normalizeNumber(n)).includes(senderNum);
      if(SESSION1_ONLY_COMMANDS.includes(parsed.command)){ if(sessionName!== 'session1') continue; }
      if(SUPER_ONLY_COMMANDS.includes(parsed.command)){ if(!isSuperOwner) continue; }
      const modeData = getSessionJson(sessionName, 'mode.json', { mode: 'public' });
      const currentMode = modeData.mode || 'public';
      if(currentMode === 'private'){ if(!isSuperOwner &&!isSessionOwner &&!isSudo &&!isFromMe) continue; }

      const getPrefix = () => getPrefixForSession(sessionName);
      const sender = senderRaw;
      const ctx = { sock, m, chatId, sender, senderRaw, senderNum, isGroup, isSuperOwner, isSessionOwner, isFromMe, isSudo, superOwner, sessionOwners, getPrefix, BOT_NAME, MAX_SESSIONS, startSession, setSessionOwner, getSessionOwners, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command, pushName, sessionName };
      try{ await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`[${sessionName}] [FAILED].${parsed.command} - ${e.message}`); }
    }
  });
  sock.ev.on('connection.update', async ({connection, lastDisconnect, qr})=>{
    if(connection === 'open'){
      if(!runtimes[sessionName]) runtimes[sessionName] = { sock, connected: true };
      runtimes[sessionName].connected = true;
      const myNum = normalizeNumber(sock.user?.id);
      console.log(`[${sessionName}] ✅ CONNECTED ${myNum} | VVSAVE DIRECT PER SESSION`);
      if(sessionName === 'session1' &&!getSuperOwner()){ setSuperOwner(myNum, sock.user?.id); setSessionOwner('session1', myNum); }
      if(!getSessionOwners()[sessionName]) setSessionOwner(sessionName, myNum);
    }
    if(connection === 'close'){
      if(runtimes[sessionName]) runtimes[sessionName].connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if(code!== DisconnectReason.loggedOut){ console.log(`[${sessionName}] DISCONNECTED, reconnecting...`); setTimeout(()=> startSession(sessionName), 3000); }
    }
  });
  if(!state.creds.registered){
    if(phoneNumberForPairing){
      await new Promise(r=> setTimeout(r, 2000));
      try{
        // 35 SEC WAIT LOGIC
        const cleanNum = phoneNumberForPairing.replace(/[^0-9]/g,'');
        const code = await sock.requestPairingCode(cleanNum);
        console.log(`[${sessionName}] PAIRING CODE for ${cleanNum}: ${code}`);
        setTimeout(()=>{ try{ sock.end(); }catch{} startSession(sessionName); }, 35000);
        return code;
      }catch(e){ console.error(e.message); return null; }
    } else {
      if(sessionName === 'session1'){
        setTimeout(async ()=>{
          const answer = await new Promise(res=> getRL().question(`[${BOT_NAME}] [${sessionName}] Enter phone (e.g 234...): `, res));
          const num = answer.replace(/[^0-9]/g,'');
          if(!num) return;
          try{ const code = await sock.requestPairingCode(num); console.log(`\n[${sessionName}] PAIRING CODE FOR ${num}: ${code}\n`); setTimeout(()=>{ try{ sock.end(); }catch{} startSession(sessionName); }, 35000); }catch(e){ console.error(e.message); }
        }, 1500);
      }
    }
  }
}
async function startAll(){
  console.log(`\n=== ${BOT_NAME} | VVSAVE DIRECT PER SESSION + 35s WAIT ===`);
  const existing = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')) : [];
  if(existing.length === 0) startSession('session1');
  else for(const s of existing.sort()){ await startSession(s); await new Promise(r=> setTimeout(r, 1500)); }
}
startAll();
