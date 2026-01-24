import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';
import { guildDB, categoryDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Ticket paneli gönderir')
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Panel gönderilecek kanal (boş bırakılırsa bu kanal)')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(option =>
            option.setName('başlık')
                .setDescription('Panel başlığı')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addStringOption(option =>
            option.setName('açıklama')
                .setDescription('Panel açıklaması')
                .setRequired(false)
                .setMaxLength(1000)
        )
        .addStringOption(option =>
            option.setName('renk')
                .setDescription('Embed rengi (hex: #5865F2)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('kanal') || interaction.channel;
        const title = interaction.options.getString('başlık') || '🎫 Destek Ticket Sistemi';
        const description = interaction.options.getString('açıklama');
        const color = interaction.options.getString('renk') || '#5865F2';

        try {
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const categories = await categoryDB.getAll(interaction.guild.id);

            // Varsayılan açıklama
            const defaultDescription = 
                '**Nasıl ticket açarım?**\n' +
                'Aşağıdaki butona tıklayarak yeni bir destek talebi oluşturabilirsiniz.\n\n' +
                '**Ne zaman ticket açmalıyım?**\n' +
                '• Sorununuz olduğunda\n' +
                '• Yardıma ihtiyacınız olduğunda\n' +
                '• Şikayet veya öneriniz olduğunda\n\n' +
                '**Kurallar:**\n' +
                '• Gereksiz ticket açmayın\n' +
                '• Yetkililere saygılı olun\n' +
                '• Konunuzu açık ve net bir şekilde anlatın';

            // Embed oluştur
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description || defaultDescription)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: `${interaction.guild.name} Destek Sistemi` })
                .setTimestamp();

            // Kategoriler varsa ekle
            if (categories.length > 0) {
                embed.addFields({
                    name: '📁 Kategoriler',
                    value: categories.map(c => `${c.emoji || '🎫'} **${c.name}**${c.description ? ` - ${c.description}` : ''}`).join('\n'),
                    inline: false
                });
            }

            // Button oluştur
            const button = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Ticket Oluştur')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            // Paneli gönder
            const panelMessage = await channel.send({
                embeds: [embed],
                components: [row],
            });

            // Guild config güncelle
            await guildDB.update(interaction.guild.id, {
                panelChannelId: channel.id,
                panelMessageId: panelMessage.id,
            });

            // Başarı mesajı
            const successEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Panel Gönderildi')
                .setDescription(`Ticket paneli ${channel} kanalına gönderildi.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            logger.info(`Ticket paneli gönderildi: ${channel.name} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Panel command hatası:', error);
            await interaction.editReply({
                content: '❌ Panel gönderilirken bir hata oluştu!',
            });
        }
    },
};
