module.exports = {
  name: 'gcstatus',
  alias: ['gcs'],
  ownerOnly: true,

  async execute(sock, m, args){
    const chatId = m.key.remoteJid;
    const { downloadMediaMessage } = require('@whiskeysockets/baileys');

    try{
      const fullText = args.join(' ').trim();
      const quotedInfo = m.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = quotedInfo?.quotedMessage;
      const quotedType = quotedMsg? Object.keys(quotedMsg)[0] : null;

      const linkRegex = /https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]+)/gi;
      const links = fullText.match(linkRegex) || [];

      let targetJid = null;
      let targetName = 'group';
      let contentText = fullText;

      // === 1. TARGET GROUP (last link = target) ===
      if(links.length > 0){
        const targetLink = links[links.length - 1];
        const code = targetLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i)[1];
        contentText = fullText.substring(0, fullText.lastIndexOf(targetLink)).trim();

        try{
          const info = await sock.groupGetInviteInfo(code);
          targetJid = info.id;
          const meta = await sock.groupMetadata(targetJid);
          targetName = meta.subject;
        }catch{
          return await sock.sendMessage(chatId, { text: `❌ Can't post. Bot not in group.\nJoin first: ${targetLink}` });
        }
      }else{
        if(!chatId.endsWith('@g.us')){
          return await sock.sendMessage(chatId, { text: '❌ Use inside group OR add target link\nEx:.gcstatus hi https://chat.whatsapp.com/xxx' });
        }
        targetJid = chatId;
        try{
          const meta = await sock.groupMetadata(targetJid);
          targetName = meta.subject;
        }catch{}
      }

      // === 2. CONTENT - FIX for reply + link ===
      const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || quotedMsg?.imageMessage?.caption || quotedMsg?.videoMessage?.caption || '';

      // If replying and no typed caption, use replied text
      if(!contentText && quotedText){
        contentText = quotedText;
      }

      // If replying to text and also typed something, combine
      if(quotedText && contentText && quotedType && (quotedType === 'conversation' || quotedType === 'extendedTextMessage')){
        // if contentText is different from target link, keep both
        if(contentText!== quotedText) contentText = `${contentText}`; // you can change to `${quotedText}\n${contentText}` if you want both
      }

      // === 3. POST AS GROUP STATUS (no chat bubble) ===
      if(quotedType === 'imageMessage' || quotedType === 'videoMessage'){
        const msgToDownload = {
          key: { remoteJid: chatId, id: quotedInfo.stanzaId, participant: quotedInfo.participant },
          message: quotedMsg
        };
        const buff = await downloadMediaMessage(msgToDownload, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
        if(!buff) return;

        if(typeof sock.groupStatus === 'function'){
          await sock.groupStatus(targetJid, { image: quotedType==='imageMessage'? buff : undefined, video: quotedType==='videoMessage'? buff : undefined, caption: contentText });
        }else{
          await sock.sendMessage(targetJid, { [quotedType==='imageMessage'?'image':'video']: buff, caption: contentText }, { isGroupStatus: true });
        }

      }else{
        // text status
        const textToPost = contentText || quotedText;
        if(!textToPost) return;

        if(typeof sock.groupStatus === 'function'){
          await sock.groupStatus(targetJid, textToPost);
        }else{
          await sock.sendMessage(targetJid, { text: textToPost, contextInfo: { isGroupStatus: true } });
        }
      }

      // === 4. SILENT CONFIRM - only react, no big message ===
      try{
        await sock.sendMessage(chatId, { react: { text: '✅', key: m.key } });
      }catch{
        // if react fails, send tiny text and delete after 3s (silent)
        const sent = await sock.sendMessage(chatId, { text: `Posted in ${targetName}` });
        setTimeout(()=> sock.sendMessage(chatId, { delete: sent.key }), 3000);
      }

    }catch(e){
      console.log('[GCSTATUS ERR]', e);
      await sock.sendMessage(chatId, { text: `❌ ${e.message}` });
    }
  }
}