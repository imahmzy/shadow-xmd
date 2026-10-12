module.exports = {
  name: 'prefix',
  execute: async (sock, m, args, ctx) => {
    const { chatId, getSessionJson, setSessionJson, sessionName } = ctx;
    let data = getSessionJson(sessionName, 'prefix.json', { prefix: '.' });
    if(!args[0]) return await sock.sendMessage(chatId, { text: '*PREFIX FOR '+sessionName+': '+data.prefix+'*' }, { quoted: m });
    data.prefix = args[0];
    setSessionJson(sessionName, 'prefix.json', data);
    await sock.sendMessage(chatId, { text: '> ✅ Prefix '+args[0]+' for '+sessionName }, { quoted: m });
  }
}