const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage } = require('@whiskeysockets/baileys');
const readline = require('readline');

const BOT_NAME = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';
const MAX_SESSIONS = 10;
const OWNER_JID = '2348166412988@s.whatsapp.net';
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
let rl = null;
function getRL(){ if(!rl) rl = readline.createInterface({input: process.stdin, output: process.stdout}); return rl; }
function normalizeNumber(jid){ if(!jid) return ''; let raw = String(jid).split('@')[0].split(':')[0]; raw = raw.replace(/[^0-9]/g,''); if(raw.startsWith('0')) raw = '234' + raw.slice(1); return raw; }
function getSuperOwner(){ try{ const d = JSON.parse(fs.readFileSync(SUPER_OWNER_FILE,'utf8')); if(d.number) return normalizeNumber(d.number); if(d.gid) return normalizeNumber(d.gid); return null; }catch{ return null; } }
function setSuperOwner(jidOrNumber, fullJid = null){ const norm = normalizeNumber(jidOrNumber); const gid = fullJid || (norm? norm + '@s.whatsapp.net' : null); fs.writeFileSync(SUPER_OWNER_FILE, JSON.stringify({ number: norm, gid: gid }, null, 2)); console.log(`\x1b[32m[OWNER SAVED]\x1b[0m ${norm}`); }
function getSessionOwners(){ try{ return JSON.parse(fs.readFileSync(SESSION_OWNERS_FILE,'utf8')); }catch{ return {}; } }
function setSessionOwner(sessionName, num){ const owners = getSessionOwners(); owners[sessionName] = normalizeNumber(num); fs.writeFileSync(SESSION_OWNERS_FILE, JSON.stringify(owners, null, 2)); }
const loadedCommands = new Map();
function loadCommands(){ loadedCommands.clear(); if(!fs.existsSync(COMMANDS_DIR)) return; for(const f of fs.readdirSync(COMMANDS_DIR).filter(x=>x.endsWith('.js'))){ try{ delete require.cache[require.resolve(path.join(COMMANDS_DIR,f))]; const cmd = require(path.join(COMMANDS_DIR,f)); if(cmd?.name && cmd.execute){ loadedCommands.set(cmd.name.toLowerCase(), cmd); if(Array.isArray(cmd.aliases)) cmd.aliases.forEach(a=> loadedCommands.set(a.toLowerCase(), cmd)); if(cmd.name === 'auto'){ loadedCommands.set('autoveiw', cmd); loadedCommands.set('autovew', cmd); loadedCommands.set('autoreac', cmd); } } }catch(e){ console.log(`\x1b[31m[LOADER FAILED] ${f}: ${e.message}\x1b[0m`); } } console.log(`\x1b[36m[${BOT_NAME}] Loaded ${loadedCommands.size} commands\x1b[0m`); }
loadCommands();
function getPrefixForSession(sessionName){ const data = getSessionJson(sessionName, 'prefix.json', { prefix: '.' }); return data.prefix || '.'; }
function parseCommandForSession(text, sessionName){ const prefix = getPrefixForSession(sessionName); if(!text.startsWith(prefix)) return null; const without = text.slice(prefix.length).trim().split(/\s+/); let cmd = without.shift()?.toLowerCase(); if(!cmd) return null; if(cmd === 'autoveiw' || cmd === 'autovew') cmd = 'autoview'; if(cmd === 'autoreac') cmd = 'autoreact'; return { command: cmd, args: without, prefix, fullText: text }; }
async function startSession(sessionName, phoneNumberForPairing = null){
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  if(!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir,{recursive:true});
  getSessionFile(sessionName, 'mode.json', { mode: 'public' });
  getSessionFile(sessionName, 'prefix.json', { prefix: '.' });
  getSessionFile(sessionName, 'sudo.json', []);
  getSessionFile(sessionName, 'auto.json', { autoview: false, autoreact: false, reactme: false, statusreact: false, autotyping: false, autorecording: false });
  getSessionFile(sessionName, 'welcome.json', { enabled: false });
  getSessionFile(sessionName, 'antidelete.json', { enabled: false });
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
      if(m.key.remoteJid === 'status@broadcast'){
        try{
          let liveAuto = getSessionJson(sessionName, 'auto.json', { autoview: false, autoreact: false, reactme: false, statusreact: false, autotyping: false, autorecording: false });
          if(liveAuto.autoview){ try{ await sock.readMessages([m.key]); }catch{} }
          if(liveAuto.statusreact){
            try{ const emojis = ['❤️','😈','🔥','👑','💀','🥶']; const rand = emojis[Math.floor(Math.random()*emojis.length)]; await sock.sendMessage(m.key.remoteJid, { react: { text: rand, key: m.key } }, { statusJidList: [m.key.participant] }); }catch{}
          }
        }catch{} continue;
      }
      const chatId = m.key.remoteJid;
      const senderRaw = m.key.participant || m.key.remoteJid;
      const senderNum = normalizeNumber(senderRaw);
      const isGroup = chatId.endsWith('@g.us');
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
      const pushName = m.pushName || 'Unknown';
      if(pushName && pushName!== 'Unknown'){ saveNameToCache(senderRaw, pushName); const ctxInfo = m.message.extendedTextMessage?.contextInfo; if(ctxInfo?.participant && ctxInfo?.pushName){ saveNameToCache(ctxInfo.participant, ctxInfo.pushName); } }
      try { const gcPath = path.join(COMMANDS_DIR, 'groupcontrol.js'); if (fs.existsSync(gcPath)) { const gcMod = require(gcPath); if (gcMod.checkGroupControl) { const gcText = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ''; const blocked = await gcMod.checkGroupControl(sock, m, chatId, senderRaw, gcText); if (blocked) continue; } } } catch (e) {}
      let autoConfig = getSessionJson(sessionName, 'auto.json', { autoview: false, autoreact: false, reactme: false, statusreact: false, autotyping: false, autorecording: false });
      if(autoConfig.autotyping || autoConfig.autorecording){ try{ await sock.presenceSubscribe(chatId).catch(()=>{}); if(autoConfig.autorecording) await sock.sendPresenceUpdate('recording', chatId); else if(autoConfig.autotyping) await sock.sendPresenceUpdate('composing', chatId); }catch{} }
      if(autoConfig.autoreact && text &&!m.key.fromMe){ try{ const emojis = ['❤️','😂','😈','🔥','👑','🥀','💀','😍','🤣']; await sock.sendMessage(chatId, { react: { text: emojis[Math.floor(Math.random()*emojis.length)], key: m.key } }); }catch{} }
      if(autoConfig.reactme && isGroup &&!m.key.fromMe){ try{ const ctxInfo = m.message?.extendedTextMessage?.contextInfo || m.message?.imageMessage?.contextInfo || m.message?.videoMessage?.contextInfo || {}; const mentioned = ctxInfo.mentionedJid || []; const replyParticipant = ctxInfo.participant || ''; const hasMention = mentioned.length > 0; const isReply =!!ctxInfo.quotedMessage ||!!replyParticipant; if(hasMention || isReply){ await sock.sendMessage(chatId, { react: { text: '😈', key: m.key } }); } }catch(e){} }
      if(!text) continue;
      const parsed = parseCommandForSession(text.trim(), sessionName);
      if(!parsed) continue;
      const handler = loadedCommands.get(parsed.command);
      if(!handler){ try{ await sock.sendPresenceUpdate('paused', chatId); }catch{} continue; }
      let superOwner = getSuperOwner();
      if(!superOwner && m.key.fromMe){ const myFullJid = sock.user?.id; const myNum = normalizeNumber(myFullJid || senderNum); if(myNum){ setSuperOwner(myNum, myFullJid); setSessionOwner(sessionName, myNum); superOwner = myNum; } }
      const sessionOwners = getSessionOwners();
      const isSuperOwner = (superOwner && senderNum === superOwner) || m.key.fromMe;
      const isSessionOwner = (sessionOwners[sessionName] && senderNum === sessionOwners[sessionName]) || isSuperOwner;
      const isFromMe = m.key.fromMe;
      const sudoList = getSessionJson(sessionName, 'sudo.json', []);
      const isSudo = sudoList.map(n=> normalizeNumber(n)).includes(senderNum);
      if(SESSION1_ONLY_COMMANDS.includes(parsed.command)){ if(sessionName!== 'session1') continue; }
      if(SUPER_ONLY_COMMANDS.includes(parsed.command)){ if(!isSuperOwner){ try{ await sock.sendMessage(chatId, { text: `> ❌ *${parsed.command.toUpperCase()}* is SUPER OWNER only.` }, { quoted: m }); }catch{} continue; } }
      const modeData = getSessionJson(sessionName, 'mode.json', { mode: 'public' });
      const currentMode = modeData.mode || 'public';
      if(currentMode === 'private'){ if(!isSuperOwner &&!isSessionOwner &&!isSudo &&!isFromMe) continue; }
      console.log(`\x1b[32m[${sessionName}] [COMMAND]\x1b[0m.${parsed.command} ${parsed.args.join(' ')} | ${pushName} (${senderNum})`);
      const getPrefix = () => getPrefixForSession(sessionName);
      const sender = senderRaw;
      const ctx = { sock, m, chatId, sender, senderRaw, senderNum, isGroup, isSuperOwner, isSessionOwner, isFromMe, isSudo, superOwner, sessionOwners, getPrefix, BOT_NAME, MAX_SESSIONS, startSession, setSessionOwner, getSessionOwners, getSessionJson, setSessionJson, getSessionDataDir, command: parsed.command, pushName, sessionName };
      try{ if(autoConfig.autotyping || autoConfig.autorecording){ await new Promise(r=> setTimeout(r, 1200)); } await handler.execute(sock, m, parsed.args, ctx); }catch(e){ console.log(`\x1b[31m[${sessionName}] [FAILED]\x1b[0m.${parsed.command} - ${e.message}`); } finally { try{ await sock.sendPresenceUpdate('paused', chatId); }catch{} }
    }
  });
  sock.ev.on('connection.update', async ({connection, lastDisconnect})=>{
    if(connection === 'open'){
      if(!runtimes[sessionName]) runtimes[sessionName] = { sock, connected: true };
      runtimes[sessionName].connected = true;
      const myNum = normalizeNumber(sock.user?.id);
      console.log(`\x1b[32m[${sessionName}] ✅ CONNECTED ${myNum} | NO VV | 234xxx DM | NO BACKLOG | 7MB\x1b[0m`);
      if(sessionName === 'session1' &&!getSuperOwner()){ setSuperOwner(myNum, sock.user?.id); setSessionOwner('session1', myNum); }
      if(!getSessionOwners()[sessionName]) setSessionOwner(sessionName, myNum);
    }
    if(connection === 'close'){
      if(runtimes[sessionName]) runtimes[sessionName].connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if(code!== DisconnectReason.loggedOut){ console.log(`\x1b[33m[${sessionName}] ❌ DISCONNECTED, reconnecting...\x1b[0m`); setTimeout(()=> startSession(sessionName), 3000); }
    }
  });
  if(!state.creds.registered){
    if(phoneNumberForPairing){ await new Promise(r=> setTimeout(r, 2000)); try{ const code = await sock.requestPairingCode(phoneNumberForPairing); console.log(`\x1b[36m[${sessionName}] PAIRING CODE for ${phoneNumberForPairing}: ${code}\x1b[0m`); return code; }catch(e){ console.error(e.message); return null; }
    } else {
      if(sessionName === 'session1'){
        setTimeout(async ()=>{
          let num = process.env.PHONE_NUMBER || null;
          if(!num){
            try{
              const answer = await new Promise(res=> getRL().question(`[${BOT_NAME}] [${sessionName}] Enter phone (e.g 234...): `, res));
              num = answer.replace(/[^0-9]/g,'');
            }catch{
              console.log(`Set PHONE_NUMBER env variable in Render!`);
              return;
            }
          }
          num = String(num).replace(/[^0-9]/g,'');
          if(!num) return;
          try{ const code = await sock.requestPairingCode(num); console.log(`\n\x1b[32m[${sessionName}] PAIRING CODE FOR ${num}: ${code}\x1b[0m\n`); }catch(e){ console.error(e.message); }
        }, 1500);
      }
    }
  }
}
async function startAll(){
  console.log(`\n\x1b[36m=== ${BOT_NAME} | CLEAN NO VV | 234xxx DM | NO BACKLOG ===\x1b[0m`);
  const existing = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=> f.startsWith('session')) : [];
  if(existing.length === 0) startSession('session1');
  else for(const s of existing.sort()){ await startSession(s); await new Promise(r=> setTimeout(r, 1500)); }
}
startAll();
