/**
 * FluX Ticket Bot - Claude AI Integration
 * Anthropic Claude API kullanarak otomatik yanıt ve analiz
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';

let anthropic = null;

/**
 * Claude AI client başlat
 */
export function initAI() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
        logger.warn('⚠️ ANTHROPIC_API_KEY bulunamadı, AI özellikleri devre dışı');
        return false;
    }

    try {
        anthropic = new Anthropic({ apiKey });
        logger.info('✅ Claude AI başlatıldı');
        return true;
    } catch (error) {
        logger.error('Claude AI başlatma hatası:', error);
        return false;
    }
}

/**
 * AI etkin mi kontrol et
 */
export function isAIEnabled() {
    return anthropic !== null;
}

/**
 * Ticket için otomatik karşılama yanıtı oluştur
 */
export async function generateWelcomeResponse(ticket, guildConfig, kbArticles = []) {
    if (!anthropic) return null;

    try {
        const systemPrompt = guildConfig.aiSystemPrompt || `Sen FluX Ticket destek asistanısın. 
Görevin: Kullanıcılara yardımcı olmak ve sorunlarını çözmek.

Kurallar:
- Türkçe yanıt ver
- Samimi ama profesyonel ol
- Kısa ve öz yanıtlar ver (max 3-4 cümle)
- Emoji kullanabilirsin ama abartma
- Eğer konuyu tam anlayamadıysan, nazikçe daha fazla bilgi iste
- Bilmediğin konularda "Bir yetkili size yardımcı olacaktır" de`;

        let kbContext = '';
        if (kbArticles.length > 0) {
            kbContext = '\n\nİlgili Bilgi Bankası Makaleleri:\n' + 
                kbArticles.slice(0, 3).map(a => `- ${a.title}: ${a.content.substring(0, 150)}...`).join('\n');
        }

        const userMessage = `Yeni bir destek talebi açıldı:

Konu: ${ticket.subject || 'Belirtilmemiş'}
Açıklama: ${ticket.description || 'Açıklama yok'}
Kategori: ${ticket.category?.name || 'Genel'}
Öncelik: ${getPriorityName(ticket.priority)}
${kbContext}

Bu kullanıcıya kısa bir karşılama mesajı yaz ve varsa bilgi bankasından faydalı bilgi paylaş.`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });

        const aiResponse = response.content[0].text;
        logger.info(`AI welcome response generated for ticket #${ticket.ticketNumber}`);
        
        return aiResponse;

    } catch (error) {
        logger.error('AI generateWelcomeResponse hatası:', error);
        return null;
    }
}

/**
 * Mesaja otomatik yanıt önerisi
 */
export async function generateReplysuggestion(ticket, lastMessages, guildConfig) {
    if (!anthropic) return null;

    try {
        const systemPrompt = guildConfig.aiSystemPrompt || `Sen FluX Ticket destek asistanısın.
Kullanıcının mesajına uygun bir yanıt öner. Kısa ve yardımcı ol.`;

        const conversation = lastMessages.slice(-5).map(m => 
            `${m.isStaff ? '[Yetkili]' : '[Kullanıcı]'}: ${m.content}`
        ).join('\n');

        const userMessage = `Ticket konuşması:
${conversation}

Bu konuşmaya uygun kısa bir yanıt öner.`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });

        return response.content[0].text;

    } catch (error) {
        logger.error('AI reply suggestion hatası:', error);
        return null;
    }
}

/**
 * Mesaj sentiment analizi
 */
export async function analyzeSentiment(content) {
    if (!anthropic) return null;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 30,
            messages: [{
                role: 'user',
                content: `Bu mesajın duygusal tonunu analiz et. Sadece şu kelimelerden BİRİNİ yaz:
positive, negative, neutral, frustrated, urgent, confused

Mesaj: "${content.substring(0, 300)}"`
            }],
        });

        const sentiment = response.content[0].text.toLowerCase().trim();
        const validSentiments = ['positive', 'negative', 'neutral', 'frustrated', 'urgent', 'confused'];
        
        return validSentiments.includes(sentiment) ? sentiment : 'neutral';

    } catch (error) {
        logger.error('AI sentiment hatası:', error);
        return null;
    }
}

/**
 * Kategori önerisi
 */
export async function suggestCategory(content, categories) {
    if (!anthropic || categories.length === 0) return null;

    try {
        const categoryList = categories.map(c => 
            `- ${c.name}: ${c.description || 'Açıklama yok'}`
        ).join('\n');

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 50,
            messages: [{
                role: 'user',
                content: `Bu mesaj için en uygun kategoriyi seç. SADECE kategori adını yaz.

Kategoriler:
${categoryList}

Mesaj: "${content.substring(0, 300)}"`
            }],
        });

        const suggested = response.content[0].text.trim();
        const match = categories.find(c => 
            c.name.toLowerCase() === suggested.toLowerCase()
        );

        return match?.id || null;

    } catch (error) {
        logger.error('AI category suggestion hatası:', error);
        return null;
    }
}

/**
 * Öncelik önerisi
 */
