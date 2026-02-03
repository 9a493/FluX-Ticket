import { EmbedBuilder } from 'discord.js';
import { transcriptDB } from './database.js';
import logger from './logger.js';

/**
 * Transcript oluşturur ve database'e kaydeder
 * @returns {string} Transcript ID (web'den görüntülemek için)
 */
export async function generateTranscript(channel, ticket, guild) {
    try {
        // Tüm mesajları çek
        const messages = await fetchAllMessages(channel);
        const sortedMessages = [...messages.values()].reverse();

        // HTML oluştur
        const html = generateHTML(channel, ticket, sortedMessages, guild);

        // Database'e kaydet
        const transcript = await transcriptDB.create({
            ticketId: ticket.id,
            guildId: ticket.guildId,
            ticketNumber: ticket.ticketNumber,
            userId: ticket.userId,
            userName: ticket.userName,
            closedBy: ticket.closedBy,
            closedByName: ticket.closedByName,
            channelName: channel.name,
            messageCount: sortedMessages.length,
            htmlContent: html,
            closedAt: new Date(),
        });

        logger.info(`Transcript oluşturuldu: #${ticket.ticketNumber} (ID: ${transcript.id})`);
        
        return transcript.id;

    } catch (error) {
        logger.error('Transcript oluşturma hatası:', error);
        throw error;
    }
}

/**
 * Tüm mesajları çeker (100'den fazla mesaj için)
 */
async function fetchAllMessages(channel, limit = 500) {
    const allMessages = new Map();
    let lastId;

    while (allMessages.size < limit) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        messages.forEach((msg, id) => allMessages.set(id, msg));
        lastId = messages.last()?.id;

        if (messages.size < 100) break;
    }

    return allMessages;
}

/**
 * HTML şablonu oluşturur
 */
