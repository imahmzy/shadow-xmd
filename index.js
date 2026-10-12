const fs = require('fs');
const path = require('path');
const http = require('http');
http.createServer((req,res)=> res.end('SHADOW XMD V4 RUNNING')).listen(process.env.PORT || 3000, ()=> console.log('PORT FIXED'));
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const BOT_NAME = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';
const MAX_SESSIONS = 10;
const BOT_START_TIME = Math.floor(Date.now() / 1000);

const SESSION1_ONLY_COMMANDS = ['addsession','addsessions','delsession','delsessions','listsession','listsessions','session','sessions','list','sessionlist','delsess','rmsession'];
const SUPER_ONLY_COMMANDS = ['addsession','addsessions','listsession','listsessions','delsession','delsessions','session'];
const COMMANDS_DIR = path.join(__dirname, 'commands');
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const TEMP_DIR = path.join(__dirname, 'temp');
const PER_SESSION_DATA_DIR = path.join(DATA_DIR, 'per_session');
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
function getSessionJson(sessionName, fileName, defaultData){ try{ const safeName = sessionName || 'session1'; const dir = path.join(PER_SESSION_DATA_DIR, safeName); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); const filePath = path.join(dir, fileName); if(!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultData,null,2)); return JSON.parse(fs.readFileSync(filePath,'utf8')); }catch{ return defaultData; } }
function setSessionJson(sessionName, fileName, data){ try{ const safeName = sessionName || 'session1'; const dir = path.join(PER_SESSION_DATA_DIR, safeName); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); const filePath = path.join(dir, fileName); fs.writeFileSync(filePath, JSON.stringify(data,null,2)); }catch(e){ console.log('setSessionJson error', e.message); } }
function getNamesCache(){ try{ if(!fs.existsSync(NAME_CACHE_FILE)) return {}; return JSON.parse(fs.readFileSync(NAME_CACHE_FILE,'utf8') || '{}'); }catch{ return {}; } }
function saveNameToCache(jid, pushName){ if(!jid ||!pushName) return; if(/^\d+$/.test(pushName)) return; if(pushName.length < 2) return; try{ let names = getNamesCache(); if(names[jid]!== pushName){ names[jid] = pushName; fs.writeFileSync(NAME_CACHE_FILE, JSON.stringify(names, null, 2)); } }catch{} }
const logger = pino({ level: 'silent' });
const runtimes = {};
function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }
function getSuperOwner(){ try{ const d = JSON.parse(fs.readFileSync(SUPER_OWNER_FILE,'utf8')); if(d.number) return normalizeNumber(d.number); if(d.gid) return normalizeNumber(d.gid); return null; }catch{ return null; } }
function setSuperOwner(jidOrNumber, fullJid = null){ const norm = normalizeNumber(jidOrNumber); const gid = fullJid || (norm? norm + '@s.whatsapp.net' : null); fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: norm, gid: gid }, null, 2)); console.log(`[OWNER SAVED] ${norm}`); }
function getSessionOwners(){ try{ return JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); }catch{ return {}; } }
function setSessionOwner(sessionName, num){ const owners = getSessionOwners(); owners[sessionName] = normalizeNumber(num); fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(owners, null, 2)); }
const loadedCommands = new Map();
function loadCommands(){ loadedCommands.clear(); if(!fs.existsSync(COMMANDS_DIR)) return; for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){ try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute){ loadedCommands.set(cmd.name.toLowerCase(), cmd); if(Array.isArray(cmd.aliases)) cmd.aliases.forEach(a=> loadedCommands.set(a.toLowerCase(), cmd)); } }catch(e){ console.log(`[LOADER FAILED] ${f}: ${e.message}`); } } console.log(`[${BOT_NAME}] Loaded ${loadedCommands.size} commands`); }
loadCommands();
function getPrefixForSession(sessionName){ const data = getSessionJson(sessionName, 'prefix.json', { prefix: '.' }); return data.prefix || '.'; }
function parseCommandForSession(text, sessionName){ const prefix = getPrefixForSession(sessionName); if(!text.startsWith(prefix)) return null; const without = text.slice(prefix.length).trim().split(/\s+/); let cmd = without.shift()?.toLowerCase(); if(!cmd) return null; return { command: cmd, args: without, prefix, fullText: text }; }

