module.exports = {
  name: 'vvsave',
  execute: async (sock, m, args, ctx) => {
    const { chatId, sessionName, getSessionJson, setSessionJson, sender } = ctx;

    // Allow if: fromMe OR sender is this bot's own JID OR main owner
    const myJid = sock.user?.id || '';
    const isSelf = m.key.fromMe || String(sender).includes(myJid.split('@')[0]) || String(chatId) === myJid;

    // Also keep main owner allowed
    if (!isSelf &&!ctx.isSuperOwner) {
      // still allow, don't block - every session can enable its own
    }

    const data = getSessionJson(sessionName, 'vvsave.json', { enabled: false });
    const action = (args[0] || '').toLowerCase();

    if (['on', 'enable'].includes(action)) {
      data.enabled = true;
      setSessionJson(sessionName, 'vvsave.json', data);
      return sock.sendMessage(chatId, { text: `✅ *VVSAVE ON for ${sessionName}*\n\nNow all viewonce sent to this bot will be saved to ${sessionName} DM\n\nCurrent: ${myJid}` });
    }
    if (['off', 'disable'].includes(action)) {
      data.enabled = false;
      setSessionJson(sessionName, 'vvsave.json', data);
      return sock.sendMessage(chatId, { text: `❌ *VVSAVE OFF for ${sessionName}*` });
    }

    const status = data.enabled? 'ON 🟢' : 'OFF 🔴';
    return sock.sendMessage(chatId, { text: `*VVSAVE ${sessionName}*\nStatus: ${status}\nBot JID: ${myJid}\n\nUse:\n.vvsave on\n.vvsave off` });
  }
}
