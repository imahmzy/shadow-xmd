module.exports = {
  name: 'list',
  aliases: ['listonline', 'listoffline', 'online', 'offline', 'liston', 'listoff'],
  execute: async (sock, m, args, ctx) => {
    const { chatId, isGroup, command } = ctx;
    if (!isGroup) return sock.sendMessage(chatId, { text: `> ❌ Group only` }, { quoted: m });

    try {
      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants;
      const isOfflineCmd = command.includes('offline') || command.includes('off');

      const checkMsg = await sock.sendMessage(chatId, {
        text: `> 🔍 Checking ${isOfflineCmd? 'offline' : 'online'} members...`
      });

      let deliveredSet = new Set();

      const receiptHandler = (receipt) => {
        try {
          const receipts = Array.isArray(receipt)? receipt : [receipt];
          for (let r of receipts) {
            if (!r.key || r.key.id!== checkMsg.key.id) continue;
            if (r.receipt) for (let rec of r.receipt) if (rec.jid) deliveredSet.add(rec.jid);
            if (r.jid) deliveredSet.add(r.jid);
            if (r.participant) deliveredSet.add(r.participant);
          }
        } catch {}
      };

      sock.ev.on('message-receipt', receiptHandler);
      sock.ev.on('messages.receipt', receiptHandler);

      let presenceMap = {};
      const presenceHandler = (json) => {
        try {
          for (let id in json) {
            if (json[id].lastKnownPresence === 'available' || json[id].lastKnownPresence === 'composing' || json[id].lastKnownPresence === 'recording') {
              presenceMap[id] = true;
              deliveredSet.add(id);
            }
          }
        } catch {}
      };
      sock.ev.on('presence.update', presenceHandler);
      try { for (let p of participants) await sock.presenceSubscribe(p.id).catch(()=>{}); } catch {}

      await new Promise(r => setTimeout(r, 7000));

      sock.ev.off('message-receipt', receiptHandler);
      sock.ev.off('messages.receipt', receiptHandler);
      sock.ev.off('presence.update', presenceHandler);

      if (deliveredSet.size === 0) {
        if (Object.keys(presenceMap).length > 0) deliveredSet = new Set(Object.keys(presenceMap));
        else participants.forEach(p => deliveredSet.add(p.id));
      }

      const deliveredList = Array.from(deliveredSet);
      const notDeliveredList = participants.filter(p =>!deliveredSet.has(p.id)).map(p => p.id);

      let targetList, title;
      if (isOfflineCmd) {
        targetList = notDeliveredList;
        title = 'OFFLINE MEMBERS';
      } else {
        targetList = deliveredList;
        title = 'ONLINE MEMBERS';
      }

      if (targetList.length === 0) {
        const msg = isOfflineCmd? `> ✅ All members are online` : `> No online members found`;
        await sock.sendMessage(chatId, { text: msg }, { quoted: m });
        try { await sock.sendMessage(chatId, { delete: checkMsg.key }); } catch {}
        return;
      }

      let text = `╭─〔 ${title} 〕─\n`;
      text += `│ Count: ${targetList.length}/${participants.length}\n`;
      text += `├────────────────\n`;

      targetList.forEach((jid, i) => {
        const num = jid.split('@')[0];
        text += `│ ${i + 1}. @${num}\n`;
      });

      text += `╰────────────\n> SHADOW XMD V4 😈👑`;

      // THIS TAGS THEM NOW
      await sock.sendMessage(chatId, { text, mentions: targetList }, { quoted: m });

      try { await sock.sendMessage(chatId, { delete: checkMsg.key }); } catch {}

    } catch (e) {
      console.log('list error', e);
      return sock.sendMessage(chatId, { text: `> ❌ Error: ${e.message}` }, { quoted: m });
    }
  }
};