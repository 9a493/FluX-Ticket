import { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { guildDB, ticketDB, categoryDB, cannedDB, staffDB, templateDB } from '../utils/database.js';
import { createTicket, isStaffMember } from '../utils/ticketManager.js';
import { logAudit, AuditActions, TargetTypes } from '../utils/auditLog.js';
import { addXP, updateStreak, checkAndAwardBadges, XP_REWARDS } from '../utils/gamification.js';
import { recordFirstResponse } from '../utils/sla.js';
import { generateAutoResponse, analyzeSentiment, suggestCannedResponse } from '../utils/ai.js';
import { applyTriggers } from '../utils/triggers.js';
import { isBusinessHours, getBusinessHoursMessage } from '../utils/businessHours.js';
import { autoAssignTicket } from '../utils/autoAssign.js';
import * as kb from '../utils/knowledgeBase.js';
import logger from '../utils/logger.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // Slash Commands
            if (interaction.isChatInputCommand()) {
                await handleCommand(interaction);
            }
            // Buttons
            else if (interaction.isButton()) {
                await handleButton(interaction);
            }
            // Select Menus
            else if (interaction.isStringSelectMenu()) {
                await handleSelectMenu(interaction);
            }
            // Modals
            else if (interaction.isModalSubmit()) {
                await handleModal(interaction);
            }
            // Autocomplete
            else if (interaction.isAutocomplete()) {
                await handleAutocomplete(interaction);
            }
        } catch (error) {
            logger.error('Interaction error:', error);
            const reply = { content: '❌ Bir hata oluştu!', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply).catch(() => {});
            } else {
                await interaction.reply(reply).catch(() => {});
            }
        }
    },
};

async function handleCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Cooldown check
    const { cooldowns } = interaction.client;
    if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Map());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expiration = timestamps.get(interaction.user.id) + cooldownAmount;
        if (now < expiration) {
            const remaining = ((expiration - now) / 1000).toFixed(1);
            return interaction.reply({
                content: `⏳ Lütfen ${remaining} saniye bekleyin.`,
                ephemeral: true,
            });
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    await command.execute(interaction);
}

async function handleButton(interaction) {
    const [action, ...args] = interaction.customId.split('_');

    switch (action) {
        case 'create':
            await handleCreateTicket(interaction, args);
            break;
        case 'close':
            await handleCloseTicket(interaction);
            break;
        case 'claim':
            await handleClaimTicket(interaction);
            break;
        case 'reopen':
            await handleReopenTicket(interaction);
            break;
        case 'rate':
            await handleRating(interaction, args);
            break;
        case 'kb':
            await handleKBVote(interaction, args);
            break;
        default:
            break;
    }
}

async function handleSelectMenu(interaction) {
    const [action, ...args] = interaction.customId.split('_');

    if (action === 'category') {
        await handleCategorySelect(interaction);
    } else if (action === 'template') {
        await handleTemplateSelect(interaction);
    } else if (action === 'canned') {
        await handleCannedSelect(interaction);
    }
}

async function handleModal(interaction) {
    const [action, ...args] = interaction.customId.split('_');

    if (action === 'ticket') {
        await handleTicketModal(interaction, args);
    } else if (action === 'template') {
        await handleTemplateModal(interaction, args);
    }
}

async function handleAutocomplete(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
        await command.autocomplete(interaction);
    }
}

// ==================== TICKET HANDLERS ====================

async function handleCreateTicket(interaction, args) {
    const categoryId = args[0];
    const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);

    // Business hours check
    const businessStatus = isBusinessHours(guildConfig);

    // Modal for ticket details
    const modal = new ModalBuilder()
        .setCustomId(`ticket_create_${categoryId || 'none'}`)
        .setTitle('🎫 Yeni Ticket');

    const subjectInput = new TextInputBuilder()
        .setCustomId('subject')
        .setLabel('Konu')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Sorununuzu kısaca özetleyin')
        .setRequired(true)
        .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Açıklama')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Sorununuzu detaylı bir şekilde açıklayın')
        .setRequired(true)
        .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descriptionInput),
    );

    await interaction.showModal(modal);
}

