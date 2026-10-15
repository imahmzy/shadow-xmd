const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const BOT_NAME = 'SHADOW XMD V4';
const REAL_OWNER = '2348166412988';
const MAX_SESSIONS = 10;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://shadow-xmd-i4tf.onrender.com';

const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const COMMANDS_DIR = path.join(__dirname, 'commands');
const PER_SESSION_DATA_DIR = path.join(DATA_DIR, 'per_session');
const SUPER_OWNER_FILE = path.join(DATA_DIR, 'super_owner.json');
const SESSION_OWNERS_FILE = path.join(DATA_DIR, 'session_owners.json');

for(const d of [DATA_DIR, SESSIONS_DIR, COMMANDS_DIR, path.join(__dirname,'temp'), PER_SESSION_DATA_DIR]){
  if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true});
}
function ensureJson(f, def){ if(!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(def,null,2)); }
ensureJson(SUPER_OWNER_FILE, { number: REAL_OWNER });
ensureJson(SESSION_OWNERS_FILE, {});

const origError = console.error;
console.error = (...args) => {
  const str = args.join(' ');
  if(str.includes('Bad MAC') || str.includes('Session error')) return;
  origError(...args);
};

// === FIXED RESTORE - SMALL ID ===
function restoreFromSessionId(){
  const rawId = (process.env.SESSION_ID || '').trim();
  if(!rawId) return console.log('[RESTORE] No SESSION_ID, will show QR');
  console.log(`[RESTORE] Found SESSION_ID length: ${rawId.length}`);
  try{
    const decoded = Buffer.from(rawId, 'base64').toString('utf-8');
    const sessionDir = path.join(SESSIONS_DIR, 'session1');
    if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});

    // Clean old files first
    try{ for(const f of fs.readdirSync(sessionDir)){ fs.unlinkSync(path.join(sessionDir, f)); } }catch{}

    // Try if it's full session JSON (old method)
    try{
      const parsed = JSON.parse(decoded);
      if(parsed['creds.json']){
        for(const [file, content] of Object.entries(parsed)){
          fs.writeFileSync(path.join(sessionDir, file), content);
        }
        console.log('[RESTORE] FULL session restored!');
        return;
      }
      // If parsed is creds itself as object
      fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(parsed));
      console.log('[RESTORE] creds.json restored from object!');
      return;
    }catch{
      // It's raw creds.json string (new small method)
      fs.writeFileSync(path.join(sessionDir, 'creds.json'), decoded);
      console.log('[RESTORE] creds.json restored! SUCCESS');
    }
  }catch(e){ console.log('[RESTORE FAILED]', e.message); }
}
restoreFromSessionId();

// === FIXED GENERATE - SMALL ID ONLY creds.json ===
function generateSessionId(){
  try{
    const credsPath = path.join(SESSIONS_DIR, 'session1', 'creds.json');
    if(!fs.existsSync(credsPath)) return console.log('[SESSION] creds.json not found yet');
    const data = fs.readFileSync(credsPath, 'utf-8');
    const b64 = Buffer.from(data).toString('base64');
    console.log(`\n\n========== NEW SMALL SESSION_ID ==========\n${b64}\n========== END - Length: ${b64.length} ==========\n\n`);
  }catch(e){ console.log('[SESSION GEN FAIL]', e.message); }
}

// === FIXED WEB SERVER - SMALL ID ===
http.createServer((req,res)=>{
  if(req.url === '/session'){
    try{
      const credsPath = path.join(SESSIONS_DIR, 'session1', 'creds.json');
      if(!fs.existsSync(credsPath)) return res.end('Not connected yet - scan QR first, wait 30 sec');
      const data = fs.readFileSync(credsPath, 'utf-8');
      const b64 = Buffer.from(data).toString('base64');
      res.end(b64);
    }catch(e){ res.end('Error: '+e.message); }
  }else{
    res.end('SHADOW XMD V4 RUNNING - /session for SESSION_ID');
  }
}).listen(process.env.PORT || 3000, ()=> console.log('PORT: '+(process.env.PORT||3000)));

