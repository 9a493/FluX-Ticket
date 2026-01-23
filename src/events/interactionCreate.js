import { Events } from 'discord.js';
import logger from '../utils/logger.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Slash Command Handler
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
                logger.info(`✅ ${interaction.user.tag} tarafından ${interaction.commandName} komutu kullanıldı (${interaction.guild?.name || 'DM'})`);
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

        // Button Handler
        else if (interaction.isButton()) {
            const buttonHandlers = {
                'create_ticket': async () => {
                    const { createTicket } = await import('../utils/ticketManager.js');
                    await createTicket(interaction);
                },
                'close_ticket': async () => {
                    const { closeTicket } = await import('../utils/ticketManager.js');
                    await closeTicket(interaction);
                },
                'close_confirm': async () => {
                    const { confirmClose } = await import('../utils/ticketManager.js');
                    await confirmClose(interaction);
                },
                'close_cancel': async () => {
                    await interaction.update({
                        content: '❌ Ticket kapatma işlemi iptal edildi.',
                        components: [],
                    });
                },
            };

            const handler = buttonHandlers[interaction.customId];
            if (handler) {
                try {
                    await handler();
                } catch (error) {
                    logger.error(`❌ Button handler error (${interaction.customId}):`, error);
                    await interaction.reply({
                        content: '❌ Bir hata oluştu!',
                        ephemeral: true,
                    });
                }
            }
        }

        // Select Menu Handler
        else if (interaction.isStringSelectMenu()) {
            // Gelecekte kategori seçimi için kullanılacak
            logger.info(`Select menu interaction: ${interaction.customId}`);
        }
    },
};