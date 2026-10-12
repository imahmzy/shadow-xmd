const fs = require('fs');
const path = require('path');
module.exports = {
  name: 'listsession',
  aliases: ['listsessions','sessionlist','session'],
  execute: async (sock, m, args, ctx) => {
    // ONLY SESSION1 CAN USE - SILENT IGNORE FOR OTHERS
    if(ctx.sessionName!== 'session1') return;
    if(!ctx.isSuperOwner) return;

    const { chatId, getSessionJson } = ctx;
    const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
    const sessions = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=>f.startsWith('session')) : [];
    let msg = `*TOTAL: ${sessions.length}*\n\n`;
    for(let s of sessions){
      const mode = getSessionJson(s, 'mode.json', {mode:'public'}).mode;
      const auto = getSessionJson(s, 'auto.json', {});
      const pref = getSessionJson(s, 'prefix.json', {prefix:'.'}).prefix;
      msg += `*${s}*\n> Mode:${mode} Prefix:${pref}\n> view:${auto.autoview?'ON':'OFF'} reactme:${auto.reactme?'ON':'OFF'}\n\n`;
    }
    await sock.sendMessage(chatId, { text: msg }, { quoted: m });
  }
}