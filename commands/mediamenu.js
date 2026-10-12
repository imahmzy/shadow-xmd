module.exports = {
 name: 'mediamenu',
 execute: async (sock, m, args, ctx) => {
  const p = ctx?.prefix || '.';
  const txt = `*╭━━━━━━━━━━━━━━━━━━━━╮*\n*┃  ▓▓▓ 𝕄𝔼𝔻𝕀𝔸 𝕄𝔼ℕ𝕌 ▓▓▓  ┃*\n*╰━━━━━━━━━━━━━━━━━━━━╯*\n*╭━━━〔 𝕄𝔼𝔻𝕀𝔸 〕━━━╮*\n*┃* ➳ ${p}𝕤𝕥𝕚𝕔𝕜𝕖𝕣 / ${p}𝕤𝕥𝕚𝕔𝕜𝕖𝕣𝟚\n*┃* ➳ ${p}𝕥𝕠𝕚𝕞𝕘 / ${p}𝕥𝕠𝕧𝕚𝕕\n*┃* ➳ ${p}𝕥𝕘𝕤𝕥𝕚𝕔𝕜𝕖𝕣𝕤 / ${p}𝕧𝕧\n*┃* ➳ ${p}𝕥𝕠𝕣𝕖𝕒𝕕 / ${p}𝕤𝕖𝕟𝕕\n*┃* ➳ ${p}𝕧𝕚𝕕𝕥𝕠𝕞𝕡𝟛 / ${p}𝕘𝕖𝕥𝕡𝕡\n*╰━━━━━━━━━━━━━━━━━━╯*`;
  await sock.sendMessage(ctx?.chatId || m.key.remoteJid, { text: txt }, { quoted: m });
 }
}