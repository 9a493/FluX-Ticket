import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { userDB, guildDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unblacklist')
        .setDescription('Kullanıcının engelini kaldır')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Kullanıcı').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const user = interaction.options.getUser('kullanıcı');

        try {
            const info = await userDB.getBlacklistInfo(user.id);
            if (!info?.blacklisted) return interaction.editReply({ content: '❌ Kullanıcı engelli değil!' });

            await userDB.removeBlacklist(user.id);
            await logAudit({ guildId: interaction.guild.id, action: AuditActions.USER_UNBLACKLIST, targetType: TargetTypes.USER, userId: interaction.user.id, userName: interaction.user.tag, targetId: user.id });

            const embed = new EmbedBuilder().setColor('#57F287').setTitle('✅ Engel Kaldırıldı')
                .addFields({ name: 'Kullanıcı', value: `${user}`, inline: true });

            const config = await guildDB.get(interaction.guild.id);
            if (config?.logChannelId) {
                const log = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
                if (log) await log.send({ embeds: [embed] });
            }
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Unblacklist error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
