const fs = require('fs');
const path = require('path');
const http = require('http');
http.createServer((req,res)=> res.end('SHADOW XMD V4 RUNNING')).listen(process.env.PORT || 3000, ()=> console.log('PORT FIXED'));
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const BOT_NAME = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';
const BOT_START_TIME = Math.floor(Date.now() / 1000);

const SESSION1_ONLY_COMMANDS = ['addsession','addsessions','delsession','delsessions','listsession','listsessions','session','sessions','list','sessionlist','delsess','rmsession'];
const SUPER_ONLY_COMMANDS = ['addsession','addsessions','listsession','listsessions','delsession','delsessions','session'];
const COMMANDS_DIR = path.join(__dirname, 'commands');
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const PER_SESSION_DATA_DIR = path.join(DATA_DIR, 'per_session');
const SUPER_OWNER_FILE = path.join(DATA_DIR, 'super_owner.json');
const SESSION_OWNERS_FILE = path.join(DATA_DIR, 'session_owners.json');
const NAME_CACHE_FILE = path.join(DATA_DIR, 'names.json');
for(const d of [DATA_DIR, SESSIONS_DIR, COMMANDS_DIR, path.join(__dirname,'temp'), PER_SESSION_DATA_DIR]){ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); }
function ensureJson(f, def){ if(!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(def,null,2)); }
ensureJson(SUPER_OWNER_FILE, { number: null, gid: null });
ensureJson(SESSION_OWNERS_FILE, {});
ensureJson(NAME_CACHE_FILE, {});
function getSessionDataDir(s){ const dir = path.join(PER_SESSION_DATA_DIR, s); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); return dir; }
function getSessionFile(s, file, def){ const dir = getSessionDataDir(s); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return fp; }
function getSessionJson(s, file, def){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return JSON.parse(fs.readFileSync(fp,'utf8')); }catch{ return def; } }
function setSessionJson(s, file, data){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir, file), JSON.stringify(data,null,2)); }catch{} }
const logger = pino({ level: 'silent' });
const runtimes = {};
function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }
function getSuperOwner(){ try{ const d = JSON.parse(fs.readFileSync(SUPER_OWNER_FILE,'utf8')); if(d.number) return normalizeNumber(d.number); if(d.gid) return normalizeNumber(d.gid); return null; }catch{ return null; } }
function setSuperOwner(n, full){ const norm = normalizeNumber(n); const gid = full || (norm? norm + '@s.whatsapp.net' : null); fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: norm, gid }, null, 2)); console.log(`[OWNER SAVED] ${norm}`); }
function getSessionOwners(){ try{ return JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); }catch{ return {}; } }
function setSessionOwner(s, n){ const o = getSessionOwners(); o[s] = normalizeNumber(n); fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(o, null, 2)); }
const loadedCommands = new Map();
function loadCommands(){ loadedCommands.clear(); if(!fs.existsSync(COMMANDS_DIR)) return; for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){ try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute){ loadedCommands.set(cmd.name.toLowerCase(), cmd); if(Array.isArray(cmd.aliases)) cmd.aliases.forEach(a=> loadedCommands.set(a.toLowerCase(), cmd)); } }catch(e){ console.log(`[LOADER FAILED] ${f}: ${e.message}`); } } console.log(`[${BOT_NAME}] Loaded ${loadedCommands.size} commands`); }
loadCommands();
function getPrefixForSession(s){ return (getSessionJson(s, 'prefix.json', { prefix: '.' }).prefix || '.'); }
function parseCommandForSession(t,s){ const p = getPrefixForSession(s); if(!t.startsWith(p)) return null; const w = t.slice(p.length).trim().split(/\s+/); const cmd = w.shift()?.toLowerCase(); if(!cmd) return null; return { command: cmd, args: w }; }

