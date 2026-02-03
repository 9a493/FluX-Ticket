import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reopen')
        .setDescription('Kapalı ticketı yeniden aç'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: '❌ Bu bir ticket kanalı değil!' });
            if (ticket.status === 'open' || ticket.status === 'claimed') return interaction.editReply({ content: '❌ Bu ticket zaten açık!' });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) return interaction.editReply({ content: '❌ Bu komutu sadece yetkililer kullanabilir!' });

            await ticketDB.reopen(interaction.channel.id);

            // Kullanıcıya yazma izni ver
            await interaction.channel.permissionOverwrites.edit(ticket.userId, { SendMessages: true }).catch(() => {});

            // Kanal adını düzelt
            const num = ticket.ticketNumber.toString().padStart(4, '0');
            const newName = interaction.channel.name.replace(/^(📦-)?archived-/, '').replace(/^closed-/, '');
            await interaction.channel.setName(newName || `ticket-${num}`).catch(() => {});

            const embed = new EmbedBuilder().setColor('#57F287').setTitle('🔓 Ticket Yeniden Açıldı')
                .setDescription(`<@${ticket.userId}>, ticketınız yeniden açıldı.`)
                .setFooter({ text: `${interaction.user.tag}` }).setTimestamp();

            await interaction.editReply({ content: `<@${ticket.userId}>`, embeds: [embed] });

            if (config?.logChannelId) {
                const log = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
                if (log) await log.send({ embeds: [embed.addFields({ name: 'Ticket', value: `#${num}`, inline: true }, { name: 'Açan', value: `${interaction.user}`, inline: true })] });
            }
        } catch (error) {
            logger.error('Reopen error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
