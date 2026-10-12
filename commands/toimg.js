const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

module.exports = {

  name: 'toimg',

  description: 'Convert a sticker to an image',

  async execute(sock, message) {

    try {

      const chatId =
        message.key.remoteJid;

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
              '❌ Reply to a sticker with .toimg'
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

      for await (
        const chunk of stream
      ) {

        chunks.push(chunk);

      }

      const buffer =
        Buffer.concat(chunks);

      /*
       * TEMP FILE
       */

      const tempDir =
        path.join(
          __dirname,
          '..',
          'temp'
        );

      if (
        !fs.existsSync(tempDir)
      ) {

        fs.mkdirSync(
          tempDir,
          {
            recursive: true
          }
        );

      }

      const inputFile =
        path.join(
          tempDir,
          `sticker_${Date.now()}.webp`
        );

      const outputFile =
        path.join(
          tempDir,
          `image_${Date.now()}.png`
        );

      fs.writeFileSync(
        inputFile,
        buffer
      );

      /*
       * USE SHARP
       */

      let sharp;

      try {

        sharp =
          require('sharp');

      } catch {

        await sock.sendMessage(
          chatId,
          {
            text:
              '❌ Sharp is not installed.\n\nRun:\nnpm install sharp'
          }
        );

        return;

      }

      /*
       * CONVERT WEBP → PNG
       */

      await sharp(inputFile)
        .png()
        .toFile(outputFile);

      /*
       * SEND IMAGE
       */

      await sock.sendMessage(
        chatId,
        {
          image:
            fs.readFileSync(
              outputFile
            ),
          caption:
            '🖼️ Converted to image by 𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ'
        }
      );

      /*
       * CLEAN UP
       */

      try {
        fs.unlinkSync(inputFile);
      } catch {}

      try {
        fs.unlinkSync(outputFile);
      } catch {}

    } catch (error) {

      console.error(
        '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] .toimg error:',
        error
      );

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text:
            '❌ Failed to convert the sticker to an image.'
        }
      );

    }

  }

};