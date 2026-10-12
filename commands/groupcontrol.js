const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'groupSettings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, '{}');

function getSettings(){ try{ return JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8')); }catch{ return {}; } }
function saveSettings(d){ fs.writeFileSync(SETTINGS_FILE, JSON.stringify(d,null,2)); }
function getGroupSettings(jid){
  const all = getSettings();
  if(!all[jid]) all[jid] = { antilink: 'off', antimention: 'off', warns: {} };
  if(!all[jid].warns) all[jid].warns = {};
  return all[jid];
}
function updateGroup(jid, key, value){
  const all = getSettings();
  if(!all[jid]) all[jid] = { antilink: 'off', antimention: 'off', warns: {} };
  all[jid][key] = value;
  saveSettings(all);
}

function normalize(jid){
  if(!jid) return '';
  return String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g,'');
}

const LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+|t\.me\/[^\s]+|youtube\.com\/[^\s]+|youtu\.be\/[^\s]+|[a-z0-9-]+\.(com|net|org|io|me|tv|co|info|link|gg|xyz|app|ly)\/[^\s]*)/i;
function isLink(text){ if(!text) return false; return LINK_REGEX.test(text); }

function isMention(m, text){
  const msg = m.message || {};
  // 1. Normal tag @all / @user
  if(msg.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) return true;
  if(msg.extendedTextMessage?.contextInfo?.groupMentions?.length > 0) return true;

  // 2. STATUS MENTION - group status mention message types
  if(msg.groupStatusMentionMessage) return true;
  if(msg.groupStatusMessage) return true;
  if(msg.statusMentionMessage) return true;
  if(msg.groupMentionMessage) return true;

  // 3. System text "mentioned this group in status" / "mentioned in status"
  const t = (text || '').toLowerCase();
  if(t.includes('mentioned') && (t.includes('status') || t.includes('group'))) return true;
  if(/mentioned this group/i.test(text)) return true;
  if(/mentioned.*status/i.test(text)) return true;
  if(/status.*mention/i.test(text)) return true;

  // 4. Normal @
  if(/@(all|everyone)/i.test(text)) return true;

  return false;
}

async function isAdminCheck(sock, chatId, sender){
  try{
    const metadata = await sock.groupMetadata(chatId);
    const senderNorm = normalize(sender);
    const found = metadata.participants.find(p => normalize(p.id) === senderNorm || p.id === sender);
    return found?.admin === 'admin' || found?.admin === 'superadmin';
  }catch{ return false; }
}

async function handleWarnKick(sock, chatId, sender, type, setting){
  if(await isAdminCheck(sock, chatId, sender)) return;
  const all = getSettings();
  if(!all[chatId]) all[chatId] = { antilink: 'off', antimention: 'off', warns: {} };
  if(!all[chatId].warns) all[chatId].warns = {};
  if(!all[chatId].warns[sender]) all[chatId].warns[sender] = { link: 0, mention: 0 };
  const warnType = type === 'link'? 'link' : 'mention';
  let count = all[chatId].warns[sender][warnType] || 0;

  const delMsg = type === 'link'? '> link deleted by SHADOW XMD V4 😈👑' : '> status deleted by SHADOW XMD V4 😈👑';

  if(setting === 'kick'){
    try{
      await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
      await sock.sendMessage(chatId, { text: `> 🚫 @${sender.split('@')[0]} kicked for ${type}\n${delMsg}`, mentions: [sender] });
      all[chatId].warns[sender][warnType] = 0;
    }catch{}
  } else if(setting === 'warn'){
    count++;
    all[chatId].warns[sender][warnType] = count;
    if(count >= 3){
      try{
        await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
        await sock.sendMessage(chatId, { text: `> 🚫 @${sender.split('@')[0]} kicked after 3 ${type} warnings\n${delMsg}`, mentions: [sender] });
        all[chatId].warns[sender][warnType] = 0;
      }catch{}
    } else {
      await sock.sendMessage(chatId, { text: `> ⚠️ @${sender.split('@')[0]} Warning ${count}/3 for ${type}\n${delMsg}`, mentions: [sender] });
    }
  }
  saveSettings(all);
}

async function checkGroupControl(sock, m, chatId, sender, text){
  if(!chatId.endsWith('@g.us')) return false;
  const settings = getGroupSettings(chatId);
  if(settings.antilink === 'off' && settings.antimention === 'off') return false;
  if(await isAdminCheck(sock, chatId, sender)) return false;

  const fullText = text || m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.groupStatusMentionMessage?.message?.protocolMessage?.editedMessage?.conversation || '';

  if(isLink(fullText)){
    if(settings.antilink === 'off') return false;
    try{ await sock.sendMessage(chatId, { delete: m.key }); }catch{}
    if(settings.antilink === 'warn' || settings.antilink === 'kick'){
      await handleWarnKick(sock, chatId, sender, 'link', settings.antilink);
    } else {
      await sock.sendMessage(chatId, { text: `> link deleted by SHADOW XMD V4 😈👑` });
    }
    return true;
  }

  // STATUS / MENTION DETECTION - now catches status group mentions
  if(isMention(m, fullText)){
    if(settings.antimention === 'off') return false;
    try{ await sock.sendMessage(chatId, { delete: m.key }); }catch{}
    if(settings.antimention === 'warn' || settings.antimention === 'kick'){
      await handleWarnKick(sock, chatId, sender, 'mention', settings.antimention);
    } else {
      await sock.sendMessage(chatId, { text: `> status deleted by SHADOW XMD V4 😈👑` });
    }
    return true;
  }
  return false;
}

module.exports = {
  name: 'groupcontrol',
  aliases: ['antilink','antimention','antistatus'],
  checkGroupControl,
  execute: async (sock, m, args, ctx)=>{
    const { chatId, isGroup } = ctx;
    if(!isGroup) return sock.sendMessage(chatId, { text: `> ❌ Group only` }, { quoted: m });

    const senderRaw = ctx.senderRaw || ctx.sender;
    const senderIsAdmin = await isAdminCheck(sock, chatId, senderRaw);

    if(!senderIsAdmin &&!ctx.isSuperOwner &&!ctx.isFromMe) {
      return sock.sendMessage(chatId, { text: `> ❌ Only group admins` }, { quoted: m });
    }

    let raw = (args[0]||'').toLowerCase();
    let mode = (args[1]||'').toLowerCase();
    let feature = 'antilink';
    if(ctx.command.includes('mention') || ctx.command.includes('status')) feature = 'antimention';
    if(['link','mention','status'].includes(raw)) feature = raw==='link'? 'antilink' : 'antimention';

    let finalMode = ['link','mention','status'].includes(raw)? mode : raw;
    if(!finalMode){
      const s = getGroupSettings(chatId);
      return sock.sendMessage(chatId, { text: `╭─〔 GROUP CONTROL 〕─\n│ Antilink: ${s.antilink}\n│ Antimention: ${s.antimention}\n│ Admins immune: YES\n│\n│.antilink on/off/warn/kick\n│.antimention on/off/warn/kick\n╰────────────` }, { quoted: m });
    }
    if(['on','enable','delete','del'].includes(finalMode)) finalMode='on';
    if(['off','disable','0'].includes(finalMode)) finalMode='off';
    if(!['on','off','warn','kick'].includes(finalMode)) return sock.sendMessage(chatId, { text: `> ❌ Use: on / off / warn / kick` }, { quoted: m });

    updateGroup(chatId, feature, finalMode);
    return sock.sendMessage(chatId, { text: `> ✅ ${feature} = ${finalMode}` }, { quoted: m });
  }
};