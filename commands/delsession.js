const fs = require('fs'); const path = require('path');
module.exports = {
  name: 'delsession',
  aliases: ['delsessions','delsess','rmsession'],
  execute: async (sock, m, args, ctx) => {
    if(ctx.sessionName!== 'session1') return;
    if(!ctx.isSuperOwner) return;
    const { chatId } = ctx;
    let target = args[0]?.toLowerCase();
    if(!target) return await sock.sendMessage(chatId, { text: '> ❌ Usage:.delsession session2' }, { quoted: m });
    if(target === 'session1') return await sock.sendMessage(chatId, { text: '> ❌ Cannot delete session1' }, { quoted: m });
    const sessPath = path.join(__dirname, '..', 'sessions', target);
    const perPath = path.join(__dirname, '..', 'data', 'per_session', target);
    const ownersPath = path.join(__dirname, '..', 'data', 'session_owners.json');
    if(!fs.existsSync(sessPath)) return await sock.sendMessage(chatId, { text: '> ❌ '+target+' not found' }, { quoted: m });
    try{
      if(fs.existsSync(sessPath)) fs.rmSync(sessPath, {recursive:true, force:true});
      if(fs.existsSync(perPath)) fs.rmSync(perPath, {recursive:true, force:true});
      if(fs.existsSync(ownersPath)){ let o=JSON.parse(fs.readFileSync(ownersPath,'utf8')); delete o[target]; fs.writeFileSync(ownersPath, JSON.stringify(o,null,2)); }
      await sock.sendMessage(chatId, { text: '> ✅ Deleted '+target }, { quoted: m });
    }catch(e){ await sock.sendMessage(chatId, { text: '> ❌ '+e.message }, { quoted: m }); }
  }
}