import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Ticketı başka bir yetkiliye devret')
        .addUserOption(o => o.setName('yetkili').setDescription('Devredilecek yetkili').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const newStaff = interaction.options.getUser('yetkili');

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });

            const member = await interaction.guild.members.fetch(newStaff.id).catch(() => null);
            if (!member || !isStaff(member, config)) return interaction.editReply({ content: '❌ Hedef kullanıcı yetkili değil!' });

            await ticketDB.claim(interaction.channel.id, newStaff.id, newStaff.tag);

            const num = ticket.ticketNumber.toString().padStart(4, '0');
            await interaction.channel.setName(`claimed-${num}-${newStaff.username}`).catch(() => {});

            const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🔄 Ticket Devredildi')
                .setDescription(t(interaction.guild.id, 'transferSuccess', { from: interaction.user.toString(), to: newStaff.toString() }))
                .setTimestamp();

            await interaction.editReply({ content: `${newStaff}`, embeds: [embed] });

            if (config?.logChannelId) {
                const log = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
                if (log) await log.send({ embeds: [embed.addFields({ name: 'Ticket', value: `#${num}`, inline: true })] });
            }
        } catch (error) {
            logger.error('Transfer error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
