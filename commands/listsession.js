const fs = require('fs'); const path = require('path');
module.exports = {
  name: 'listsession',
  aliases: ['listsessions','session','sessions','list','sessionlist'],
  execute: async (sock, m, args, ctx) => {
    if(ctx.sessionName!== 'session1') return;
    if(!ctx.isSuperOwner) return;
    const { chatId, getSessionJson } = ctx;
    const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
    const sessions = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=>f.startsWith('session')) : [];
    let msg = '*TOTAL: '+sessions.length+'*\n\n';
    for(let s of sessions){
      const mode = getSessionJson(s, 'mode.json', {mode:'public'}).mode;
      const pref = getSessionJson(s, 'prefix.json', {prefix:'.'}).prefix;
      msg += '*'+s+'*'+(s===ctx.sessionName?' [CURRENT]':'')+'\n> Mode:'+mode+' | Prefix:'+pref+'\n\n';
    }
    await sock.sendMessage(chatId, { text: msg }, { quoted: m });
  }
}