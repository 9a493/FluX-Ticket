import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB, noteDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('note')
        .setDescription('Ticket\'a dahili not ekler (sadece yetkililer görür)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Not ekle')
                .addStringOption(option =>
                    option.setName('içerik')
                        .setDescription('Not içeriği')
                        .setRequired(true)
                        .setMaxLength(500)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Notları listele')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Not sil')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('Silinecek notun ID\'si')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.channel;

        // Ticket kontrolü
        const ticket = await ticketDB.get(channel.id);
        if (!ticket) {
            return interaction.reply({
                content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                ephemeral: true,
            });
        }

        // Yetkili kontrolü
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const staffRoles = guildConfig.staffRoles?.split(',').filter(r => r) || [];
        const isStaff = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));

        if (!isStaff && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                ephemeral: true,
            });
        }

        switch (subcommand) {
            case 'add':
                await addNote(interaction, ticket);
                break;
            case 'list':
                await listNotes(interaction, ticket);
                break;
            case 'delete':
                await deleteNote(interaction, ticket);
                break;
        }
    },
};

async function addNote(interaction, ticket) {
    const content = interaction.options.getString('içerik');

    try {
        await noteDB.create(ticket.id, interaction.user.id, content);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📝 Dahili Not Eklendi')
            .setDescription(content)
            .addFields(
                { name: '👤 Ekleyen', value: `${interaction.user}`, inline: true },
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
            )
            .setFooter({ text: 'Bu not sadece yetkililere görünür' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        
        logger.info(`Note added to ticket #${ticket.ticketNumber} by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('Note add hatası:', error);
        await interaction.reply({
            content: '❌ Not eklenirken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

async function listNotes(interaction, ticket) {
    try {
        const notes = await noteDB.getAll(ticket.id);

        if (notes.length === 0) {
            return interaction.reply({
                content: '📋 Bu ticketta henüz not yok.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📝 Dahili Notlar - Ticket #${ticket.ticketNumber.toString().padStart(4, '0')}`)
            .setDescription(
                notes.map((n, i) => 
                    `**${i + 1}.** <@${n.authorId}> - <t:${Math.floor(new Date(n.createdAt).getTime() / 1000)}:R>\n` +
                    `> ${n.content}\n` +
                    `\`ID: ${n.id}\``
                ).join('\n\n')
            )
            .setFooter({ text: `Toplam ${notes.length} not • Sadece yetkililere görünür` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        logger.error('Note list hatası:', error);
        await interaction.reply({
            content: '❌ Notlar yüklenirken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

async function deleteNote(interaction, ticket) {
    const noteId = interaction.options.getString('id');

    try {
        await noteDB.delete(noteId);

        await interaction.reply({
            content: '✅ Not silindi.',
            ephemeral: true,
        });

    } catch (error) {
        logger.error('Note delete hatası:', error);
        await interaction.reply({
            content: '❌ Not silinirken bir hata oluştu! ID\'yi kontrol edin.',
            ephemeral: true,
        });
    }
}
