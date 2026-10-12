module.exports = {
 name: 'ownermenu',
 execute: async (sock, m, args, ctx) => {
  const p = ctx?.prefix || '.';
  const txt = `*╭━━━━━━━━━━━━━━━━━━━━╮*\n*┃  ▓▓▓ 𝕆𝕎ℕ𝔼ℝ 𝕄𝔼ℕ𝕌 ▓▓▓  ┃*\n*╰━━━━━━━━━━━━━━━━━━━━╯*\n*╭━━━〔 𝕆𝕎ℕ𝔼ℝ 〕━━━╮*\n*┃* ➳ ${p}𝕤𝕦𝕕𝕠 / ${p}𝕒𝕕𝕕𝕤𝕦𝕕𝕠\n*┃* ➳ ${p}𝕕𝕖𝕝𝕤𝕦𝕕𝕠 / ${p}𝕝𝕚𝕤𝕥𝕤𝕦𝕕𝕠\n*┃* ➳ ${p}𝕞𝕠𝕕𝕖 public/private\n*┃* ➳ ${p}𝕡𝕣𝕖𝕗𝕚𝕩 / ${p}𝕤𝕖𝕥𝕡𝕣𝕖𝕗𝕚𝕩\n*┃* ➳ ${p}𝕣𝕖𝕤𝕥𝕒𝕣𝕥 / ${p}𝕤𝕙𝕦𝕥𝕕𝕠𝕨𝕟\n*╰━━━━━━━━━━━━━━━━━━╯*`;
  await sock.sendMessage(ctx?.chatId || m.key.remoteJid, { text: txt }, { quoted: m });
 }
}