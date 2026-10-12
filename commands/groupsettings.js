module.exports = {
 name: 'groupsettings',
 aliases: ['groupsetting'],
 execute: async (sock, m, args, ctx) => {
  const p = ctx?.prefix || '.';
  const txt = `*╭━━━━━━━━━━━━━━━━━━━━╮*\n*┃  ▓▓▓ 𝕊𝔼𝕋𝕋𝕀ℕ𝔾𝕊 ▓▓▓  ┃*\n*╰━━━━━━━━━━━━━━━━━━━━╯*\n*╭━━━〔 𝕊𝔼𝕋𝕋𝕀ℕ𝔾𝕊 〕━━━╮*\n*┃* ➳ ${p}𝕨𝕖𝕝𝕔𝕠𝕞𝕖 𝕠𝕟/𝕠𝕗𝕗\n*┃* ➳ ${p}𝕘𝕠𝕠𝕕𝕓𝕪𝕖 𝕠𝕟/𝕠𝕗𝕗\n*┃* ➳ ${p}𝕒𝕟𝕥𝕚𝕝𝕚𝕟𝕜 𝕠𝕟/𝕠𝕗𝕗\n*┃* ➳ ${p}𝕒𝕟𝕥𝕚𝕞𝕖𝕟𝕥𝕚𝕠𝕟 𝕠𝕟/𝕠𝕗𝕗\n*┃* ➳ ${p}𝕜𝕚𝕔𝕜𝕒𝕝𝕝 𝟙/𝟚\n*╰━━━━━━━━━━━━━━━━━━╯*`;
  await sock.sendMessage(ctx?.chatId || m.key.remoteJid, { text: txt }, { quoted: m });
 }
}