function getSessionDataDir(s){ const dir = path.join(PER_SESSION_DATA_DIR, s); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); return dir; }
function getSessionJson(s, file, def){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return JSON.parse(fs.readFileSync(fp,'utf8')); }catch{ return def; } }
function setSessionJson(s, file, data){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir, file), JSON.stringify(data,null,2)); }catch{} }
function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }

const logger = pino({ level: 'silent' });
const runtimes = {};
const loadedCommands = new Map();
function loadCommands(){
  loadedCommands.clear();
  if(!fs.existsSync(COMMANDS_DIR)) return;
  for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){
    // DON'T skip addsession anymore, we handle it in core
    if(['listsessions'].some(k=> f.toLowerCase().includes(k))) continue;
    try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute) loadedCommands.set(cmd.name.toLowerCase(), cmd); }catch(e){ console.log(`[LOADER] ${f}: ${e.message}`); }
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
  getSessionJson(sessionName, 'mode.json', { mode: 'public' });
  getSessionJson(sessionName, 'prefix.json', { prefix: '.' });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{ version = [2,3000,1015901307]; }

  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger, version,
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    browser: ['Chrome','Windows','10']
  });
  runtimes[sessionName] = { sock, connected: false };
  sock.ev.on('creds.update', saveCreds);

  if(!state.creds.registered && sessionName!== 'session1' && phoneNumberForPairing){
    const num = phoneNumberForPairing.replace(/[^0-9]/g,'');
    setTimeout(async ()=>{
      try{
        const code = await sock.requestPairingCode(num);
        console.log(`\n\n===== ${sessionName.toUpperCase()} PAIRING CODE FOR ${num}: ${code} =====\n\n`);
      }catch(e){ console.log(`[${sessionName}] pairing error: ${e.message}`); }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect, qr } = update;
    if(qr){
      console.log(`\n\n========== [${sessionName}] QR CODE ==========`);
      qrcode.generate(qr, { small: true });
      console.log(`\nIf QR not visible, OPEN THIS LINK:\nhttps://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}\n`);
      console.log(`========== END QR ==========\n\n`);
    }
    if(connection === 'open'){
      runtimes[sessionName].connected = true;
      console.log(`[${sessionName}] ✅ CONNECTED!`);
      if(sessionName==='session1') setTimeout(()=> generateSessionId(), 3000);
    }
    if(connection === 'close'){
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[${sessionName}] CLOSED code:${code} - reconnecting...`);
      if(code!== DisconnectReason.loggedOut){
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

      // STRICT OWNER CHECK - only you
      const cleanSender = normalizeNumber(senderRaw);
      const isRealOwner = cleanSender === REAL_OWNER;

      console.log(`[CMD] ${parsed.command} from ${cleanSender} owner:${isRealOwner}`);

      if(['addsession','addsesion'].includes(parsed.command)){
        if(!isRealOwner){ await sock.sendMessage(chatId, {text: `❌ Owner only`}); continue; }
        const targetNum = parsed.args[0]?.replace(/[^0-9]/g,'');
        if(!targetNum){ await sock.sendMessage(chatId, {text: `Use: ${parsed.prefix}addsession 23480xxxxxxx`}); continue; }
        const nextName = getNextSessionName();
        if(!nextName){ await sock.sendMessage(chatId, {text: `❌ Max ${MAX_SESSIONS} sessions reached`}); continue; }
        await sock.sendMessage(chatId, {text: `⏳ Creating ${nextName} for ${targetNum}...\nGenerating pairing code...`});

        // Start session and wait for code
        (async ()=>{
          const newSessionDir = path.join(SESSIONS_DIR, nextName);
          if(!fs.existsSync(newSessionDir)) fs.mkdirSync(newSessionDir,{recursive:true});
          getSessionJson(nextName, 'mode.json', { mode: 'public' });
          getSessionJson(nextName, 'prefix.json', { prefix: '.' });
          const { state, saveCreds } = await useMultiFileAuthState(newSessionDir);
          let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{ version = [2,3000,1015901307]; }
          const newSock = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
            logger, version,
            printQRInTerminal: false,
            browser: ['Chrome','Windows','10']
          });
          newSock.ev.on('creds.update', saveCreds);

          if(!newSock.authState.creds.registered){
            setTimeout(async ()=>{
              try{
                const code = await newSock.requestPairingCode(targetNum);
                console.log(`[${nextName}] CODE: ${code} for ${targetNum}`);
                await sock.sendMessage(chatId, {text: `*${nextName} PAIRING CODE*\n\nNumber: ${targetNum}\nCode: *${code}*\n\nGo to WhatsApp > Linked Devices > Link with phone number > enter code\n\nCode expires in 60 sec`});
                // Start full session after
                setTimeout(()=> startSession(nextName), 5000);
              }catch(e){
                console.log(`PAIRING FAIL: ${e.message}`);
                await sock.sendMessage(chatId, {text: `❌ Pairing failed: ${e.message}\nMake sure number is correct and on WhatsApp`});
              }
            }, 3000);
          }
          newSock.ev.on('connection.update', async (u)=>{
            const { connection, lastDisconnect, qr } = u;
            if(connection === 'open'){
              runtimes[nextName] = { sock: newSock, connected: true };
              await sock.sendMessage(chatId, {text: `✅ ${nextName} connected!`});
            }
            if(connection === 'close'){
              const c = lastDisconnect?.error?.output?.statusCode;
              if(c!== DisconnectReason.loggedOut) setTimeout(()=> startSession(nextName), 5000);
            }
          });
        })();
        continue;
      }
      if(['delsession','delsesion'].includes(parsed.command)){
        if(!isRealOwner){ await sock.sendMessage(chatId, {text: `❌ Owner only`}); continue; }
        const delName = (parsed.args[0]||'').toLowerCase();
        if(!delName){ await sock.sendMessage(chatId, {text: `Use: ${parsed.prefix}delsession session2`}); continue; }
        if(delName==='session1'){ await sock.sendMessage(chatId, {text: `❌ Can't delete session1`}); continue; }
        const delPath = path.join(SESSIONS_DIR, delName);
        const perPath = path.join(PER_SESSION_DATA_DIR, delName);
        if(!fs.existsSync(delPath)){ await sock.sendMessage(chatId, {text: `❌ ${delName} not found`}); continue; }
        try{
          if(runtimes[delName]?.sock) try{ runtimes[delName].sock.end(); }catch{}
          fs.rmSync(delPath, {recursive:true, force:true});
          if(fs.existsSync(perPath)) fs.rmSync(perPath, {recursive:true, force:true});
          delete runtimes[delName];
          await sock.sendMessage(chatId, {text: `✅ Deleted ${delName}`});
        }catch(e){ await sock.sendMessage(chatId, {text: `❌ Error: ${e.message}`}); }
        continue;
      }
      if(['listsessions','listsession'].includes(parsed.command)){
        const sess = fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).sort();
        let txt = `*${BOT_NAME} SESSIONS*\n\n`;
        for(const s of sess){ txt+= `• ${s}: ${runtimes[s]?.connected? '🟢 ONLINE':'🔴 OFFLINE'}\n`; }
        await sock.sendMessage(chatId, {text: txt}); continue;
      }
      const handler = loadedCommands.get(parsed.command);
      if(!handler) continue;
      const ctx = { sock, m, chatId, sender: senderRaw, senderNum, isGroup: chatId.endsWith('@g.us'), isSuperOwner: isRealOwner, sessionName, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command };
      try{ await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`CMD FAIL ${parsed.command}: ${e.message}`); }
    }
  });
}

setInterval(()=>{ https.get(RENDER_URL, (res)=> console.log(`[PING] ${res.statusCode}`)).on('error', ()=>{}); }, 10*60*1000);

async function startAll(){
  console.log(`=== ${BOT_NAME} | OWNER ${REAL_OWNER} ===`);
  const existing = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')).sort() : [];
  if(existing.length===0) startSession('session1');
  else for(const s of existing){ await startSession(s); await new Promise(r=> setTimeout(r,1000)); }
}
startAll();
