const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const TEMP_DIR = path.join(os.tmpdir(), 'shadow-tgstickers');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function randomFile(prefix, ext) {
 return path.join(TEMP_DIR, `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}.${ext}`);
}
function shuffle(arr) {
 const a = [...arr];
 for (let i = a.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [a[i], a[j]] = [a[j], a[i]];
 }
 return a;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function safeDelete(f) { try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {} }

function parseStickerPackUrl(input) {
 if (!input) return null;
 let value = String(input).trim();
 if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
 try {
  const url = new URL(value);
  if (url.hostname!== 't.me' && url.hostname!== 'telegram.me') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0].toLowerCase()!== 'addstickers') return null;
  return decodeURIComponent(parts[1]);
 } catch { return null; }
}

async function telegramRequest(token, method, params = {}) {
 const url = `https://api.telegram.org/bot${token}/${method}`;
 const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
 let data;
 try { data = await res.json(); } catch { throw new Error(`Telegram invalid response HTTP ${res.status}`); }
 if (!data.ok) throw new Error(data.description || `Telegram API error ${data.error_code}`);
 return data.result;
}

async function downloadTelegramFile(token, fileId, outputPath) {
 const file = await telegramRequest(token, 'getFile', { file_id: fileId });
 if (!file?.file_path) throw new Error('Telegram no file_path');
 const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
 const res = await fetch(downloadUrl);
 if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);
 const buffer = Buffer.from(await res.arrayBuffer());
 fs.writeFileSync(outputPath, buffer);
 return buffer;
}

async function runFFmpeg(args) {
 try {
  await execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',...args], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
 } catch (e) {
  throw new Error(e?.stderr || e?.message || 'FFmpeg failed');
 }
}

async function convertStaticSticker(input, output) {
 await runFFmpeg(['-i', input, '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-compression_level', '6', '-preset', 'picture', output]);
}
async function convertVideoSticker(input, output) {
 await runFFmpeg(['-i', input, '-t', '3', '-an', '-vf', 'fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,format=rgba', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '65', '-compression_level', '6', '-loop', '0', output]);
}

module.exports = {
 name: 'tgstickers',
 aliases: ['tgsticker', 'telegramstickers'],
 execute: async (sock, m, args, ctx) => {
  const chatId = ctx?.chatId || m.key.remoteJid;
  const prefix = ctx?.prefix || '.';

  // GET TOKEN FROM ENV OR CONFIG
  const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || global.TELEGRAM_BOT_TOKEN || '').trim();

  if (!TELEGRAM_BOT_TOKEN) {
   return await sock.sendMessage(chatId, { text: `❌ *Telegram Token Missing*\n\nSet it in.env:\nTELEGRAM_BOT_TOKEN=your_token_here\n\nThen restart bot.` }, { quoted: m });
  }

  const packUrl = args?.[0];
  let amount = Number(args?.[1] || 1);
  if (!packUrl) {
   return await sock.sendMessage(chatId, { text: `❌ *Usage:*\n${prefix}tgstickers https://t.me/addstickers/PackName 5` }, { quoted: m });
  }
  if (!Number.isFinite(amount)) amount = 1;
  amount = Math.min(20, Math.max(1, Math.floor(amount)));

  const packName = parseStickerPackUrl(packUrl);
  if (!packName) {
   return await sock.sendMessage(chatId, { text: `❌ Invalid URL\nExample:\n${prefix}tgstickers https://t.me/addstickers/PackName 5` }, { quoted: m });
  }

  await sock.sendMessage(chatId, { text: `🔄 *SHADOWxMD V4*\n\n📦 Pack: ${packName}\n🎲 Amount: ${amount}\n⏳ Loading...` }, { quoted: m });

  try {
   await telegramRequest(TELEGRAM_BOT_TOKEN, 'getMe');
   const stickerSet = await telegramRequest(TELEGRAM_BOT_TOKEN, 'getStickerSet', { name: packName });
   if (!stickerSet?.stickers?.length) {
    return await sock.sendMessage(chatId, { text: `❌ No stickers in pack ${packName}` }, { quoted: m });
   }

   const selected = shuffle(stickerSet.stickers).slice(0, Math.min(amount, stickerSet.stickers.length));
   let sent = 0, failed = 0;

   for (let i = 0; i < selected.length; i++) {
    const sticker = selected[i];
    const isVideo = sticker.is_video;
    const isAnimated = sticker.is_animated;
    if (isAnimated) { failed++; continue; } // skip tgs for now (needs lottie)

    let orig = null, conv = null;
    try {
     orig = randomFile(`tg_${i}`, isVideo? 'webm' : 'webp');
     conv = randomFile(`wa_${i}`, 'webp');
     await downloadTelegramFile(TELEGRAM_BOT_TOKEN, sticker.file_id, orig);
     if (isVideo) await convertVideoSticker(orig, conv);
     else await convertStaticSticker(orig, conv);
     if (!fs.existsSync(conv) || fs.statSync(conv).size === 0) throw new Error('Empty output');
     const buf = fs.readFileSync(conv);
     await sock.sendMessage(chatId, { sticker: buf });
     sent++;
     if (i < selected.length - 1) await sleep(350);
    } catch (e) {
     failed++;
     console.log(`Sticker ${i} failed:`, e.message);
    } finally {
     safeDelete(orig); safeDelete(conv);
    }
   }

   await sock.sendMessage(chatId, { text: `✅ *Done*\n\n📦 ${packName}\n📤 Sent: ${sent}\n❌ Failed/Skipped: ${failed}\n\n> SHADOWxMD V4 😈👑` });

  } catch (e) {
   console.error(e);
   await sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: m });
  }
 }
};