export async function suggestPriority(content) {
    if (!anthropic) return 2;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{
                role: 'user',
                content: `Bu mesajın aciliyetini değerlendir. Sadece 1-4 arası bir SAYI yaz:
1 = Düşük (genel soru)
2 = Normal (standart destek)
3 = Yüksek (önemli sorun)
4 = Acil (kritik, hemen çözülmeli)

Mesaj: "${content.substring(0, 300)}"`
            }],
        });

        const priority = parseInt(response.content[0].text.trim());
        return (priority >= 1 && priority <= 4) ? priority : 2;

    } catch (error) {
        logger.error('AI priority suggestion hatası:', error);
        return 2;
    }
}

/**
 * Knowledge Base'den ilgili makaleleri bul
 */
export async function findRelevantArticles(content, articles) {
    if (!anthropic || articles.length === 0) return [];

    try {
        const articleList = articles.slice(0, 10).map((a, i) => 
            `${i + 1}. ${a.title}`
        ).join('\n');

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 50,
            messages: [{
                role: 'user',
                content: `Bu soruyla ilgili makalelerin numaralarını virgülle ayırarak yaz.
Hiçbiri ilgili değilse "yok" yaz. Sadece numaraları yaz.

Makaleler:
${articleList}

Soru: "${content.substring(0, 300)}"`
            }],
        });

        const result = response.content[0].text.toLowerCase().trim();
        if (result === 'yok' || result === 'none') return [];

        const indices = result.split(',')
            .map(n => parseInt(n.trim()) - 1)
            .filter(n => !isNaN(n) && n >= 0 && n < articles.length);

        return indices.map(i => articles[i]).filter(Boolean);

    } catch (error) {
        logger.error('AI find articles hatası:', error);
        return [];
    }
}

/**
 * Canned response önerisi
 */
export async function suggestCannedResponse(content, cannedResponses) {
    if (!anthropic || cannedResponses.length === 0) return null;

    try {
        const responseList = cannedResponses.slice(0, 15).map(c => 
            `- ${c.name}: ${c.content.substring(0, 80)}...`
        ).join('\n');

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 50,
            messages: [{
                role: 'user',
                content: `Bu mesaja yanıt için en uygun hazır yanıtı seç.
Hiçbiri uygun değilse "yok" yaz. Sadece hazır yanıt adını yaz.

Hazır Yanıtlar:
${responseList}

Mesaj: "${content.substring(0, 300)}"`
            }],
        });

        const suggested = response.content[0].text.trim().toLowerCase();
        if (suggested === 'yok' || suggested === 'none') return null;

        const match = cannedResponses.find(c => 
            c.name.toLowerCase() === suggested
        );

        return match || null;

    } catch (error) {
        logger.error('AI canned suggestion hatası:', error);
        return null;
    }
}

/**
 * Ticket özeti oluştur
 */
export async function generateTicketSummary(messages) {
    if (!anthropic || messages.length === 0) return null;

    try {
        const conversation = messages.slice(-20).map(m => 
            `[${m.isStaff ? 'Yetkili' : 'Kullanıcı'}]: ${m.content}`
        ).join('\n');

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 150,
            messages: [{
                role: 'user',
                content: `Bu ticket konuşmasının kısa bir özetini yaz (max 2-3 cümle):

${conversation.substring(0, 2000)}`
            }],
        });

        return response.content[0].text.trim();

    } catch (error) {
        logger.error('AI ticket summary hatası:', error);
        return null;
    }
}

/**
 * Spam/flood tespiti
 */
export async function detectSpam(content) {
    if (!anthropic) return false;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{
                role: 'user',
                content: `Bu mesaj spam, reklam, anlamsız içerik veya trolleme mi?
Sadece "evet" veya "hayır" yaz.

Mesaj: "${content.substring(0, 300)}"`
            }],
        });

        const answer = response.content[0].text.trim().toLowerCase();
        return answer === 'evet' || answer === 'yes';

    } catch (error) {
        logger.error('AI spam detection hatası:', error);
        return false;
    }
}

/**
 * Otomatik etiket önerisi
 */
export async function suggestTags(content, existingTags = []) {
    if (!anthropic) return [];

    try {
        const tagList = existingTags.length > 0 
            ? `Mevcut etiketler: ${existingTags.join(', ')}` 
            : '';

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 50,
            messages: [{
                role: 'user',
                content: `Bu mesaj için uygun etiketleri virgülle ayırarak yaz (max 3 etiket).
${tagList}

Mesaj: "${content.substring(0, 300)}"`
            }],
        });

        return response.content[0].text
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t && t.length < 20)
            .slice(0, 3);

    } catch (error) {
        logger.error('AI tag suggestion hatası:', error);
        return [];
    }
}

/**
 * Helper: Öncelik adını al
 */
function getPriorityName(priority) {
    const names = { 1: 'Düşük', 2: 'Normal', 3: 'Yüksek', 4: 'Acil' };
    return names[priority] || 'Normal';
}

export default {
    initAI,
    isAIEnabled,
    generateWelcomeResponse,
    generateReplysuggestion,
    analyzeSentiment,
    suggestCategory,
    suggestPriority,
    findRelevantArticles,
    suggestCannedResponse,
    generateTicketSummary,
    detectSpam,
    suggestTags,
};
