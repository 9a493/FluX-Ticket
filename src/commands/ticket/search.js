import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, messageDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

const STATUS_EMOJIS = { 'open': '🟢', 'claimed': '🟡', 'closed': '🔴', 'archived': '📦' };

export default {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Ticketlarda arama yapar')
        .addStringOption(option =>
            option.setName('sorgu')
                .setDescription('Aranacak metin')
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option.setName('alan')
                .setDescription('Arama alanı')
                .setRequired(false)
                .addChoices(
                    { name: '📝 Konu & Açıklama', value: 'ticket' },
                    { name: '💬 Mesajlar', value: 'message' },
                    { name: '🏷️ Etiketler', value: 'tag' },
                    { name: '📋 Tümü', value: 'all' },
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const query = interaction.options.getString('sorgu');
        const field = interaction.options.getString('alan') || 'all';

        try {
            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles?.split(',').filter(r => r) || [];
            const isStaff = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));

            if (!isStaff && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                });
            }

            let results = [];

            // Ticket arama
            if (field === 'ticket' || field === 'all' || field === 'tag') {
                const tickets = await ticketDB.search(interaction.guild.id, query, 10);
                results.push(...tickets.map(t => ({
                    type: 'ticket',
                    ticket: t,
                    match: t.subject || t.description || t.tags,
                })));
            }

            // Mesaj arama
            if (field === 'message' || field === 'all') {
                const messages = await messageDB.search(interaction.guild.id, query, 10);
                results.push(...messages.map(m => ({
                    type: 'message',
                    ticket: m.ticket,
                    message: m,
                    match: m.content,
                })));
            }

            if (results.length === 0) {
                return interaction.editReply({
                    content: `🔍 "${query}" için sonuç bulunamadı.`,
                });
            }

            // Sonuçları unique ticket'lara göre grupla
            const uniqueTickets = new Map();
            for (const result of results) {
                if (!uniqueTickets.has(result.ticket.id)) {
                    uniqueTickets.set(result.ticket.id, result);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`🔍 Arama Sonuçları: "${query}"`)
                .setDescription(
                    Array.from(uniqueTickets.values()).slice(0, 10).map((r, i) => {
                        const t = r.ticket;
                        const num = t.ticketNumber.toString().padStart(4, '0');
                        const status = STATUS_EMOJIS[t.status] || '❓';
                        const matchPreview = r.match?.substring(0, 50) || '';
                        const type = r.type === 'message' ? '💬' : '📝';
                        
                        return `${status} **#${num}** ${type}\n> ${matchPreview}...`;
                    }).join('\n\n')
                )
                .setFooter({ text: `${uniqueTickets.size} sonuç bulundu` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Search "${query}" by ${interaction.user.tag}: ${results.length} results`);

        } catch (error) {
            logger.error('Search command hatası:', error);
            await interaction.editReply({
                content: '❌ Arama yapılırken bir hata oluştu!',
            });
        }
    },
};