async function startSession(sessionName){
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
  getSessionFile(sessionName, 'mode.json', { mode: 'public' });
  getSessionFile(sessionName, 'prefix.json', { prefix: '.' });
  getSessionFile(sessionName, 'sudo.json', []);
  getSessionFile(sessionName, 'auto.json', { autoview: false, autoreact: false, reactme: false, statusreact: false, autotyping: false, autorecording: false });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{ version = [2,3000,1015901307]; }
  console.log(`[${sessionName}] WA VER ${version} | REGISTERED: ${state.creds.registered} | PHONE: ${process.env.PHONE_NUMBER || 'NOT SET'}`);

  const sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, logger, version, markOnlineOnConnect: true, syncFullHistory: false, browser: ['Chrome','Windows','10'] });
  runtimes[sessionName] = { sock, connected: false };
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({connection, lastDisconnect})=>{
    if(connection === 'open'){
      runtimes[sessionName].connected = true;
      console.log(`[${sessionName}] ✅ CONNECTED ${normalizeNumber(sock.user?.id)} - BOT IS LIVE!`);
      if(sessionName === 'session1' &&!getSuperOwner()){ setSuperOwner(normalizeNumber(sock.user?.id), sock.user?.id); setSessionOwner('session1', normalizeNumber(sock.user?.id)); }
      if(!getSessionOwners()[sessionName]) setSessionOwner(sessionName, normalizeNumber(sock.user?.id));
    }
    if(connection === 'close'){
      const code = lastDisconnect?.error?.output?.statusCode;
      const msg = lastDisconnect?.error?.message || '';
      console.log(`[${sessionName}] ❌ DISCONNECTED code:${code} msg:${msg}`);
      // If not registered, wait longer before retry so user has time to enter code
      if(!state.creds.registered){
        console.log(`[${sessionName}] Waiting 15s before new pairing code... keep your WhatsApp open`);
        setTimeout(()=> startSession(sessionName), 15000);
      } else {
        if(code!== DisconnectReason.loggedOut){ setTimeout(()=> startSession(sessionName), 5000); }
      }
    }
  });

  sock.ev.on('messages.upsert', async ({type, messages})=>{
    if(type!== 'notify') return;
    for(const m of messages){
      if(!m.message) continue;
      const chatId = m.key.remoteJid;
      const senderRaw = m.key.participant || m.key.remoteJid;
      const senderNum = normalizeNumber(senderRaw);
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
      if(!text) continue;
      const parsed = parseCommandForSession(text.trim(), sessionName);
      if(!parsed) continue;
      const handler = loadedCommands.get(parsed.command);
      if(!handler) continue;
      let superOwner = getSuperOwner();
      if(!superOwner && m.key.fromMe){ const myNum = normalizeNumber(sock.user?.id || senderNum); if(myNum){ setSuperOwner(myNum, sock.user?.id); setSessionOwner(sessionName, myNum); superOwner = myNum; } }
      const isSuperOwner = (superOwner && senderNum === superOwner) || m.key.fromMe;
      if(SUPER_ONLY_COMMANDS.includes(parsed.command) &&!isSuperOwner) continue;
      const ctx = { sock, m, chatId, sender: senderRaw, senderRaw, senderNum, isGroup: chatId.endsWith('@g.us'), isSuperOwner, isSessionOwner: true, isFromMe: m.key.fromMe, isSudo: false, superOwner, getPrefix: ()=>getPrefixForSession(sessionName), BOT_NAME, sessionName, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command, pushName: m.pushName||'Unknown' };
      try{ await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`FAILED ${parsed.command}: ${e.message}`); }
    }
  });

  if(!state.creds.registered){
    const num = (process.env.PHONE_NUMBER || '').replace(/[^0-9]/g,'');
    if(!num){ console.log('Set PHONE_NUMBER env!'); return; }
    await new Promise(r=> setTimeout(r, 4000));
    let attempt = 0;
    const doPair = async ()=>{
      attempt++;
      try{
        const code = await sock.requestPairingCode(num);
        console.log(`\n\n===== ATTEMPT ${attempt} | PAIRING CODE FOR ${num}: ${code} | VALID 90 SEC =====\nYou have 90 seconds to enter this in WhatsApp > Linked Devices > Link with phone number\n\n`);
      }catch(e){ console.log(`Pairing error attempt ${attempt}: ${e.message}`); }
    };
    await doPair();
    // Refresh code every 70 sec so you always have a valid one
    const interval = setInterval(async ()=>{
      if(state.creds.registered){ clearInterval(interval); return; }
      await doPair();
    }, 70000);
  }
}

async function startAll(){
  console.log(`=== ${BOT_NAME} | WAIT FIX 90SEC ===`);
  startSession('session1');
}
startAll();
