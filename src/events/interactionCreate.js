import { Events, InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { createTicket, createTicketWithCategory, closeTicket, confirmClose, handleRating, claimTicketButton } from '../utils/ticketManager.js';
import { ticketDB, guildDB, categoryDB, cannedDB } from '../utils/database.js';
import logger from '../utils/logger.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // Slash Commands
            if (interaction.isChatInputCommand()) {
                await handleSlashCommand(interaction);
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
            else if (interaction.type === InteractionType.ModalSubmit) {
                await handleModal(interaction);
            }
            // Autocomplete
            else if (interaction.isAutocomplete()) {
                await handleAutocomplete(interaction);
            }
        } catch (error) {
            logger.error('Interaction hatası:', error);
            
            const errorMessage = '❌ Bir hata oluştu! Lütfen tekrar deneyin.';
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (e) {
                // Yanıt verilemezse sessizce devam et
            }
        }
    },
};

// ==================== SLASH COMMANDS ====================
async function handleSlashCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logger.warn(`Bilinmeyen komut: ${interaction.commandName}`);
        return;
    }

    // Cooldown kontrolü
    const { cooldowns } = interaction.client;
    
    if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Map());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({
                content: `⏱️ Lütfen **${timeLeft.toFixed(1)}** saniye bekleyin!`,
                ephemeral: true,
            });
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // Komutu çalıştır
    await command.execute(interaction);
}

// ==================== BUTTONS ====================
async function handleButton(interaction) {
    const customId = interaction.customId;

    // Ticket oluştur (modal'lı)
    if (customId === 'create_ticket_modal') {
        const modal = new ModalBuilder()
            .setCustomId('ticket_create_modal')
            .setTitle('🎫 Ticket Oluştur');

        const subjectInput = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel('Konu')
            .setPlaceholder('Sorununuzun kısa bir özeti...')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('ticket_description')
            .setLabel('Açıklama')
            .setPlaceholder('Sorununuzu detaylı bir şekilde açıklayın...')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(subjectInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
    }
    // Ticket oluştur (direkt)
    else if (customId === 'create_ticket') {
        await createTicket(interaction);
    }
    // Ticket kapat
    else if (customId === 'close_ticket') {
        await closeTicket(interaction);
    }
    // Kapatmayı onayla
    else if (customId === 'close_confirm') {
        await confirmClose(interaction);
    }
    // Kapatmayı iptal
    else if (customId === 'close_cancel') {
        await interaction.update({
            content: '❌ Ticket kapatma işlemi iptal edildi.',
            embeds: [],
            components: [],
        });
    }
    // Ticket sahiplen
    else if (customId === 'claim_ticket') {
        await claimTicketButton(interaction);
    }
    // Rating butonları (1-5)
    else if (customId.startsWith('rating_')) {
        const rating = customId.replace('rating_', '');
        if (rating === 'skip') {
            await interaction.update({
                content: '👋 Değerlendirme atlandı. Teşekkür ederiz!',
                embeds: [],
                components: [],
            });
        } else {
            await handleRating(interaction, parseInt(rating));
        }
    }
    // Priority butonları
    else if (customId.startsWith('priority_')) {
        const priority = parseInt(customId.replace('priority_', ''));
        await handlePriorityButton(interaction, priority);
    }
}

// ==================== SELECT MENUS ====================
async function handleSelectMenu(interaction) {
    const customId = interaction.customId;

    // Kategori seçimi
    if (customId === 'ticket_category_select') {
        const categoryId = interaction.values[0];
        await createTicketWithCategory(interaction, categoryId);
    }
    // Canned response seçimi
    else if (customId === 'canned_select') {
        const cannedName = interaction.values[0];
        await handleCannedSelect(interaction, cannedName);
    }
}

// ==================== MODALS ====================
async function handleModal(interaction) {
    const customId = interaction.customId;

    // Ticket oluşturma modal'ı
    if (customId === 'ticket_create_modal') {
        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const description = interaction.fields.getTextInputValue('ticket_description');
        
        await createTicket(interaction, { subject, description });
    }
    // Canned response oluşturma modal'ı
    else if (customId === 'canned_create_modal') {
        const name = interaction.fields.getTextInputValue('canned_name');
        const content = interaction.fields.getTextInputValue('canned_content');
        
        await handleCannedCreate(interaction, name, content);
    }
}

// ==================== AUTOCOMPLETE ====================
async function handleAutocomplete(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command || !command.autocomplete) {
        return;
    }

    try {
        await command.autocomplete(interaction);
    } catch (error) {
        logger.error('Autocomplete hatası:', error);
    }
}

// ==================== HELPER FUNCTIONS ====================
async function handlePriorityButton(interaction, priority) {
    try {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) {
            return interaction.reply({
                content: '❌ Bu ticket bulunamadı!',
                ephemeral: true,
            });
        }

        // Yetkili kontrolü
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const staffRoles = guildConfig.staffRoles?.split(',').filter(r => r) || [];
        const isStaff = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));

        if (!isStaff && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Bu işlem için yetkili olmalısınız!',
                ephemeral: true,
            });
        }

        await ticketDB.setPriority(interaction.channel.id, priority);

        const priorityNames = {
            1: '🟢 Düşük',
            2: '🟡 Orta',
            3: '🟠 Yüksek',
            4: '🔴 Acil',
        };

        await interaction.update({
            content: `✅ Öncelik **${priorityNames[priority]}** olarak ayarlandı.`,
            components: [],
        });
    } catch (error) {
        logger.error('Priority button hatası:', error);
    }
}

async function handleCannedSelect(interaction, cannedName) {
    try {
        const canned = await cannedDB.get(interaction.guild.id, cannedName);
        
        if (!canned) {
            return interaction.reply({
                content: '❌ Hazır yanıt bulunamadı!',
                ephemeral: true,
            });
        }

        // Kullanım sayısını artır
        await cannedDB.incrementUse(interaction.guild.id, cannedName);

        // Mesajı gönder
        await interaction.channel.send({
            content: canned.content,
        });

        await interaction.update({
            content: `✅ **${cannedName}** hazır yanıtı gönderildi.`,
            components: [],
        });
    } catch (error) {
        logger.error('Canned select hatası:', error);
    }
}

async function handleCannedCreate(interaction, name, content) {
    try {
        await cannedDB.create(
            interaction.guild.id,
            name,
            content,
            interaction.user.id
        );

        await interaction.reply({
            content: `✅ **${name}** hazır yanıtı oluşturuldu!`,
            ephemeral: true,
        });
    } catch (error) {
        if (error.code === 'P2002') {
            await interaction.reply({
                content: `❌ **${name}** isimli hazır yanıt zaten mevcut!`,
                ephemeral: true,
            });
        } else {
            throw error;
        }
    }
}
