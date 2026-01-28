import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Ticket paneli gönderir')
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Panel gönderilecek kanal')
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
                .setDescription('Embed rengi (hex)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('buton')
                .setDescription('Buton metni')
                .setRequired(false)
                .setMaxLength(50)
        )
        .addBooleanOption(option =>
            option.setName('modal')
                .setDescription('Ticket açarken modal formu göster?')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
        const customTitle = interaction.options.getString('başlık');
        const customDescription = interaction.options.getString('açıklama');
        const customColor = interaction.options.getString('renk');
        const customButton = interaction.options.getString('buton');
        const useModal = interaction.options.getBoolean('modal') ?? true;

        try {
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);

            // Varsayılan değerler
            const title = customTitle || '🎫 Destek Ticket Sistemi';
            const description = customDescription || 
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
            
            const color = customColor?.replace('#', '') || '5865F2';
            const buttonText = customButton || 'Ticket Oluştur';

            // Embed oluştur
            const embed = new EmbedBuilder()
                .setColor(`#${color}`)
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // Thumbnail ekle (varsa)
            if (interaction.guild.iconURL()) {
                embed.setThumbnail(interaction.guild.iconURL({ size: 256 }));
            }

            // Buton oluştur
            const buttonId = useModal ? 'create_ticket_modal' : 'create_ticket';
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(buttonId)
                    .setLabel(buttonText)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫'),
            );

            // Paneli gönder
            const panelMessage = await targetChannel.send({
                embeds: [embed],
                components: [row],
            });

            // Database'e kaydet
            await guildDB.update(interaction.guild.id, {
                panelChannelId: targetChannel.id,
                panelMessageId: panelMessage.id,
            });

            // Onay mesajı
            const successEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Panel Gönderildi')
                .setDescription(`Ticket paneli ${targetChannel} kanalına gönderildi.`)
                .addFields(
                    { name: '📍 Kanal', value: `${targetChannel}`, inline: true },
                    { name: '📝 Modal', value: useModal ? 'Açık' : 'Kapalı', inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            logger.info(`Ticket panel sent to ${targetChannel.name} in ${interaction.guild.name}`);

        } catch (error) {
            logger.error('Panel command hatası:', error);
            await interaction.editReply({
                content: '❌ Panel gönderilirken bir hata oluştu!',
            });
        }
    },
};
