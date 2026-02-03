import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { userDB, guildDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Kullanıcıyı ticket sisteminden engelle')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Sebep'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

        try {
            await userDB.addBlacklist(user.id, user.tag, reason, interaction.user.id);
            await logAudit({ guildId: interaction.guild.id, action: AuditActions.USER_BLACKLIST, targetType: TargetTypes.USER, userId: interaction.user.id, userName: interaction.user.tag, targetId: user.id });

            const embed = new EmbedBuilder().setColor('#ED4245').setTitle('🚫 Kullanıcı Engellendi')
                .addFields({ name: 'Kullanıcı', value: `${user}`, inline: true }, { name: 'Sebep', value: reason, inline: true });

            const config = await guildDB.get(interaction.guild.id);
            if (config?.logChannelId) {
                const log = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
                if (log) await log.send({ embeds: [embed] });
            }
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Blacklist error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
