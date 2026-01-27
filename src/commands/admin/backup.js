import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB, ticketDB, categoryDB, cannedDB, staffDB, templateDB } from '../../utils/database.js';
import { getAllArticles } from '../../utils/knowledgeBase.js';
import { getTriggers } from '../../utils/triggers.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Veritabanı yedekleme işlemleri')
        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('Yedek oluştur')
        )
        .addSubcommand(sub => sub
            .setName('export')
            .setDescription('Ayarları JSON olarak dışa aktar')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'create') {
                await createBackup(interaction);
            } else if (sub === 'export') {
                await exportSettings(interaction);
            }
        } catch (error) {
            logger.error('Backup command hatası:', error);
            await interaction.editReply({
                content: '❌ Yedekleme sırasında bir hata oluştu!',
            });
        }
    },
};

async function createBackup(interaction) {
    const guildId = interaction.guild.id;

    // Tüm verileri topla
    const guildConfig = await guildDB.getOrCreate(guildId, interaction.guild.name);
    const categories = await categoryDB.getAll(guildId);
    const cannedResponses = await cannedDB.getAll(guildId);
    const templates = await templateDB.getAll(guildId);
    const kbArticles = await getAllArticles(guildId, { published: null });
    const triggers = await getTriggers(guildId);
    const staff = await staffDB.getAll(guildId);

    // Ticket istatistikleri
    const tickets = await ticketDB.getAllTickets(guildId);
    const ticketStats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        closed: tickets.filter(t => t.status === 'closed').length,
    };

    const backup = {
        version: '3.0.0',
        createdAt: new Date().toISOString(),
        guildId,
        guildName: interaction.guild.name,
        
        // Ayarlar
        settings: {
            locale: guildConfig.locale,
            timezone: guildConfig.timezone,
            maxTicketsPerUser: guildConfig.maxTicketsPerUser,
            autoCloseHours: guildConfig.autoCloseHours,
            welcomeMessage: guildConfig.welcomeMessage,
            closeMessage: guildConfig.closeMessage,
            
            // Business Hours
            businessHoursEnabled: guildConfig.businessHoursEnabled,
            businessHoursStart: guildConfig.businessHoursStart,
            businessHoursEnd: guildConfig.businessHoursEnd,
            businessDays: guildConfig.businessDays,
            
            // SLA
            slaEnabled: guildConfig.slaEnabled,
            slaFirstResponseMins: guildConfig.slaFirstResponseMins,
            slaResolutionHours: guildConfig.slaResolutionHours,
            
            // AI
            aiEnabled: guildConfig.aiEnabled,
            aiAutoResponse: guildConfig.aiAutoResponse,
            aiPrompt: guildConfig.aiPrompt,
            
            // Auto-Assign
            autoAssignEnabled: guildConfig.autoAssignEnabled,
            autoAssignMode: guildConfig.autoAssignMode,
        },
        
        // İçerik
        categories: categories.map(c => ({
            name: c.name,
            description: c.description,
            emoji: c.emoji,
            color: c.color,
            order: c.order,
        })),
        
        cannedResponses: cannedResponses.map(r => ({
            name: r.name,
            content: r.content,
            category: r.category,
        })),
        
        templates: templates.map(t => ({
            name: t.name,
            description: t.description,
            emoji: t.emoji,
            fields: t.fields,
            defaultPriority: t.defaultPriority,
            defaultTags: t.defaultTags,
        })),
        
        knowledgeBase: kbArticles.map(a => ({
            title: a.title,
            content: a.content,
            category: a.category,
            tags: a.tags,
            pinned: a.pinned,
        })),
        
        triggers: triggers.map(t => ({
            keywords: t.keywords,
            matchType: t.matchType,
            autoCategory: t.autoCategory,
            autoPriority: t.autoPriority,
            autoTags: t.autoTags,
            autoResponse: t.autoResponse,
        })),
        
        // İstatistikler (readonly)
        stats: {
            tickets: ticketStats,
            staffCount: staff.length,
            totalTickets: guildConfig.ticketCount,
        },
    };

    // JSON dosyası oluştur
    const jsonContent = JSON.stringify(backup, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { 
        name: `flux-backup-${guildId}-${Date.now()}.json` 
    });

    // Audit log
    await logAudit({
        guildId,
        action: 'backup_create',
        targetType: TargetTypes.SYSTEM,
        userId: interaction.user.id,
        userName: interaction.user.tag,
    });

    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅ Yedek Oluşturuldu')
        .setDescription('Sunucu ayarlarınızın yedeği başarıyla oluşturuldu.')
        .addFields(
            { name: '📁 Kategoriler', value: `${categories.length}`, inline: true },
            { name: '💬 Hazır Yanıtlar', value: `${cannedResponses.length}`, inline: true },
            { name: '📋 Şablonlar', value: `${templates.length}`, inline: true },
            { name: '📚 KB Makaleleri', value: `${kbArticles.length}`, inline: true },
            { name: '🔧 Triggerlar', value: `${triggers.length}`, inline: true },
            { name: '👥 Staff', value: `${staff.length}`, inline: true },
        )
        .setFooter({ text: 'Bu dosyayı güvenli bir yerde saklayın!' })
        .setTimestamp();

    await interaction.editReply({
        embeds: [embed],
        files: [attachment],
    });

    logger.info(`Backup created for guild ${guildId} by ${interaction.user.tag}`);
}

async function exportSettings(interaction) {
    const guildId = interaction.guild.id;
    const guildConfig = await guildDB.getOrCreate(guildId, interaction.guild.name);

    const settings = {
        exportedAt: new Date().toISOString(),
        locale: guildConfig.locale,
        timezone: guildConfig.timezone,
        maxTicketsPerUser: guildConfig.maxTicketsPerUser,
        autoCloseHours: guildConfig.autoCloseHours,
        welcomeMessage: guildConfig.welcomeMessage,
        closeMessage: guildConfig.closeMessage,
        businessHours: {
            enabled: guildConfig.businessHoursEnabled,
            start: guildConfig.businessHoursStart,
            end: guildConfig.businessHoursEnd,
            days: guildConfig.businessDays,
            outsideMessage: guildConfig.outsideHoursMessage,
        },
        sla: {
            enabled: guildConfig.slaEnabled,
            firstResponseMins: guildConfig.slaFirstResponseMins,
            resolutionHours: guildConfig.slaResolutionHours,
        },
        ai: {
            enabled: guildConfig.aiEnabled,
            autoResponse: guildConfig.aiAutoResponse,
            prompt: guildConfig.aiPrompt,
        },
        autoAssign: {
            enabled: guildConfig.autoAssignEnabled,
            mode: guildConfig.autoAssignMode,
        },
        spam: {
            protection: guildConfig.spamProtection,
            maxTickets: guildConfig.spamMaxTickets,
            timeframeMins: guildConfig.spamTimeframeMins,
        },
    };

    const jsonContent = JSON.stringify(settings, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { 
        name: `flux-settings-${guildId}.json` 
    });

    await interaction.editReply({
        content: '✅ Ayarlar dışa aktarıldı.',
        files: [attachment],
    });
}
