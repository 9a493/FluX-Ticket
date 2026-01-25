import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import { setGuildLocale, getAvailableLocales, getGuildLocale } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Sunucu dilini değiştirir')
        .addStringOption(option =>
            option.setName('dil')
                .setDescription('Yeni dil')
                .setRequired(true)
                .addChoices(
                    { name: '🇹🇷 Türkçe', value: 'tr' },
                    { name: '🇬🇧 English', value: 'en' },
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const newLocale = interaction.options.getString('dil');

        try {
            const currentLocale = await getGuildLocale(interaction.guild.id);
            
            if (currentLocale === newLocale) {
                const langNames = { tr: 'Türkçe', en: 'English' };
                return interaction.editReply({
                    content: `❌ Dil zaten **${langNames[newLocale]}** olarak ayarlı!`,
                });
            }

            // Dili değiştir
            await setGuildLocale(interaction.guild.id, newLocale);

            // Başarı mesajı (her iki dilde)
            const messages = {
                tr: {
                    title: '✅ Dil Değiştirildi',
                    description: 'Sunucu dili **Türkçe** olarak ayarlandı.',
                    flag: '🇹🇷',
                },
                en: {
                    title: '✅ Language Changed',
                    description: 'Server language has been set to **English**.',
                    flag: '🇬🇧',
                },
            };

            const msg = messages[newLocale];

            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle(`${msg.flag} ${msg.title}`)
                .setDescription(msg.description)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Language changed to ${newLocale} for guild ${interaction.guild.name} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Language command hatası:', error);
            await interaction.editReply({
                content: '❌ Dil değiştirilirken bir hata oluştu!',
            });
        }
    },
};
