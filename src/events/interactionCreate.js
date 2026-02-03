import { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import logger from '../utils/logger.js';
import { guildDB, ticketDB, categoryDB, userDB } from '../utils/database.js';
import { createTicket, closeTicket, confirmClose, claimTicket, isStaff } from '../utils/ticketManager.js';
import { t } from '../utils/i18n.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Command handling
        if (interaction.isChatInputCommand()) {
            return handleCommand(interaction);
        }

        // Button handling
        if (interaction.isButton()) {
            return handleButton(interaction);
        }

        // Select menu handling
        if (interaction.isStringSelectMenu()) {
            return handleSelectMenu(interaction);
        }

        // Modal handling
        if (interaction.isModalSubmit()) {
            return handleModal(interaction);
        }

        // Autocomplete handling
        if (interaction.isAutocomplete()) {
            return handleAutocomplete(interaction);
        }
    },
};

// ==================== COMMAND HANDLER ====================
async function handleCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
    }

    // Cooldown check
    const cooldowns = interaction.client.cooldowns;
    const now = Date.now();
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (cooldowns.has(interaction.commandName)) {
        const timestamps = cooldowns.get(interaction.commandName);
        const userTimestamp = timestamps.get(interaction.user.id);

        if (userTimestamp) {
            const expirationTime = userTimestamp + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return interaction.reply({
                    content: `⏱️ Bu komutu kullanmak için **${timeLeft.toFixed(1)} saniye** beklemelisiniz.`,
                    ephemeral: true,
                });
            }
        }
    }

    // Set cooldown
    if (!cooldowns.has(interaction.commandName)) {
        cooldowns.set(interaction.commandName, new Map());
    }
    cooldowns.get(interaction.commandName).set(interaction.user.id, now);
    setTimeout(() => cooldowns.get(interaction.commandName).delete(interaction.user.id), cooldownAmount);

    // Execute command
    try {
        await command.execute(interaction);
        logger.debug(`Command executed: ${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
    } catch (error) {
        logger.error(`Command error (${interaction.commandName}):`, error);

        const errorMessage = '❌ Komut çalıştırılırken bir hata oluştu!';

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
        }
    }
}

// ==================== BUTTON HANDLER ====================
async function handleButton(interaction) {
    const customId = interaction.customId;

    try {
        // Ticket oluştur (direkt)
        if (customId === 'create_ticket') {
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const categories = await categoryDB.getAll(interaction.guild.id);

            // Kategori varsa seçim göster
            if (categories.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_category')
                    .setPlaceholder('Kategori seçin...')
                    .addOptions(
                        categories.map(cat => ({
                            label: cat.name,
                            description: cat.description || 'Kategori',
                            value: cat.id,
                            emoji: cat.emoji || '🎫',
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: t(interaction.guild.id, 'selectCategory'),
                    components: [row],
                    ephemeral: true,
                });
            }

            // Kategori yoksa direkt ticket oluştur
            return createTicket(interaction);
        }

        // Ticket oluştur (modal ile)
        if (customId === 'create_ticket_modal') {
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const categories = await categoryDB.getAll(interaction.guild.id);

            // Kategori varsa seçim göster
            if (categories.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_category_modal')
                    .setPlaceholder('Kategori seçin...')
                    .addOptions(
                        categories.map(cat => ({
                            label: cat.name,
                            description: cat.description || 'Kategori',
                            value: cat.id,
                            emoji: cat.emoji || '🎫',
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: t(interaction.guild.id, 'selectCategory'),
                    components: [row],
                    ephemeral: true,
                });
            }

            // Modal göster
            return showTicketModal(interaction);
        }

        // Ticket sahiplen
        if (customId === 'claim_ticket') {
            return claimTicket(interaction);
        }

        // Ticket kapat
        if (customId === 'close_ticket') {
            return closeTicket(interaction);
        }

        // Kapatma onayı
        if (customId.startsWith('close_confirm')) {
            const reason = customId.includes(':') ? customId.split(':')[1] : null;
            return confirmClose(interaction, reason);
        }

        // Kapatma iptali
        if (customId === 'close_cancel') {
            return interaction.update({
                content: t(interaction.guild.id, 'closeCancelled'),
                embeds: [],
                components: [],
            });
        }

        // Rating
        if (customId.startsWith('rate_')) {
            if (customId === 'rate_skip') {
                return interaction.update({
                    content: t(interaction.guild.id, 'ratingSkipped'),
                    embeds: [],
                    components: [],
                });
            }

            const rating = parseInt(customId.split('_')[1]);
            await ticketDB.setRating(interaction.channel.id, rating);

            return interaction.update({
                content: t(interaction.guild.id, 'ratingThanks') + ` (${rating}/5 ⭐)`,
                embeds: [],
                components: [],
            });
        }

    } catch (error) {
        logger.error('Button error:', error);
        await interaction.reply({
            content: '❌ Bir hata oluştu!',
            ephemeral: true,
        }).catch(() => {});
    }
}

// ==================== SELECT MENU HANDLER ====================
async function handleSelectMenu(interaction) {
    const customId = interaction.customId;

    try {
        // Kategori seçimi (direkt ticket)
        if (customId === 'select_category') {
            const categoryId = interaction.values[0];
            await interaction.update({ content: '⏳ Ticket oluşturuluyor...', components: [] });
            return createTicket(interaction, categoryId);
        }

        // Kategori seçimi (modal ile)
        if (customId === 'select_category_modal') {
            const categoryId = interaction.values[0];
            return showTicketModal(interaction, categoryId);
        }

    } catch (error) {
        logger.error('Select menu error:', error);
        await interaction.reply({
            content: '❌ Bir hata oluştu!',
            ephemeral: true,
        }).catch(() => {});
    }
}

// ==================== MODAL HANDLER ====================
async function handleModal(interaction) {
    const customId = interaction.customId;

    try {
        // Ticket modal
        if (customId.startsWith('ticket_modal')) {
            const categoryId = customId.includes(':') ? customId.split(':')[1] : null;
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const description = interaction.fields.getTextInputValue('ticket_description');

            return createTicket(interaction, categoryId, subject, description);
        }

    } catch (error) {
        logger.error('Modal error:', error);
        await interaction.reply({
            content: '❌ Bir hata oluştu!',
            ephemeral: true,
        }).catch(() => {});
    }
}

// ==================== AUTOCOMPLETE HANDLER ====================
async function handleAutocomplete(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command || !command.autocomplete) {
        return;
    }

    try {
        await command.autocomplete(interaction);
    } catch (error) {
        logger.error('Autocomplete error:', error);
    }
}

// ==================== HELPERS ====================
async function showTicketModal(interaction, categoryId = null) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket_modal${categoryId ? ':' + categoryId : ''}`)
        .setTitle(t(interaction.guild.id, 'modalTitle'));

    const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel(t(interaction.guild.id, 'modalSubject'))
        .setPlaceholder(t(interaction.guild.id, 'modalSubjectPlaceholder'))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel(t(interaction.guild.id, 'modalDesc'))
        .setPlaceholder(t(interaction.guild.id, 'modalDescPlaceholder'))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );

    return interaction.showModal(modal);
}
