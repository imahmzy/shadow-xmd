module.exports = {
  name: 'vvsave',
  execute: async (sock, m, args, ctx) => {
    const { chatId, sessionName, getSessionJson, setSessionJson } = ctx;
    const data = getSessionJson(sessionName, 'vvsave.json', { enabled: false });
    const action = (args[0] || '').toLowerCase();
    if (['on','enable'].includes(action)) {
      data.enabled = true;
      setSessionJson(sessionName, 'vvsave.json', data);
      return sock.sendMessage(chatId, { text: `✅ VVSAVE ON for ${sessionName}\nAll viewonce will go to ${sessionName} DM directly (no reaction)` });
    }
    if (['off','disable'].includes(action)) {
      data.enabled = false;
      setSessionJson(sessionName, 'vvsave.json', data);
      return sock.sendMessage(chatId, { text: `❌ VVSAVE OFF for ${sessionName}` });
    }
    return sock.sendMessage(chatId, { text: `*VVSAVE ${sessionName}*\nStatus: ${data.enabled?'ON 🟢':'OFF 🔴'}\n\n.vvsave on / off` });
  }
}
