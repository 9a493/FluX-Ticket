import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { staffDB } from '../../utils/database.js';
import { createProfileEmbed, getXPToNextLevel, getLevelTitle, BADGES } from '../../utils/gamification.js';

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Staff profilini görüntüle')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Profili görülecek kullanıcı')),

    async execute(interaction) {
        await interaction.deferReply();
        
        const user = interaction.options.getUser('kullanıcı') || interaction.user;
        const staff = await staffDB.get(interaction.guild.id, user.id);
        
        if (!staff) {
            return interaction.editReply({ content: '❌ Bu kullanıcının staff kaydı bulunamadı.' });
        }
        
        const { needed, progress } = getXPToNextLevel(staff.xp);
        const progressBar = '█'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10));
        
        const badges = staff.badges ? staff.badges.split(',').map(id => {
            const badge = Object.values(BADGES).find(b => b.id === id);
            return badge ? badge.emoji : '';
        }).join(' ') : 'Henüz rozet yok';
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📊 ${user.username} - Profil`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '📈 Seviye', value: `**${staff.level}** - ${getLevelTitle(staff.level)}`, inline: true },
                { name: '✨ XP', value: `**${staff.xp}** XP`, inline: true },
                { name: '🔥 Seri', value: `**${staff.currentStreak}** gün`, inline: true },
                { name: '📊 İlerleme', value: `${progressBar}\n${progress.toFixed(1)}% (${needed} XP kaldı)`, inline: false },
                { name: '🎫 Ticketlar', value: `Sahiplenilen: **${staff.ticketsClaimed}**\nKapatılan: **${staff.ticketsClosed}**`, inline: true },
                { name: '⭐ Rating', value: `**${staff.averageRating.toFixed(1)}/5** (${staff.totalRatings} oy)`, inline: true },
                { name: '🏆 Rozetler', value: badges, inline: false },
            )
            .setFooter({ text: `En uzun seri: ${staff.longestStreak} gün` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },
};
