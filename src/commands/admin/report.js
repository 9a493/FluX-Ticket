import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB, ticketDB, statsDB, staffDB, dailyStatsDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Detaylı rapor oluştur')
        .addSubcommand(sub => sub
            .setName('daily')
            .setDescription('Günlük rapor')
        )
        .addSubcommand(sub => sub
            .setName('weekly')
            .setDescription('Haftalık rapor')
        )
        .addSubcommand(sub => sub
            .setName('monthly')
            .setDescription('Aylık rapor')
        )
        .addSubcommand(sub => sub
            .setName('staff')
            .setDescription('Staff performans raporu')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            let embed;

            switch (sub) {
                case 'daily':
                    embed = await generateDailyReport(guildId);
                    break;
                case 'weekly':
                    embed = await generateWeeklyReport(guildId);
                    break;
                case 'monthly':
                    embed = await generateMonthlyReport(guildId);
                    break;
                case 'staff':
                    embed = await generateStaffReport(guildId);
                    break;
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Report command hatası:', error);
            await interaction.editReply({
                content: '❌ Rapor oluşturulurken bir hata oluştu!',
            });
        }
    },
};

async function generateDailyReport(guildId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allTickets = await ticketDB.getAllTickets(guildId);
    const todayTickets = allTickets.filter(t => new Date(t.createdAt) >= today);
    const todayClosed = allTickets.filter(t => t.closedAt && new Date(t.closedAt) >= today);
    const openTickets = allTickets.filter(t => t.status === 'open' || t.status === 'claimed');

    const avgRating = calculateAvgRating(todayClosed);
    const avgResponseTime = calculateAvgResponseTime(todayClosed);

    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Günlük Rapor')
        .setDescription(`**${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}**`)
        .addFields(
            { name: '📬 Açılan Ticket', value: `${todayTickets.length}`, inline: true },
            { name: '✅ Kapatılan Ticket', value: `${todayClosed.length}`, inline: true },
            { name: '🔄 Bekleyen', value: `${openTickets.length}`, inline: true },
            { name: '⭐ Ortalama Rating', value: avgRating ? `${avgRating.toFixed(1)}/5` : 'N/A', inline: true },
            { name: '⏱️ Ort. Yanıt Süresi', value: avgResponseTime ? `${avgResponseTime} dk` : 'N/A', inline: true },
            { name: '📈 Çözüm Oranı', value: todayTickets.length > 0 ? `%${Math.round(todayClosed.length / todayTickets.length * 100)}` : 'N/A', inline: true },
        )
        .setFooter({ text: 'FluX Ticket • Günlük Rapor' })
        .setTimestamp();
}

async function generateWeeklyReport(guildId) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const allTickets = await ticketDB.getAllTickets(guildId);
    const weekTickets = allTickets.filter(t => new Date(t.createdAt) >= weekAgo);
    const weekClosed = allTickets.filter(t => t.closedAt && new Date(t.closedAt) >= weekAgo);

    const dailyStats = await dailyStatsDB.getRange(guildId, weekAgo, new Date());
    
    // Günlük dağılım
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const dailyBreakdown = dayNames.map((day, i) => {
        const dayTickets = weekTickets.filter(t => new Date(t.createdAt).getDay() === i);
        return `${day}: ${dayTickets.length}`;
    }).join(' | ');

    const avgRating = calculateAvgRating(weekClosed);

    // Top performers
    const staffStats = {};
    weekClosed.forEach(t => {
        if (t.claimedBy) {
            staffStats[t.claimedBy] = (staffStats[t.claimedBy] || 0) + 1;
        }
    });
    const topPerformer = Object.entries(staffStats).sort((a, b) => b[1] - a[1])[0];

    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Haftalık Rapor')
        .setDescription(`**${weekAgo.toLocaleDateString('tr-TR')} - ${new Date().toLocaleDateString('tr-TR')}**`)
        .addFields(
            { name: '📬 Toplam Ticket', value: `${weekTickets.length}`, inline: true },
            { name: '✅ Kapatılan', value: `${weekClosed.length}`, inline: true },
            { name: '⭐ Ort. Rating', value: avgRating ? `${avgRating.toFixed(1)}/5` : 'N/A', inline: true },
            { name: '📅 Günlük Dağılım', value: `\`${dailyBreakdown}\``, inline: false },
            { name: '🏆 En Çok Kapatan', value: topPerformer ? `<@${topPerformer[0]}> (${topPerformer[1]} ticket)` : 'N/A', inline: true },
        )
        .setFooter({ text: 'FluX Ticket • Haftalık Rapor' })
        .setTimestamp();
}

