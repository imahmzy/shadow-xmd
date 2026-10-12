const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// SELF PING SERVER
const PORT = process.env.PORT || 3000;
http.createServer((req,res)=> res.end('SHADOW XMD V4 LIVE')).listen(PORT, ()=> console.log('PORT FIXED'));

const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const BOT_NAME = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';
const MAX_SESSIONS = 10;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://shadow-xmd-i4tf.onrender.com';

const COMMANDS_DIR = path.join(__dirname, 'commands');
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const PER_SESSION_DATA_DIR = path.join(DATA_DIR, 'per_session');
const SUPER_OWNER_FILE = path.join(DATA_DIR, 'super_owner.json');
const SESSION_OWNERS_FILE = path.join(DATA_DIR, 'session_owners.json');

for(const d of [DATA_DIR, SESSIONS_DIR, COMMANDS_DIR, path.join(__dirname,'temp'), PER_SESSION_DATA_DIR]){ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); }
function ensureJson(f, def){ if(!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(def,null,2)); }
ensureJson(SUPER_OWNER_FILE, { number: null, gid: null });
ensureJson(SESSION_OWNERS_FILE, {});

// ===== SESSION_ID RESTORE (FREE PERSISTENCE) =====
function restoreFromSessionId(){
  if(!process.env.SESSION_ID) return;
  try{
    console.log('[RESTORE] SESSION_ID found, restoring...');
    const decoded = Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8');
    const creds = JSON.parse(decoded);
    const sessionDir = path.join(SESSIONS_DIR, 'session1');
    if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
    fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(creds, null, 2));
    console.log('[RESTORE] session1 creds.json restored from SESSION_ID');
  }catch(e){ console.log('[RESTORE FAILED]', e.message); }
}
restoreFromSessionId();

function generateSessionId(sessionName='session1'){
  try{
    const credsPath = path.join(SESSIONS_DIR, sessionName, 'creds.json');
    if(!fs.existsSync(credsPath)) return null;
    const data = fs.readFileSync(credsPath, 'utf-8');
    const b64 = Buffer.from(data).toString('base64');
    console.log(`\n\n========== YOUR ${sessionName.toUpperCase()} SESSION_ID (COPY THIS TO ENV) ==========`);
    console.log(b64);
    console.log(`========== END SESSION_ID ==========\n\n`);
    return b64;
  }catch(e){ console.log('gen session id fail', e.message); return null; }
}

function getSessionDataDir(s){ const dir = path.join(PER_SESSION_DATA_DIR, s); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); return dir; }
function getSessionJson(s, file, def){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return JSON.parse(fs.readFileSync(fp,'utf8')); }catch{ return def; } }
function setSessionJson(s, file, data){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir, file), JSON.stringify(data,null,2)); }catch{} }
const logger = pino({ level: 'silent' });
const runtimes = {};
function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }
function getSuperOwner(){ try{ const d = JSON.parse(fs.readFileSync(SUPER_OWNER_FILE,'utf8')); if(d.number) return normalizeNumber(d.number); return null; }catch{ return null; } }
function setSuperOwner(n, full){ const norm = normalizeNumber(n); fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: norm, gid: full||norm+'@s.whatsapp.net' }, null, 2)); }
function getSessionOwners(){ try{ return JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); }catch{ return {}; } }
function setSessionOwner(s, n){ const o = getSessionOwners(); o[s] = normalizeNumber(n); fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(o, null, 2)); }
const loadedCommands = new Map();
function loadCommands(){ loadedCommands.clear(); if(!fs.existsSync(COMMANDS_DIR)) return; for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){ if(['addsession','listsessions','delsession','listsession','delsessions','session'].some(k=> f.toLowerCase().includes(k))) continue; // we handle session commands internally
  try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute){ loadedCommands.set(cmd.name.toLowerCase(), cmd); if(cmd.aliases) cmd.aliases.forEach(a=> loadedCommands.set(a.toLowerCase(), cmd)); } }catch(e){ console.log(`[LOADER FAILED] ${f}: ${e.message}`); } } console.log(`[${BOT_NAME}] Loaded ${loadedCommands.size} other commands`); }
loadCommands();
function getPrefixForSession(s){ return (getSessionJson(s, 'prefix.json', { prefix: '.' }).prefix || '.'); }
function parseCommand(t,s){ const p = getPrefixForSession(s); if(!t.startsWith(p)) return null; const w = t.slice(p.length).trim().split(/\s+/); const cmd = w.shift()?.toLowerCase(); if(!cmd) return null; return { command: cmd, args: w, prefix: p }; }
function getNextSessionName(){ for(let i=1;i<=MAX_SESSIONS;i++){ const name = `session${i}`; if(!fs.existsSync(path.join(SESSIONS_DIR, name))) return name; } return null; }

