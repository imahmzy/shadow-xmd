module.exports = {
    name: 'groupinfo',
    description: 'Show group information',

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
            const participants = metadata.participants || [];

            const admins = participants.filter(
                participant =>
                    participant.admin === 'admin' ||
                    participant.admin === 'superadmin'
            );

            const owner = metadata.owner
                ? `@${metadata.owner.split('@')[0]}`
                : 'Unknown';

            const creationDate = metadata.creation
                ? new Date(metadata.creation * 1000).toLocaleString()
                : 'Unknown';

            const description =
                metadata.desc || 'No group description';

            // Get group invite link
            let groupLink = 'Unable to generate link';

            try {
                const code = await sock.groupInviteCode(jid);

                if (code) {
                    groupLink =
                        `https://chat.whatsapp.com/${code}`;
                }
            } catch (linkError) {
                console.log(
                    '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Could not get group link:',
                    linkError.message
                );
            }

            const text =
`╭━━━〔 🖤 GROUP INFO 〕━━━╮
┃
┃ 📛 Name:
┃ ${metadata.subject}
┃
┃ 👥 Members:
┃ ${participants.length}
┃
┃ 👑 Admins:
┃ ${admins.length}
┃
┃ 📅 Created:
┃ ${creationDate}
┃
┃ 👑 Owner:
┃ ${owner}
┃
┃ 🔗 Group Link:
┃ ${groupLink}
┃
┃ 📝 Description:
┃ ${description}
┃
╰━━━━━━━━━━━━━━━━━━━━╯
> SHADOW REIGNS SUPREME😈👑 `;

            const mentions = [];

            if (metadata.owner) {
                mentions.push(metadata.owner);
            }

            await sock.sendMessage(jid, {
                text,
                mentions
            });

        } catch (error) {
            console.error(
                '[𝙎𝙃𝘼𝘿𝙊𝙒ˣᵐᵈ V3] Groupinfo error:',
                error
            );

            await sock.sendMessage(jid, {
                text: '❌ Failed to get group information.'
            });
        }
    }
}