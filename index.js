const fs = require('fs');
const path = require('path');
const http = require('http');
http.createServer((req,res)=> res.end('SHADOW XMD V4 RUNNING - SCAN QR IN LOGS')).listen(process.env.PORT || 3000, ()=> console.log('PORT FIXED'));
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

const BOT_NAME = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';
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
function getSessionDataDir(s){ const dir = path.join(PER_SESSION_DATA_DIR, s); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); return dir; }
function getSessionFile(s, file, def){ const dir = getSessionDataDir(s); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return fp; }
function getSessionJson(s, file, def){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); const fp = path.join(dir, file); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(def,null,2)); return JSON.parse(fs.readFileSync(fp,'utf8')); }catch{ return def; } }
function setSessionJson(s, file, data){ try{ const dir = path.join(PER_SESSION_DATA_DIR, s||'session1'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir, file), JSON.stringify(data,null,2)); }catch{} }
const logger = pino({ level: 'silent' });
function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }
function getSuperOwner(){ try{ const d = JSON.parse(fs.readFileSync(SUPER_OWNER_FILE,'utf8')); if(d.number) return normalizeNumber(d.number); return null; }catch{ return null; } }
function setSuperOwner(n, full){ const norm = normalizeNumber(n); fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: norm, gid: full||norm+'@s.whatsapp.net' }, null, 2)); }
function setSessionOwner(s, n){ try{ const o = JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); o[s] = normalizeNumber(n); fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(o, null, 2)); }catch{} }
const loadedCommands = new Map();
function loadCommands(){ loadedCommands.clear(); for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){ try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute){ loadedCommands.set(cmd.name.toLowerCase(), cmd); } }catch(e){ console.log(`[LOADER FAILED] ${f}: ${e.message}`); } } console.log(`[${BOT_NAME}] Loaded ${loadedCommands.size} commands`); }
loadCommands();
function getPrefixForSession(s){ return (getSessionJson(s, 'prefix.json', { prefix: '.' }).prefix || '.'); }
function parseCommandForSession(t,s){ const p = getPrefixForSession(s); if(!t.startsWith(p)) return null; const w = t.slice(p.length).trim().split(/\s+/); const cmd = w.shift()?.toLowerCase(); if(!cmd) return null; return { command: cmd, args: w }; }

async function startSession(sessionName){
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
  getSessionFile(sessionName, 'mode.json', { mode: 'public' });
  getSessionFile(sessionName, 'prefix.json', { prefix: '.' });
  getSessionFile(sessionName, 'sudo.json', []);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version; try{ version = (await fetchLatestBaileysVersion()).version; }catch{ version = [2,3000,1015901307]; }
  console.log(`[${sessionName}] REGISTERED: ${state.creds.registered}`);

  const sock = makeWASocket({ auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, logger, version, markOnlineOnConnect: true, syncFullHistory: false, browser: ['Ubuntu','Chrome','20.0.04'] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect, qr } = update;
    if(qr){
      console.log(`\n\n[${sessionName}] ==== SCAN THIS QR WITH WHATSAPP ====`);
      qrcode.generate(qr, { small: true });
      console.log(`\nIf QR not clear, open link: https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}\n\n`);
    }
    if(connection === 'open'){
      console.log(`[${sessionName}] ✅ CONNECTED - BOT LIVE!`);
      const myNum = normalizeNumber(sock.user?.id);
      if(!getSuperOwner()){ setSuperOwner(myNum, sock.user?.id); setSessionOwner(sessionName, myNum); }
    }
    if(connection === 'close'){
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[${sessionName}] CLOSED code:${code}`);
      if(code!== DisconnectReason.loggedOut){
        console.log(`Reconnecting in 5s...`);
        setTimeout(()=> startSession(sessionName), 5000);
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
      const superOwner = getSuperOwner();
      const isSuperOwner = (superOwner && senderNum === superOwner) || m.key.fromMe;
      const ctx = { sock, m, chatId, sender: senderRaw, senderNum, isGroup: chatId.endsWith('@g.us'), isSuperOwner, isSessionOwner: true, isFromMe: m.key.fromMe, getPrefix: ()=>getPrefixForSession(sessionName), BOT_NAME, sessionName, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command, pushName: m.pushName||'Unknown' };
      try{ await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`CMD FAIL ${parsed.command}: ${e.message}`); }
    }
  });
}
startSession('session1');
