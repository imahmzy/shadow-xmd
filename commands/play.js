const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

const YTDLP_PATH = path.join(__dirname, '..', 'YTDLP.exe');
const FFMPEG_DIR = path.join(__dirname, '..'); // ffmpeg.exe dey for same root
const TEMP_DIR = path.join(__dirname, '..', 'temp');

module.exports = {
  name: 'play',
  aliases: ['song','music','yta'],
  execute: async (sock, m, args, ctx) => {
    const { chatId } = ctx;
    const query = args.join(' ').trim();
    if (!query) return sock.sendMessage(chatId, { text: `> ❌ Usage: .play <song name>\nExample: .play Olamide - Infinity` }, { quoted: m });

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    if (!fs.existsSync(YTDLP_PATH)) return sock.sendMessage(chatId, { text: `> ❌ YTDLP.exe not found` }, { quoted: m });

    try {
      await sock.sendMessage(chatId, { text: `> 🔍 Searching: *${query}*...` }, { quoted: m });

      // 1. Search - escape quotes properly
      const cleanQuery = query.replace(/"/g, '').replace(/`/g, '');
      const searchCmd = `"${YTDLP_PATH}" "ytsearch1:${cleanQuery}" --print title --print id --print duration_string --no-playlist --no-warnings --skip-download`;

      let title = query, videoId = '', duration = '';
      try {
        const { stdout } = await execAsync(searchCmd, { timeout: 30000 });
        const lines = stdout.trim().split('\n').filter(Boolean);
        title = lines[0] || query;
        videoId = lines[1] || '';
        duration = lines[2] || '';
      } catch (e) {
        console.log('Search error:', e.message);
        return sock.sendMessage(chatId, { text: `> ❌ Search failed: ${e.message.slice(0,150)}` }, { quoted: m });
      }

      if (!videoId) return sock.sendMessage(chatId, { text: `> ❌ No results for ${query}` }, { quoted: m });

      const url = `https://www.youtube.com/watch?v=${videoId}`;
      await sock.sendMessage(chatId, { text: `> ⬇️ Downloading: *${title}*\n> ⏱️ ${duration}\n> 🔗 ${url}` }, { quoted: m });

      // 2. Download with ffmpeg-location fix
      const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 25) || 'song';
      const timestamp = Date.now();
      const outputTemplate = path.join(TEMP_DIR, `${timestamp}_${safeTitle}.%(ext)s`);

      const downloadCmd = `"${YTDLP_PATH}" --ffmpeg-location "${FFMPEG_DIR}" -x --audio-format mp3 --audio-quality 192K -o "${outputTemplate}" --no-playlist --no-warnings --no-mtime "${url}"`;

      console.log('DL CMD:', downloadCmd);
      await execAsync(downloadCmd, { timeout: 180000 });

      // Find file by timestamp - more accurate
      const files = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(String(timestamp))).sort((a,b) => fs.statSync(path.join(TEMP_DIR,b)).mtimeMs - fs.statSync(path.join(TEMP_DIR,a)).mtimeMs);
      const mp3File = files[0] ? path.join(TEMP_DIR, files[0]) : null;

      if (!mp3File || !fs.existsSync(mp3File)) {
        return sock.sendMessage(chatId, { text: `> ❌ Download failed - file not found. Check console.` }, { quoted: m });
      }

      // 3. Send
      await sock.sendMessage(chatId, {
        audio: fs.readFileSync(mp3File),
        mimetype: 'audio/mpeg',
        fileName: `${safeTitle}.mp3`,
        ptt: false
      }, { quoted: m });

      await sock.sendMessage(chatId, {
        text: `╭─〔 *MUSIC* 〕─\n│ 🎵 *${title}*\n│ ⏱️ ${duration}\n│ 🔗 ${url}\n╰───────────────\n> sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴`
      }, { quoted: m });

      setTimeout(() => {
        try { if (fs.existsSync(mp3File)) fs.unlinkSync(mp3File); } catch {}
      }, 30000);

    } catch (e) {
      console.log(`[PLAY FAILED]`, e);
      const errMsg = (e.stderr || e.message || 'Unknown').slice(0,400);
      return sock.sendMessage(chatId, { text: `> ❌ Error:\n${errMsg}` }, { quoted: m });
    }
  }
}