module.exports = {
 name: 'dlmenu',
 aliases: ['downloadmenu'],
 execute: async (sock, m, args, ctx) => {
  const p = ctx?.prefix || '.';
  const txt = `*╭━━━━━━━━━━━━━━━━━━━━╮*\n*┃  ▓▓▓ 𝔻𝕃 𝕄𝔼ℕ𝕌 ▓▓▓  ┃*\n*╰━━━━━━━━━━━━━━━━━━━━╯*\n*╭━━━〔 𝔻𝕆𝕎ℕ𝕃𝕆𝔸𝔻 〕━━━╮*\n*┃* ➳ ${p}𝕡𝕝𝕒𝕪 / ${p}𝕤𝕠𝕟𝕘\n*┃* ➳ ${p}𝕪𝕥𝕞𝕡𝟛 / ${p}𝕪𝕥𝕞𝕡𝟜\n*╰━━━━━━━━━━━━━━━━━━╯*`;
  await sock.sendMessage(ctx?.chatId || m.key.remoteJid, { text: txt }, { quoted: m });
 }
}