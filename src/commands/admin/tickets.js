import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

const PRIORITY_EMOJIS = { 1: '🟢', 2: '🟡', 3: '🟠', 4: '🔴' };
const STATUS_EMOJIS = { 'open': '🟢', 'claimed': '🟡', 'closed': '🔴', 'archived': '📦' };

export default {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Açık ticketları listeler')
        .addStringOption(option =>
            option.setName('durum')
                .setDescription('Filtrele')
                .setRequired(false)
                .addChoices(
                    { name: '🟢 Açık', value: 'open' },
                    { name: '🟡 Sahiplenilmiş', value: 'claimed' },
                    { name: '🔴 Kapalı', value: 'closed' },
                    { name: '📦 Arşivlenmiş', value: 'archived' },
                    { name: '📋 Tümü', value: 'all' },
                )
        )
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Belirli bir kullanıcının ticketları')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('yetkili')
                .setDescription('Belirli bir yetkilinin sahiplendiği ticketlar')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const status = interaction.options.getString('durum') || 'open';
        const filterUser = interaction.options.getUser('kullanıcı');
        const filterStaff = interaction.options.getUser('yetkili');

        try {
            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));
            if (!isStaff && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                });
            }

            // Ticketları getir
            let tickets;
            if (status === 'all') {
                tickets = await ticketDB.getAllTickets(interaction.guild.id);
            } else {
                tickets = await ticketDB.getTicketsByStatus(interaction.guild.id, status);
            }

            // Filtrele
            if (filterUser) {
                tickets = tickets.filter(t => t.userId === filterUser.id);
            }
            if (filterStaff) {
                tickets = tickets.filter(t => t.claimedBy === filterStaff.id);
            }

            if (tickets.length === 0) {
                return interaction.editReply({
                    content: '📋 Belirtilen kriterlere uygun ticket bulunamadı.',
                });
            }

            // Sayfalama için ticketları böl (max 10 per embed)
            const maxPerPage = 10;
            const totalPages = Math.ceil(tickets.length / maxPerPage);
            const page = 1;

            const startIndex = (page - 1) * maxPerPage;
            const pageTickets = tickets.slice(startIndex, startIndex + maxPerPage);

            // Embed oluştur
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📋 Ticket Listesi`)
                .setDescription(
                    pageTickets.map((t, i) => {
                        const num = t.ticketNumber.toString().padStart(4, '0');
                        const statusEmoji = STATUS_EMOJIS[t.status] || '❓';
                        const priorityEmoji = PRIORITY_EMOJIS[t.priority] || '';
                        const claimed = t.claimedBy ? `→ <@${t.claimedBy}>` : '';
                        const age = getAge(new Date(t.createdAt));
                        
                        return `${statusEmoji} **#${num}** ${priorityEmoji} <@${t.userId}> ${claimed} • \`${age}\``;
                    }).join('\n')
                )
                .addFields(
                    { name: '📊 Özet', value: `Toplam: **${tickets.length}** ticket`, inline: true },
                )
                .setFooter({ text: `Sayfa ${page}/${totalPages} • ${interaction.guild.name}` })
                .setTimestamp();

            // Durum dağılımı
            const openCount = tickets.filter(t => t.status === 'open').length;
            const claimedCount = tickets.filter(t => t.status === 'claimed').length;
            const closedCount = tickets.filter(t => t.status === 'closed').length;
            const archivedCount = tickets.filter(t => t.status === 'archived').length;

            embed.addFields({
                name: '📈 Durum Dağılımı',
                value: `🟢 Açık: ${openCount} • 🟡 Sahiplenilmiş: ${claimedCount} • 🔴 Kapalı: ${closedCount} • 📦 Arşiv: ${archivedCount}`,
                inline: false,
            });

            // Yüksek öncelikli
            const highPriority = tickets.filter(t => t.priority >= 3 && (t.status === 'open' || t.status === 'claimed')).length;
            if (highPriority > 0) {
                embed.addFields({
                    name: '⚠️ Yüksek Öncelikli',
                    value: `${highPriority} ticket yüksek/acil öncelikte!`,
                    inline: true,
                });
            }

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Tickets list viewed by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Tickets command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticketlar listelenirken bir hata oluştu!',
            });
        }
    },
};

function getAge(date) {
    const ms = Date.now() - date.getTime();
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}g`;
    if (hours > 0) return `${hours}s`;
    return `${minutes}d`;
}
