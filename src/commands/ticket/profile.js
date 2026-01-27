import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { staffDB, guildDB } from '../../utils/database.js';
import { createProfileEmbed, getLeaderboard, getLevelTitle, getXPToNextLevel } from '../../utils/gamification.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Staff profilini görüntüle')
        .addUserOption(option =>
            option.setName('yetkili')
                .setDescription('Profilini görmek istediğiniz yetkili')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('yetkili') || interaction.user;

        try {
            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles?.split(',').filter(r => r) || [];
            
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                return interaction.editReply({ content: '❌ Kullanıcı bulunamadı!' });
            }

            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId)) || 
                           member.permissions.has('Administrator');

            if (!isStaff) {
                return interaction.editReply({
                    content: '❌ Bu kullanıcı yetkili değil!',
                });
            }

            // Staff bilgilerini al veya oluştur
            const staff = await staffDB.getOrCreate(
                interaction.guild.id, 
                targetUser.id, 
                targetUser.username
            );

            const embed = createProfileEmbed(staff, targetUser);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Profile command hatası:', error);
            await interaction.editReply({
                content: '❌ Profil yüklenirken bir hata oluştu!',
            });
        }
    },
};
