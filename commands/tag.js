module.exports = {
  name: 'tagall',
  aliases: ['tag', 'hidetag', 'htag', 'ta'],
  description: 'Tag all - visible and hidden',
  execute: async (sock, m, args, ctx) => {
    const { chatId } = ctx;
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: `> ❌ Group only` }, { quoted: m });
    }

    const rawText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
    const invoked = rawText.split(/\s+/)[0].slice(1).toLowerCase();
    const isHide = ['hidetag','htag'].includes(invoked);

    try {
      const groupMeta = await sock.groupMetadata(chatId);
      const participants = groupMeta.participants || [];
      const mentions = participants.map(p => p.id);

      let customMsg = args.join(' ').trim();
      if (!customMsg) customMsg = isHide? ' ' : `Attention everyone in ${groupMeta.subject}`;

      if (isHide) {
        // HIDETAG FIXED - only your message + hidden tags + small footer
        const hidden = String.fromCharCode(8206).repeat(400);
        const text = `${customMsg}${hidden}\n> ᴛᴀɢᴇᴅ ʙʏ sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴`;

        await sock.sendMessage(chatId, {
          text: text,
          mentions: mentions
        }, { quoted: m });

      } else {
        // TAGALL normal
        let tagText = `${customMsg}\n\n`;
        participants.forEach((p,i)=>{
          tagText += `@${p.id.split('@')[0]} `;
          if((i+1)%5===0) tagText+='\n';
        });
        tagText += `\n\n> ᴛᴀɢɢᴇᴅ ʙʏ sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴`;

        await sock.sendMessage(chatId, {
          text: tagText,
          mentions: mentions
        }, { quoted: m });
      }

    } catch (e) {
      console.log(`[TAG ERROR] ${e.message}`);
      return sock.sendMessage(chatId, { text: `> ❌ ${e.message}` }, { quoted: m });
    }
  }
}