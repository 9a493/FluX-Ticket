import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Bot ayarlarını yönet')
        .addSubcommand(s => s.setName('view').setDescription('Mevcut ayarları görüntüle'))
        .addSubcommand(s => s.setName('maxtickets').setDescription('Kullanıcı başına max ticket')
            .addIntegerOption(o => o.setName('limit').setDescription('Limit (1-10)').setRequired(true).setMinValue(1).setMaxValue(10)))
        .addSubcommand(s => s.setName('autoclose').setDescription('Otomatik kapatma süresi')
            .addIntegerOption(o => o.setName('saat').setDescription('Saat (0=kapalı)').setRequired(true).setMinValue(0).setMaxValue(168)))
        .addSubcommand(s => s.setName('dm').setDescription('DM bildirimleri')
            .addBooleanOption(o => o.setName('aktif').setDescription('Aktif/Pasif').setRequired(true)))
        .addSubcommand(s => s.setName('webhook').setDescription('Webhook URL')
            .addStringOption(o => o.setName('url').setDescription('Discord webhook URL')))
        .addSubcommand(s => s.setName('welcome').setDescription('Karşılama mesajı')
            .addStringOption(o => o.setName('mesaj').setDescription('{user} kullanıcıyı mention eder')))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);

            if (sub === 'view') {
                const embed = new EmbedBuilder().setColor('#5865F2').setTitle('⚙️ Bot Ayarları')
                    .addFields(
                        { name: '📁 Ticket Kategorisi', value: config.categoryId ? `<#${config.categoryId}>` : 'Ayarlanmadı', inline: true },
                        { name: '📝 Log Kanalı', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Yok', inline: true },
                        { name: '📄 Transcript Kanalı', value: config.transcriptChannelId ? `<#${config.transcriptChannelId}>` : 'Yok', inline: true },
                        { name: '👥 Staff Rolleri', value: config.staffRoles ? config.staffRoles.split(',').map(r => `<@&${r}>`).join(', ') : 'Yok', inline: false },
                        { name: '🎫 Max Ticket/Kullanıcı', value: `${config.maxTicketsPerUser || 3}`, inline: true },
                        { name: '⏰ Otomatik Kapatma', value: config.autoCloseHours ? `${config.autoCloseHours} saat` : 'Kapalı', inline: true },
                        { name: '📬 DM Bildirimleri', value: config.dmNotifications ? '✅ Açık' : '❌ Kapalı', inline: true },
                        { name: '🌐 Dil', value: config.locale === 'en' ? '🇬🇧 English' : '🇹🇷 Türkçe', inline: true },
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            let updateData = {};
            let message = '';

            if (sub === 'maxtickets') {
                updateData.maxTicketsPerUser = interaction.options.getInteger('limit');
                message = `✅ Max ticket: ${updateData.maxTicketsPerUser}`;
            }
            else if (sub === 'autoclose') {
                updateData.autoCloseHours = interaction.options.getInteger('saat');
                message = updateData.autoCloseHours ? `✅ Otomatik kapatma: ${updateData.autoCloseHours} saat` : '✅ Otomatik kapatma kapatıldı';
            }
            else if (sub === 'dm') {
                updateData.dmNotifications = interaction.options.getBoolean('aktif');
                message = updateData.dmNotifications ? '✅ DM bildirimleri açıldı' : '✅ DM bildirimleri kapatıldı';
            }
            else if (sub === 'webhook') {
                const url = interaction.options.getString('url');
                if (url && !url.startsWith('https://discord.com/api/webhooks/')) {
                    return interaction.editReply({ content: '❌ Geçersiz webhook URL!' });
                }
                updateData.webhookUrl = url || null;
                message = url ? '✅ Webhook ayarlandı' : '✅ Webhook kaldırıldı';
            }
            else if (sub === 'welcome') {
                updateData.welcomeMessage = interaction.options.getString('mesaj') || null;
                message = updateData.welcomeMessage ? '✅ Karşılama mesajı ayarlandı' : '✅ Varsayılan mesaja dönüldü';
            }

            await guildDB.update(interaction.guild.id, updateData);
            await interaction.editReply({ content: message });
        } catch (error) {
            logger.error('Settings error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
