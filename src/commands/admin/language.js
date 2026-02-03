import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { setGuildLocale, getAvailableLocales } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Bot dilini değiştir')
        .addStringOption(o => o.setName('dil').setDescription('Dil seçin').setRequired(true).addChoices(
            { name: '🇹🇷 Türkçe', value: 'tr' },
            { name: '🇬🇧 English', value: 'en' },
        ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const locale = interaction.options.getString('dil');

        try {
            await setGuildLocale(interaction.guild.id, locale);

            const messages = {
                tr: '✅ Bot dili Türkçe olarak ayarlandı!',
                en: '✅ Bot language set to English!',
            };

            await interaction.editReply({ content: messages[locale] });
            logger.info(`Language changed to ${locale} in ${interaction.guild.name}`);
        } catch (error) {
            logger.error('Language error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
