import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { cannedDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('canned')
        .setDescription('Hazır yanıt yönetimi')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Yeni hazır yanıt ekler')
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Hazır yanıt ismi (kısa)')
                        .setRequired(true)
                        .setMaxLength(50)
                )
                .addStringOption(option =>
                    option.setName('içerik')
                        .setDescription('Hazır yanıt içeriği')
                        .setRequired(true)
                        .setMaxLength(1000)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Hazır yanıt siler')
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Silinecek hazır yanıt')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Tüm hazır yanıtları listeler')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('use')
                .setDescription('Hazır yanıt kullanır')
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Kullanılacak hazır yanıt')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Hazır yanıtı düzenler')
                .addStringOption(option =>
                    option.setName('isim')
                        .setDescription('Düzenlenecek hazır yanıt')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('içerik')
                        .setDescription('Yeni içerik')
                        .setRequired(true)
                        .setMaxLength(1000)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const responses = await cannedDB.getAll(interaction.guild.id);

        const filtered = responses
            .filter(r => r.name.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(r => ({ name: r.name, value: r.name }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // Yetkili kontrolü
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const staffRoles = guildConfig.staffRoles 
            ? guildConfig.staffRoles.split(',').filter(r => r)
            : [];
        
        const isStaff = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!isStaff && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                ephemeral: true,
            });
        }

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
            case 'use':
                await handleUse(interaction);
                break;
            case 'edit':
                await handleEdit(interaction);
                break;
        }
    },
};

async function handleAdd(interaction) {
    const name = interaction.options.getString('isim').toLowerCase();
    const content = interaction.options.getString('içerik');

    try {
        // Zaten var mı?
        const existing = await cannedDB.get(interaction.guild.id, name);
        if (existing) {
            return interaction.reply({
                content: `❌ **${name}** isimli hazır yanıt zaten mevcut!`,
                ephemeral: true,
            });
        }

        await cannedDB.create(interaction.guild.id, name, content, interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Hazır Yanıt Oluşturuldu')
            .addFields(
                { name: '📝 İsim', value: `\`${name}\``, inline: true },
                { name: '👤 Oluşturan', value: `${interaction.user}`, inline: true },
                { name: '📄 İçerik', value: content.substring(0, 200) + (content.length > 200 ? '...' : ''), inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        logger.info(`Canned response created: ${name} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Canned add hatası:', error);
        await interaction.reply({
            content: '❌ Hazır yanıt oluşturulurken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

async function handleRemove(interaction) {
    const name = interaction.options.getString('isim').toLowerCase();

    try {
        const existing = await cannedDB.get(interaction.guild.id, name);
        if (!existing) {
            return interaction.reply({
                content: `❌ **${name}** isimli hazır yanıt bulunamadı!`,
                ephemeral: true,
            });
        }

        await cannedDB.delete(interaction.guild.id, name);

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🗑️ Hazır Yanıt Silindi')
            .setDescription(`**${name}** isimli hazır yanıt silindi.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        logger.info(`Canned response deleted: ${name} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Canned remove hatası:', error);
        await interaction.reply({
            content: '❌ Hazır yanıt silinirken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

async function handleList(interaction) {
    try {
        const responses = await cannedDB.getAll(interaction.guild.id);

        if (responses.length === 0) {
            return interaction.reply({
                content: '📋 Henüz hazır yanıt oluşturulmamış. `/canned add` ile ekleyebilirsiniz.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Hazır Yanıtlar')
            .setDescription(
                responses.map((r, i) => 
                    `**${i + 1}.** \`${r.name}\` - ${r.content.substring(0, 50)}${r.content.length > 50 ? '...' : ''} (${r.useCount} kullanım)`
                ).join('\n')
            )
            .setFooter({ text: `Toplam ${responses.length} hazır yanıt` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        logger.error('Canned list hatası:', error);
        await interaction.reply({
            content: '❌ Hazır yanıtlar listelenirken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

async function handleUse(interaction) {
    const name = interaction.options.getString('isim').toLowerCase();

    try {
        const response = await cannedDB.get(interaction.guild.id, name);
        if (!response) {
            return interaction.reply({
                content: `❌ **${name}** isimli hazır yanıt bulunamadı!`,
                ephemeral: true,
            });
        }

        // Kullanım sayısını artır
        await cannedDB.incrementUse(interaction.guild.id, name);

        // İçeriği gönder
        await interaction.reply(response.content);

        logger.info(`Canned response used: ${name} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Canned use hatası:', error);
        await interaction.reply({
            content: '❌ Hazır yanıt kullanılırken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

async function handleEdit(interaction) {
    const name = interaction.options.getString('isim').toLowerCase();
    const newContent = interaction.options.getString('içerik');

    try {
        const existing = await cannedDB.get(interaction.guild.id, name);
        if (!existing) {
            return interaction.reply({
                content: `❌ **${name}** isimli hazır yanıt bulunamadı!`,
                ephemeral: true,
            });
        }

        await cannedDB.update(interaction.guild.id, name, { content: newContent });

        const embed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('✏️ Hazır Yanıt Düzenlendi')
            .addFields(
                { name: '📝 İsim', value: `\`${name}\``, inline: true },
                { name: '📄 Yeni İçerik', value: newContent.substring(0, 200) + (newContent.length > 200 ? '...' : ''), inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        logger.info(`Canned response edited: ${name} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Canned edit hatası:', error);
        await interaction.reply({
            content: '❌ Hazır yanıt düzenlenirken bir hata oluştu!',
            ephemeral: true,
        });
    }
}
