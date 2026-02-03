import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Ticket kanalının adını değiştir')
        .addStringOption(o => o.setName('isim').setDescription('Yeni isim').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const newName = interaction.options.getString('isim').toLowerCase().replace(/\s+/g, '-');

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });

            const oldName = interaction.channel.name;
            await interaction.channel.setName(newName);

            await interaction.editReply({ content: `✅ Kanal adı değiştirildi: ${oldName} → ${newName}` });

            if (config?.logChannelId) {
                const log = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
                if (log) {
                    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('✏️ Ticket Yeniden Adlandırıldı')
                        .addFields(
                            { name: 'Eski Ad', value: oldName, inline: true },
                            { name: 'Yeni Ad', value: newName, inline: true },
                            { name: 'Değiştiren', value: `${interaction.user}`, inline: true },
                        ).setTimestamp();
                    await log.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            logger.error('Rename error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
