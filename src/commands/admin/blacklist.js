import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { userDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Kullanıcıyı ticket sisteminden engeller')
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Engellenecek kullanıcı')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Engelleme sebebi')
                .setRequired(false)
                .setMaxLength(200)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

        try {
            // Kullanıcı zaten engellenmiş mi?
            const isBlacklisted = await userDB.isBlacklisted(targetUser.id);
            if (isBlacklisted) {
                return interaction.editReply({
                    content: `❌ **${targetUser.tag}** zaten engellenmiş!`,
                });
            }

            // Kendini engellemeye çalışıyor mu?
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ Kendinizi engelleyemezsiniz!',
                });
            }

            // Bot'u engellemeye çalışıyor mu?
            if (targetUser.bot) {
                return interaction.editReply({
                    content: '❌ Botları engelleyemezsiniz!',
                });
            }

            // Blacklist'e ekle
            await userDB.addBlacklist(targetUser.id, targetUser.tag, reason);

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🚫 Kullanıcı Engellendi')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `${targetUser} (${targetUser.tag})`, inline: true },
                    { name: '👮 Engelleyen', value: `${interaction.user}`, inline: true },
                    { name: '📋 Sebep', value: reason, inline: false },
                )
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

            logger.info(`${targetUser.tag} blacklisted by ${interaction.user.tag} - Reason: ${reason}`);

        } catch (error) {
            logger.error('Blacklist command hatası:', error);
            await interaction.editReply({
                content: '❌ Kullanıcı engellenirken bir hata oluştu!',
            });
        }
    },
};
