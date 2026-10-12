import { config } from './config.js';

export async function handleMessage(sock, msg) {
  try {
    const jid = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
    if (!text.startsWith(config.prefix || '.')) return;

    const [cmd, ...args] = text.slice((config.prefix || '.').length).trim().split(/ +/);
    const command = cmd.toLowerCase();

    // VV SAVE COMMAND
    if (command === 'vvsave') {
      const { default: vvCommand } = await import('./commands/vv.js');
      return await vvCommand(sock, msg, args);
    }

    // ADD YOUR OTHER COMMANDS HERE
    // if (command === 'ping') { ... }

  } catch (e) {
    console.log('handler error', e.message);
  }
}