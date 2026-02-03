import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { generateTranscript, createTranscriptEmbed } from '../../utils/transcript.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

const BASE_URL = process.env.BASE_URL || 'https://fluxdigital.com.tr';

export default {
    data: new SlashCommandBuilder()
        .setName('archive')
        .setDescription('Ticketı arşivle (salt okunur)'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });
            if (ticket.status === 'archived') return interaction.editReply({ content: '❌ Bu ticket zaten arşivlenmiş!' });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });

            // Transcript oluştur
            let transcriptId = null;
            try {
                transcriptId = await generateTranscript(interaction.channel, ticket, interaction.guild);
            } catch (e) {
                logger.error('Transcript error:', e);
            }

            // Database'de arşivle
            await ticketDB.update(interaction.channel.id, { status: 'archived' });

            // Yazma iznini kaldır (salt okunur)
            await interaction.channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false }).catch(() => {});
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false }).catch(() => {});

            // Kanal adını güncelle
            const num = ticket.ticketNumber.toString().padStart(4, '0');
            await interaction.channel.setName(`📦-archived-${num}`).catch(() => {});
            await interaction.channel.setTopic(`Arşivlenmiş Ticket #${num} | Salt Okunur`).catch(() => {});

            const embed = new EmbedBuilder().setColor('#9B59B6').setTitle(t(interaction.guild.id, 'archiveSuccess'))
                .setDescription(t(interaction.guild.id, 'archiveDesc'))
                .addFields({ name: '📄 Transcript', value: transcriptId ? `[Web'de Görüntüle](${BASE_URL}/transcript/${transcriptId})` : 'Oluşturulamadı', inline: true })
                .setFooter({ text: `${interaction.user.tag}` }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log
            if (config?.logChannelId && transcriptId) {
                const log = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
                if (log) {
                    const updated = await ticketDB.get(interaction.channel.id);
                    await log.send({ embeds: [createTranscriptEmbed(updated, transcriptId, BASE_URL)] });
                }
            }
        } catch (error) {
            logger.error('Archive error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