async function generateMonthlyReport(guildId) {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const allTickets = await ticketDB.getAllTickets(guildId);
    const monthTickets = allTickets.filter(t => new Date(t.createdAt) >= monthAgo);
    const monthClosed = allTickets.filter(t => t.closedAt && new Date(t.closedAt) >= monthAgo);

    const guildConfig = await guildDB.getOrCreate(guildId, 'Unknown');
    const stats = guildConfig.stats;

    const avgRating = calculateAvgRating(monthClosed);
    const slaRate = (stats?.slaMetCount || 0) + (stats?.slaBreachedCount || 0) > 0
        ? ((stats?.slaMetCount || 0) / ((stats?.slaMetCount || 0) + (stats?.slaBreachedCount || 0)) * 100).toFixed(1)
        : 'N/A';

    // Priority breakdown
    const priorities = { 1: 0, 2: 0, 3: 0, 4: 0 };
    monthTickets.forEach(t => { priorities[t.priority] = (priorities[t.priority] || 0) + 1; });

    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Aylık Rapor')
        .setDescription(`**${monthAgo.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}**`)
        .addFields(
            { name: '📬 Toplam Ticket', value: `${monthTickets.length}`, inline: true },
            { name: '✅ Kapatılan', value: `${monthClosed.length}`, inline: true },
            { name: '📈 Çözüm Oranı', value: monthTickets.length > 0 ? `%${Math.round(monthClosed.length / monthTickets.length * 100)}` : 'N/A', inline: true },
            { name: '⭐ Ort. Rating', value: avgRating ? `${avgRating.toFixed(1)}/5` : 'N/A', inline: true },
            { name: '🎯 SLA Oranı', value: `%${slaRate}`, inline: true },
            { name: '📊 Günlük Ortalama', value: `${(monthTickets.length / 30).toFixed(1)} ticket`, inline: true },
            { name: '🎚️ Öncelik Dağılımı', value: `🟢 ${priorities[1]} | 🟡 ${priorities[2]} | 🟠 ${priorities[3]} | 🔴 ${priorities[4]}`, inline: false },
        )
        .setFooter({ text: 'FluX Ticket • Aylık Rapor' })
        .setTimestamp();
}

async function generateStaffReport(guildId) {
    const staff = await staffDB.getAll(guildId);
    
    if (staff.length === 0) {
        return new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('📊 Staff Performans Raporu')
            .setDescription('Henüz staff verisi yok.');
    }

    // Sort by tickets closed
    const sortedStaff = staff.sort((a, b) => b.ticketsClosed - a.ticketsClosed);

    const staffList = sortedStaff.slice(0, 10).map((s, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
        return `${medal} <@${s.userId}>\n` +
               `   └ 🎫 ${s.ticketsClosed} | ⭐ ${s.averageRating.toFixed(1)} | Lv.${s.level} (${s.xp} XP)`;
    }).join('\n\n');

    // Totals
    const totalTickets = staff.reduce((sum, s) => sum + s.ticketsClosed, 0);
    const avgRating = staff.length > 0 
        ? (staff.reduce((sum, s) => sum + s.averageRating, 0) / staff.length).toFixed(1)
        : 'N/A';

    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Staff Performans Raporu')
        .setDescription(staffList)
        .addFields(
            { name: '📈 Toplam', value: `${totalTickets} ticket`, inline: true },
            { name: '⭐ Genel Ort. Rating', value: `${avgRating}/5`, inline: true },
            { name: '👥 Aktif Staff', value: `${staff.length} kişi`, inline: true },
        )
        .setFooter({ text: 'FluX Ticket • Staff Raporu' })
        .setTimestamp();
}

function calculateAvgRating(tickets) {
    const rated = tickets.filter(t => t.rating);
    if (rated.length === 0) return null;
    return rated.reduce((sum, t) => sum + t.rating, 0) / rated.length;
}

function calculateAvgResponseTime(tickets) {
    const withResponse = tickets.filter(t => t.firstResponseAt);
    if (withResponse.length === 0) return null;
    
    const totalMinutes = withResponse.reduce((sum, t) => {
        const diff = new Date(t.firstResponseAt) - new Date(t.createdAt);
        return sum + (diff / 1000 / 60);
    }, 0);
    
    return Math.round(totalMinutes / withResponse.length);
}
