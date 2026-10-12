module.exports = {
  name: 'mode',
  execute: async (sock, m, args, ctx) => {
    const { chatId, getSessionJson, setSessionJson, sessionName } = ctx;
    let data = getSessionJson(sessionName, 'mode.json', { mode: 'public' });
    if(!args[0]) return await sock.sendMessage(chatId, { text: '*MODE FOR '+sessionName+': '+data.mode+'*' }, { quoted: m });
    data.mode = args[0].toLowerCase();
    setSessionJson(sessionName, 'mode.json', data);
    await sock.sendMessage(chatId, { text: '> ✅ Mode '+data.mode+' for '+sessionName }, { quoted: m });
  }
}