function generateHTML(channel, ticket, messages, guild) {
    const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
    const createdAt = new Date(ticket.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const closedAt = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const guildName = guild?.name || channel.guild?.name || 'Unknown Server';
    const guildIcon = guild?.iconURL?.() || channel.guild?.iconURL?.() || '';

    const priorityNames = {
        1: { name: 'Düşük', color: '#57F287' },
        2: { name: 'Orta', color: '#FEE75C' },
        3: { name: 'Yüksek', color: '#F57C00' },
        4: { name: 'Acil', color: '#ED4245' },
    };

    const priority = priorityNames[ticket.priority] || priorityNames[1];

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket #${ticketNumber} - ${guildName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            color: #e2e8f0;
            line-height: 1.6;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            padding: 40px;
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
        }
        
        .header-top {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
        }
        
        .guild-icon {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: white;
        }
        
        .guild-icon img {
            width: 100%;
            height: 100%;
            border-radius: 16px;
            object-fit: cover;
        }
        
        .header-info h1 {
            color: white;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        
        .header-info p {
            color: rgba(255,255,255,0.8);
            font-size: 14px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
        }
        
        .stat-item {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            padding: 16px;
            border-radius: 12px;
            text-align: center;
        }
        
        .stat-item span {
            display: block;
            font-size: 12px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 4px;
        }
        
        .stat-item strong {
            display: block;
            font-size: 16px;
            color: white;
            font-weight: 600;
        }
        
        .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            background: ${priority.color}30;
            color: ${priority.color};
            border: 1px solid ${priority.color}50;
        }
        
        .ticket-info {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
        }
        
        .ticket-info h3 {
            color: #94a3b8;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
        }
        
        .ticket-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }
        
        .info-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .info-item label {
            font-size: 12px;
            color: #64748b;
        }
        
        .info-item value {
            font-size: 14px;
            color: #e2e8f0;
        }
        
        .messages {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            overflow: hidden;
        }
        
        .messages-header {
            padding: 16px 20px;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .messages-header h2 {
            color: #e2e8f0;
            font-size: 16px;
            font-weight: 600;
        }
        
        .message-count {
            background: #6366f1;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .messages-list {
            padding: 12px;
        }
        
        .message {
            display: flex;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            transition: background 0.2s;
        }
        
        .message:hover {
            background: rgba(255,255,255,0.03);
        }
        
        .avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            margin-right: 16px;
            flex-shrink: 0;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 16px;
        }
        
        .avatar img {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
        }
        
        .message-content {
            flex: 1;
            min-width: 0;
        }
        
        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
            flex-wrap: wrap;
        }
        
        .author {
            font-weight: 600;
            color: #e2e8f0;
            font-size: 14px;
        }
        
        .author.bot {
            color: #8b5cf6;
        }
        
        .author.staff {
            color: #f59e0b;
        }
        
        .bot-tag {
            background: #5865f2;
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        
        .staff-tag {
            background: #f59e0b;
            color: #1e293b;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
        }
        
        .timestamp {
            color: #64748b;
            font-size: 12px;
        }
        
        .text {
            color: #cbd5e1;
            word-wrap: break-word;
            font-size: 14px;
        }
        
        .text a {
            color: #60a5fa;
            text-decoration: none;
        }
        
        .text a:hover {
            text-decoration: underline;
        }
        
        .embed {
            background: #0f172a;
            border-left: 4px solid #6366f1;
            border-radius: 4px;
            padding: 16px;
            margin-top: 12px;
            max-width: 520px;
        }
        
        .embed-title {
            color: #e2e8f0;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .embed-description {
            color: #94a3b8;
            font-size: 13px;
        }
        
        .embed-fields {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-top: 12px;
        }
        
        .embed-field {
            font-size: 13px;
        }
        
        .embed-field-name {
            color: #e2e8f0;
            font-weight: 600;
            margin-bottom: 2px;
        }
        
        .embed-field-value {
            color: #94a3b8;
        }
        
        .attachment {
            margin-top: 12px;
        }
        
        .attachment img {
            max-width: 400px;
            max-height: 300px;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .attachment img:hover {
            transform: scale(1.02);
        }
        
        .attachment a {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #60a5fa;
            text-decoration: none;
            padding: 8px 12px;
            background: rgba(96, 165, 250, 0.1);
            border-radius: 6px;
            font-size: 13px;
        }
        
        .attachment a:hover {
            background: rgba(96, 165, 250, 0.2);
        }
        
        .footer {
            text-align: center;
            margin-top: 24px;
            padding: 24px;
            color: #64748b;
            font-size: 13px;
        }
        
        .footer a {
            color: #8b5cf6;
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .branding {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 12px;
        }
        
        .branding img {
            width: 20px;
            height: 20px;
        }
        
        @media (max-width: 640px) {
            .container {
                padding: 12px;
            }
            
            .header {
                padding: 24px;
            }
            
            .header-info h1 {
                font-size: 22px;
            }
            
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .message {
                padding: 8px 4px;
            }
            
            .avatar {
                width: 36px;
                height: 36px;
                margin-right: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-top">
                <div class="guild-icon">
                    ${guildIcon ? `<img src="${guildIcon}" alt="${guildName}">` : guildName.charAt(0).toUpperCase()}
                </div>
                <div class="header-info">
                    <h1>Ticket #${ticketNumber}</h1>
                    <p>${guildName}</p>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <span>Açılış Tarihi</span>
                    <strong>${createdAt}</strong>
                </div>
                <div class="stat-item">
                    <span>Kapanış Tarihi</span>
                    <strong>${closedAt}</strong>
                </div>
                <div class="stat-item">
                    <span>Mesaj Sayısı</span>
                    <strong>${messages.length}</strong>
                </div>
                <div class="stat-item">
                    <span>Öncelik</span>
                    <strong><span class="priority-badge">${priority.name}</span></strong>
                </div>
            </div>
        </div>
        
        <div class="ticket-info">
            <h3>Ticket Bilgileri</h3>
            <div class="ticket-info-grid">
                <div class="info-item">
                    <label>Açan Kullanıcı</label>
                    <value>${ticket.userName || ticket.userId}</value>
                </div>
                <div class="info-item">
                    <label>Kapatan</label>
                    <value>${ticket.closedByName || ticket.closedBy || 'Sistem'}</value>
                </div>
                ${ticket.claimedBy ? `
                <div class="info-item">
                    <label>Sahiplenen</label>
                    <value>${ticket.claimedByName || ticket.claimedBy}</value>
                </div>
                ` : ''}
                ${ticket.category ? `
                <div class="info-item">
                    <label>Kategori</label>
                    <value>${ticket.category.emoji || '🎫'} ${ticket.category.name}</value>
                </div>
                ` : ''}
                ${ticket.subject ? `
                <div class="info-item">
                    <label>Konu</label>
                    <value>${escapeHTML(ticket.subject)}</value>
                </div>
                ` : ''}
                ${ticket.closeReason ? `
                <div class="info-item">
                    <label>Kapanış Sebebi</label>
                    <value>${escapeHTML(ticket.closeReason)}</value>
                </div>
                ` : ''}
                ${ticket.rating ? `
                <div class="info-item">
                    <label>Değerlendirme</label>
                    <value>${'⭐'.repeat(ticket.rating)}${'☆'.repeat(5 - ticket.rating)} (${ticket.rating}/5)</value>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="messages">
            <div class="messages-header">
                <h2>💬 Mesajlar</h2>
                <span class="message-count">${messages.length} mesaj</span>
            </div>
            <div class="messages-list">
                ${messages.map(msg => generateMessageHTML(msg, ticket)).join('')}
            </div>
        </div>
        
        <div class="footer">
            <p>Bu transcript ${guildName} sunucusunun ticket sistemi tarafından oluşturulmuştur.</p>
            <p>Oluşturulma: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
            <div class="branding">
                <span>Powered by</span>
                <a href="https://fluxdigital.com.tr" target="_blank"><strong>FluX Ticket</strong></a>
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Tek bir mesaj için HTML oluşturur
 */
function generateMessageHTML(message, ticket) {
    const author = message.author;
    const timestamp = message.createdAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const isBot = author.bot;
    const isStaff = ticket.claimedBy === author.id;
    const isOwner = ticket.userId === author.id;

    let content = escapeHTML(message.content);
    
    // Mention'ları düzenle
    content = content.replace(/<@!?(\d+)>/g, (match, id) => {
        const member = message.mentions.members?.get(id);
        return member 
            ? `<span style="color: #8b5cf6; background: rgba(139,92,246,0.1); padding: 0 4px; border-radius: 4px;">@${member.displayName}</span>` 
            : match;
    });

    // Role mention'ları
    content = content.replace(/<@&(\d+)>/g, (match, id) => {
        const role = message.mentions.roles?.get(id);
        return role 
            ? `<span style="color: ${role.hexColor}; background: rgba(255,255,255,0.1); padding: 0 4px; border-radius: 4px;">@${role.name}</span>` 
            : match;
    });

    // Channel mention'ları
    content = content.replace(/<#(\d+)>/g, (match, id) => {
        const channel = message.guild?.channels.cache.get(id);
        return channel 
            ? `<span style="color: #60a5fa;">#${channel.name}</span>` 
            : match;
    });

    // Link'leri tıklanabilir yap
    content = content.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');

    // Newline'ları br'ye çevir
    content = content.replace(/\n/g, '<br>');

    // Embeds
    let embedsHTML = '';
    if (message.embeds.length > 0) {
        for (const embed of message.embeds) {
            const borderColor = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#6366f1';
            embedsHTML += `
                <div class="embed" style="border-color: ${borderColor};">
                    ${embed.title ? `<div class="embed-title">${escapeHTML(embed.title)}</div>` : ''}
                    ${embed.description ? `<div class="embed-description">${escapeHTML(embed.description).replace(/\n/g, '<br>')}</div>` : ''}
                    ${embed.fields?.length > 0 ? `
                        <div class="embed-fields">
                            ${embed.fields.map(f => `
                                <div class="embed-field">
                                    <div class="embed-field-name">${escapeHTML(f.name)}</div>
                                    <div class="embed-field-value">${escapeHTML(f.value)}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    // Attachments
    let attachmentsHTML = '';
    if (message.attachments.size > 0) {
        for (const [, attachment] of message.attachments) {
            if (attachment.contentType?.startsWith('image/')) {
                attachmentsHTML += `
                    <div class="attachment">
                        <a href="${attachment.url}" target="_blank">
                            <img src="${attachment.url}" alt="${attachment.name}" loading="lazy">
                        </a>
                    </div>
                `;
            } else {
                attachmentsHTML += `
                    <div class="attachment">
                        <a href="${attachment.url}" target="_blank">
                            📎 ${attachment.name} (${formatBytes(attachment.size)})
                        </a>
                    </div>
                `;
            }
        }
    }

    const avatarUrl = author.displayAvatarURL({ size: 64 });
    const authorClass = isBot ? 'bot' : (isStaff ? 'staff' : '');

    return `
        <div class="message">
            <div class="avatar">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${author.username}">` : author.username.charAt(0).toUpperCase()}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="author ${authorClass}">${escapeHTML(author.globalName || author.username)}</span>
                    ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
                    ${isStaff ? '<span class="staff-tag">STAFF</span>' : ''}
                    ${isOwner && !isBot ? '<span class="staff-tag" style="background: #22c55e;">OWNER</span>' : ''}
                    <span class="timestamp">${timestamp}</span>
                </div>
                ${content ? `<div class="text">${content}</div>` : ''}
                ${embedsHTML}
                ${attachmentsHTML}
            </div>
        </div>
    `;
}

/**
 * HTML karakterlerini escape eder
 */
function escapeHTML(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Byte'ları formatlar
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Transcript embed'i oluşturur (log kanalına gönderilecek)
 */
export function createTranscriptEmbed(ticket, transcriptId, baseUrl) {
    const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
    const transcriptUrl = `${baseUrl}/transcript/${transcriptId}`;
    
    const embed = new EmbedBuilder()
        .setColor('#8b5cf6')
        .setTitle(`📄 Transcript - Ticket #${ticketNumber}`)
        .setDescription(`Ticket kapatıldı ve transcript oluşturuldu.`)
        .addFields(
            { name: '👤 Açan', value: `<@${ticket.userId}>`, inline: true },
            { name: '🔒 Kapatan', value: ticket.closedBy ? `<@${ticket.closedBy}>` : 'Sistem', inline: true },
            { name: '💬 Mesaj Sayısı', value: `${ticket.messageCount}`, inline: true },
        )
        .setURL(transcriptUrl)
        .setTimestamp();

    if (ticket.closeReason) {
        embed.addFields({ name: '📋 Kapanış Sebebi', value: ticket.closeReason, inline: false });
    }

    if (ticket.rating) {
        const stars = '⭐'.repeat(ticket.rating) + '☆'.repeat(5 - ticket.rating);
        embed.addFields({ name: '⭐ Değerlendirme', value: `${stars} (${ticket.rating}/5)`, inline: true });
    }

    embed.addFields({ 
        name: '🔗 Transcript', 
        value: `[Web'de Görüntüle](${transcriptUrl})`, 
        inline: false 
    });

    return embed;
}

export default { generateTranscript, createTranscriptEmbed };
