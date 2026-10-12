module.exports = {
 name: 'sessionmenu',
 execute: async (sock, m, args, ctx) => {
  const p = ctx?.prefix || '.';
  const txt = `*╭━━━━━━━━━━━━━━━━━━━━╮*\n*┃  ▓▓▓ 𝕊𝔼𝕊𝕊𝕀𝕆ℕ 𝕄𝔼ℕ𝕌 ▓▓▓  ┃*\n*╰━━━━━━━━━━━━━━━━━━━━╯*\n*╭━━━〔 𝕊𝔼𝕊𝕊𝕀𝕆ℕ 〕━━━╮*\n*┃* ➳ ${p}𝕒𝕕𝕕𝕤𝕖𝕤𝕤𝕚𝕠𝕟 234...\n*┃* ➳ ${p}𝕕𝕖𝕝𝕤𝕖𝕤𝕤𝕚𝕠𝕟 session2\n*┃* ➳ ${p}𝕝𝕚𝕤𝕥𝕤𝕖𝕤𝕤𝕚𝕠𝕟\n*┃* ➳ ${p}𝕤𝕖𝕤𝕤𝕚𝕠𝕟\n*╰━━━━━━━━━━━━━━━━━━╯*`;
  await sock.sendMessage(ctx?.chatId || m.key.remoteJid, { text: txt }, { quoted: m });
 }
}