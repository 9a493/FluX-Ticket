import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Ticket paneli gönder')
        .addStringOption(o => o.setName('başlık').setDescription('Panel başlığı'))
        .addStringOption(o => o.setName('açıklama').setDescription('Panel açıklaması'))
        .addStringOption(o => o.setName('renk').setDescription('Renk').addChoices(
            { name: '🔵 Mavi', value: '#5865F2' },
            { name: '🟢 Yeşil', value: '#57F287' },
            { name: '🟣 Mor', value: '#9B59B6' },
        ))
        .addBooleanOption(o => o.setName('modal').setDescription('Modal göster'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const title = interaction.options.getString('başlık') || t(interaction.guild.id, 'panelTitle');
        const description = interaction.options.getString('açıklama') || t(interaction.guild.id, 'panelDesc');
        const color = interaction.options.getString('renk') || '#5865F2';
        const useModal = interaction.options.getBoolean('modal') ?? false;

        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: `${interaction.guild.name} • FluX Ticket` });

            const button = new ButtonBuilder()
                .setCustomId(useModal ? 'create_ticket_modal' : 'create_ticket')
                .setLabel(t(interaction.guild.id, 'panelButton'))
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary);

            const message = await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
            await guildDB.update(interaction.guild.id, { panelChannelId: interaction.channel.id, panelMessageId: message.id });
            await interaction.editReply({ content: '✅ Panel gönderildi!' });
            logger.info(`Panel sent: ${interaction.guild.name}`);
        } catch (error) {
            logger.error('Panel error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
