module.exports = {

    name: 'translate',

    description: 'Translate text to another language',

    async execute(sock, message, args) {

        const chatId =
            message.key.remoteJid;

        try {

            /*
             * GET COMMAND
             */

            const command =
                message.command?.toLowerCase() ||
                'translate';

            /*
             * LANGUAGE MAP
             */

            const languages = {

                english: 'en',
                french: 'fr',
                spanish: 'es',
                german: 'de',
                italian: 'it',
                portuguese: 'pt',
                russian: 'ru',
                ukrainian: 'uk',
                arabic: 'ar',
                hausa: 'ha',
                yoruba: 'yo',
                igbo: 'ig',
                chinese: 'zh',
                japanese: 'ja',
                korean: 'ko',
                hindi: 'hi',
                turkish: 'tr',
                dutch: 'nl',
                polish: 'pl',
                swedish: 'sv',
                norwegian: 'no',
                danish: 'da',
                finnish: 'fi',
                greek: 'el',
                hebrew: 'he',
                persian: 'fa',
                urdu: 'ur',
                bengali: 'bn',
                indonesian: 'id',
                vietnamese: 'vi',
                thai: 'th',
                malay: 'ms'
            };

            /*
             * DEFAULT TARGET = ENGLISH
             */

            let targetLanguage = 'en';
            let languageName = 'English';

            /*
             * CHECK translatetoLANGUAGE
             */

            if (
                command.startsWith('translateto')
            ) {

                const requestedLanguage =
                    command
                        .slice('translateto'.length)
                        .toLowerCase();

                if (
                    !languages[requestedLanguage]
                ) {

                    await sock.sendMessage(
                        chatId,
                        {
                            react: {
                                text: '❌',
                                key: message.key
                            }
                        }
                    );

                    await sock.sendMessage(
                        chatId,
                        {
                            text:
`❌ Unknown language.

Examples:
.translatetofrench
.translatetoarabic
.translatetogerman
.translatetoh​ausa
.translatetoyoruba
.translatetoigbo`
                        }
                    );

                    return;
                }

                targetLanguage =
                    languages[requestedLanguage];

                languageName =
                    requestedLanguage
                        .charAt(0)
                        .toUpperCase() +
                    requestedLanguage.slice(1);
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

            if (
                !text &&
                quoted
            ) {

                if (
                    quoted.conversation
                ) {

                    text =
                        quoted.conversation.trim();

                } else if (
                    quoted.extendedTextMessage?.text
                ) {

                    text =
                        quoted.extendedTextMessage
                            .text
                            .trim();

                } else if (
                    quoted.imageMessage?.caption
                ) {

                    text =
                        quoted.imageMessage
                            .caption
                            .trim();

                } else if (
                    quoted.videoMessage?.caption
                ) {

                    text =
                        quoted.videoMessage
                            .caption
                            .trim();

                }
            }

            /*
             * CHECK TEXT
             */

            if (!text) {

                await sock.sendMessage(
                    chatId,
                    {
                        react: {
                            text: '❌',
                            key: message.key
                        }
                    }
                );

                await sock.sendMessage(
                    chatId,
                    {
                        text:
`❌ Please provide text to translate.

Examples:
.translate Hello
.translatetofrench Hello
.translatetoarabic Hello

Or reply to a message with .translate`
                    }
                );

                return;
            }

            /*
             * API LIMIT
             */

            if (
                Buffer.byteLength(
                    text,
                    'utf8'
                ) > 500
            ) {

                await sock.sendMessage(
                    chatId,
                    {
                        react: {
                            text: '❌',
                            key: message.key
                        }
                    }
                );

                await sock.sendMessage(
                    chatId,
                    {
                        text:
                            '❌ Text is too long. Please keep it under 500 bytes.'
                    }
                );

                return;
            }

            /*
             * STATUS
             */

            await sock.sendMessage(
                chatId,
                {
                    text:
                        `🌍 Translating to ${languageName}...`
                }
            );

            /*
             * MYMEMORY API
             *
             * Auto-detect source:
             * langpair=autodetect|target
             */

            const url =
                'https://api.mymemory.translated.net/get?' +
                new URLSearchParams({
                    q: text,
                    langpair:
                        `autodetect|${targetLanguage}`,
                    mt: '1'
                }).toString();

            const response =
                await fetch(url);

            const data =
                await response.json();

            /*
             * CHECK HTTP ERROR
             */

            if (
                !response.ok
            ) {

                throw new Error(
                    `Translation API returned ${response.status}`
                );
            }

            /*
             * CHECK API RESPONSE
             */

            const translated =
                data?.responseData?.translatedText;

            if (
                !translated
            ) {

                throw new Error(
                    data?.responseStatus ||
                    'No translation was returned.'
                );
            }

            /*
             * SUCCESS
             */

            await sock.sendMessage(
                chatId,
                {
                    react: {
                        text: '✅',
                        key: message.key
                    }
                }
            );

            await sock.sendMessage(
                chatId,
                {
                    text:
`╭━━━〔 🌍 TRANSLATOR 〕━━━╮
┃
┃   🎯 To: ${languageName}
┃
┃   📝 Original:
┃   ${text}
┃
┃   🔤 Translation:
┃   ${translated}
┃
╰━━━━━━━━━━━━━━━━━━━━╯`
                }
            );

            console.log(
                `[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Translated to ${languageName}: ${translated}`
            );

        } catch (error) {

            console.error(
                '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] .translate error:',
                error
            );

            try {

                await sock.sendMessage(
                    chatId,
                    {
                        react: {
                            text: '❌',
                            key: message.key
                        }
                    }
                );

            } catch {}

            try {

                await sock.sendMessage(
                    chatId,
                    {
                        text:
                            `❌ Translation failed.\n\n${error.message}`
                    }
                );

            } catch {}

        }

    }

};