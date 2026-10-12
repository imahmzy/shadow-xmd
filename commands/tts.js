const { EdgeTTS } = require('@andresaya/edge-tts');
const fs = require('fs');
const path = require('path');

module.exports = {

  name: 'tts',

  aliases: [
    'ttsmale',
    'ttsfemale'
  ],

  description: 'Convert text to speech',

  async execute(sock, message, args) {

    const chatId = message.key.remoteJid;

    let audioFile = null;

    try {

      /*
       * GET COMMAND
       */

      const command =
        message.command?.toLowerCase() || 'tts';

      /*
       * SELECT VOICE
       */

      let voice;

      if (command === 'ttsfemale') {

        voice = 'en-US-JennyNeural';

      } else {

        // .tts and .ttsmale

        voice = 'en-US-GuyNeural';

      }

      /*
       * GET TEXT
       */

      let text =
        Array.isArray(args)
          ? args.join(' ').trim()
          : '';

      /*
       * GET QUOTED MESSAGE
       */

      const context =
        message.message
          ?.extendedTextMessage
          ?.contextInfo;

      const quoted =
        context?.quotedMessage;

      /*
       * READ QUOTED TEXT
       */

      if (!text && quoted) {

        if (quoted.conversation) {

          text =
            quoted.conversation.trim();

        } else if (
          quoted.extendedTextMessage?.text
        ) {

          text =
            quoted.extendedTextMessage.text.trim();

        } else if (
          quoted.imageMessage?.caption
        ) {

          text =
            quoted.imageMessage.caption.trim();

        } else if (
          quoted.videoMessage?.caption
        ) {

          text =
            quoted.videoMessage.caption.trim();

        }

      }

      /*
       * CHECK TEXT
       */

      if (!text) {

        await sock.sendMessage(
          chatId,
          {
            text:
              '❌ Give me some text to speak.\n\n' +
              'Examples:\n' +
              '.tts Hello everyone\n' +
              '.ttsmale Hello everyone\n' +
              '.ttsfemale Hello everyone\n\n' +
              'You can also reply to a message with .tts'
          }
        );

        return;
      }

      /*
       * TEXT LIMIT
       */

      if (text.length > 500) {

        await sock.sendMessage(
          chatId,
          {
            text:
              '❌ Text is too long.\n\n' +
              'Maximum: 500 characters.'
          }
        );

        return;
      }

      /*
       * VOICE NAME
       */

      const voiceName =
        command === 'ttsfemale'
          ? 'female'
          : 'male';

      /*
       * STATUS
       */

      await sock.sendMessage(
        chatId,
        {
          text:
            `🔊 Generating ${voiceName} voice...`
        }
      );

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

      /*
       * UNIQUE FILE NAME
       *
       * IMPORTANT:
       * Do NOT include .mp3 here.
       * EdgeTTS adds the extension itself.
       */

      const id =
        `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      const outputBase =
        path.join(
          tempDir,
          `tts_${id}`
        );

      /*
       * FINAL FILE
       */

      audioFile =
        `${outputBase}.mp3`;

      /*
       * CREATE EDGE TTS
       */

      const tts =
        new EdgeTTS();

      /*
       * GENERATE SPEECH
       */

      await tts.synthesize(
        text,
        voice,
        {
          rate: '+0%',
          volume: '+0%',
          pitch: '+0Hz',
          outputFormat:
            'audio-24khz-96kbitrate-mono-mp3'
        }
      );

      /*
       * CHECK GENERATED AUDIO
       */

      const audioBuffer =
        tts.toBuffer();

      if (
        !audioBuffer ||
        audioBuffer.length === 0
      ) {

        throw new Error(
          'Edge TTS returned no audio data.'
        );

      }

      console.log(
        `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] TTS audio generated: ${audioBuffer.length} bytes`
      );

      /*
       * SAVE AUDIO DIRECTLY
       */

      fs.writeFileSync(
        audioFile,
        audioBuffer
      );

      /*
       * CHECK FILE
       */

      if (
        !fs.existsSync(audioFile) ||
        fs.statSync(audioFile).size === 0
      ) {

        throw new Error(
          'The generated audio file is empty.'
        );

      }

      console.log(
        `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] TTS voice: ${voice}`
      );

      console.log(
        `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] TTS file: ${audioFile}`
      );

      /*
       * SEND AUDIO
       */

      await sock.sendMessage(
        chatId,
        {
          audio:
            fs.readFileSync(
              audioFile
            ),

          mimetype:
            'audio/mpeg',

          fileName:
            `𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ-${voiceName}.mp3`
        }
      );

      console.log(
        '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] TTS sent successfully.'
      );

    } catch (error) {

      console.error(
        '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] TTS ERROR:',
        error
      );

      try {

        await sock.sendMessage(
          chatId,
          {
            text:
              `❌ TTS failed.\n\n${error.message}`
          }
        );

      } catch {}

    } finally {

      /*
       * CLEAN TEMP FILE
       */

      if (audioFile) {

        try {

          if (fs.existsSync(audioFile)) {

            fs.unlinkSync(
              audioFile
            );

          }

        } catch {}

      }

    }

  }

};