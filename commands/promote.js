module.exports = {
  name: 'promote',
  aliases: ['demote', 'revoke'],
  description: 'Promote / Demote with SHADOW XMD style',
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
      const botNumber = normalize(sock.user.id);
      const botLid = sock.user.lid? normalize(sock.user.lid) : null;

      let isBotAdmin = false;
      for (const p of groupMetadata.participants) {
        const pNum = normalize(p.id);
        const isThisBot = pNum === botNumber || (botLid && pNum === botLid) || p.id === sock.user.id || p.id === sock.user.lid;
        if (isThisBot && (p.admin === 'admin' || p.admin === 'superadmin')) {
          isBotAdmin = true;
          break;
        }
      }

      if (!isBotAdmin) {
        return sock.sendMessage(chatId, { text: '❌ Make me admin first.' }, { quoted: m });
      }

      // Get targets
      let targets = [];
      const replyParticipant = m.message.extendedTextMessage?.contextInfo?.participant;
      if (replyParticipant) targets.push(replyParticipant);

      const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length) targets.push(...mentioned);

      // allow numbers in args
      if (args.length) {
        for (const a of args) {
          let n = String(a).replace(/[^0-9]/g, '');
          if (n.startsWith('0')) n = '234' + n.slice(1);
          if (n.length >= 10) targets.push(n + '@s.whatsapp.net');
        }
      }

      targets = [...new Set(targets)];
      if (!targets.length) {
        return sock.sendMessage(chatId, {
          text: `Use:\n${prefix}promote @user\nReply with ${prefix}promote\n${prefix}demote @user`
        }, { quoted: m });
      }

      // --- PROMOTE ---
      if (['promote'].includes(invoked)) {
        await sock.groupParticipantsUpdate(chatId, targets, 'promote');
        for (const jid of targets) {
          await sock.sendMessage(chatId, {
            text: `> @${jid.split('@')[0]} PROMOTED BY ${BRAND} 😈👑`,
            mentions: [jid]
          });
        }
        return;
      }

      // --- DEMOTE / REVOKE ---
      if (['demote', 'revoke'].includes(invoked)) {
        await sock.groupParticipantsUpdate(chatId, targets, 'demote');
        for (const jid of targets) {
          await sock.sendMessage(chatId, {
            text: `> @${jid.split('@')[0]} REVOKED BY ${BRAND} 😈👑`,
            mentions: [jid]
          });
        }
        return;
      }

    } catch (e) {
      console.error(`[PROMOTE/DEMOTE] Error:`, e);
      return sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: m });
    }
  }
}