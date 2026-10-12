module.exports = {
  name: 'auto',
  aliases: ['autoview','autoreact','reactme','statusreact','autotyping','autorecording'],
  execute: async (sock, m, args, ctx) => {
    const { chatId, getSessionJson, setSessionJson, sessionName } = ctx;
    let config = getSessionJson(sessionName, 'auto.json', { autoview: false, autoreact: false, reactme: false, statusreact: false, autotyping: false, autorecording: false });
    if(!args[0]){
      let msg = '*AUTO FOR '+sessionName.toUpperCase()+'*\n\n';
      for(let k in config) msg += k+': '+(config[k]? '✅ ON' : '❌ OFF')+'\n';
      return await sock.sendMessage(chatId, { text: msg }, { quoted: m });
    }
    let feature = args[0].toLowerCase();
    let value = args[1]?.toLowerCase();
    if(['on','off'].includes(feature)){ value = feature; feature = (ctx.command||'').toLowerCase(); }
    if(!['autoview','autoreact','reactme','statusreact','autotyping','autorecording'].includes(feature)) return await sock.sendMessage(chatId, { text: '❌ Unknown: '+feature }, { quoted: m });
    if(!['on','off'].includes(value)) return await sock.sendMessage(chatId, { text: 'Usage:.'+feature+' on/off' }, { quoted: m });
    config[feature] = value === 'on';
    setSessionJson(sessionName, 'auto.json', config);
    await sock.sendMessage(chatId, { text: '> ✅ '+feature.toUpperCase()+' '+value.toUpperCase()+' for '+sessionName }, { quoted: m });
  }
}