const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

module.exports = {

  name: 'tovid',

  description: 'Convert a sticker to a video',

  async execute(sock, message) {

    const chatId = message.key.remoteJid;

    let inputFile = null;
    let outputFile = null;

    try {

      /*
       * GET QUOTED MESSAGE
       */

      const quoted =
        message.message?.extendedTextMessage
          ?.contextInfo
          ?.quotedMessage;

      if (!quoted) {

        return await sock.sendMessage(
          chatId,
          {
            text:
              '❌ Reply to a sticker with .tovid'
          }
        );

      }

      /*
       * CHECK STICKER
       */

      if (!quoted.stickerMessage) {

        return await sock.sendMessage(
          chatId,
          {
            text:
              '❌ That is not a sticker.'
          }
        );

      }

      /*
       * DOWNLOAD STICKER
       */

      const stream =
        await downloadContentFromMessage(
          quoted.stickerMessage,
          'sticker'
        );

      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer =
        Buffer.concat(chunks);

      /*
       * TEMP DIRECTORY
       */

      const tempDir =
        path.join(
          __dirname,
          '..',
          'temp'
        );

      if (!fs.existsSync(tempDir)) {

        fs.mkdirSync(
          tempDir,
          {
            recursive: true
          }
        );

      }

      const timestamp = Date.now();

      inputFile =
        path.join(
          tempDir,
          `sticker_${timestamp}.webp`
        );

      outputFile =
        path.join(
          tempDir,
          `video_${timestamp}.mp4`
        );

      fs.writeFileSync(
        inputFile,
        buffer
      );

      /*
       * FFMPEG
       */

      const ffmpegPath =
        'C:\\ffmpeg\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';

      /*
       * CONVERT WEBP → MP4
       *
       * -loop 0       = keep animated sticker looping
       * -t 10         = maximum 10 seconds
       * -vf           = scale to even dimensions
       * libx264       = H.264 video
       * yuv420p       = WhatsApp-compatible format
       */

      await new Promise((resolve, reject) => {

        execFile(
          ffmpegPath,
          [
            '-y',
            '-i',
            inputFile,

            '-t',
            '10',

            '-vf',
            'scale=trunc(iw/2)*2:trunc(ih/2)*2',

            '-c:v',
            'libx264',

            '-pix_fmt',
            'yuv420p',

            '-movflags',
            '+faststart',

            outputFile

          ],
          {
            windowsHide: true
          },
          (error, stdout, stderr) => {

            if (error) {

              console.error(
                '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] FFmpeg error:',
                stderr
              );

              return reject(error);

            }

            resolve();

          }
        );

      });

      /*
       * CHECK OUTPUT
       */

      if (
        !fs.existsSync(outputFile) ||
        fs.statSync(outputFile).size === 0
      ) {

        throw new Error(
          'FFmpeg produced no video.'
        );

      }

      /*
       * SEND VIDEO
       */

      await sock.sendMessage(
        chatId,
        {
          video:
            fs.readFileSync(
              outputFile
            ),

          mimetype:
            'video/mp4',

          caption:
            '🎬 Converted to video by 𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ'
        }
      );

      /*
       * CLEAN UP
       */

      try {
        if (inputFile) {
          fs.unlinkSync(inputFile);
        }
      } catch {}

      try {
        if (outputFile) {
          fs.unlinkSync(outputFile);
        }
      } catch {}

    } catch (error) {

      console.error(
        '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] .tovid error:',
        error
      );

      /*
       * CLEAN TEMP FILES
       */

      try {
        if (inputFile && fs.existsSync(inputFile)) {
          fs.unlinkSync(inputFile);
        }
      } catch {}

      try {
        if (outputFile && fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile);
        }
      } catch {}

      await sock.sendMessage(
        chatId,
        {
          text:
            '❌ Failed to convert the sticker to a video.'
        }
      );

    }

  }

};