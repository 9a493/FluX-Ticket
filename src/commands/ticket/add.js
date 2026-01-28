import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Ticket\'a kullanıcı ekler')
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Eklenecek kullanıcı')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const userToAdd = interaction.options.getUser('kullanıcı');
        const member = interaction.member;

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            // Yetki kontrolü: Ticket sahibi veya yetkili
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            const isOwner = ticket.userId === interaction.user.id;
            
            if (!isStaff && !isOwner && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için ticket sahibi veya yetkili olmalısınız!',
                });
            }

            // Bot eklemeye çalışıyor mu?
            if (userToAdd.bot) {
                return interaction.editReply({
                    content: '❌ Botları ticket\'a ekleyemezsiniz!',
                });
            }

            // Kendini eklemeye çalışıyor mu?
            if (userToAdd.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ Kendinizi ticket\'a ekleyemezsiniz, zaten içindesiniz!',
                });
            }

            // Kullanıcı zaten ticket'ta mı?
            const permissions = channel.permissionOverwrites.cache.get(userToAdd.id);
            if (permissions?.allow.has(PermissionFlagsBits.ViewChannel)) {
                return interaction.editReply({
                    content: `❌ ${userToAdd} zaten bu ticket'ta!`,
                });
            }

            // Member fetch
            const memberToAdd = await interaction.guild.members.fetch(userToAdd.id).catch(() => null);
            if (!memberToAdd) {
                return interaction.editReply({
                    content: '❌ Kullanıcı bu sunucuda bulunamadı!',
                });
            }

            // Kullanıcıyı kanala ekle
            await channel.permissionOverwrites.create(memberToAdd, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true,
            });

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setDescription(`✅ ${memberToAdd} ticket'a eklendi.`)
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
            });

            // Kanala bilgi mesajı
            const notificationEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('👤 Kullanıcı Eklendi')
                .setDescription(`${memberToAdd} ticket'a ${interaction.user} tarafından eklendi.`)
                .setTimestamp();

            await channel.send({ 
                content: `${memberToAdd}`,
                embeds: [notificationEmbed] 
            });

            logger.info(`${userToAdd.tag} added to ticket #${ticket.ticketNumber} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Add command hatası:', error);
            await interaction.editReply({
                content: '❌ Kullanıcı eklenirken bir hata oluştu!',
            });
        }
    },
};
