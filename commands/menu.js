const fs = require('fs');

module.exports = {
 name: 'menu',
 aliases: ['help', 'allmenu'],
 execute: async (sock, m, args, ctx) => {
  const chatId = ctx?.chatId || m.key.remoteJid;
  const prefix = ctx?.prefix || '.';
  const pushName = m.pushName || 'User';

  const v = `
*╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮*
*┃  𝕊ℍ𝔸𝔻𝕆𝕎ˣᵐᵈ 𝕍𝟜  ┃*
*┃  𝕀 𝔸𝕄 𝔸𝕋𝕆𝕄𝕀ℂ 💜  ┃*
*╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯*

*👤 𝕌𝕊𝔼ℝ: ${pushName}*
*⚡ ℙℝ𝔼𝔽𝕀𝕏: ${prefix}*

*╭━━━〔 𝕄𝔸𝕀ℕ 〕━━━╮*
*┃* ➳ ${prefix}𝕞𝕖𝕟𝕦, ${prefix}𝕙𝕖𝕝𝕡, ${prefix}𝕝𝕚𝕤𝕥
*┃* ➳ ${prefix}𝕡𝕚𝕟𝕘, ${prefix}𝕒𝕝𝕚𝕧𝕖, ${prefix}𝕤𝕡𝕖𝕖𝕕
*┃* ➳ ${prefix}𝕠𝕨𝕟𝕖𝕣, ${prefix}𝕕𝕖𝕧
*╰━━━━━━━━━━━━━━━━━╯*

*╭━━━〔 𝕊𝔼𝕊𝕊𝕀𝕆ℕ 〕━━━╮*
*┃* ➳ ${prefix}𝕒𝕕𝕕𝕤𝕖𝕤𝕤𝕚𝕠𝕟
*┃* ➳ ${prefix}𝕘𝕖𝕥𝕤𝕖𝕤𝕤𝕚𝕠𝕟
*┃* ➳ ${prefix}𝕝𝕚𝕤𝕥𝕤𝕖𝕤𝕤𝕚𝕠𝕟
*┃* ➳ ${prefix}𝕕𝕖𝕝𝕤𝕖𝕤𝕤𝕚𝕠𝕟
*╰━━━━━━━━━━━━━━━━━━━━╯*

*╭━━━〔 𝔾ℝ𝕆𝕌ℙ 〕━━━╮*
*┃* ➳ ${prefix}𝕥𝕒𝕘𝕒𝕝𝕝, ${prefix}𝕙𝕚𝕕𝕖𝕥𝕒𝕘
*┃* ➳ ${prefix}𝕡𝕣𝕠𝕞𝕠𝕥𝕖, ${prefix}𝕕𝕖𝕞𝕠𝕥𝕖
*┃* ➳ ${prefix}𝕜𝕚𝕔𝕜, ${prefix}𝕒𝕕𝕕
*┃* ➳ ${prefix}𝕘𝕣𝕠𝕦𝕡 𝕠𝕡𝕖𝕟 / 𝕔𝕝𝕠𝕤𝕖
*┃* ➳ ${prefix}𝕝𝕚𝕟𝕜, ${prefix}𝕣𝕖𝕧𝕠𝕜𝕖
*╰━━━━━━━━━━━━━━━━━━╯*

*╭━━━〔 𝔻𝕆𝕎ℕ𝕃𝕆𝔸𝔻 〕━━━╮*
*┃* ➳ ${prefix}𝕡𝕝𝕒𝕪, ${prefix}𝕤𝕠𝕟𝕘
*┃* ➳ ${prefix}𝕧𝕚𝕕𝕖𝕠, ${prefix}𝕪𝕥𝕞𝕡𝟜
*┃* ➳ ${prefix}𝕥𝕚𝕜𝕥𝕠𝕜, ${prefix}𝕗𝕓, ${prefix}𝕚𝕘
*╰━━━━━━━━━━━━━━━━━━━━━━╯*

*╭━━━〔 𝔸𝕀 & 𝕋𝕆𝕆𝕃𝕊 〕━━━╮*
*┃* ➳ ${prefix}𝕒𝕚, ${prefix}𝕘𝕡𝕥
*┃* ➳ ${prefix}𝕚𝕞𝕘, ${prefix}𝕤𝕥𝕚𝕔𝕜𝕖𝕣
*┃* ➳ ${prefix}𝕥𝕠𝕚𝕞𝕘, ${prefix}𝕥𝕠𝕦𝕣𝕝
*╰━━━━━━━━━━━━━━━━━━━━━━━━╯*

*╭━━━〔 𝕆𝕎ℕ𝔼ℝ 〕━━━╮*
*┃* ➳ ${prefix}𝕞𝕠𝕕𝕖, ${prefix}𝕣𝕖𝕤𝕥𝕒𝕣𝕥
*┃* ➳ ${prefix}𝕓𝕣𝕠𝕒𝕕𝕔𝕒𝕤𝕥
*╰━━━━━━━━━━━━━━━━━━╯*

*╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮*
*┃ 𝕊ℍ𝔸𝔻𝕆𝕎𝕩𝕄𝔻𝕍𝟜 - 𝕀 𝔸𝕄 𝔸𝕋𝕆𝕄𝕀ℂ 💜 ┃*
*╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯*
`;

  const imgPath = './media/shadowv4.jpg';
  
  try {
   if (fs.existsSync(imgPath)) {
    await sock.sendMessage(chatId, {
     image: fs.readFileSync(imgPath),
     caption: v
    }, { quoted: m });
   } else {
    await sock.sendMessage(chatId, { text: v }, { quoted: m });
   }
  } catch (e) {
   await sock.sendMessage(chatId, { text: v }, { quoted: m });
  }
 }
}