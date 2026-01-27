import { Events, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB, staffDB, messageDB } from '../utils/database.js';
import { isStaffMember } from '../utils/ticketManager.js';
import { addXP, updateStreak, XP_REWARDS } from '../utils/gamification.js';
import { recordFirstResponse } from '../utils/sla.js';
import { suggestCannedResponse } from '../utils/ai.js';
import logger from '../utils/logger.js';

export default {
    name: Events.MessageCreate,
    async execute(message) {
        // Bot mesajlarını yoksay
        if (message.author.bot) return;
        if (!message.guild) return;

        try {
            // Ticket kanalı mı kontrol et
            const ticket = await ticketDB.get(message.channel.id);
            if (!ticket) return;

            const guildConfig = await guildDB.getOrCreate(message.guild.id, message.guild.name);
            const isStaff = isStaffMember(message.member, guildConfig);

            // Mesaj sayısını artır
            await ticketDB.incrementMessages(message.channel.id, isStaff);

            // Mesajı kaydet (arama için)
            await messageDB.create(
                ticket.id,
                message.id,
                message.author.id,
                message.author.tag,
                message.content.substring(0, 1000),
                isStaff
            );

            // Staff ise
            if (isStaff) {
                // İlk yanıt SLA
                if (!ticket.firstResponseAt && ticket.userId !== message.author.id) {
                    await recordFirstResponse(message.channel.id);

                    // XP ver
                    const responseTime = Date.now() - new Date(ticket.createdAt).getTime();
                    const responseMinutes = responseTime / (1000 * 60);
                    
                    let xpAmount = XP_REWARDS.FIRST_RESPONSE;
                    if (responseMinutes < 5) {
                        xpAmount += XP_REWARDS.FAST_RESPONSE;
                    }

                    await addXP(message.guild.id, message.author.id, xpAmount, 'İlk yanıt');
                    await staffDB.incrementStats(message.guild.id, message.author.id, 'messagesCount');
                    await updateStreak(message.guild.id, message.author.id);
                }

                // Her mesaj için küçük XP
                await addXP(message.guild.id, message.author.id, XP_REWARDS.HELP_USER, 'Mesaj');

                // AI canned response önerisi
                if (guildConfig.aiEnabled && message.content.length > 20) {
                    const cannedResponses = await import('../utils/database.js').then(m => m.cannedDB.getAll(message.guild.id));
                    const suggestion = await suggestCannedResponse(message.content, cannedResponses);
                    
                    if (suggestion) {
                        await message.channel.send({
                            embeds: [new EmbedBuilder()
                                .setColor('#5865F2')
                                .setDescription(`💡 **Önerilen hazır yanıt:** \`${suggestion.name}\`\n\`/canned use ${suggestion.name}\``)
                            ],
                        }).catch(() => {});
                    }
                }
            }

        } catch (error) {
            logger.error('messageCreate error:', error);
        }
    },
};
