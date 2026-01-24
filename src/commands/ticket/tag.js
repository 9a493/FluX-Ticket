import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tag')
        .setDescription('Ticket\'a etiket ekler veya kaldırır')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Ticket\'a etiket ekler')
                .addStringOption(option =>
                    option.setName('etiket')
                        .setDescription('Eklenecek etiket')
                        .setRequired(true)
                        .setMaxLength(30)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Ticket\'tan etiket kaldırır')
                .addStringOption(option =>
                    option.setName('etiket')
                        .setDescription('Kaldırılacak etiket')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Ticket etiketlerini listeler')
        ),

    async autocomplete(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket || !ticket.tags) {
            return interaction.respond([]);
        }

        const focusedValue = interaction.options.getFocused().toLowerCase();
        const tags = ticket.tags.split(',').filter(t => t);
        
        const filtered = tags
            .filter(t => t.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(t => ({ name: t, value: t }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.channel;
        const member = interaction.member;

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.reply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                    ephemeral: true,
                });
            }

            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            if (!isStaff && !member.permissions.has('Administrator')) {
                return interaction.reply({
                    content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                    ephemeral: true,
                });
            }

            switch (subcommand) {
                case 'add':
                    await handleAdd(interaction, ticket);
                    break;
                case 'remove':
                    await handleRemove(interaction, ticket);
                    break;
                case 'list':
                    await handleList(interaction, ticket);
                    break;
            }

        } catch (error) {
            logger.error('Tag command hatası:', error);
            await interaction.reply({
                content: '❌ Bir hata oluştu!',
                ephemeral: true,
            });
        }
    },
};

async function handleAdd(interaction, ticket) {
    const tag = interaction.options.getString('etiket').toLowerCase().replace(/\s+/g, '-');
    
    const currentTags = ticket.tags ? ticket.tags.split(',').filter(t => t) : [];
    
    if (currentTags.includes(tag)) {
        return interaction.reply({
            content: `❌ **${tag}** etiketi zaten ekli!`,
            ephemeral: true,
        });
    }

    if (currentTags.length >= 10) {
        return interaction.reply({
            content: '❌ Bir ticket\'a en fazla 10 etiket eklenebilir!',
            ephemeral: true,
        });
    }

    await ticketDB.addTag(interaction.channel.id, tag);

    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setDescription(`✅ **${tag}** etiketi eklendi.`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    logger.info(`Tag added to ticket #${ticket.ticketNumber}: ${tag}`);
}

async function handleRemove(interaction, ticket) {
    const tag = interaction.options.getString('etiket').toLowerCase();
    
    const currentTags = ticket.tags ? ticket.tags.split(',').filter(t => t) : [];
    
    if (!currentTags.includes(tag)) {
        return interaction.reply({
            content: `❌ **${tag}** etiketi bulunamadı!`,
            ephemeral: true,
        });
    }

    await ticketDB.removeTag(interaction.channel.id, tag);

    const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setDescription(`✅ **${tag}** etiketi kaldırıldı.`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    logger.info(`Tag removed from ticket #${ticket.ticketNumber}: ${tag}`);
}

async function handleList(interaction, ticket) {
    const tags = ticket.tags ? ticket.tags.split(',').filter(t => t) : [];

    if (tags.length === 0) {
        return interaction.reply({
            content: '📋 Bu ticket\'ta henüz etiket yok.',
            ephemeral: true,
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏷️ Ticket Etiketleri')
        .setDescription(tags.map(t => `\`${t}\``).join(' • '))
        .setFooter({ text: `Toplam ${tags.length} etiket` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}
