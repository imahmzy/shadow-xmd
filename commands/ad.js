module.exports = {
  name: 'ad',
  aliases: ['add', 'kick', 'remove'],
  description: 'Add or kick with SHADOW XMD style - FIXED ADMIN CHECK',
  execute: async (sock, m, args, ctx) => {
    const { chatId, getPrefix } = ctx;
    const prefix = getPrefix();
    const BRAND = '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ ᐯ⁴';

    const normalize = (num) => {
      if (!num) return '';
      let n = String(num).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (n.startsWith('0')) n = '234' + n.slice(1);
      return n;
    };

    const textRaw = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || '';
    const invoked = textRaw.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Group only.' }, { quoted: m });
    }

    try {
      const groupMetadata = await sock.groupMetadata(chatId);

      // FIXED ADMIN CHECK - USE NUMBER COMPARISON
      const botNumber = normalize(sock.user.id);
      const botLid = sock.user.lid? normalize(sock.user.lid) : null;

      let isBotAdmin = false;
      let adminParticipant = null;

      for (const p of groupMetadata.participants) {
        const pNum = normalize(p.id);
        const isThisBot = pNum === botNumber || (botLid && pNum === botLid) || p.id === sock.user.id || p.id === sock.user.lid;
        if (isThisBot && (p.admin === 'admin' || p.admin === 'superadmin')) {
          isBotAdmin = true;
          adminParticipant = p;
          break;
        }
      }

      // Debug log
      console.log(`[AD] Bot number: ${botNumber} | isAdmin: ${isBotAdmin} | participant:`, adminParticipant?.id, adminParticipant?.admin);

      if (!isBotAdmin) {
        // Double check: sometimes Baileys cache is old, try fetch again
        console.log(`[AD] All participants:`, groupMetadata.participants.map(p=> `${normalize(p.id)}-${p.admin}`));
        return sock.sendMessage(chatId, { text: '❌ Make me admin first.' }, { quoted: m });
      }

      const normalizeJid = (num) => {
        let n = String(num).replace(/[^0-9]/g, '');
        if (n.startsWith('0')) n = '234' + n.slice(1);
        if (n.length < 10) return null;
        return n + '@s.whatsapp.net';
      };

      // --- KICK ---
      if (['kick', 'remove'].includes(invoked)) {
        let toKick = [];
        const replyParticipant = m.message.extendedTextMessage?.contextInfo?.participant;
        if (replyParticipant) toKick.push(replyParticipant);

        const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length) toKick.push(...mentioned);

        if (args.length) {
          for (const a of args) {
            const jid = normalizeJid(a);
            if (jid) toKick.push(jid);
          }
        }
        toKick = [...new Set(toKick)];

        if (!toKick.length) {
          return sock.sendMessage(chatId, { text: `Use:\n${prefix}kick @user\nReply with ${prefix}kick\n${prefix}kick 234...` }, { quoted: m });
        }

        await sock.groupParticipantsUpdate(chatId, toKick, 'remove');

        for (const jid of toKick) {
          await sock.sendMessage(chatId, {
            text: `> @${jid.split('@')[0]} BANISHED BY ${BRAND} 😈👑`,
            mentions: [jid]
          });
        }
        return;
      }

      // --- ADD ---
      if (['ad', 'add'].includes(invoked)) {
        if (!args[0]) {
          return sock.sendMessage(chatId, { text: `Use: ${prefix}ad 234...` }, { quoted: m });
        }

        let toAdd = [];
        for (const a of args) {
          const parts = a.split(',');
          for (const p of parts) {
            const jid = normalizeJid(p);
            if (jid) toAdd.push(jid);
          }
        }
        toAdd = [...new Set(toAdd)];
        if (!toAdd.length) return sock.sendMessage(chatId, { text: '❌ Invalid number.' }, { quoted: m });

        await sock.groupParticipantsUpdate(chatId, toAdd, 'add');

        for (const jid of toAdd) {
          await sock.sendMessage(chatId, {
            text: `> @${jid.split('@')[0]} ADDED BY ${BRAND} 😈👑`,
            mentions: [jid]
          });
        }
        return;
      }

    } catch (e) {
      console.error(`[AD/KICK] Error:`, e);
      return sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: m });
    }
  }
}