import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import { ticketDB, guildDB, categoryDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Ticket\'ı başka bir kategoriye taşır')
        .addStringOption(option =>
            option.setName('kategori')
                .setDescription('Hedef kategori')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const categories = await categoryDB.getAll(interaction.guild.id);

        const filtered = categories
            .filter(c => c.name.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(c => ({ name: `${c.emoji || '🎫'} ${c.name}`, value: c.id }))
        );
    },

    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.channel;
        const categoryId = interaction.options.getString('kategori');
        const member = interaction.member;

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

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

            // Kategori kontrolü
            const category = await categoryDB.get(categoryId);
            if (!category) {
                return interaction.editReply({
                    content: '❌ Kategori bulunamadı!',
                });
            }

            // Aynı kategoride mi?
            if (ticket.categoryId === categoryId) {
                return interaction.editReply({
                    content: `❌ Ticket zaten **${category.emoji || '🎫'} ${category.name}** kategorisinde!`,
                });
            }

            const oldCategory = ticket.category;
            const oldCategoryName = oldCategory ? `${oldCategory.emoji || '🎫'} ${oldCategory.name}` : 'Genel';

            // Discord kategori kontrolü
            if (category.discordCategoryId) {
                try {
                    await channel.setParent(category.discordCategoryId, { lockPermissions: false });
                } catch (error) {
                    logger.warn('Discord kategori taşıma hatası:', error.message);
                }
            }

            // Kanal adını güncelle
            const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
            const newName = `${category.emoji || '🎫'}-${category.name.toLowerCase()}-${ticketNumber}`;
            await channel.setName(newName);

            // Database güncelle
            await ticketDB.update(channel.id, { categoryId: category.id });

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor(category.color || '#5865F2')
                .setTitle('📁 Ticket Taşındı')
                .setDescription(`Ticket kategorisi değiştirildi.`)
                .addFields(
                    { name: '📝 Ticket', value: `#${ticketNumber}`, inline: true },
                    { name: '📂 Eski Kategori', value: oldCategoryName, inline: true },
                    { name: '📂 Yeni Kategori', value: `${category.emoji || '🎫'} ${category.name}`, inline: true },
                    { name: '👤 Taşıyan', value: `${interaction.user}`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Ticket #${ticket.ticketNumber} moved to ${category.name} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Move command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket taşınırken bir hata oluştu!',
            });
        }
    },
};