async function startSession(sessionName){
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
  getSessionFile(sessionName, 'mode.json', { mode: 'public' });
  getSessionFile(sessionName, 'prefix.json', { prefix: '.' });
  getSessionFile(sessionName, 'sudo.json', []);
  getSessionFile(sessionName, 'auto.json', { autoview: false, autoreact: false, reactme: false, statusreact: false, autotyping: false, autorecording: false });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{ version = [2,3000,1015901307]; }
  console.log(`[${sessionName}] WA VERSION: ${version} | CREDS REGISTERED: ${state.creds.registered} | PHONE_ENV: ${process.env.PHONE_NUMBER || 'NOT SET'}`);

  const sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, logger, version, markOnlineOnConnect: true, syncFullHistory: false });
  runtimes[sessionName] = { sock, connected: false };
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({type, messages})=>{
    if(type!== 'notify') return;
    for(const m of messages){
      if(!m.message) continue;
      const msgTime = Number(m.messageTimestamp || 0);
      if(msgTime && msgTime < BOT_START_TIME - 5) continue;
      if(m.key.remoteJid === 'status@broadcast'){ continue; }
      const chatId = m.key.remoteJid;
      const senderRaw = m.key.participant || m.key.remoteJid;
      const senderNum = normalizeNumber(senderRaw);
      const isGroup = chatId.endsWith('@g.us');
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
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
      if(modeData.mode === 'private'){ if(!isSuperOwner &&!isSessionOwner &&!isSudo &&!isFromMe) continue; }
      const getPrefix = () => getPrefixForSession(sessionName);
      const ctx = { sock, m, chatId, sender: senderRaw, senderRaw, senderNum, isGroup, isSuperOwner, isSessionOwner, isFromMe, isSudo, superOwner, sessionOwners, getPrefix, BOT_NAME, MAX_SESSIONS, startSession, setSessionOwner, getSessionOwners, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command, pushName: m.pushName || 'Unknown', sessionName };
      try{ await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`[${sessionName}] FAILED.${parsed.command} - ${e.message}`); }
    }
  });

  sock.ev.on('connection.update', async ({connection, lastDisconnect})=>{
    if(connection === 'open'){
      runtimes[sessionName].connected = true;
      const myNum = normalizeNumber(sock.user?.id);
      console.log(`[${sessionName}] ✅ CONNECTED ${myNum}`);
      if(sessionName === 'session1' &&!getSuperOwner()){ setSuperOwner(myNum, sock.user?.id); setSessionOwner('session1', myNum); }
      if(!getSessionOwners()[sessionName]) setSessionOwner(sessionName, myNum);
    }
    if(connection === 'close'){
      runtimes[sessionName].connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[${sessionName}] DISCONNECTED code:${code} reason:${lastDisconnect?.error?.message}`);
      if(code!== 401){ setTimeout(()=> startSession(sessionName), 3000); }
    }
  });

  if(!state.creds.registered){
    const num = (process.env.PHONE_NUMBER || '').replace(/[^0-9]/g,'');
    if(!num){
      console.log(`[${sessionName}] ERROR: PHONE_NUMBER env NOT SET! Set it in Render > Environment`);
      return;
    }
    console.log(`[${sessionName}] Waiting 3s to request pairing code for ${num}...`);
    await new Promise(r=> setTimeout(r, 3000));
    try{
      const code = await sock.requestPairingCode(num);
      console.log(`\n\n================ PAIRING CODE FOR ${num}: ${code} ================\n\n`);
    }catch(e){
      console.log(`[${sessionName}] PAIRING FAILED: ${e.message} ${e.stack}`);
    }
  } else {
    console.log(`[${sessionName}] Session already registered, skipping pairing code`);
  }
}

async function startAll(){
  console.log(`=== ${BOT_NAME} CLEAN NO VV DEBUG ===`);
  const existing = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')) : [];
  if(existing.length === 0) startSession('session1');
  else for(const s of existing.sort()){ await startSession(s); await new Promise(r=> setTimeout(r, 1500)); }
}
startAll();
