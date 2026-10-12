const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WELCOME_FILE = path.join(DATA_DIR, 'welcome.json');

function loadWelcomeData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(WELCOME_FILE)) {
      fs.writeFileSync(
        WELCOME_FILE,
        JSON.stringify({}, null, 2)
      );
    }

    return JSON.parse(
      fs.readFileSync(WELCOME_FILE, 'utf8')
    );
  } catch (error) {
    console.error(
      '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Welcome data error:',
      error
    );

    return {};
  }
}

function saveWelcomeData(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(
    WELCOME_FILE,
    JSON.stringify(data, null, 2)
  );
}

module.exports = {
  name: 'welcome',

  description: 'Manage group welcome messages',

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;

      if (!chatId || !chatId.endsWith('@g.us')) {
        return await sock.sendMessage(chatId, {
          text: '❌ This command can only be used in groups.'
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
          sock.user.id.split(':')[0].split('@')[0]
        );
      }

      if (sock.user?.lid) {
        botNumbers.push(
          sock.user.lid.split(':')[0].split('@')[0]
        );
      }

      function cleanNumber(value) {
        return String(value || '').replace(/\D/g, '');
      }

      function getNumberFromJid(jid) {
        if (!jid) return '';

        return cleanNumber(
          jid.split('@')[0].split(':')[0]
        );
      }

      const botParticipant =
        participants.find(participant =>
          botNumbers.includes(
            getNumberFromJid(participant.id)
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
            '❌ I need to be an admin to manage welcome messages.'
        });
      }

      // -----------------------------------------
      // LOAD DATA
      // -----------------------------------------

      const data = loadWelcomeData();

      if (!data[chatId]) {
        data[chatId] = {
          enabled: false,
          message: 'Hey {user}, welcome to {group}! 👋'
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
            `👋 WELCOME SYSTEM\n\n` +
            `Status: ${status}\n\n` +
            `Default placeholders:\n` +
            `{user} = tagged member\n` +
            `{group} = group name\n\n` +
            `Commands:\n` +
            `.welcome on\n` +
            `.welcome off\n` +
            `.welcome set Your message here`
        });
      }

      const action =
        args[0].toLowerCase();

      // -----------------------------------------
      // WELCOME ON
      // -----------------------------------------

      if (action === 'on') {
        data[chatId].enabled = true;

        saveWelcomeData(data);

        return await sock.sendMessage(chatId, {
          text:
            '👋 WELCOME SYSTEM ENABLED\n\n' +
            'New members will now be welcomed automatically.'
        });
      }

      // -----------------------------------------
      // WELCOME OFF
      // -----------------------------------------

      if (action === 'off') {
        data[chatId].enabled = false;

        saveWelcomeData(data);

        return await sock.sendMessage(chatId, {
          text:
            '🔕 WELCOME SYSTEM DISABLED\n\n' +
            'New members will no longer receive welcome messages.'
        });
      }

      // -----------------------------------------
      // SET CUSTOM MESSAGE
      // -----------------------------------------

      if (action === 'set') {
        const customMessage =
          args.slice(1).join(' ').trim();

        if (!customMessage) {
          return await sock.sendMessage(chatId, {
            text:
              '❌ Please provide a welcome message.\n\n' +
              'Example:\n' +
              '.welcome set Hey {user}, welcome to {group}! 👋'
          });
        }

        data[chatId].message =
          customMessage;

        saveWelcomeData(data);

        return await sock.sendMessage(chatId, {
          text:
            '✅ CUSTOM WELCOME MESSAGE SAVED\n\n' +
            customMessage
        });
      }

      // -----------------------------------------
      // UNKNOWN OPTION
      // -----------------------------------------

      return await sock.sendMessage(chatId, {
        text:
          '❌ Unknown welcome option.\n\n' +
          'Use:\n' +
          '.welcome on\n' +
          '.welcome off\n' +
          '.welcome set Your message'
      });

    } catch (error) {
      console.error(
        '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Welcome error:',
        error
      );

      await sock.sendMessage(message.key.remoteJid, {
        text:
          '❌ Welcome command failed.\n\n' +
          `Error: ${error.message}`
      });
    }
  }
};