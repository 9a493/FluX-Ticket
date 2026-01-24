import { AttachmentBuilder } from 'discord.js';
import logger from './logger.js';

/**
 * HTML formatında transcript oluşturur
 */
export async function generateTranscript(channel, ticket) {
    try {
        // Tüm mesajları çek (limit 100, daha fazlası için pagination gerekir)
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = [...messages.values()].reverse();

        // HTML oluştur
        const html = generateHTML(channel, ticket, sortedMessages);

        // Dosya olarak gönder
        const attachment = new AttachmentBuilder(Buffer.from(html, 'utf-8'), {
            name: `transcript-${ticket.ticketNumber.toString().padStart(4, '0')}.html`,
        });

        // Transcript'i kanala gönder
        const transcriptMessage = await channel.send({
            content: '📄 **Transcript oluşturuldu:**',
            files: [attachment],
        });

        // URL döndür
        return transcriptMessage.attachments.first()?.url || null;

    } catch (error) {
        logger.error('Transcript oluşturma hatası:', error);
        throw error;
    }
}

/**
 * HTML şablonu oluşturur
 */
function generateHTML(channel, ticket, messages) {
    const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
    const createdAt = new Date(ticket.createdAt).toLocaleString('tr-TR');
    const closedAt = new Date().toLocaleString('tr-TR');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket #${ticketNumber} - Transcript</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            background-color: #36393f;
            color: #dcddde;
            line-height: 1.5;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #5865f2, #7289da);
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .header h1 {
            color: white;
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .header .info {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        
        .header .info-item {
            background: rgba(255,255,255,0.1);
            padding: 10px 20px;
            border-radius: 5px;
            color: white;
        }
        
        .header .info-item span {
            display: block;
            font-size: 12px;
            opacity: 0.8;
        }
        
        .header .info-item strong {
            font-size: 16px;
        }
        
        .messages {
            background: #2f3136;
            border-radius: 10px;
            padding: 20px;
        }
        
        .message {
            display: flex;
            padding: 10px 0;
            border-bottom: 1px solid #40444b;
        }
        
        .message:last-child {
            border-bottom: none;
        }
        
        .message:hover {
            background: rgba(255,255,255,0.02);
        }
        
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 15px;
            flex-shrink: 0;
        }
        
        .message-content {
            flex: 1;
            min-width: 0;
        }
        
        .message-header {
            display: flex;
            align-items: baseline;
            gap: 10px;
            margin-bottom: 5px;
        }
        
        .author {
            font-weight: 600;
            color: #ffffff;
        }
        
        .author.bot {
            color: #5865f2;
        }
        
        .bot-tag {
            background: #5865f2;
            color: white;
            font-size: 10px;
            padding: 2px 5px;
            border-radius: 3px;
            font-weight: 600;
        }
        
        .timestamp {
            color: #72767d;
            font-size: 12px;
        }
        
        .text {
            color: #dcddde;
            word-wrap: break-word;
        }
        
        .embed {
            background: #2f3136;
            border-left: 4px solid #5865f2;
            border-radius: 4px;
            padding: 15px;
            margin-top: 10px;
            max-width: 500px;
        }
        
        .embed-title {
            color: white;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .embed-description {
            color: #dcddde;
        }
        
        .attachment {
            margin-top: 10px;
        }
        
        .attachment img {
            max-width: 400px;
            max-height: 300px;
            border-radius: 5px;
        }
        
        .attachment a {
            color: #00b0f4;
            text-decoration: none;
        }
        
        .attachment a:hover {
            text-decoration: underline;
        }
        
        .footer {
            text-align: center;
            margin-top: 20px;
            padding: 20px;
            color: #72767d;
            font-size: 14px;
        }
        
        .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        
        .stat {
            background: #2f3136;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #5865f2;
        }
        
        .stat-label {
            font-size: 12px;
            color: #72767d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Ticket #${ticketNumber}</h1>
            <p>${channel.guild.name}</p>
            <div class="info">
                <div class="info-item">
                    <span>Açılış Tarihi</span>
                    <strong>${createdAt}</strong>
                </div>
                <div class="info-item">
                    <span>Kapanış Tarihi</span>
                    <strong>${closedAt}</strong>
                </div>
                <div class="info-item">
                    <span>Toplam Mesaj</span>
                    <strong>${messages.length}</strong>
                </div>
            </div>
        </div>
        
        <div class="messages">
            ${messages.map(msg => generateMessageHTML(msg)).join('')}
        </div>
        
        <div class="footer">
            <p>Bu transcript ${channel.guild.name} sunucusunun ticket sistemi tarafından oluşturulmuştur.</p>
            <p>Oluşturulma: ${new Date().toLocaleString('tr-TR')}</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Tek bir mesaj için HTML oluşturur
 */
function generateMessageHTML(message) {
    const author = message.author;
    const timestamp = message.createdAt.toLocaleString('tr-TR');
    const isBot = author.bot;

    let content = escapeHTML(message.content);
    
    // Mention'ları düzenle
    content = content.replace(/<@!?(\d+)>/g, (match, id) => {
        const member = message.mentions.members?.get(id);
        return member ? `<span style="color: #7289da; background: rgba(114,137,218,0.1); padding: 0 2px; border-radius: 3px;">@${member.displayName}</span>` : match;
    });

    // Role mention'ları
    content = content.replace(/<@&(\d+)>/g, (match, id) => {
        const role = message.mentions.roles?.get(id);
        return role ? `<span style="color: ${role.hexColor}; background: rgba(255,255,255,0.1); padding: 0 2px; border-radius: 3px;">@${role.name}</span>` : match;
    });

    // Channel mention'ları
    content = content.replace(/<#(\d+)>/g, (match, id) => {
        const channel = message.guild?.channels.cache.get(id);
        return channel ? `<span style="color: #7289da;">#${channel.name}</span>` : match;
    });

    // Newline'ları br'ye çevir
    content = content.replace(/\n/g, '<br>');

    // Embeds
    let embedsHTML = '';
    if (message.embeds.length > 0) {
        for (const embed of message.embeds) {
            embedsHTML += `
                <div class="embed" style="border-color: ${embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865f2'};">
                    ${embed.title ? `<div class="embed-title">${escapeHTML(embed.title)}</div>` : ''}
                    ${embed.description ? `<div class="embed-description">${escapeHTML(embed.description).replace(/\n/g, '<br>')}</div>` : ''}
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
                        <img src="${attachment.url}" alt="Attachment">
                    </div>
                `;
            } else {
                attachmentsHTML += `
                    <div class="attachment">
                        <a href="${attachment.url}" target="_blank">📎 ${attachment.name}</a>
                    </div>
                `;
            }
        }
    }

    return `
        <div class="message">
            <img class="avatar" src="${author.displayAvatarURL({ size: 64 })}" alt="${author.username}">
            <div class="message-content">
                <div class="message-header">
                    <span class="author ${isBot ? 'bot' : ''}">${escapeHTML(author.username)}</span>
                    ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
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

export default { generateTranscript };
