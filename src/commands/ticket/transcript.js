import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { generateTranscript } from '../../utils/transcript.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('transcript')
        .setDescription('Ticket\'ın transcript\'ini (sohbet kaydını) oluşturur'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
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

            // Transcript oluştur
            await interaction.editReply({
                content: '⏳ Transcript oluşturuluyor...',
            });

            const transcriptUrl = await generateTranscript(channel, ticket);

            if (!transcriptUrl) {
                return interaction.editReply({
                    content: '❌ Transcript oluşturulurken bir hata oluştu!',
                });
            }

            // Database güncelle
            await ticketDB.update(channel.id, { transcriptUrl });

            // Başarı mesajı
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('📄 Transcript Oluşturuldu')
                .setDescription(
                    `Ticket #${ticket.ticketNumber.toString().padStart(4, '0')} için transcript oluşturuldu.\n\n` +
                    'Transcript dosyası yukarıdaki mesaja eklendi.'
                )
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👤 Oluşturan', value: `${interaction.user}`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({
                content: null,
                embeds: [embed],
            });

            logger.info(`Transcript created for ticket #${ticket.ticketNumber} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Transcript command hatası:', error);
            await interaction.editReply({
                content: '❌ Transcript oluşturulurken bir hata oluştu!',
            });
        }
    },
};
