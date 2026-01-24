import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { userDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unblacklist')
        .setDescription('Kullanıcının ticket engelini kaldırır')
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Engeli kaldırılacak kullanıcı')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('kullanıcı');

        try {
            // Kullanıcı engellenmiş mi?
            const isBlacklisted = await userDB.isBlacklisted(targetUser.id);
            if (!isBlacklisted) {
                return interaction.editReply({
                    content: `❌ **${targetUser.tag}** zaten engelli değil!`,
                });
            }

            // Blacklist'ten kaldır
            await userDB.removeBlacklist(targetUser.id);

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Engel Kaldırıldı')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `${targetUser} (${targetUser.tag})`, inline: true },
                    { name: '👮 Kaldıran', value: `${interaction.user}`, inline: true },
                )
                .setFooter({ text: 'Kullanıcı artık ticket açabilir' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Log kanalına bildir
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            if (guildConfig.logChannelId) {
                try {
                    const logChannel = await interaction.guild.channels.fetch(guildConfig.logChannelId);
                    await logChannel.send({ embeds: [embed] });
                } catch (error) {
                    // Log kanalına gönderilemezse sessizce devam et
                }
            }

            logger.info(`${targetUser.tag} unblacklisted by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Unblacklist command hatası:', error);
            await interaction.editReply({
                content: '❌ Engel kaldırılırken bir hata oluştu!',
            });
        }
    },
};
