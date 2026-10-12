const https = require('https');

module.exports = {
    name: 'define',
    description: 'Get the definition of a word',

    async execute(sock, message, args) {
        const chatId = message.key.remoteJid;

        // ============================================================
        // CHECK WORD
        // ============================================================

        if (!args || !args.length) {
            return sock.sendMessage(chatId, {
                text: '❌ Usage: .define <word>'
            });
        }

        const word = args.join(' ').trim();

        if (!word) {
            return sock.sendMessage(chatId, {
                text: '❌ Please provide a word.'
            });
        }

        // ============================================================
        // HTTPS GET
        // ============================================================

        function httpsGet(url, timeout = 5000) {
            return new Promise((resolve, reject) => {

                const request = https.get(
                    url,
                    {
                        headers: {
                            'User-Agent': '𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ-V3/1.0',
                            'Accept': 'application/json'
                        }
                    },
                    response => {

                        let body = '';

                        response.on('data', chunk => {
                            body += chunk;
                        });

                        response.on('end', () => {

                            if (
                                response.statusCode < 200 ||
                                response.statusCode >= 300
                            ) {
                                return reject(
                                    new Error(`HTTP ${response.statusCode}`)
                                );
                            }

                            try {
                                resolve(JSON.parse(body));
                            } catch {
                                reject(
                                    new Error('Invalid JSON response')
                                );
                            }
                        });
                    }
                );

                request.setTimeout(timeout, () => {
                    request.destroy();
                    reject(new Error('Request timed out'));
                });

                request.on('error', error => {
                    reject(error);
                });
            });
        }

        // ============================================================
        // PRIMARY API
        // ============================================================

        async function primaryDictionary(word) {

            const url =
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

            const data = await httpsGet(url, 3000);

            if (!Array.isArray(data) || !data.length) {
                throw new Error('No result');
            }

            const entry = data[0];

            const meanings = [];

            for (const meaning of entry.meanings || []) {

                for (const definition of meaning.definitions || []) {

                    if (!definition.definition) continue;

                    meanings.push({
                        partOfSpeech: meaning.partOfSpeech || '',
                        definition: definition.definition,
                        example: definition.example || ''
                    });

                    if (meanings.length >= 5) break;
                }

                if (meanings.length >= 5) break;
            }

            if (!meanings.length) {
                throw new Error('No definitions found');
            }

            let phonetic = entry.phonetic || '';

            if (!phonetic && Array.isArray(entry.phonetics)) {
                const phoneticItem = entry.phonetics.find(
                    item => item.text
                );

                if (phoneticItem) {
                    phonetic = phoneticItem.text;
                }
            }

            return {
                word: entry.word || word,
                phonetic,
                meanings
            };
        }

        // ============================================================
        // FALLBACK API
        // ============================================================

        async function fallbackDictionary(word) {

            const url =
                `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`;

            const data = await httpsGet(url, 5000);

            if (!data || !Array.isArray(data.entries)) {
                throw new Error('Invalid fallback response');
            }

            const meanings = [];

            for (const entry of data.entries) {

                const partOfSpeech =
                    entry.partOfSpeech || '';

                // ----------------------------------------
                // FreeDictionaryAPI uses senses[]
                // ----------------------------------------

                for (const sense of entry.senses || []) {

                    if (!sense.definition) continue;

                    meanings.push({
                        partOfSpeech,
                        definition: sense.definition,
                        example: sense.example || ''
                    });

                    if (meanings.length >= 5) break;
                }

                if (meanings.length >= 5) break;
            }

            if (!meanings.length) {
                throw new Error('No fallback definitions found');
            }

            let phonetic = '';

            for (const entry of data.entries) {

                if (
                    Array.isArray(entry.pronunciations) &&
                    entry.pronunciations.length
                ) {
                    const pronunciation =
                        entry.pronunciations.find(
                            p => p.text
                        );

                    if (pronunciation) {
                        phonetic = pronunciation.text;
                        break;
                    }
                }
            }

            return {
                word: data.word || word,
                phonetic,
                meanings
            };
        }

        // ============================================================
        // GET DEFINITION
        // ============================================================

        let result = null;

        try {

            result = await primaryDictionary(word);

            console.log(
                `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Primary dictionary succeeded: ${word}`
            );

        } catch (primaryError) {

            console.log(
                `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Primary dictionary error: ${primaryError.message}`
            );

            try {

                result = await fallbackDictionary(word);

                console.log(
                    `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Fallback dictionary succeeded: ${word}`
                );

            } catch (fallbackError) {

                console.log(
                    `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Fallback dictionary error: ${fallbackError.message}`
                );

                return sock.sendMessage(chatId, {
                    text:
                        `❌ *Definition unavailable*\n\n` +
                        `I couldn't retrieve a definition for *${word}* right now.\n\n` +
                        `> Try again in a few seconds.`
                });
            }
        }

        // ============================================================
        // BUILD RESPONSE
        // ============================================================

        let response =
            `╭━━━〔 *𝔻𝔼𝔽𝕀ℕ𝔼* 〕━━━╮\n` +
            `┃\n` +
            `┃  *Word:* ${result.word}\n`;

        if (result.phonetic) {
            response +=
                `┃  *Pronunciation:* ${result.phonetic}\n`;
        }

        response += `┃\n`;

        result.meanings.forEach((item, index) => {

            response +=
                `┃  *${index + 1}.* `;

            if (item.partOfSpeech) {
                response += `_${item.partOfSpeech}_ `;
            }

            response += `${item.definition}\n`;

            if (item.example) {
                response +=
                    `┃     ↳ _Example:_ ${item.example}\n`;
            }

            response += `┃\n`;
        });

        response +=
            `╰━━━━━━━━━━━━━━━━━━╯\n` +
            `> SHADOW REIGNS SUPREME😈👑`;

        // ============================================================
        // SEND
        // ============================================================

        await sock.sendMessage(chatId, {
            text: response
        });

        // ============================================================
        // REACTION
        // ============================================================

        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: '✅',
                    key: message.key
                }
            });
        } catch {}
    }
};