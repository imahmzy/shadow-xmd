module.exports = {
 name: 'toolsmenu',
 execute: async (sock, m, args, ctx) => {
  const p = ctx?.prefix || '.';
  const txt = `*╭━━━━━━━━━━━━━━━━━━━━╮*\n*┃  ▓▓▓ 𝕋𝕆𝕆𝕃𝕊 𝕄𝔼ℕ𝕌 ▓▓▓  ┃*\n*╰━━━━━━━━━━━━━━━━━━━━╯*\n*╭━━━〔 𝕋𝕆𝕆𝕃𝕊 〕━━━╮*\n*┃* ➳ ${p}𝕥𝕣𝕒𝕟𝕤𝕝𝕒𝕥𝕖 / ${p}𝕕𝕖𝕗𝕚𝕟𝕖\n*┃* ➳ ${p}𝕥𝕥𝕤 / ${p}𝕝𝕪𝕣𝕚𝕔𝕤\n*┃* ➳ ${p}𝕘𝕖𝕥𝕡𝕡 / ${p}𝕘𝕖𝕥𝕘𝕔𝕡𝕡 / ${p}𝕘𝕖𝕥𝕟𝕒𝕞𝕖\n*┃* ➳ ${p}𝕒𝕕 / ${p}𝕛𝕠𝕜𝕖 / ${p}𝕢𝕦𝕠𝕥𝕖\n*╰━━━━━━━━━━━━━━━━━━╯*`;
  await sock.sendMessage(ctx?.chatId || m.key.remoteJid, { text: txt }, { quoted: m });
 }
}