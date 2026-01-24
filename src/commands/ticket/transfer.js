import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Ticket\'ı başka bir yetkiliye devreder')
        .addUserOption(option =>
            option.setName('yetkili')
                .setDescription('Ticket\'ın devredileceği yetkili')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('not')
                .setDescription('Devir notu (opsiyonel)')
                .setRequired(false)
                .setMaxLength(200)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.channel;
        const targetUser = interaction.options.getUser('yetkili');
        const note = interaction.options.getString('not');
        const member = interaction.member;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

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

            // Hedef yetkili mi?
            if (!targetMember) {
                return interaction.editReply({
                    content: '❌ Hedef kullanıcı bu sunucuda bulunamadı!',
                });
            }

            const targetIsStaff = staffRoles.some(roleId => targetMember.roles.cache.has(roleId));
            if (!targetIsStaff && !targetMember.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Ticket sadece yetkililere devredilebilir!',
                });
            }

            // Kendine devretme
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ Ticket\'ı kendinize devredemezsiniz!',
                });
            }

            // Aynı kişiye devretme
            if (ticket.claimedBy === targetUser.id) {
                return interaction.editReply({
                    content: `❌ Bu ticket zaten ${targetUser} tarafından sahiplenilmiş!`,
                });
            }

            const previousOwner = ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Sahipsiz';

            // Ticket'ı devret
            await ticketDB.claim(channel.id, targetUser.id);

            // Kanal adını güncelle
            const baseName = channel.name.replace(/-[^-]+$/, '');
            await channel.setName(`${baseName}-${targetUser.username}`);

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🔄 Ticket Devredildi')
                .setDescription(
                    `Bu ticket ${interaction.user} tarafından ${targetUser}'a devredildi.\n\n` +
                    `${targetUser}, bu ticket artık sizin sorumluluğunuzda.`
                )
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👤 Önceki Yetkili', value: previousOwner, inline: true },
                    { name: '👤 Yeni Yetkili', value: `${targetUser}`, inline: true },
                )
                .setTimestamp();

            if (note) {
                embed.addFields({ name: '📋 Not', value: note, inline: false });
            }

            await interaction.editReply({ embeds: [embed] });

            // Hedef kullanıcıya mention
            await channel.send({ content: `${targetUser}` });

            // Log
            if (guildConfig.logChannelId) {
                try {
                    const logChannel = await interaction.guild.channels.fetch(guildConfig.logChannelId);
                    const logEmbed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('🔄 Ticket Devredildi')
                        .addFields(
                            { name: 'Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                            { name: 'Devreden', value: `${interaction.user}`, inline: true },
                            { name: 'Yeni Yetkili', value: `${targetUser}`, inline: true },
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] });
                } catch (error) {
                    // Log hatası sessiz
                }
            }

            logger.info(`Ticket #${ticket.ticketNumber} transferred from ${interaction.user.tag} to ${targetUser.tag}`);

        } catch (error) {
            logger.error('Transfer command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket devredilirken bir hata oluştu!',
            });
        }
    },
};
