const fs = require('fs');
const path = require('path');
const VV_STATE_FILE = path.join(__dirname, '..', 'data', 'vvsave.json');
if(!fs.existsSync(VV_STATE_FILE)) fs.writeFileSync(VV_STATE_FILE, JSON.stringify({enabled:false}, null, 2));
module.exports = {
  name: 'vvsave',
  aliases: ['vvs'],
  execute: async (sock, m, args, ctx) => {
    const action = (args[0]||'').toLowerCase();
    if(action==='on'){
      fs.writeFileSync(VV_STATE_FILE, JSON.stringify({enabled:true}, null, 2));
      await sock.sendMessage(ctx.chatId, {text:'✅ *VVSAVE ON*\nBot now auto-checks ALL DM & GROUP messages\nIf viewonce=true → saves to temp/vv/ for 30min\nReact any emoji to reveal to owner DM (2348166412988)'}, {quoted:m});
      console.log('[VVSAVE] ON');
    } else if(action==='off'){
      fs.writeFileSync(VV_STATE_FILE, JSON.stringify({enabled:false}, null, 2));
      if(global.vvCache){ for(const [id,d] of global.vvCache){ try{clearTimeout(d.timeout); if(fs.existsSync(d.path)) fs.unlinkSync(d.path);}catch{} } global.vvCache.clear(); }
      await sock.sendMessage(ctx.chatId, {text:'❌ VVSAVE OFF - cache cleared'}, {quoted:m});
      console.log('[VVSAVE] OFF');
    } else {
      const s = JSON.parse(fs.readFileSync(VV_STATE_FILE,'utf8'));
      await sock.sendMessage(ctx.chatId, {text:`VVSAVE is ${s.enabled?'ON ✅':'OFF ❌'}\n.vvsave on\n.vvsave off`}, {quoted:m});
    }
  }
}