async function handleTicketModal(interaction, args) {
    await interaction.deferReply({ ephemeral: true });

    const categoryId = args[1] !== 'none' ? args[1] : null;
    const subject = interaction.fields.getTextInputValue('subject');
    const description = interaction.fields.getTextInputValue('description');
    const content = `${subject}\n${description}`;

    const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);

    // Check triggers
    const triggerResult = await applyTriggers(interaction.guild.id, content);

    // Create ticket
    const result = await createTicket(
        interaction.guild,
        interaction.user,
        triggerResult?.category || categoryId,
        { subject, description }
    );

    if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.error}` });
    }

    // Business hours message
    const businessStatus = isBusinessHours(guildConfig);
    if (!businessStatus.isOpen && businessStatus.message) {
        await result.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#FEE75C')
                .setDescription(businessStatus.message)
            ],
        });
    }

    // Auto-assign
    if (guildConfig.autoAssignEnabled) {
        const assignedStaff = await autoAssignTicket(interaction.guild.id, categoryId);
        if (assignedStaff) {
            await result.channel.send({
                content: `📋 Bu ticket otomatik olarak <@${assignedStaff.userId}> kullanıcısına atandı.`,
            });
            await ticketDB.update(result.channel.id, { assignedTo: assignedStaff.userId, assignedAt: new Date() });
        }
    }

    // Trigger response
    if (triggerResult?.response) {
        await result.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#5865F2')
                .setDescription(triggerResult.response)
                .setFooter({ text: '💡 Otomatik Yanıt' })
            ],
        });
    }

    // AI auto-response
    if (guildConfig.aiEnabled && guildConfig.aiAutoResponse) {
        const ticket = await ticketDB.get(result.channel.id);
        const kbArticles = await kb.getAllArticles(interaction.guild.id, { limit: 5 });
        const aiResponse = await generateAutoResponse(ticket, guildConfig, kbArticles);
        
        if (aiResponse) {
            await result.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#9B59B6')
                    .setAuthor({ name: '🤖 AI Asistan' })
                    .setDescription(aiResponse)
                    .setFooter({ text: 'Claude AI tarafından oluşturuldu' })
                ],
            });
        }

        // Sentiment analysis
        const sentiment = await analyzeSentiment(content);
        if (sentiment) {
            await ticketDB.update(result.channel.id, { sentiment });
        }
    }

    // Priority from triggers
    if (triggerResult?.priority) {
        await ticketDB.update(result.channel.id, { priority: triggerResult.priority });
    }

    // Tags from triggers
    if (triggerResult?.tags?.length > 0) {
        await ticketDB.update(result.channel.id, { tags: triggerResult.tags.join(',') });
    }

    // Audit log
    await logAudit({
        guildId: interaction.guild.id,
        action: AuditActions.TICKET_CREATE,
        targetType: TargetTypes.TICKET,
        targetId: result.ticket.id,
        userId: interaction.user.id,
        userName: interaction.user.tag,
        details: `Subject: ${subject}`,
    });

    await interaction.editReply({
        content: `✅ Ticketınız oluşturuldu: ${result.channel}`,
    });
}

async function handleCloseTicket(interaction) {
    const ticket = await ticketDB.get(interaction.channel.id);
    if (!ticket) {
        return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });
    }

    await interaction.deferReply();

    // Close ticket
    await ticketDB.close(interaction.channel.id, interaction.user.id);

    // Staff XP
    if (ticket.claimedBy) {
        const xpResult = await addXP(interaction.guild.id, ticket.claimedBy, XP_REWARDS.CLOSE_TICKET, 'Ticket kapatma');
        await staffDB.incrementStats(interaction.guild.id, ticket.claimedBy, 'ticketsClosed');
        await updateStreak(interaction.guild.id, ticket.claimedBy);
        
        const staff = await staffDB.get(interaction.guild.id, ticket.claimedBy);
        if (staff) {
            await checkAndAwardBadges(interaction.guild.id, ticket.claimedBy, staff);
        }
    }

    // Audit log
    await logAudit({
        guildId: interaction.guild.id,
        action: AuditActions.TICKET_CLOSE,
        targetType: TargetTypes.TICKET,
        targetId: ticket.id,
        userId: interaction.user.id,
        userName: interaction.user.tag,
    });

    // Rating embed
    const ratingEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⭐ Deneyiminizi Değerlendirin')
        .setDescription('Aldığınız destek hizmeti nasıldı?');

    const ratingButtons = new ActionRowBuilder().addComponents(
        ...['1', '2', '3', '4', '5'].map(n => ({
            type: 2,
            style: 2,
            label: '⭐'.repeat(parseInt(n)),
            custom_id: `rate_${n}_${ticket.id}`,
        }))
    );

    await interaction.editReply({
        content: '🔒 Ticket kapatıldı. Bu kanal 30 saniye sonra silinecek.',
        embeds: [ratingEmbed],
        components: [ratingButtons],
    });

    // DM notification
    const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
    if (guildConfig.dmNotifications) {
        const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
        if (user) {
            await user.send({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔒 Ticket Kapatıldı')
                    .setDescription(`**${interaction.guild.name}** sunucusundaki ticketınız kapatıldı.`)
                    .addFields({ name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true })
                    .setTimestamp()
                ],
            }).catch(() => {});
        }
    }

    // Delete channel after 30 seconds
    setTimeout(() => interaction.channel.delete().catch(() => {}), 30000);
}

async function handleClaimTicket(interaction) {
    const ticket = await ticketDB.get(interaction.channel.id);
    if (!ticket) {
        return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });
    }

    if (ticket.claimedBy) {
        return interaction.reply({ content: `❌ Bu ticket zaten <@${ticket.claimedBy}> tarafından sahiplenilmiş!`, ephemeral: true });
    }

    // Staff check
    const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
    const isStaff = await isStaffMember(interaction.member, guildConfig);
    if (!isStaff) {
        return interaction.reply({ content: '❌ Sadece yetkililer ticket sahiplenebilir!', ephemeral: true });
    }

    await ticketDB.claim(interaction.channel.id, interaction.user.id);

    // First response SLA
    await recordFirstResponse(interaction.channel.id);

    // XP
    await addXP(interaction.guild.id, interaction.user.id, XP_REWARDS.CLAIM_TICKET, 'Ticket sahiplenme');
    await staffDB.incrementStats(interaction.guild.id, interaction.user.id, 'ticketsClaimed');

    // Audit log
    await logAudit({
        guildId: interaction.guild.id,
        action: AuditActions.TICKET_CLAIM,
        targetType: TargetTypes.TICKET,
        targetId: ticket.id,
        userId: interaction.user.id,
        userName: interaction.user.tag,
    });

    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setDescription(`✅ Bu ticket ${interaction.user} tarafından sahiplenildi.`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleReopenTicket(interaction) {
    const ticket = await ticketDB.get(interaction.channel.id);
    if (!ticket) {
        return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });
    }

    if (ticket.status !== 'closed') {
        return interaction.reply({ content: '❌ Bu ticket zaten açık!', ephemeral: true });
    }

    await ticketDB.reopen(interaction.channel.id);

    await logAudit({
        guildId: interaction.guild.id,
        action: AuditActions.TICKET_REOPEN,
        targetType: TargetTypes.TICKET,
        targetId: ticket.id,
        userId: interaction.user.id,
        userName: interaction.user.tag,
    });

    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setDescription('🔓 Bu ticket yeniden açıldı.')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleRating(interaction, args) {
    const rating = parseInt(args[0]);
    const ticketId = args[1];

    const ticket = await ticketDB.getById(ticketId);
    if (!ticket) {
        return interaction.reply({ content: '❌ Ticket bulunamadı!', ephemeral: true });
    }

    await ticketDB.update(ticket.channelId, { rating });

    // Staff rating XP
    if (ticket.claimedBy) {
        const xpAmount = rating >= 5 ? XP_REWARDS.FIVE_STAR_RATING :
                         rating >= 4 ? XP_REWARDS.FOUR_STAR_RATING :
                         rating >= 3 ? XP_REWARDS.THREE_STAR_RATING : 0;
        
        if (xpAmount > 0) {
            await addXP(ticket.guildId, ticket.claimedBy, xpAmount, `${rating} yıldız rating`);
        }

        // Update staff rating
        const staff = await staffDB.get(ticket.guildId, ticket.claimedBy);
        if (staff) {
            const newTotal = staff.totalRatings + 1;
            const newAvg = ((staff.averageRating * staff.totalRatings) + rating) / newTotal;
            await staffDB.update(ticket.guildId, ticket.claimedBy, {
                averageRating: newAvg,
                totalRatings: newTotal,
            });
        }
    }

    await interaction.update({
        content: `✅ Değerlendirmeniz için teşekkürler! (${'⭐'.repeat(rating)})`,
        embeds: [],
        components: [],
    });
}

async function handleKBVote(interaction, args) {
    const type = args[0];
    const articleId = args[1];

    await kb.voteArticle(articleId, type === 'helpful');
    await interaction.reply({
        content: type === 'helpful' ? '👍 Geri bildiriminiz için teşekkürler!' : '👎 Geri bildiriminiz alındı.',
        ephemeral: true,
    });
}

async function handleCategorySelect(interaction) {
    const categoryId = interaction.values[0];
    await handleCreateTicket(interaction, [categoryId]);
}

async function handleTemplateSelect(interaction) {
    const templateId = interaction.values[0];
    const template = await templateDB.get(templateId);
    
    if (!template || template.fields.length === 0) {
        await handleCreateTicket(interaction, ['none']);
        return;
    }

    // Create modal with template fields
    const modal = new ModalBuilder()
        .setCustomId(`template_submit_${templateId}`)
        .setTitle(`📋 ${template.name}`);

    for (const field of template.fields.slice(0, 5)) {
        const input = new TextInputBuilder()
            .setCustomId(field.id)
            .setLabel(field.label)
            .setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setPlaceholder(field.placeholder || '')
            .setRequired(field.required);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    await interaction.showModal(modal);
}

async function handleTemplateModal(interaction, args) {
    await interaction.deferReply({ ephemeral: true });

    const templateId = args[1];
    const template = await templateDB.get(templateId);

    if (!template) {
        return interaction.editReply({ content: '❌ Şablon bulunamadı!' });
    }

    // Collect field values
    let description = '';
    for (const field of template.fields) {
        const value = interaction.fields.getTextInputValue(field.id);
        description += `**${field.label}:** ${value}\n`;
    }

    // Create ticket with template data
    const result = await createTicket(
        interaction.guild,
        interaction.user,
        null,
        { subject: template.name, description }
    );

    if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.error}` });
    }

    // Apply template settings
    if (template.defaultPriority) {
        await ticketDB.update(result.channel.id, { priority: template.defaultPriority });
    }
    if (template.defaultTags) {
        await ticketDB.update(result.channel.id, { tags: template.defaultTags });
    }

    await templateDB.incrementUse(templateId);

    await interaction.editReply({
        content: `✅ Ticketınız oluşturuldu: ${result.channel}`,
    });
}

async function handleCannedSelect(interaction) {
    const responseName = interaction.values[0];
    const canned = await cannedDB.get(interaction.guild.id, responseName);

    if (!canned) {
        return interaction.reply({ content: '❌ Yanıt bulunamadı!', ephemeral: true });
    }

    await cannedDB.incrementUse(interaction.guild.id, responseName);

    await interaction.reply({ content: canned.content });
}
