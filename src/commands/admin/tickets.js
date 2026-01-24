import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

const PRIORITIES = {
    1: { name: 'Düşük', emoji: '🟢' },
    2: { name: 'Orta', emoji: '🟡' },
    3: { name: 'Yüksek', emoji: '🟠' },
    4: { name: 'Acil', emoji: '🔴' },
};

export default {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Açık ticketları listeler')
        .addStringOption(option =>
            option.setName('filtre')
                .setDescription('Filtreleme seçeneği')
                .setRequired(false)
                .addChoices(
                    { name: '🟢 Tümü', value: 'all' },
                    { name: '📭 Sahipsiz', value: 'unclaimed' },
                    { name: '📬 Sahipli', value: 'claimed' },
                    { name: '🔴 Acil', value: 'urgent' },
                    { name: '👤 Benim', value: 'mine' },
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const filter = interaction.options.getString('filtre') || 'all';
        const member = interaction.member;

        try {
            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            if (!isStaff && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                });
            }

            // Açık ticketları getir
            let tickets = await ticketDB.getOpenTickets(interaction.guild.id);

            // Filtreleme
            switch (filter) {
                case 'unclaimed':
                    tickets = tickets.filter(t => t.status === 'open');
                    break;
                case 'claimed':
                    tickets = tickets.filter(t => t.status === 'claimed');
                    break;
                case 'urgent':
                    tickets = tickets.filter(t => t.priority === 4);
                    break;
                case 'mine':
                    tickets = tickets.filter(t => t.claimedBy === interaction.user.id);
                    break;
            }

            if (tickets.length === 0) {
                const filterNames = {
                    all: 'açık',
                    unclaimed: 'sahipsiz',
                    claimed: 'sahipli',
                    urgent: 'acil',
                    mine: 'size ait',
                };

                return interaction.editReply({
                    content: `📋 Hiç ${filterNames[filter]} ticket bulunamadı.`,
                });
            }

            // Önceliğe göre sırala (acil olanlar önce)
            tickets.sort((a, b) => (b.priority || 1) - (a.priority || 1));

            // Ticket listesi oluştur
            const ticketList = await Promise.all(tickets.slice(0, 25).map(async (ticket) => {
                const priority = PRIORITIES[ticket.priority || 1];
                const status = ticket.status === 'claimed' ? '📬' : '📭';
                const channelLink = `<#${ticket.channelId}>`;
                
                let ownerInfo = '';
                try {
                    const owner = await interaction.client.users.fetch(ticket.userId);
                    ownerInfo = owner.username;
                } catch {
                    ownerInfo = 'Bilinmiyor';
                }

                let claimedInfo = '';
                if (ticket.claimedBy) {
                    try {
                        const claimer = await interaction.client.users.fetch(ticket.claimedBy);
                        claimedInfo = ` → ${claimer.username}`;
                    } catch {
                        claimedInfo = ' → Bilinmiyor';
                    }
                }

                const timeSinceCreation = formatTimeAgo(new Date(ticket.createdAt));

                return `${status} ${priority.emoji} **#${ticket.ticketNumber.toString().padStart(4, '0')}** - ${channelLink}\n` +
                       `   └ 👤 ${ownerInfo}${claimedInfo} • ⏱️ ${timeSinceCreation}`;
            }));

            // Embed oluştur
            const filterEmojis = {
                all: '📋',
                unclaimed: '📭',
                claimed: '📬',
                urgent: '🔴',
                mine: '👤',
            };

            const filterNames = {
                all: 'Tüm Açık',
                unclaimed: 'Sahipsiz',
                claimed: 'Sahipli',
                urgent: 'Acil',
                mine: 'Benim',
            };

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`${filterEmojis[filter]} ${filterNames[filter]} Ticketlar`)
                .setDescription(ticketList.join('\n\n'))
                .setFooter({ 
                    text: `Toplam ${tickets.length} ticket${tickets.length > 25 ? ' (ilk 25 gösteriliyor)' : ''}`
                })
                .setTimestamp();

            // Özet ekle
            const unclaimed = tickets.filter(t => t.status === 'open').length;
            const claimed = tickets.filter(t => t.status === 'claimed').length;
            const urgent = tickets.filter(t => t.priority === 4).length;

            embed.addFields({
                name: '📊 Özet',
                value: `📭 Sahipsiz: **${unclaimed}** | 📬 Sahipli: **${claimed}** | 🔴 Acil: **${urgent}**`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Tickets listed by ${interaction.user.tag} (filter: ${filter})`);

        } catch (error) {
            logger.error('Tickets command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticketlar listelenirken bir hata oluştu!',
            });
        }
    },
};

/**
 * Zaman farkını formatlar
 */
function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}g önce`;
    if (hours > 0) return `${hours}s önce`;
    if (minutes > 0) return `${minutes}dk önce`;
    return 'Şimdi';
}
