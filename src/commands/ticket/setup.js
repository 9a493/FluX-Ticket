import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Ticket sistemini kurar')
        .addChannelOption(option =>
            option.setName('kategori')
                .setDescription('Ticket kanallarının oluşturulacağı kategori')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildCategory)
        )
        .addChannelOption(option =>
            option.setName('panel-kanal')
                .setDescription('Ticket panelinin gönderileceği kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
            option.setName('yetkili-rol')
                .setDescription('Ticketlara erişebilecek yetkili rolü')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('log-kanal')
                .setDescription('Ticket loglarının gönderileceği kanal')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
            option.setName('yetkili-rol-2')
                .setDescription('İkinci yetkili rolü (opsiyonel)')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('yetkili-rol-3')
                .setDescription('Üçüncü yetkili rolü (opsiyonel)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const category = interaction.options.getChannel('kategori');
        const panelChannel = interaction.options.getChannel('panel-kanal');
        const logChannel = interaction.options.getChannel('log-kanal');
        
        // Yetkili rolleri topla
        const staffRoles = [
            interaction.options.getRole('yetkili-rol'),
            interaction.options.getRole('yetkili-rol-2'),
            interaction.options.getRole('yetkili-rol-3'),
        ].filter(r => r !== null);

        const staffRoleIds = staffRoles.map(r => r.id);

        try {
            // Guild ayarlarını kaydet/güncelle
            const guild = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            
            await guildDB.setup(interaction.guild.id, {
                categoryId: category.id,
                panelChannelId: panelChannel.id,
                logChannelId: logChannel?.id || null,
                staffRoles: staffRoleIds,
            });

            // Panel embed'i oluştur
            const panelEmbed = new EmbedBuilder()
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

            // Panel butonu
            const createButton = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Ticket Oluştur')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(createButton);

            // Paneli gönder
            const panelMessage = await panelChannel.send({
                embeds: [panelEmbed],
                components: [row],
            });

            // Panel mesaj ID'sini kaydet
            await guildDB.update(interaction.guild.id, {
                panelMessageId: panelMessage.id,
            });

            // Başarı mesajı
            const successEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Ticket Sistemi Kuruldu!')
                .setDescription('Ticket sistemi başarıyla kuruldu ve kullanıma hazır.')
                .addFields(
                    { name: '📁 Ticket Kategorisi', value: `${category}`, inline: true },
                    { name: '📝 Panel Kanalı', value: `${panelChannel}`, inline: true },
                    { name: '📋 Log Kanalı', value: logChannel ? `${logChannel}` : '❌ Ayarlanmadı', inline: true },
                    { name: '👮 Yetkili Rolleri', value: staffRoles.map(r => `${r}`).join(', ') || 'Yok', inline: false },
                )
                .addFields({
                    name: '📖 Sonraki Adımlar',
                    value: 
                        '• `/category add` - Ticket kategorileri ekleyin\n' +
                        '• `/canned add` - Hazır yanıtlar oluşturun\n' +
                        '• `/panel` - Farklı kanallara panel gönderin',
                    inline: false,
                })
                .setFooter({ text: 'Yardım için /help komutunu kullanın' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Log kanalına bilgi mesajı
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('⚙️ Ticket Sistemi Kuruldu')
                    .setDescription(`Ticket sistemi ${interaction.user} tarafından kuruldu.`)
                    .addFields(
                        { name: 'Kategori', value: `${category}`, inline: true },
                        { name: 'Panel', value: `${panelChannel}`, inline: true },
                        { name: 'Yetkililer', value: staffRoles.map(r => `${r}`).join(', '), inline: true },
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }

            logger.info(`Setup completed for ${interaction.guild.name} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Setup command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket sistemi kurulurken bir hata oluştu! Lütfen tekrar deneyin.',
            });
        }
    },
};
