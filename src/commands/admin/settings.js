import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Sunucu ticket ayarlarını yönetir')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Mevcut ayarları görüntüler')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('logchannel')
                .setDescription('Log kanalını ayarlar')
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Log kanalı')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('staffrole')
                .setDescription('Yetkili rolü ekler')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Yetkili rolü')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('removestaffrole')
                .setDescription('Yetkili rolü kaldırır')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Kaldırılacak rol')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('maxtickets')
                .setDescription('Kullanıcı başına maksimum ticket sayısı')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Maksimum ticket sayısı (1-10)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('autoclose')
                .setDescription('Otomatik kapatma süresini ayarlar')
                .addIntegerOption(option =>
                    option.setName('saat')
                        .setDescription('İnaktivite süresi (saat)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(168)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('dmnotifications')
                .setDescription('DM bildirimlerini açar/kapatır')
                .addBooleanOption(option =>
                    option.setName('durum')
                        .setDescription('DM bildirimleri')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('webhook')
                .setDescription('Webhook URL ayarlar')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('Webhook URL (boş bırakılırsa kaldırılır)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcomemessage')
                .setDescription('Karşılama mesajını ayarlar')
                .addStringOption(option =>
                    option.setName('mesaj')
                        .setDescription('Karşılama mesajı ({user} kullanıcı adı)')
                        .setRequired(true)
                        .setMaxLength(500)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'view':
                await viewSettings(interaction);
                break;
            case 'logchannel':
                await setLogChannel(interaction);
                break;
            case 'staffrole':
                await addStaffRole(interaction);
                break;
            case 'removestaffrole':
                await removeStaffRole(interaction);
                break;
            case 'maxtickets':
                await setMaxTickets(interaction);
                break;
            case 'autoclose':
                await setAutoClose(interaction);
                break;
            case 'dmnotifications':
                await setDMNotifications(interaction);
                break;
            case 'webhook':
                await setWebhook(interaction);
                break;
            case 'welcomemessage':
                await setWelcomeMessage(interaction);
                break;
        }
    },
};

async function viewSettings(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);

        const staffRoles = config.staffRoles 
            ? config.staffRoles.split(',').filter(r => r).map(r => `<@&${r}>`).join(', ')
            : 'Ayarlanmamış';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Sunucu Ayarları')
            .setThumbnail(interaction.guild.iconURL())
            .addFields(
                { name: '📁 Ticket Kategorisi', value: config.categoryId ? `<#${config.categoryId}>` : 'Ayarlanmamış', inline: true },
                { name: '📋 Panel Kanalı', value: config.panelChannelId ? `<#${config.panelChannelId}>` : 'Ayarlanmamış', inline: true },
                { name: '📝 Log Kanalı', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Ayarlanmamış', inline: true },
                { name: '👮 Yetkili Rolleri', value: staffRoles, inline: false },
                { name: '🎫 Toplam Ticket', value: `${config.ticketCount}`, inline: true },
                { name: '👤 Max Ticket/Kullanıcı', value: `${config.maxTicketsPerUser || 3}`, inline: true },
                { name: '⏰ Auto-Close', value: config.autoCloseHours ? `${config.autoCloseHours} saat` : 'Kapalı', inline: true },
                { name: '🌍 Dil', value: config.locale === 'en' ? '🇬🇧 English' : '🇹🇷 Türkçe', inline: true },
                { name: '📧 DM Bildirimleri', value: config.dmNotifications ? '✅ Açık' : '❌ Kapalı', inline: true },
                { name: '🔗 Webhook', value: config.webhookUrl ? '✅ Ayarlanmış' : '❌ Ayarlanmamış', inline: true },
            )
            .setFooter({ text: `${interaction.guild.name}` })
            .setTimestamp();

        if (config.welcomeMessage) {
            embed.addFields({
                name: '👋 Karşılama Mesajı',
                value: config.welcomeMessage.substring(0, 100) + (config.welcomeMessage.length > 100 ? '...' : ''),
                inline: false,
            });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Settings view hatası:', error);
        await interaction.editReply({
            content: '❌ Ayarlar yüklenirken bir hata oluştu!',
        });
    }
}

async function setLogChannel(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel('kanal');

    try {
        await guildDB.update(interaction.guild.id, { logChannelId: channel.id });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`✅ Log kanalı ${channel} olarak ayarlandı.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Log channel set to ${channel.name} for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings logchannel hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function addStaffRole(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const role = interaction.options.getRole('rol');

    try {
        const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const currentRoles = config.staffRoles ? config.staffRoles.split(',').filter(r => r) : [];

        if (currentRoles.includes(role.id)) {
            return interaction.editReply({ content: `❌ ${role} zaten yetkili rolü!` });
        }

        currentRoles.push(role.id);
        await guildDB.update(interaction.guild.id, { staffRoles: currentRoles.join(',') });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`✅ ${role} yetkili rolü olarak eklendi.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Staff role ${role.name} added for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings staffrole hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function removeStaffRole(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const role = interaction.options.getRole('rol');

    try {
        const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const currentRoles = config.staffRoles ? config.staffRoles.split(',').filter(r => r) : [];

        if (!currentRoles.includes(role.id)) {
            return interaction.editReply({ content: `❌ ${role} yetkili rolü değil!` });
        }

        const newRoles = currentRoles.filter(r => r !== role.id);
        await guildDB.update(interaction.guild.id, { staffRoles: newRoles.join(',') });

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(`✅ ${role} yetkili rolünden kaldırıldı.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Staff role ${role.name} removed for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings removestaffrole hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function setMaxTickets(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const limit = interaction.options.getInteger('limit');

    try {
        await guildDB.update(interaction.guild.id, { maxTicketsPerUser: limit });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`✅ Kullanıcı başına maksimum ticket sayısı **${limit}** olarak ayarlandı.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Max tickets set to ${limit} for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings maxtickets hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function setAutoClose(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const hours = interaction.options.getInteger('saat');

    try {
        await guildDB.update(interaction.guild.id, { autoCloseHours: hours });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(
                hours === 0 
                    ? '✅ Otomatik kapatma devre dışı bırakıldı.'
                    : `✅ İnaktif ticketlar **${hours} saat** sonra otomatik kapatılacak.`
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Auto-close set to ${hours}h for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings autoclose hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function setDMNotifications(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const enabled = interaction.options.getBoolean('durum');

    try {
        await guildDB.update(interaction.guild.id, { dmNotifications: enabled });

        const embed = new EmbedBuilder()
            .setColor(enabled ? '#57F287' : '#ED4245')
            .setDescription(
                enabled 
                    ? '✅ DM bildirimleri **açıldı**.'
                    : '❌ DM bildirimleri **kapatıldı**.'
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`DM notifications ${enabled ? 'enabled' : 'disabled'} for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings dmnotifications hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function setWebhook(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const url = interaction.options.getString('url');

    try {
        // Webhook URL doğrulama
        if (url && !url.startsWith('https://discord.com/api/webhooks/')) {
            return interaction.editReply({
                content: '❌ Geçersiz webhook URL! URL `https://discord.com/api/webhooks/` ile başlamalı.',
            });
        }

        await guildDB.update(interaction.guild.id, { webhookUrl: url || null });

        const embed = new EmbedBuilder()
            .setColor(url ? '#57F287' : '#ED4245')
            .setDescription(
                url 
                    ? '✅ Webhook URL **ayarlandı**.'
                    : '❌ Webhook URL **kaldırıldı**.'
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Webhook ${url ? 'set' : 'removed'} for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings webhook hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function setWelcomeMessage(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const message = interaction.options.getString('mesaj');

    try {
        await guildDB.update(interaction.guild.id, { welcomeMessage: message });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Karşılama Mesajı Ayarlandı')
            .setDescription(`Yeni mesaj:\n\n${message}`)
            .setFooter({ text: '{user} → kullanıcı adı olarak değiştirilir' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Welcome message updated for ${interaction.guild.name}`);

    } catch (error) {
        logger.error('Settings welcomemessage hatası:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}
