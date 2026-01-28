import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

const PRIORITIES = {
    1: { name: 'Düşük', emoji: '🟢', color: '#57F287' },
    2: { name: 'Orta', emoji: '🟡', color: '#FEE75C' },
    3: { name: 'Yüksek', emoji: '🟠', color: '#F57C00' },
    4: { name: 'Acil', emoji: '🔴', color: '#ED4245' },
};

export default {
    data: new SlashCommandBuilder()
        .setName('priority')
        .setDescription('Ticket önceliğini belirler')
        .addIntegerOption(option =>
            option.setName('seviye')
                .setDescription('Öncelik seviyesi')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Düşük', value: 1 },
                    { name: '🟡 Orta', value: 2 },
                    { name: '🟠 Yüksek', value: 3 },
                    { name: '🔴 Acil', value: 4 },
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.channel;
        const priority = interaction.options.getInteger('seviye');
        const member = interaction.member;

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            // Sadece yetkililer öncelik değiştirebilir
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

            const oldPriority = ticket.priority || 1;
            const priorityInfo = PRIORITIES[priority];
            const oldPriorityInfo = PRIORITIES[oldPriority];

            // Önceliği güncelle
            await ticketDB.setPriority(channel.id, priority);

            // Kanal adını güncelle (opsiyonel - öncelik emojisi ekle)
            const baseName = channel.name.replace(/^[🟢🟡🟠🔴]-/, '');
            if (priority >= 3) {
                await channel.setName(`${priorityInfo.emoji}-${baseName}`);
            }

            // Topic güncelle
            const topic = channel.topic || '';
            const newTopic = topic.replace(/Öncelik: [^\|]+/, `Öncelik: ${priorityInfo.emoji} ${priorityInfo.name}`);
            if (newTopic !== topic) {
                await channel.setTopic(newTopic.includes('Öncelik:') ? newTopic : `${topic} | Öncelik: ${priorityInfo.emoji} ${priorityInfo.name}`);
            }

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor(priorityInfo.color)
                .setTitle(`${priorityInfo.emoji} Öncelik Değiştirildi`)
                .setDescription(
                    `Ticket önceliği güncellendi:\n\n` +
                    `${oldPriorityInfo.emoji} ${oldPriorityInfo.name} → ${priorityInfo.emoji} **${priorityInfo.name}**`
                )
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👤 Değiştiren', value: `${interaction.user}`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Ticket #${ticket.ticketNumber} priority changed to ${priorityInfo.name} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Priority command hatası:', error);
            await interaction.editReply({
                content: '❌ Öncelik değiştirilirken bir hata oluştu!',
            });
        }
    },
};
