const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GOODBYE_FILE = path.join(DATA_DIR, 'goodbye.json');

function loadGoodbyeData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(GOODBYE_FILE)) {
      fs.writeFileSync(
        GOODBYE_FILE,
        JSON.stringify({}, null, 2)
      );
    }

    return JSON.parse(
      fs.readFileSync(GOODBYE_FILE, 'utf8')
    );

  } catch (error) {
    console.error(
      '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Goodbye data error:',
      error
    );

    return {};
  }
}

function saveGoodbyeData(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(
    GOODBYE_FILE,
    JSON.stringify(data, null, 2)
  );
}

module.exports = {
  name: 'goodbye',

  description: 'Manage group goodbye messages',

  async execute(sock, message, args) {

    try {

      const chatId =
        message.key.remoteJid;

      // -----------------------------------------
      // CHECK GROUP
      // -----------------------------------------

      if (!chatId || !chatId.endsWith('@g.us')) {

        return await sock.sendMessage(chatId, {
          text:
            '❌ This command can only be used in groups.'
        });

      }

      // -----------------------------------------
      // GET GROUP
      // -----------------------------------------

      const groupMetadata =
        await sock.groupMetadata(chatId);

      const participants =
        groupMetadata.participants || [];

      // -----------------------------------------
      // FIND BOT
      // -----------------------------------------

      const botNumbers = [];

      if (sock.user?.id) {
        botNumbers.push(
          sock.user.id
            .split(':')[0]
            .split('@')[0]
        );
      }

      if (sock.user?.lid) {
        botNumbers.push(
          sock.user.lid
            .split(':')[0]
            .split('@')[0]
        );
      }

      function cleanNumber(value) {
        return String(value || '')
          .replace(/\D/g, '');
      }

      function getNumberFromJid(jid) {

        if (!jid) return '';

        return cleanNumber(
          jid
            .split('@')[0]
            .split(':')[0]
        );
      }

      const botParticipant =
        participants.find(participant =>
          botNumbers.includes(
            getNumberFromJid(
              participant.id
            )
          )
        );

      // -----------------------------------------
      // CHECK ADMIN
      // -----------------------------------------

      const botIsAdmin =
        botParticipant?.admin === 'admin' ||
        botParticipant?.admin === 'superadmin';

      if (!botIsAdmin) {

        return await sock.sendMessage(chatId, {
          text:
            '❌ I need to be an admin to manage goodbye messages.'
        });

      }

      // -----------------------------------------
      // LOAD SETTINGS
      // -----------------------------------------

      const data =
        loadGoodbyeData();

      if (!data[chatId]) {

        data[chatId] = {
          enabled: false,
          message:
            'Goodbye {user}, we will miss you from {group}! 👋'
        };

      }

      // -----------------------------------------
      // NO ARGUMENT
      // -----------------------------------------

      if (!args[0]) {

        const status =
          data[chatId].enabled
            ? '🟢 ON'
            : '🔴 OFF';

        return await sock.sendMessage(chatId, {
          text:
            `👋 GOODBYE SYSTEM\n\n` +
            `Status: ${status}\n\n` +
            `Placeholders:\n` +
            `{user} = member tag\n` +
            `{group} = group name\n\n` +
            `Commands:\n` +
            `.goodbye on\n` +
            `.goodbye off\n` +
            `.goodbye set Your message`
        });

      }

      const action =
        args[0].toLowerCase();

      // -----------------------------------------
      // GOODBYE ON
      // -----------------------------------------

      if (action === 'on') {

        data[chatId].enabled = true;

        saveGoodbyeData(data);

        return await sock.sendMessage(chatId, {
          text:
            '👋 GOODBYE SYSTEM ENABLED\n\n' +
            '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ will now say goodbye when members leave.'
        });

      }

      // -----------------------------------------
      // GOODBYE OFF
      // -----------------------------------------

      if (action === 'off') {

        data[chatId].enabled = false;

        saveGoodbyeData(data);

        return await sock.sendMessage(chatId, {
          text:
            '🔕 GOODBYE SYSTEM DISABLED\n\n' +
            'No goodbye messages will be sent.'
        });

      }

      // -----------------------------------------
      // SET CUSTOM MESSAGE
      // -----------------------------------------

      if (action === 'set') {

        const customMessage =
          args
            .slice(1)
            .join(' ')
            .trim();

        if (!customMessage) {

          return await sock.sendMessage(chatId, {
            text:
              '❌ Please provide a goodbye message.\n\n' +
              'Example:\n' +
              '.goodbye set Goodbye {user}, we will miss you from {group}! 👋'
          });

        }

        data[chatId].message =
          customMessage;

        saveGoodbyeData(data);

        return await sock.sendMessage(chatId, {
          text:
            '✅ CUSTOM GOODBYE MESSAGE SAVED\n\n' +
            customMessage
        });

      }

      // -----------------------------------------
      // UNKNOWN OPTION
      // -----------------------------------------

      return await sock.sendMessage(chatId, {
        text:
          '❌ Unknown goodbye option.\n\n' +
          'Use:\n' +
          '.goodbye on\n' +
          '.goodbye off\n' +
          '.goodbye set Your message'
      });

    } catch (error) {

      console.error(
        '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Goodbye error:',
        error
      );

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text:
            '❌ Goodbye command failed.\n\n' +
            `Error: ${error.message}`
        }
      );

    }
  }
};