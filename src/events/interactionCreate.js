import { Events } from 'discord.js';
import logger from '../utils/logger.js';
import { createTicket, closeTicket, confirmClose, handleRating, claimTicketButton, createTicketWithCategory } from '../utils/ticketManager.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // ==================== SLASH COMMANDS ====================
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                logger.error(`❌ ${interaction.commandName} komutu bulunamadı.`);
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
                        content: `⏰ Bu komutu tekrar kullanabilmek için ${timeLeft.toFixed(1)} saniye beklemelisin.`,
                        ephemeral: true,
                    });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

            // Komutu çalıştır
            try {
                await command.execute(interaction);
                logger.info(`✅ ${interaction.user.tag} - /${interaction.commandName} (${interaction.guild?.name || 'DM'})`);
            } catch (error) {
                logger.error(`❌ ${interaction.commandName} komutunda hata:`, error);
                
                const errorMessage = {
                    content: '❌ Bu komutu çalıştırırken bir hata oluştu!',
                    ephemeral: true,
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // ==================== BUTTONS ====================
        else if (interaction.isButton()) {
            const customId = interaction.customId;

            try {
                // Ticket oluştur
                if (customId === 'create_ticket') {
                    await createTicket(interaction);
                }
                
                // Ticket kapat (button)
                else if (customId === 'close_ticket') {
                    await closeTicket(interaction);
                }
                
                // Kapatma onayı
                else if (customId.startsWith('close_confirm')) {
                    const reason = customId.split(':')[1] || null;
                    await confirmClose(interaction, reason);
                }
                
                // Kapatma iptali
                else if (customId === 'close_cancel') {
                    await interaction.update({
                        content: '❌ Ticket kapatma işlemi iptal edildi.',
                        embeds: [],
                        components: [],
                    });
                }
                
                // Claim (button)
                else if (customId === 'claim_ticket') {
                    await claimTicketButton(interaction);
                }
                
                // Rating butonları
                else if (customId.startsWith('rating_')) {
                    const rating = customId.split('_')[1];
                    
                    if (rating === 'skip') {
                        await interaction.update({
                            content: '👋 Değerlendirme atlandı. Teşekkür ederiz!',
                            embeds: [],
                            components: [],
                        });
                    } else {
                        await handleRating(interaction, rating);
                    }
                }

                // Modal aç (ticket açarken)
                else if (customId === 'create_ticket_modal') {
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
                    
                    const modal = new ModalBuilder()
                        .setCustomId('ticket_create_modal')
                        .setTitle('🎫 Ticket Oluştur');

                    const subjectInput = new TextInputBuilder()
                        .setCustomId('ticket_subject')
                        .setLabel('Konu')
                        .setPlaceholder('Sorununuzun kısa bir özeti...')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(100);

                    const descriptionInput = new TextInputBuilder()
                        .setCustomId('ticket_description')
                        .setLabel('Açıklama')
                        .setPlaceholder('Sorununuzu detaylı bir şekilde açıklayın...')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1000);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(subjectInput),
                        new ActionRowBuilder().addComponents(descriptionInput)
                    );

                    await interaction.showModal(modal);
                }

                // Priority butonları
                else if (customId.startsWith('priority_')) {
                    const priority = parseInt(customId.split('_')[1]);
                    const { ticketDB } = await import('../utils/database.js');
                    const { EmbedBuilder } = await import('discord.js');

                    await ticketDB.setPriority(interaction.channel.id, priority);

                    const priorityNames = { 1: '🟢 Düşük', 2: '🟡 Orta', 3: '🟠 Yüksek', 4: '🔴 Acil' };
                    
                    const embed = new EmbedBuilder()
                        .setColor(priority === 4 ? '#ED4245' : priority === 3 ? '#FEE75C' : '#57F287')
                        .setDescription(`✅ Ticket önceliği **${priorityNames[priority]}** olarak ayarlandı.`)
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                }

            } catch (error) {
                logger.error(`❌ Button handler error (${customId}):`, error);
                
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Bir hata oluştu!',
                        ephemeral: true,
                    });
                }
            }
        }

        // ==================== SELECT MENUS ====================
        else if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            try {
                // Kategori seçimi
                if (customId === 'ticket_category_select') {
                    const categoryId = interaction.values[0];
                    await createTicketWithCategory(interaction, categoryId);
                }

                // Canned response seçimi
                else if (customId === 'canned_select') {
                    const { cannedDB } = await import('../utils/database.js');
                    const responseName = interaction.values[0];
                    
                    const response = await cannedDB.get(interaction.guild.id, responseName);
                    if (response) {
                        await cannedDB.incrementUse(interaction.guild.id, responseName);
                        await interaction.reply(response.content);
                    } else {
                        await interaction.reply({
                            content: '❌ Hazır yanıt bulunamadı!',
                            ephemeral: true,
                        });
                    }
                }

            } catch (error) {
                logger.error(`❌ Select menu error (${customId}):`, error);
                await interaction.reply({
                    content: '❌ Bir hata oluştu!',
                    ephemeral: true,
                });
            }
        }

        // ==================== MODALS ====================
        else if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            try {
                // Ticket oluşturma modal'ı
                if (customId === 'ticket_create_modal') {
                    const subject = interaction.fields.getTextInputValue('ticket_subject');
                    const description = interaction.fields.getTextInputValue('ticket_description');

                    // Modal verilerini sakla ve ticket oluştur
                    interaction.ticketData = { subject, description };
                    await createTicket(interaction);
                }

                // Canned response oluşturma modal'ı
                else if (customId === 'canned_create_modal') {
                    const { cannedDB } = await import('../utils/database.js');
                    const { EmbedBuilder } = await import('discord.js');

                    const name = interaction.fields.getTextInputValue('canned_name');
                    const content = interaction.fields.getTextInputValue('canned_content');

                    await cannedDB.create(interaction.guild.id, name, content, interaction.user.id);

                    const embed = new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle('✅ Hazır Yanıt Oluşturuldu')
                        .addFields(
                            { name: 'İsim', value: name, inline: true },
                            { name: 'İçerik', value: content.substring(0, 100) + (content.length > 100 ? '...' : ''), inline: false }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }

            } catch (error) {
                logger.error(`❌ Modal error (${customId}):`, error);
                await interaction.reply({
                    content: '❌ Bir hata oluştu!',
                    ephemeral: true,
                });
            }
        }

        // ==================== AUTOCOMPLETE ====================
        else if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                logger.error(`❌ Autocomplete error (${interaction.commandName}):`, error);
            }
        }
    },
};
