const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'vv',
  aliases: ['vvp', 'viewonce', 'rvo'],
  description: 'View once revealer - VV and VVP',
  execute: async (sock, m, args, ctx) => {
  const sessionName = ctx.sessionName || 'session1';
    const { chatId, senderNum, getPrefix } = ctx;
    const prefix = getPrefix();

    const rawText = m.message.conversation || m.message.extendedTextMessage?.text || '';
    const invoked = rawText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
    const isSilent = invoked === 'vvp';

    const quotedInfo = m.message.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedInfo?.quotedMessage;

    if (!quotedMsg) {
      if (isSilent) {
        try { await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } }); } catch {}
        return;
      }
      return sock.sendMessage(chatId, { text: `> ❌ Reply to a *View Once* message\n\n> ${prefix}vv - reveal in chat\n> ${prefix}vvp - silent to owner DM` }, { quoted: m });
    }

    let viewOnce = quotedMsg.viewOnceMessageV2?.message || quotedMsg.viewOnceMessage?.message || quotedMsg.viewOnceMessageV2Extension?.message || null;

    if (!viewOnce) {
      if (quotedMsg.imageMessage?.viewOnce || quotedMsg.videoMessage?.viewOnce || quotedMsg.audioMessage?.viewOnce) {
        viewOnce = quotedMsg;
      }
    }

    if (!viewOnce) {
      if (isSilent) {
        try { await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } }); } catch {}
        return;
      }
      return sock.sendMessage(chatId, { text: `> ❌ That is not a ViewOnce message 😔` }, { quoted: m });
    }

    const msgType = Object.keys(viewOnce)[0];
    const mediaContent = viewOnce[msgType];

    try {
      // Build message object for download
      const msgToDownload = {
        key: {
          remoteJid: chatId,
          id: quotedInfo.stanzaId,
          participant: quotedInfo.participant,
          fromMe: false
        },
        message: viewOnce
      };

      const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {}, {
        logger: undefined,
        reuploadRequest: sock.updateMediaMessage
      });

      let ownerJid = null;
      try {
        const data = fs.readFileSync(path.join(__dirname, '../data/super_owner.json'), 'utf8');
        const json = JSON.parse(data);
        if (json.gid) ownerJid = json.gid;
        else if (json.number) ownerJid = json.number.replace(/[^0-9]/g,'') + '@s.whatsapp.net';
      } catch {}
      if (!ownerJid) ownerJid = senderNum + '@s.whatsapp.net';

      const captionDesign =
`╭─〔 *SHADOW XMD V4* 〕─
│ *ViewOnce Revealed* 😈
│ *Type:* ${msgType.replace('Message','').toUpperCase()}
│ *From:* @${quotedInfo.participant? quotedInfo.participant.split('@')[0] : 'unknown'}
╰───────────────
> *Revealed by SHADOW XMD* 😈👑`;

      if (isSilent) {
        if (msgType === 'imageMessage') {
          await sock.sendMessage(ownerJid, { image: buffer, caption: captionDesign, mentions: quotedInfo.participant? [quotedInfo.participant] : [] });
        } else if (msgType === 'videoMessage') {
          await sock.sendMessage(ownerJid, { video: buffer, caption: captionDesign, mentions: quotedInfo.participant? [quotedInfo.participant] : [] });
        } else if (msgType === 'audioMessage') {
          await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/mp4', ptt: mediaContent.ptt || false });
          await sock.sendMessage(ownerJid, { text: captionDesign });
        }
        try { await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } }); } catch {}
        return;
      } else {
        if (msgType === 'imageMessage') {
          await sock.sendMessage(chatId, { image: buffer, caption: captionDesign, mentions: quotedInfo.participant? [quotedInfo.participant] : [] }, { quoted: m });
        } else if (msgType === 'videoMessage') {
          await sock.sendMessage(chatId, { video: buffer, caption: captionDesign, mentions: quotedInfo.participant? [quotedInfo.participant] : [] }, { quoted: m });
        } else if (msgType === 'audioMessage') {
          await sock.sendMessage(chatId, { audio: buffer, mimetype: 'audio/mp4', ptt: mediaContent.ptt || false }, { quoted: m });
          await sock.sendMessage(chatId, { text: captionDesign, mentions: quotedInfo.participant? [quotedInfo.participant] : [] }, { quoted: m });
        }
        return;
      }

    } catch (e) {
      console.log(`[VV ERROR] ${e.message}`);
      console.log(e.stack);
      if (isSilent) {
        try { await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } }); } catch {}
        return;
      }
      return sock.sendMessage(chatId, { text: `> ❌ Failed to reveal\n> ${e.message}` }, { quoted: m });
    }
  }
}