async function startSession(sessionName, phoneNumberForPairing=null){
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
  if(!fs.existsSync(path.join(PER_SESSION_DATA_DIR, sessionName))) fs.mkdirSync(path.join(PER_SESSION_DATA_DIR, sessionName),{recursive:true});
  // ensure per session files
  if(!fs.existsSync(path.join(PER_SESSION_DATA_DIR, sessionName, 'prefix.json'))) fs.writeFileSync(path.join(PER_SESSION_DATA_DIR, sessionName, 'prefix.json'), JSON.stringify({prefix:'.'},null,2));
  if(!fs.existsSync(path.join(PER_SESSION_DATA_DIR, sessionName, 'mode.json'))) fs.writeFileSync(path.join(PER_SESSION_DATA_DIR, sessionName, 'mode.json'), JSON.stringify({mode:'public'},null,2));
  if(!fs.existsSync(path.join(PER_SESSION_DATA_DIR, sessionName, 'sudo.json'))) fs.writeFileSync(path.join(PER_SESSION_DATA_DIR, sessionName, 'sudo.json'), JSON.stringify([],null,2));

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{ version = [2,3000,1015901307]; }
  console.log(`[${sessionName}] REGISTERED: ${state.creds.registered} PHONE_ENV: ${process.env.PHONE_NUMBER||'none'}`);

  const sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, logger, version, markOnlineOnConnect: true, browser: ['Chrome','Windows','10'] });
  runtimes[sessionName] = { sock, connected: false };
  sock.ev.on('creds.update', saveCreds);

  // 8 DIGIT PAIRING CODE LOGIC
  if(!state.creds.registered){
    const num = (phoneNumberForPairing || process.env.PHONE_NUMBER || '').replace(/[^0-9]/g,'');
    if(!num){ console.log(`[${sessionName}] No phone number for pairing, will show QR`); }
    else {
      setTimeout(async ()=>{
        try{
          console.log(`[${sessionName}] Requesting 8-digit code for ${num}...`);
          const code = await sock.requestPairingCode(num);
          console.log(`\n\n===== ${sessionName.toUpperCase()} 8-DIGIT CODE FOR ${num}: ${code} =====\nEnter in WhatsApp > Linked Devices > Link with phone number\nCode valid 60 sec, will auto-refresh\n\n`);
        }catch(e){ console.log(`[${sessionName}] Pairing failed: ${e.message}`); }
      }, 4000);
      // refresh code every 60 sec
      let interval = setInterval(async ()=>{
        if(state.creds.registered){ clearInterval(interval); return; }
        try{ const c = await sock.requestPairingCode(num); console.log(`\n[${sessionName}] NEW CODE: ${c} for ${num}\n`); }catch{}
      }, 65000);
    }
  }

  sock.ev.on('connection.update', async ({connection, lastDisconnect, qr})=>{
    if(qr &&!state.creds.registered &&!phoneNumberForPairing &&!process.env.PHONE_NUMBER){
      console.log(`\n[${sessionName}] SCAN QR:`); qrcode.generate(qr, {small:true});
    }
    if(connection === 'open'){
      runtimes[sessionName].connected = true;
      console.log(`[${sessionName}] ✅ CONNECTED ${normalizeNumber(sock.user?.id)}`);
      const myNum = normalizeNumber(sock.user?.id);
      if(!getSuperOwner()){ setSuperOwner(myNum, sock.user?.id); setSessionOwner('session1', myNum); }
      if(!getSessionOwners()[sessionName]) setSessionOwner(sessionName, myNum);
      if(sessionName === 'session1') generateSessionId('session1');
    }
    if(connection === 'close'){
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[${sessionName}] CLOSED code:${code}`);
      if(code!== DisconnectReason.loggedOut){ setTimeout(()=> startSession(sessionName), 5000); }
    }
  });

  sock.ev.on('messages.upsert', async ({type, messages})=>{
    if(type!== 'notify') return;
    for(const m of messages){
      if(!m.message) continue;
      const chatId = m.key.remoteJid;
      if(chatId === 'status@broadcast') continue;
      const senderRaw = m.key.participant || m.key.remoteJid;
      const senderNum = normalizeNumber(senderRaw);
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
      if(!text) continue;
      const parsed = parseCommand(text.trim(), sessionName);
      if(!parsed) continue;
      const superOwner = getSuperOwner();
      const isSuperOwner = (superOwner && senderNum === superOwner) || m.key.fromMe;
      const owners = getSessionOwners();
      const isSessionOwner = (owners[sessionName] && senderNum === owners[sessionName]) || isSuperOwner;

      // ===== SESSION MANAGEMENT COMMANDS (BUILT-IN) =====
      if(['addsession','addsessions'].includes(parsed.command)){
        if(!isSuperOwner) continue;
        const targetNum = parsed.args[0]?.replace(/[^0-9]/g,'');
        if(!targetNum || targetNum.length < 10){ await sock.sendMessage(chatId, {text: `❌ Use: ${parsed.prefix}addsession 23480...`}); continue; }
        const existing = fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).length;
        if(existing >= MAX_SESSIONS){ await sock.sendMessage(chatId, {text: `❌ Max ${MAX_SESSIONS} sessions reached. Delete one with.delsession`}); continue; }
        const nextName = getNextSessionName();
        if(!nextName){ await sock.sendMessage(chatId, {text: `❌ No slot left`}); continue; }
        await sock.sendMessage(chatId, {text: `⏳ Creating ${nextName} for ${targetNum}...\nCheck Render logs for 8-digit code`});
        startSession(nextName, targetNum);
        continue;
      }
      if(['listsessions','listsession','sessionlist','sessions','list'].includes(parsed.command)){
        if(!isSuperOwner) continue;
        const sess = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).sort() : [];
        let txt = `*${BOT_NAME} SESSIONS* (${sess.length}/${MAX_SESSIONS})\n\n`;
        for(const s of sess){ const conn = runtimes[s]?.connected? '🟢 ONLINE' : '🔴 OFFLINE'; const owner = getSessionOwners()[s] || 'unknown'; txt+= `• ${s}: ${conn} | Owner: ${owner}\n`; }
        await sock.sendMessage(chatId, {text: txt}); continue;
      }
      if(['delsession','delsessions','rmsession','delsess'].includes(parsed.command)){
        if(!isSuperOwner) continue;
        const toDel = parsed.args[0];
        if(!toDel){ await sock.sendMessage(chatId, {text: `Use: ${parsed.prefix}delsession session2`}); continue; }
        if(toDel === 'session1'){ await sock.sendMessage(chatId, {text: `❌ Cannot delete session1`}); continue; }
        const delPath = path.join(SESSIONS_DIR, toDel);
        if(!fs.existsSync(delPath)){ await sock.sendMessage(chatId, {text: `❌ ${toDel} not found`}); continue; }
        try{ fs.rmSync(delPath, {recursive:true, force:true}); const perPath = path.join(PER_SESSION_DATA_DIR, toDel); if(fs.existsSync(perPath)) fs.rmSync(perPath,{recursive:true,force:true}); const o = getSessionOwners(); delete o[toDel]; fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(o,null,2)); await sock.sendMessage(chatId, {text: `✅ Deleted ${toDel}`}); }catch(e){ await sock.sendMessage(chatId, {text: `❌ Failed: ${e.message}`}); }
        continue;
      }

      // other commands
      const handler = loadedCommands.get(parsed.command);
      if(!handler) continue;
      const ctx = { sock, m, chatId, sender: senderRaw, senderNum, isGroup: chatId.endsWith('@g.us'), isSuperOwner, isSessionOwner, isFromMe: m.key.fromMe, superOwner, getPrefix: ()=>getPrefixForSession(sessionName), BOT_NAME, sessionName, MAX_SESSIONS, startSession, getNextSessionName, getSessionOwners, setSessionOwner, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command, pushName: m.pushName||'Unknown' };
      try{ await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`CMD FAIL ${parsed.command}: ${e.message}`); }
    }
  });
}

// SELF PING EVERY 10 MIN
setInterval(()=>{
  https.get(RENDER_URL, (res)=>{ console.log(`[SELF PING] ${res.statusCode} - keeping alive`); }).on('error', (e)=>{ console.log('[SELF PING FAIL]', e.message); });
}, 10*60*1000);

async function startAll(){
  console.log(`=== ${BOT_NAME} | MAX ${MAX_SESSIONS} | 8-DIGIT + SESSION_ID + SELF-PING ===`);
  // restore already done
  const existing = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).sort() : [];
  if(existing.length===0){ startSession('session1'); }
  else { for(const s of existing){ await startSession(s); await new Promise(r=> setTimeout(r, 1500)); } }
}
startAll();
