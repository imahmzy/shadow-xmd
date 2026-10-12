const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'get',
  aliases: ['getpp','getname','getgcpp','pp','gcpp'],
  execute: async (sock, m, args, ctx) => {
  const sessionName = ctx.sessionName || 'session1';
    const { chatId } = ctx;
    const rawText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const parts = rawText.split(/\s+/);
    const invoked = parts[0].slice(1).toLowerCase();

    let sub = '';
    if (['getpp','pp'].includes(invoked)) sub = 'pp';
    else if (['getname','name'].includes(invoked)) sub = 'name';
    else if (['getgcpp','gcpp','grouppp'].includes(invoked)) sub = 'gcpp';
    else {
      sub = (args[0] || '').toLowerCase();
      if (sub) args.shift();
    }

    const contextInfo = m.message.extendedTextMessage?.contextInfo || {};
    const quotedParticipant = contextInfo.participant;
    const mentioned = contextInfo.mentionedJid?.[0];
    const quotedPushName = contextInfo.pushName;

    let targetJid = null;
    if (quotedParticipant) targetJid = quotedParticipant;
    else if (mentioned) targetJid = mentioned;
    else if (args[0] && sub!== 'gcpp') {
      let num = args[0].replace(/[^0-9]/g,'');
      if (num) targetJid = num + '@s.whatsapp.net';
    }

    // Load cached names
    let cachedNames = {};
    try {
      const namePath = path.join(__dirname, '../data/names.json');
      if (fs.existsSync(namePath)) cachedNames = JSON.parse(fs.readFileSync(namePath, 'utf8'));
    } catch {}

    try {
      if (sub === 'name') {
        if (!targetJid) {
          // If no target, get sender's own main name
          const selfName = m.pushName || 'Unknown';
          const selfJid = m.key.participant || chatId;
          const num = selfJid.split('@')[0];
          return sock.sendMessage(chatId, { text: `╭─〔 *USER NAME* 〕─\n│ 👤 Name: ${selfName}\n│ 🔤 Exact: ${selfName}\n│ 📱 ${num}\n│ @${num}\n╰───────────────\n> ᴇxᴛʀᴀᴄᴛᴇᴅ ʙʏ sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴`, mentions:[selfJid] }, { quoted: m });
        }

        let displayName = null;

        // 1. If replying, use pushName from reply - THIS IS MAIN FONT NAME
        if (quotedParticipant === targetJid && quotedPushName) {
          displayName = quotedPushName;
        }

        // 2. Check cache (saved from terminal)
        if (!displayName && cachedNames[targetJid]) {
          displayName = cachedNames[targetJid];
        }

        // 3. If target is sender himself
        if (!displayName && targetJid === (m.key.participant || chatId)) {
          displayName = m.pushName;
        }

        // 4. Final
        if (!displayName) {
          displayName = `Not cached yet - make user send a message or reply to his message\nCached names: ${Object.keys(cachedNames).length}`;
        }

        const num = targetJid.split('@')[0];
        const txt = `╭─〔 *USER NAME* 〕─\n│ 👤 Name: ${displayName}\n│ 🔤 Exact: ${displayName}\n│ 📱 Number: ${num}\n│ 🆔 @${num}\n╰───────────────\n> ᴇxᴛʀᴀᴄᴛᴇᴅ ʙʏ sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴`;

        await sock.sendMessage(chatId, { text: txt, mentions:[targetJid] }, { quoted: m });
      }

      else if (sub === 'pp') {
        if (!targetJid) {
          if (chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `> ❌ Reply or tag user` }, { quoted: m });
          else targetJid = chatId;
        }
        const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(()=> null);
        if (!ppUrl) return sock.sendMessage(chatId, { text: `> ⚠️ No pp for @${targetJid.split('@')[0]}`, mentions:[targetJid] }, { quoted: m });
        const num = targetJid.split('@')[0];
        const caption = `╭─〔 *PROFILE PICTURE* 〕─\n│ 👤 @${num}\n│ 🆔 ${num}\n╰───────────────\n> ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ ʙʏ sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴`;
        await sock.sendMessage(chatId, { image: { url: ppUrl }, caption, mentions:[targetJid] }, { quoted: m });
      }

      else if (sub === 'gcpp') {
        let groupJid = chatId;
        if (args[0] && args[0].includes('@g.us')) groupJid = args[0];
        if (!groupJid.endsWith('@g.us')) return sock.sendMessage(chatId, { text: `> ❌ Group only` }, { quoted: m });
        const ppUrl = await sock.profilePictureUrl(groupJid, 'image').catch(()=> null);
        if (!ppUrl) return sock.sendMessage(chatId, { text: `> ⚠️ No group pp` }, { quoted: m });
        const meta = await sock.groupMetadata(groupJid);
        const caption = `╭─〔 *GROUP PP* 〕─\n│ 👥 ${meta.subject}\n│ 👤 ${meta.participants.length}\n╰───────────────\n> sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴`;
        await sock.sendMessage(chatId, { image: { url: ppUrl }, caption }, { quoted: m });
      }

    } catch (e) {
      return sock.sendMessage(chatId, { text: `> ❌ ${e.message}` }, { quoted: m });
    }
  }
}