import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import * as kb from '../../utils/knowledgeBase.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('kb')
        .setDescription('Bilgi Bankası yönetimi')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Makale ekle')
                .addStringOption(option =>
                    option.setName('başlık')
                        .setDescription('Makale başlığı')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option.setName('içerik')
                        .setDescription('Makale içeriği')
                        .setRequired(true)
                        .setMaxLength(2000)
                )
                .addStringOption(option =>
                    option.setName('kategori')
                        .setDescription('Kategori')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('etiketler')
                        .setDescription('Etiketler (virgülle ayır)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Makaleleri listele')
                .addStringOption(option =>
                    option.setName('kategori')
                        .setDescription('Kategori filtresi')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Makale görüntüle')
                .addStringOption(option =>
                    option.setName('makale')
                        .setDescription('Makale adı')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Makalelerde ara')
                .addStringOption(option =>
                    option.setName('sorgu')
                        .setDescription('Aranacak metin')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Makale sil')
                .addStringOption(option =>
                    option.setName('makale')
                        .setDescription('Makale adı')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pin')
                .setDescription('Makaleyi sabitle/kaldır')
                .addStringOption(option =>
                    option.setName('makale')
                        .setDescription('Makale adı')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);

        if (focused.name === 'makale') {
            const articles = await kb.getAllArticles(interaction.guild.id, { limit: 25 });
            const filtered = articles.filter(a => 
                a.title.toLowerCase().includes(focused.value.toLowerCase())
            );
            await interaction.respond(
                filtered.slice(0, 25).map(a => ({ name: a.title, value: a.id }))
            );
        } else if (focused.name === 'kategori') {
            const categories = await kb.getCategories(interaction.guild.id);
            const filtered = categories.filter(c => 
                c.toLowerCase().includes(focused.value.toLowerCase())
            );
            await interaction.respond(
                filtered.slice(0, 25).map(c => ({ name: c, value: c }))
            );
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await addArticle(interaction);
                break;
            case 'list':
                await listArticles(interaction);
                break;
            case 'view':
                await viewArticle(interaction);
                break;
            case 'search':
                await searchArticles(interaction);
                break;
            case 'delete':
                await deleteArticle(interaction);
                break;
            case 'pin':
                await pinArticle(interaction);
                break;
        }
    },
};

async function addArticle(interaction) {
    // Admin kontrolü
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
            content: '❌ Makale eklemek için yönetici olmalısınız!',
            ephemeral: true,
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString('başlık');
    const content = interaction.options.getString('içerik');
    const category = interaction.options.getString('kategori');
    const tags = interaction.options.getString('etiketler');

    try {
        const article = await kb.createArticle(interaction.guild.id, {
            title,
            content,
            category,
            tags,
            authorId: interaction.user.id,
        });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Makale Oluşturuldu')
            .setDescription(`**${title}** bilgi bankasına eklendi.`)
            .addFields(
                { name: '📁 Kategori', value: category || 'Genel', inline: true },
                { name: '🏷️ Etiketler', value: tags || 'Yok', inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`KB article created: ${title} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('KB add hatası:', error);
        await interaction.editReply({ content: '❌ Makale eklenirken bir hata oluştu!' });
    }
}

async function listArticles(interaction) {
    await interaction.deferReply();

    const category = interaction.options.getString('kategori');

    try {
        const articles = await kb.getAllArticles(interaction.guild.id, { category });
        
        if (articles.length === 0) {
            return interaction.editReply({
                content: '📚 Henüz makale eklenmemiş.',
            });
        }

        const embed = kb.createArticleListEmbed(articles, category);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('KB list hatası:', error);
        await interaction.editReply({ content: '❌ Makaleler yüklenirken bir hata oluştu!' });
    }
}

async function viewArticle(interaction) {
    await interaction.deferReply();

    const articleId = interaction.options.getString('makale');

    try {
        const article = await kb.getArticle(articleId);
        
        if (!article) {
            return interaction.editReply({ content: '❌ Makale bulunamadı!' });
        }

        const embed = kb.createArticleEmbed(article);
        const buttons = kb.createVoteButtons(articleId);

        await interaction.editReply({ embeds: [embed], components: [buttons] });

    } catch (error) {
        logger.error('KB view hatası:', error);
        await interaction.editReply({ content: '❌ Makale yüklenirken bir hata oluştu!' });
    }
}

async function searchArticles(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('sorgu');

    try {
        const articles = await kb.searchArticles(interaction.guild.id, query);
        
        if (articles.length === 0) {
            return interaction.editReply({
                content: `🔍 "${query}" için sonuç bulunamadı.`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🔍 Arama: "${query}"`)
            .setDescription(
                articles.map((a, i) => 
                    `**${i + 1}.** ${a.pinned ? '📌 ' : ''}${a.title}\n> ${a.content.substring(0, 80)}...`
                ).join('\n\n')
            )
            .setFooter({ text: `${articles.length} sonuç bulundu` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('KB search hatası:', error);
        await interaction.editReply({ content: '❌ Arama yapılırken bir hata oluştu!' });
    }
}

async function deleteArticle(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
            content: '❌ Makale silmek için yönetici olmalısınız!',
            ephemeral: true,
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const articleId = interaction.options.getString('makale');

    try {
        await kb.deleteArticle(articleId);
        await interaction.editReply({ content: '✅ Makale silindi.' });

    } catch (error) {
        logger.error('KB delete hatası:', error);
        await interaction.editReply({ content: '❌ Makale silinirken bir hata oluştu!' });
    }
}

async function pinArticle(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
            content: '❌ Makale sabitlemek için yönetici olmalısınız!',
            ephemeral: true,
        });
    }

    await interaction.deferReply({ ephemeral: true });

    const articleId = interaction.options.getString('makale');

    try {
        const article = await kb.getArticle(articleId);
        if (!article) {
            return interaction.editReply({ content: '❌ Makale bulunamadı!' });
        }

        await kb.updateArticle(articleId, { pinned: !article.pinned });
        
        await interaction.editReply({
            content: article.pinned 
                ? '📌 Makale sabitlemesi kaldırıldı.'
                : '📌 Makale sabitlendi.',
        });

    } catch (error) {
        logger.error('KB pin hatası:', error);
        await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu!' });
    }
}
