import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from './database.js';
import logger from './logger.js';

/**
 * KB Makale oluştur
 */
export async function createArticle(guildId, data) {
    try {
        const article = await prisma.kBArticle.create({
            data: {
                guildId,
                title: data.title,
                content: data.content,
                category: data.category || null,
                tags: data.tags || null,
                authorId: data.authorId,
                published: data.published ?? true,
                pinned: data.pinned ?? false,
            },
        });

        logger.info(`KB Article created: ${article.title}`);
        return article;

    } catch (error) {
        logger.error('Create KB article error:', error);
        throw error;
    }
}

/**
 * Makale güncelle
 */
export async function updateArticle(articleId, data) {
    try {
        return await prisma.kBArticle.update({
            where: { id: articleId },
            data,
        });
    } catch (error) {
        logger.error('Update KB article error:', error);
        throw error;
    }
}

/**
 * Makale sil
 */
export async function deleteArticle(articleId) {
    try {
        await prisma.kBArticle.delete({
            where: { id: articleId },
        });
        return true;
    } catch (error) {
        logger.error('Delete KB article error:', error);
        throw error;
    }
}

/**
 * Makale al (ID ile)
 */
export async function getArticle(articleId) {
    try {
        const article = await prisma.kBArticle.findUnique({
            where: { id: articleId },
        });

        if (article) {
            // View count artır
            await prisma.kBArticle.update({
                where: { id: articleId },
                data: { viewCount: { increment: 1 } },
            });
        }

        return article;
    } catch (error) {
        logger.error('Get KB article error:', error);
        return null;
    }
}

/**
 * Tüm makaleleri getir
 */
export async function getAllArticles(guildId, options = {}) {
    const { 
        category = null, 
        published = true, 
        limit = 50,
        search = null,
    } = options;

    try {
        const where = { guildId };

        if (category) where.category = category;
        if (published !== null) where.published = published;

        // Arama
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { content: { contains: search } },
                { tags: { contains: search } },
            ];
        }

        return await prisma.kBArticle.findMany({
            where,
            orderBy: [
                { pinned: 'desc' },
                { order: 'asc' },
                { createdAt: 'desc' },
            ],
            take: limit,
        });

    } catch (error) {
        logger.error('Get all KB articles error:', error);
        return [];
    }
}

/**
 * Kategorileri getir
 */
export async function getCategories(guildId) {
    try {
        const articles = await prisma.kBArticle.findMany({
            where: { guildId, published: true },
            select: { category: true },
            distinct: ['category'],
        });

        return articles
            .map(a => a.category)
            .filter(Boolean)
            .sort();

    } catch (error) {
        logger.error('Get KB categories error:', error);
        return [];
    }
}

/**
 * Makale arama
 */
export async function searchArticles(guildId, query, limit = 10) {
    try {
        const articles = await prisma.kBArticle.findMany({
            where: {
                guildId,
                published: true,
                OR: [
                    { title: { contains: query } },
                    { content: { contains: query } },
                    { tags: { contains: query } },
                ],
            },
            orderBy: [
                { pinned: 'desc' },
                { viewCount: 'desc' },
            ],
            take: limit,
        });

        return articles;

    } catch (error) {
        logger.error('Search KB articles error:', error);
        return [];
    }
}

/**
 * Faydalı/faydasız oyla
 */
export async function voteArticle(articleId, helpful) {
    try {
        const field = helpful ? 'helpfulCount' : 'notHelpfulCount';
        
        await prisma.kBArticle.update({
            where: { id: articleId },
            data: { [field]: { increment: 1 } },
        });

        return true;
    } catch (error) {
        logger.error('Vote KB article error:', error);
        return false;
    }
}

/**
 * En popüler makaleleri getir
 */
export async function getPopularArticles(guildId, limit = 5) {
    try {
        return await prisma.kBArticle.findMany({
            where: { guildId, published: true },
            orderBy: { viewCount: 'desc' },
            take: limit,
        });
    } catch (error) {
        logger.error('Get popular KB articles error:', error);
        return [];
    }
}

/**
 * KB Embed oluştur
 */
export function createArticleEmbed(article) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📚 ${article.title}`)
        .setDescription(article.content.length > 2000 
            ? article.content.substring(0, 2000) + '...' 
            : article.content
        )
        .setTimestamp(new Date(article.updatedAt));

    if (article.category) {
        embed.addFields({ name: '📁 Kategori', value: article.category, inline: true });
    }

    if (article.tags) {
        embed.addFields({ 
            name: '🏷️ Etiketler', 
            value: article.tags.split(',').map(t => `\`${t.trim()}\``).join(' '), 
            inline: true 
        });
    }

    embed.addFields(
        { name: '👁️ Görüntüleme', value: `${article.viewCount}`, inline: true },
        { name: '👍 Faydalı', value: `${article.helpfulCount}`, inline: true },
        { name: '👎 Değil', value: `${article.notHelpfulCount}`, inline: true },
    );

    if (article.pinned) {
        embed.setAuthor({ name: '📌 Sabitlenmiş Makale' });
    }

    return embed;
}

/**
 * KB Liste embed'i oluştur
 */
export function createArticleListEmbed(articles, category = null, page = 1, totalPages = 1) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📚 Bilgi Bankası${category ? ` - ${category}` : ''}`)
        .setFooter({ text: `Sayfa ${page}/${totalPages} • ${articles.length} makale` })
        .setTimestamp();

    if (articles.length === 0) {
        embed.setDescription('Bu kategoride henüz makale bulunmuyor.');
        return embed;
    }

    const description = articles.map((a, i) => {
        const pinEmoji = a.pinned ? '📌 ' : '';
        const viewEmoji = a.viewCount > 100 ? '🔥 ' : '';
        return `${pinEmoji}${viewEmoji}**${i + 1}.** [${a.title}](# "${a.id}")\n   └ ${a.content.substring(0, 50)}...`;
    }).join('\n\n');

    embed.setDescription(description);

    return embed;
}

/**
 * Vote butonları oluştur
 */
export function createVoteButtons(articleId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`kb_helpful_${articleId}`)
            .setLabel('Faydalı')
            .setStyle(ButtonStyle.Success)
            .setEmoji('👍'),
        new ButtonBuilder()
            .setCustomId(`kb_not_helpful_${articleId}`)
            .setLabel('Değil')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👎'),
    );
}

export default {
    createArticle,
    updateArticle,
    deleteArticle,
    getArticle,
    getAllArticles,
    getCategories,
    searchArticles,
    voteArticle,
    getPopularArticles,
    createArticleEmbed,
    createArticleListEmbed,
    createVoteButtons,
};
