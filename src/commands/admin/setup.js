import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';
import { guildDB, categoryDB, statsDB, userDB, apiKeyDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';
import { t, setGuildLocale, getAvailableLocales } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Ticket botunu ayarla')
        .addChannelOption(o => o.setName('kategori').setDescription('Ticket kategorisi').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
        .addRoleOption(o => o.setName('staff').setDescription('Staff rolü').setRequired(true))
        .addChannelOption(o => o.setName('log').setDescription('Log kanalı').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('transcript').setDescription('Transcript kanalı').addChannelTypes(ChannelType.GuildText))
        .addRoleOption(o => o.setName('staff2').setDescription('Ek staff rolü'))
        .addRoleOption(o => o.setName('staff3').setDescription('Ek staff rolü'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const category = interaction.options.getChannel('kategori');
        const logChannel = interaction.options.getChannel('log');
        const transcriptChannel = interaction.options.getChannel('transcript');
        const staff1 = interaction.options.getRole('staff');
        const staff2 = interaction.options.getRole('staff2');
        const staff3 = interaction.options.getRole('staff3');
        const staffRoles = [staff1.id, staff2?.id, staff3?.id].filter(Boolean).join(',');

        try {
            await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            await guildDB.update(interaction.guild.id, {
                categoryId: category.id,
                logChannelId: logChannel?.id,
                transcriptChannelId: transcriptChannel?.id || logChannel?.id,
                staffRoles,
            });

            await logAudit({ guildId: interaction.guild.id, action: AuditActions.BOT_SETUP, targetType: TargetTypes.SYSTEM, userId: interaction.user.id, userName: interaction.user.tag });

            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Bot Ayarlandı')
                .addFields(
                    { name: '📁 Kategori', value: `${category}`, inline: true },
                    { name: '📝 Log', value: logChannel ? `${logChannel}` : 'Yok', inline: true },
                    { name: '👥 Staff', value: [staff1, staff2, staff3].filter(Boolean).join(', '), inline: false },
                )
                .setFooter({ text: 'Şimdi /panel ile ticket paneli gönderin' });

            await interaction.editReply({ embeds: [embed] });
            logger.info(`Setup completed: ${interaction.guild.name}`);
        } catch (error) {
            logger.error('Setup error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
