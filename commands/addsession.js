module.exports = {
  name: 'addsession',
  aliases: ['addsessions'],
  execute: async (sock, m, args, ctx) => {
    if(ctx.sessionName!== 'session1') return;
    if(!ctx.isSuperOwner) return;
    const { chatId, startSession } = ctx;
    let phone = args[0]?.replace(/[^0-9]/g,'');
    if(!phone) return await sock.sendMessage(chatId, { text: '> ❌ Usage:.addsession 234...' }, { quoted: m });
    const fs = require('fs'); const path = require('path');
    const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
    const existing = fs.existsSync(SESSIONS_DIR)? fs.readdirSync(SESSIONS_DIR).filter(f=>f.startsWith('session')).length : 0;
    const newName = 'session'+(existing+1);
    await sock.sendMessage(chatId, { text: '> ⏳ Creating '+newName+'...' }, { quoted: m });
    try{ const code = await startSession(newName, phone); if(code) await sock.sendMessage(chatId, { text: '> ✅ '+newName+' Code: '+code }, { quoted: m }); }
    catch(e){ await sock.sendMessage(chatId, { text: '> ❌ '+e.message }, { quoted: m }); }
  }
}