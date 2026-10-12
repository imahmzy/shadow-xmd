const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
http.createServer((req,res)=> res.end('SHADOW XMD V4 RUNNING - SCAN QR IN LOGS')).listen(process.env.PORT || 3000, ()=> console.log('PORT FIXED'));
// FORCE FRESH QR - DELETE AFTER SCANNING ONCE
const { execSync } = require('child_process');
try{ execSync('rm -rf sessions/session1'); console.log('DELETED OLD SESSION1 FOR FRESH QR'); }catch{}
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const BOT_NAME = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';
const REAL_OWNER = '2348166412988';
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
ensureJson(SUPER_OWNER_FILE, { number: REAL_OWNER, gid: REAL_OWNER+'@s.whatsapp.net' });
ensureJson(SESSION_OWNERS_FILE, {});
// force you as owner
fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: REAL_OWNER, gid: REAL_OWNER+'@s.whatsapp.net' }, null,2));

function restoreFromSessionId(){
  if(!process.env.SESSION_ID) return;
  try{
    console.log('[RESTORE] SESSION_ID found...');
    const decoded = Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8');
    const sessionDir = path.join(SESSIONS_DIR, 'session1');
    if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
    fs.writeFileSync(path.join(sessionDir, 'creds.json'), decoded);
    console.log('[RESTORE] session1 restored from SESSION_ID');
  }catch(e){ console.log('[RESTORE FAILED]', e.message); }
}
restoreFromSessionId();

function generateSessionId(){
  try{
    const p = path.join(SESSIONS_DIR, 'session1', 'creds.json');
    if(!fs.existsSync(p)) return;
    const data = fs.readFileSync(p,'utf-8');
    const b64 = Buffer.from(data).toString('base64');
    console.log(`\n\n========== YOUR SESSION1 SESSION_ID (COPY TO RENDER ENV) ==========\n${b64}\n========== END SESSION_ID ==========\n\n`);
  }catch(e){ console.log('gen fail', e.message); }
}

function getSessionDataDir(s){ const dir = path.join(PER_SESSION_DATA_DIR, s); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); return dir; }
function getSessionFile(s, file, def){ const dir = getSessionDataDir(s); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return fp; }
function getSessionJson(s, file, def){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return JSON.parse(fs.readFileSync(fp,'utf8')); }catch{ return def; } }
function setSessionJson(s, file, data){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir, file), JSON.stringify(data,null,2)); }catch{} }
const logger = pino({ level: 'silent' });
const runtimes = {};

function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }
function getSuperOwner(){ return REAL_OWNER; }
function setSuperOwner(n, full){ const norm = normalizeNumber(n); fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: norm, gid: full||norm+'@s.whatsapp.net' }, null, 2)); }
function getSessionOwners(){ try{ return JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); }catch{ return {}; } }
function setSessionOwner(s, n){ try{ const o = JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); o[s] = normalizeNumber(n); fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(o, null, 2)); }catch{} }

const loadedCommands = new Map();
function loadCommands(){
  loadedCommands.clear();
  for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){
    // skip old session commands files - we handle internally
    if(['addsession','listsessions','delsession','listsession','delsessions'].some(k=> f.toLowerCase().includes(k))) continue;
    try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute){ loadedCommands.set(cmd.name.toLowerCase(), cmd); } }catch(e){ console.log(`[LOADER FAILED] ${f}: ${e.message}`); }
  }
  console.log(`[${BOT_NAME}] Loaded ${loadedCommands.size} commands`);
}
loadCommands();
function getPrefixForSession(s){ return (getSessionJson(s, 'prefix.json', { prefix: '.' }).prefix || '.'); }
function parseCommandForSession(t,s){ const p = getPrefixForSession(s); if(!t.startsWith(p)) return null; const w = t.slice(p.length).trim().split(/\s+/); const cmd = w.shift()?.toLowerCase(); if(!cmd) return null; return { command: cmd, args: w, prefix: p }; }
function getNextSessionName(){ for(let i=1;i<=MAX_SESSIONS;i++){ const name = `session${i}`; if(!fs.existsSync(path.join(SESSIONS_DIR, name))) return name; } return null; }

