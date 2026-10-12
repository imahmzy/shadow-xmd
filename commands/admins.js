module.exports = {
    name: 'admins',
    description: 'Show the group administrators',

    async execute(sock, message, args) {
        const jid = message.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            await sock.sendMessage(jid, {
                text: '❌ This command can only be used in a group.'
            });
            return;
        }

        try {
            const metadata = await sock.groupMetadata(jid);

            const admins = metadata.participants.filter(
                participant =>
                    participant.admin === 'admin' ||
                    participant.admin === 'superadmin'
            );

            if (admins.length === 0) {
                await sock.sendMessage(jid, {
                    text: '❌ No group admins found.'
                });
                return;
            }

            let text =
`╭━━━〔 👑 GROUP ADMINS 〕━━━╮
┃
`;

            const mentions = [];

            for (const admin of admins) {
                mentions.push(admin.id);

                text += `┃ 👑 @${admin.id.split('@')[0]}\n`;
            }

            text +=
`┃
╰━━━━━━━━━━━━━━━━━━━━╯
>  𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3`;

            await sock.sendMessage(jid, {
                text,
                mentions
            });

        } catch (error) {
            console.error(
                '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Admins error:',
                error
            );

            await sock.sendMessage(jid, {
                text: '❌ Failed to get group admins.'
            });
        }
    }
};