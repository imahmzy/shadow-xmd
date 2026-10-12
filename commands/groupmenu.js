module.exports = {
 name: 'groupmenu',
 execute: async (sock, m, args, ctx) => {
  const p = ctx?.prefix || '.';
  const txt = `*╭━━━━━━━━━━━━━━━━━━━━╮*\n*┃  ▓▓▓ 𝔾ℝ𝕆𝕌ℙ 𝕄𝔼ℕ𝕌 ▓▓▓  ┃*\n*╰━━━━━━━━━━━━━━━━━━━━╯*\n*╭━━━〔 𝔾ℝ𝕆𝕌ℙ 〕━━━╮*\n*┃* ➳ ${p}𝕘𝕣𝕠𝕦𝕡𝕚𝕟𝕗𝕠 / ${p}𝕒𝕕𝕞𝕚𝕟𝕤\n*┃* ➳ ${p}𝕜𝕚𝕔𝕜 / ${p}𝕒𝕕𝕕\n*┃* ➳ ${p}𝕡𝕣𝕠𝕞𝕠𝕥𝕖 / ${p}𝕕𝕖𝕞𝕠𝕥𝕖\n*┃* ➳ ${p}𝕥𝕒𝕘𝕒𝕝𝕝 / ${p}𝕙𝕚𝕕𝕖𝕥𝕒𝕘\n*┃* ➳ ${p}𝕠𝕡𝕖𝕟 / ${p}𝕔𝕝𝕠𝕤𝕖 / ${p}𝕕𝕖𝕝𝕖𝕥𝕖\n*╰━━━━━━━━━━━━━━━━━━╯*`;
  await sock.sendMessage(ctx?.chatId || m.key.remoteJid, { text: txt }, { quoted: m });
 }
}