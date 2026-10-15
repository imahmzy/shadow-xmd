module.exports = {
  name: 'vvsave',
  execute: async (sock, m, args, ctx) => {
    const { chatId, isSuperOwner, sessionName, getSessionJson, setSessionJson } = ctx;
    if (!isSuperOwner) return sock.sendMessage(chatId, { text: '❌ Owner only' });

    const data = getSessionJson(sessionName, 'vvsave.json', { enabled: false });
    const action = (args[0] || '').toLowerCase();

    if (['on', 'enable'].includes(action)) {
      data.enabled = true;
      setSessionJson(sessionName, 'vvsave.json', data);
      return sock.sendMessage(chatId, { text: '✅ *ViewOnce Save ON*\n\nAll view once images/videos/audio will be sent to your DM' });
    }
    if (['off', 'disable'].includes(action)) {
      data.enabled = false;
      setSessionJson(sessionName, 'vvsave.json', data);
      return sock.sendMessage(chatId, { text: '❌ *ViewOnce Save OFF*' });
    }

    const status = data.enabled? 'ON 🟢' : 'OFF 🔴';
    return sock.sendMessage(chatId, { text: `*VVSAVE*\n\nStatus: ${status}\n\nUse:\n.vvsave on - Enable\n.vvsave off - Disable` });
  }
}