async function startSession(sessionName, phoneNumberForPairing=null){
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
  getSessionFile(sessionName, 'mode.json', { mode: 'public' });
  getSessionFile(sessionName, 'prefix.json', { prefix: '.' });
  getSessionFile(sessionName, 'sudo.json', []);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{ version = [2,3000,1015901307]; }
  console.log(`[${sessionName}] REGISTERED: ${state.creds.registered} | pairing: ${phoneNumberForPairing||'none'}`);

  const sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, logger, version, markOnlineOnConnect: true, syncFullHistory: false, browser: ['Ubuntu','Chrome','20.0.04'] });
  runtimes[sessionName] = { sock, connected: false };
  sock.ev.on('creds.update', saveCreds);

  // 8-DIGIT ONLY FOR OTHER SESSIONS, NOT SESSION1
  if(!state.creds.registered && sessionName !== 'session1' && phoneNumberForPairing){
    const num = phoneNumberForPairing.replace(/[^0-9]/g,'');
    setTimeout(async ()=>{
      try{
        const code = await sock.requestPairingCode(num);
        console.log(`\n\n===== ${sessionName.toUpperCase()} 8-DIGIT CODE FOR ${num}: ${code} =====\n\n`);
        if(runtimes['session1']?.connected){
          try{ await runtimes['session1'].sock.sendMessage(REAL_OWNER+'@s.whatsapp.net', {text: `*${sessionName} PAIR CODE*\nNumber: ${num}\nCode: *${code}*\n\nWhatsApp > Linked Devices > Link with phone number`}); }catch{}
        }
      }catch(e){ console.log(`[${sessionName}] pairing error: ${e.message}`); }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect, qr } = update;
    // QR ONLY FOR SESSION1 - THIS IS YOUR WORKING CODE
    if(qr && sessionName === 'session1' && !state.creds.registered){
      console.log(`\n\n[${sessionName}] ==== SCAN THIS QR WITH WHATSAPP ====`);
      qrcode.generate(qr, { small: true });
      console.log(`\nIf QR not clear, open link: https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}\n\n`);
    }
    if(connection === 'open'){
      runtimes[sessionName].connected = true;
      console.log(`[${sessionName}] ✅ CONNECTED - BOT LIVE!`);
      const myNum = normalizeNumber(sock.user?.id);
      if(sessionName==='session1') setSuperOwner(REAL_OWNER, REAL_OWNER+'@s.whatsapp.net');
      setSessionOwner(sessionName, myNum);
      if(sessionName==='session1') generateSessionId();
    }
    if(connection === 'close'){
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[${sessionName}] CLOSED code:${code}`);
      if(code!== DisconnectReason.loggedOut){
        console.log(`Reconnecting ${sessionName} in 5s...`);
        setTimeout(()=> startSession(sessionName, phoneNumberForPairing), 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({type, messages})=>{
    if(type!== 'notify') return;
    for(const m of messages){
      if(!m.message) continue;
      const chatId = m.key.remoteJid;
      if(chatId==='status@broadcast') continue;
      const senderRaw = m.key.participant || m.key.remoteJid;
      const senderNum = normalizeNumber(senderRaw);
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
      if(!text) continue;
      const parsed = parseCommandForSession(text.trim(), sessionName);
      if(!parsed) continue;

      const isRealOwner = senderNum === REAL_OWNER;

      // === ONLY YOU 2348166412988 ===
      if(['addsession','addsessions'].includes(parsed.command)){
        if(!isRealOwner){ await sock.sendMessage(chatId, {text: `❌ Owner only`}); continue; }
        const targetNum = parsed.args[0]?.replace(/[^0-9]/g,'');
        if(!targetNum || targetNum.length < 10){ await sock.sendMessage(chatId, {text: `❌ Use: ${parsed.prefix}addsession 23480xxxxxxx`}); continue; }
        const existing = fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).length;
        if(existing >= MAX_SESSIONS){ await sock.sendMessage(chatId, {text: `❌ Max ${MAX_SESSIONS} reached. Use ${parsed.prefix}delsession`}); continue; }
        const nextName = getNextSessionName();
        if(!nextName){ await sock.sendMessage(chatId, {text: `❌ No slot left`}); continue; }
        await sock.sendMessage(chatId, {text: `⏳ Creating ${nextName} for ${targetNum}...\nCheck logs + I will DM you 8-digit code`});
        startSession(nextName, targetNum);
        continue;
      }
      if(['listsessions','listsession','sessionlist','sessions'].includes(parsed.command)){
        if(!isRealOwner) continue;
        const sess = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).sort() : [];
        let txt = `*${BOT_NAME} SESSIONS* (${sess.length}/${MAX_SESSIONS})\n\n`;
        for(const s of sess){ const conn = runtimes[s]?.connected? '🟢 ONLINE' : '🔴 OFFLINE'; txt+= `• ${s}: ${conn}\n`; }
        await sock.sendMessage(chatId, {text: txt}); continue;
      }
      if(['delsession','delsessions','rmsession'].includes(parsed.command)){
        if(!isRealOwner){ await sock.sendMessage(chatId, {text: `❌ Owner only`}); continue; }
        const toDel = parsed.args[0];
        if(!toDel){ await sock.sendMessage(chatId, {text: `Use: ${parsed.prefix}delsession session2`}); continue; }
        if(toDel==='session1'){ await sock.sendMessage(chatId, {text: `❌ Cannot delete session1`}); continue; }
        const delPath = path.join(SESSIONS_DIR, toDel);
        if(!fs.existsSync(delPath)){ await sock.sendMessage(chatId, {text: `❌ ${toDel} not found`}); continue; }
        try{ if(runtimes[toDel]){ try{ await runtimes[toDel].sock.logout(); }catch{} } fs.rmSync(delPath,{recursive:true,force:true}); const perPath = path.join(PER_SESSION_DATA_DIR, toDel); if(fs.existsSync(perPath)) fs.rmSync(perPath,{recursive:true,force:true}); const o = getSessionOwners(); delete o[toDel]; fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(o,null,2)); await sock.sendMessage(chatId, {text: `✅ Deleted ${toDel}`}); }catch(e){ await sock.sendMessage(chatId, {text: `❌ ${e.message}`}); }
        continue;
      }

      const handler = loadedCommands.get(parsed.command);
      if(!handler) continue;
      const superOwner = getSuperOwner();
      const isSuperOwner = isRealOwner;
      const ctx = { sock, m, chatId, sender: senderRaw, senderNum, isGroup: chatId.endsWith('@g.us'), isSuperOwner, isSessionOwner: true, isFromMe: m.key.fromMe, superOwner: REAL_OWNER, getPrefix: ()=>getPrefixForSession(sessionName), BOT_NAME, sessionName, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command, pushName: m.pushName||'Unknown' };
      try{ await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`CMD FAIL ${parsed.command}: ${e.message}`); }
    }
  });
}

// SELF PING
setInterval(()=>{
  https.get(RENDER_URL, (res)=> console.log(`[SELF PING] ${res.statusCode}`)).on('error', e=> console.log('[SELF PING FAIL]', e.message));
}, 10*60*1000);

async function startAll(){
  console.log(`=== ${BOT_NAME} | OWNER ${REAL_OWNER} | QR=session1, CODE=others ===`);
  const existing = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).sort() : [];
  if(existing.length===0){ startSession('session1'); }
  else { for(const s of existing){ await startSession(s); await new Promise(r=> setTimeout(r,1500)); } }
}
startAll();
