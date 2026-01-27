import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../../utils/gamification.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Staff sıralamasını gösterir')
        .addStringOption(o => o.setName('tür').setDescription('Sıralama türü')
            .addChoices(
                { name: '✨ XP', value: 'xp' },
                { name: '🎫 Ticket', value: 'tickets' },
                { name: '⭐ Rating', value: 'rating' },
                { name: '🔥 Seri', value: 'streak' },
            )),

    async execute(interaction) {
        await interaction.deferReply();
        const type = interaction.options.getString('tür') || 'xp';
        const lb = await getLeaderboard(interaction.guild.id, type, 10);
        
        if (lb.length === 0) return interaction.editReply({ content: '📊 Henüz veri yok.' });
        
        const titles = { xp: '✨ XP', tickets: '🎫 Ticket', rating: '⭐ Rating', streak: '🔥 Seri' };
        const medals = ['🥇', '🥈', '🥉'];
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`${titles[type]} Sıralaması`)
            .setDescription(lb.map((s, i) => {
                const m = medals[i] || `**${i + 1}.**`;
                let v = type === 'xp' ? `${s.xp} XP (Lv.${s.level})` :
                        type === 'tickets' ? `${s.ticketsClosed} ticket` :
                        type === 'rating' ? `${s.averageRating.toFixed(1)}⭐` : `${s.longestStreak} gün`;
                return `${m} <@${s.userId}>\n   └ ${v}`;
            }).join('\n\n'))
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },
};
