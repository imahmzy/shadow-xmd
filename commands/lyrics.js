module.exports = {
  name: 'lyrics',
  aliases: ['lyric','liriks'],
  execute: async (sock, m, args, ctx) => {
    const { chatId } = ctx;
    const query = args.join(' ').trim();
    if (!query) return sock.sendMessage(chatId, { text: `> ❌ Usage:.lyrics <song name>\nExample:.lyrics Olamide Infinity` }, { quoted: m });

    try {
      await sock.sendMessage(chatId, { text: `> 🔍 Finding lyrics for: *${query}*...` }, { quoted: m });

      // Try lyrics.ovh API (no key needed)
      const searchUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(query.split('-')[0]?.trim() || 'unknown')}/${encodeURIComponent(query.split('-')[1]?.trim() || query)}`;

      // Better: use genius via some public API
      let lyricsText = null;
      try {
        const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(query)}/${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.lyrics) lyricsText = data.lyrics;
      } catch {}

      // Fallback 1: try with better parsing
      if (!lyricsText) {
        try {
          // Try searching as single query - use lrclib API
          const res2 = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
          const data2 = await res2.json();
          if (data2 && data2[0] && data2[0].plainLyrics) {
            lyricsText = data2[0].plainLyrics;
            const track = data2[0];
            const header = `╭─〔 *LYRICS FOUND* 〕─\n│ 🎵 ${track.trackName} - ${track.artistName}\n│ 💿 ${track.albumName || 'Single'}\n╰───────────────\n\n`;
            lyricsText = header + lyricsText;
          }
        } catch {}
      }

      // Fallback 2: use genius scraping via API
      if (!lyricsText) {
        try {
          const res3 = await fetch(`https://some-random-api.com/others/lyrics?title=${encodeURIComponent(query)}`);
          const data3 = await res3.json();
          if (data3.lyrics) lyricsText = `╭─〔 *${data3.title} - ${data3.author}* 〕─\n\n${data3.lyrics}`;
        } catch {}
      }

      if (!lyricsText) {
        return sock.sendMessage(chatId, { text: `> ❌ Lyrics not found for *${query}*\n> Try:.lyrics Artist - Title\n> Example:.lyrics Burna Boy - Ye` }, { quoted: m });
      }

      // Trim if too long for WhatsApp (max ~ 6000 chars)
      if (lyricsText.length > 5000) {
        lyricsText = lyricsText.slice(0, 5000) + '\n\n... (trimmed)';
      }

      await sock.sendMessage(chatId, { text: `${lyricsText}\n\n> sʜᴀᴅᴏᴡˣᵐᵈ ᐯ⁴ |.play ${query}` }, { quoted: m });

    } catch (e) {
      console.log(`[LYRICS FAILED] ${e.message}`);
      return sock.sendMessage(chatId, { text: `> ❌ Error: ${e.message.slice(0,200)}` }, { quoted: m });
    }
  }
}