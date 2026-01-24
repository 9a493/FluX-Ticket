import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { categoryDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('category')
        .setDescription('Ticket kategorisi yönetimi')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Yeni kategori ekler')
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Kategori adı')
                        .setRequired(true)
                        .setMaxLength(50)
                )
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Kategori emojisi')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('açıklama')
                        .setDescription('Kategori açıklaması')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addRoleOption(option =>
                    option.setName('yetkili-rol')
                        .setDescription('Bu kategoriye özel yetkili rol')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('renk')
                        .setDescription('Embed rengi (hex: #5865F2)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Kategori siler')
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Silinecek kategori')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Tüm kategorileri listeler')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Kategori düzenler')
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Düzenlenecek kategori')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('yeni-isim')
                        .setDescription('Yeni kategori adı')
                        .setRequired(false)
                        .setMaxLength(50)
                )
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Yeni emoji')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('açıklama')
                        .setDescription('Yeni açıklama')
                        .setRequired(false)
                        .setMaxLength(100)
                )
                .addBooleanOption(option =>
                    option.setName('aktif')
                        .setDescription('Kategori aktif mi?')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const categories = await categoryDB.getAll(interaction.guild.id);

        const filtered = categories
            .filter(c => c.name.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(c => ({ name: `${c.emoji || '🎫'} ${c.name}`, value: c.name }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await handleAdd(interaction);
                break;
            case 'remove':
                await handleRemove(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
            case 'edit':
                await handleEdit(interaction);
                break;
        }
    },
};

async function handleAdd(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('isim');
    const emoji = interaction.options.getString('emoji') || '🎫';
    const description = interaction.options.getString('açıklama');
    const staffRole = interaction.options.getRole('yetkili-rol');
    const color = interaction.options.getString('renk') || '#5865F2';

    try {
        // Zaten var mı?
        const categories = await categoryDB.getAll(interaction.guild.id);
        if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            return interaction.editReply({
                content: `❌ **${name}** isimli kategori zaten mevcut!`,
            });
        }

        await categoryDB.create(interaction.guild.id, name, {
            emoji,
            description,
            staffRoles: staffRole?.id || '',
            color,
        });

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('✅ Kategori Oluşturuldu')
            .addFields(
                { name: '📁 Kategori', value: `${emoji} ${name}`, inline: true },
                { name: '📝 Açıklama', value: description || 'Belirtilmedi', inline: true },
            )
            .setTimestamp();

        if (staffRole) {
            embed.addFields({ name: '👮 Yetkili Rol', value: `${staffRole}`, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Category created: ${name} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Category add hatası:', error);
        await interaction.editReply({
            content: '❌ Kategori oluşturulurken bir hata oluştu!',
        });
    }
}

async function handleRemove(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('isim');

    try {
        const categories = await categoryDB.getAll(interaction.guild.id);
        const category = categories.find(c => c.name.toLowerCase() === name.toLowerCase());

        if (!category) {
            return interaction.editReply({
                content: `❌ **${name}** isimli kategori bulunamadı!`,
            });
        }

        await categoryDB.delete(category.id);

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🗑️ Kategori Silindi')
            .setDescription(`**${category.emoji || '🎫'} ${category.name}** kategorisi silindi.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Category deleted: ${name} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Category remove hatası:', error);
        await interaction.editReply({
            content: '❌ Kategori silinirken bir hata oluştu!',
        });
    }
}

async function handleList(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const categories = await categoryDB.getAll(interaction.guild.id);

        if (categories.length === 0) {
            return interaction.editReply({
                content: '📋 Henüz kategori oluşturulmamış.\n\n' +
                         '**Varsayılan:** Kategori yoksa tüm ticketlar tek bir genel kategoride açılır.\n\n' +
                         '`/category add` komutu ile kategori ekleyebilirsiniz.',
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📁 Ticket Kategorileri')
            .setDescription(
                categories.map((c, i) => 
                    `**${i + 1}.** ${c.emoji || '🎫'} **${c.name}**${c.description ? `\n   └ ${c.description}` : ''}`
                ).join('\n\n')
            )
            .setFooter({ text: `Toplam ${categories.length} kategori` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Category list hatası:', error);
        await interaction.editReply({
            content: '❌ Kategoriler listelenirken bir hata oluştu!',
        });
    }
}

async function handleEdit(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('isim');
    const newName = interaction.options.getString('yeni-isim');
    const emoji = interaction.options.getString('emoji');
    const description = interaction.options.getString('açıklama');
    const enabled = interaction.options.getBoolean('aktif');

    try {
        const categories = await categoryDB.getAll(interaction.guild.id);
        const category = categories.find(c => c.name.toLowerCase() === name.toLowerCase());

        if (!category) {
            return interaction.editReply({
                content: `❌ **${name}** isimli kategori bulunamadı!`,
            });
        }

        // Güncelleme verilerini hazırla
        const updateData = {};
        if (newName) updateData.name = newName;
        if (emoji) updateData.emoji = emoji;
        if (description !== null) updateData.description = description;
        if (enabled !== null) updateData.enabled = enabled;

        if (Object.keys(updateData).length === 0) {
            return interaction.editReply({
                content: '❌ En az bir değişiklik yapmalısınız!',
            });
        }

        await categoryDB.update(category.id, updateData);

        const embed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('✏️ Kategori Düzenlendi')
            .setDescription(`**${category.emoji || '🎫'} ${category.name}** kategorisi güncellendi.`)
            .setTimestamp();

        if (newName) embed.addFields({ name: 'Yeni İsim', value: newName, inline: true });
        if (emoji) embed.addFields({ name: 'Yeni Emoji', value: emoji, inline: true });
        if (description) embed.addFields({ name: 'Yeni Açıklama', value: description, inline: true });
        if (enabled !== null) embed.addFields({ name: 'Durum', value: enabled ? '✅ Aktif' : '❌ Deaktif', inline: true });

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Category edited: ${name} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Category edit hatası:', error);
        await interaction.editReply({
            content: '❌ Kategori düzenlenirken bir hata oluştu!',
        });
    }
}
