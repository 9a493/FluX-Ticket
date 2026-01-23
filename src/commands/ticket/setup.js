import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Ticket sistemini kurar')
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Ticket panelinin gönderileceği kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('kategori')
                .setDescription('Ticketların oluşturulacağı kategori')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption(option =>
            option.setName('yetkili-rol')
                .setDescription('Ticketları görebilecek yetkili rolü')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('log-kanal')
                .setDescription('Ticket loglarının gönderileceği kanal')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const panelChannel = interaction.options.getChannel('kanal');
        const category = interaction.options.getChannel('kategori');
        const staffRole = interaction.options.getRole('yetkili-rol');
        const logChannel = interaction.options.getChannel('log-kanal');

        try {
            // Embed oluştur
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎫 Destek Ticket Sistemi')
                .setDescription(
                    '**Nasıl ticket açarım?**\n' +
                    'Aşağıdaki butona tıklayarak yeni bir destek talebi oluşturabilirsiniz.\n\n' +
                    '**Ne zaman ticket açmalıyım?**\n' +
                    '• Sorununuz olduğunda\n' +
                    '• Yardıma ihtiyacınız olduğunda\n' +
                    '• Şikayet veya öneriniz olduğunda\n\n' +
                    '**Kurallar:**\n' +
                    '• Gereksiz ticket açmayın\n' +
                    '• Yetkililere saygılı olun\n' +
                    '• Konunuzu açık ve net bir şekilde anlatın'
                )
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: `${interaction.guild.name} Destek Sistemi` })
                .setTimestamp();

            // Button oluştur
            const button = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Ticket Oluştur')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            // Paneli gönder
            await panelChannel.send({
                embeds: [embed],
                components: [row],
            });

            // Konfigürasyonu kaydet (şimdilik sadece log'layacağız, database eklenince kaydedilecek)
            const config = {
                guildId: interaction.guild.id,
                panelChannelId: panelChannel.id,
                categoryId: category.id,
                staffRoleId: staffRole.id,
                logChannelId: logChannel?.id || null,
            };

            logger.info(`Ticket sistemi kuruldu: ${interaction.guild.name}`, config);

            // Başarı mesajı
            const successEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Ticket Sistemi Kuruldu!')
                .addFields(
                    { name: '📢 Panel Kanalı', value: `${panelChannel}`, inline: true },
                    { name: '📁 Kategori', value: `${category.name}`, inline: true },
                    { name: '👮 Yetkili Rolü', value: `${staffRole}`, inline: true },
                )
                .setTimestamp();

            if (logChannel) {
                successEmbed.addFields({ name: '📋 Log Kanalı', value: `${logChannel}`, inline: true });
            }

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            logger.error('Setup komutu hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket sistemi kurulurken bir hata oluştu! Botun gerekli izinlere sahip olduğundan emin olun.',
            });
        }
    },
};