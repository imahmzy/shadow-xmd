module.exports = {
  name: 'sudo',
  execute: async (sock, m, args, ctx) => {
    const { chatId, isSuperOwner, getSessionJson, setSessionJson, sessionName } = ctx;
    if (!isSuperOwner) return;
    let list = getSessionJson(sessionName,'sudo.json',[]);
    const num = (args[1]||args[0]||'').replace(/[^0-9]/g,'');
    const action = (args[0]||'').toLowerCase();

    if(action==='add' && num){
      if(!list.includes(num)) list.push(num);
      setSessionJson(sessionName,'sudo.json',list);
      return sock.sendMessage(chatId,{text:`> SUDO added for ${sessionName}: ${num} ✅`},{quoted:m});
    }
    if(action==='del' && num){
      list = list.filter(n=>n!==num);
      setSessionJson(sessionName,'sudo.json',list);
      return sock.sendMessage(chatId,{text:`> SUDO removed for ${sessionName}: ${num} ✅`},{quoted:m});
    }
    return sock.sendMessage(chatId,{text:`> SUDO LIST for ${sessionName}:\n${list.join('\n')||'Empty'}\n\nUse:.sudo add 234.. /.sudo del 234..`},{quoted:m});
  }
}