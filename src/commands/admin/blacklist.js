import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { userDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Kara liste yönetimi')
        .addSubcommand(s => s.setName('add').setDescription('Kara listeye ekle')
            .addUserOption(o => o.setName('kullanıcı').setDescription('Kullanıcı').setRequired(true))
            .addStringOption(o => o.setName('sebep').setDescription('Sebep')))
        .addSubcommand(s => s.setName('remove').setDescription('Kara listeden çıkar')
            .addUserOption(o => o.setName('kullanıcı').setDescription('Kullanıcı').setRequired(true)))
        .addSubcommand(s => s.setName('check').setDescription('Kara liste durumunu kontrol et')
            .addUserOption(o => o.setName('kullanıcı').setDescription('Kullanıcı').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('kullanıcı');

        if (sub === 'add') {
            const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
            await userDB.addBlacklist(user.id, user.username, reason, interaction.user.id);
            await logAudit({
                guildId: interaction.guild.id,
                action: AuditActions.USER_BLACKLIST,
                targetType: TargetTypes.USER,
                targetId: user.id,
                userId: interaction.user.id,
                userName: interaction.user.tag,
                details: reason,
            });
            await interaction.reply({ content: `✅ ${user} kara listeye eklendi.\nSebep: ${reason}`, ephemeral: true });
        } else if (sub === 'remove') {
            await userDB.removeBlacklist(user.id);
            await logAudit({
                guildId: interaction.guild.id,
                action: AuditActions.USER_UNBLACKLIST,
                targetType: TargetTypes.USER,
                targetId: user.id,
                userId: interaction.user.id,
                userName: interaction.user.tag,
            });
            await interaction.reply({ content: `✅ ${user} kara listeden çıkarıldı.`, ephemeral: true });
        } else {
            const isBlacklisted = await userDB.isBlacklisted(user.id);
            await interaction.reply({ content: isBlacklisted ? `❌ ${user} kara listede.` : `✅ ${user} kara listede değil.`, ephemeral: true });
        }
    },
};
