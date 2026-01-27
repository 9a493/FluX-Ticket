import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('watcher')
        .setDescription('Ticket izleyicilerini yönetir')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('İzleyici ekler')
                .addUserOption(opt =>
                    opt.setName('kullanıcı')
                        .setDescription('Eklenecek kullanıcı')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('İzleyici çıkarır')
                .addUserOption(opt =>
                    opt.setName('kullanıcı')
                        .setDescription('Çıkarılacak kullanıcı')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('İzleyicileri listeler')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // Ticket kontrolü
        const ticket = await ticketDB.get(interaction.channel.id);
        
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

        switch (sub) {
            case 'add':
                await addWatcher(interaction, ticket);
                break;
            case 'remove':
                await removeWatcher(interaction, ticket);
                break;
            case 'list':
                await listWatchers(interaction, ticket);
                break;
        }
    },
};

async function addWatcher(interaction, ticket) {
    const user = interaction.options.getUser('kullanıcı');

    // Bot kontrolü
    if (user.bot) {
        return interaction.reply({
            content: '❌ Bot kullanıcıları izleyici olarak eklenemez!',
            ephemeral: true,
        });
    }

    await interaction.deferReply();

    try {
        // Mevcut watcherleri al
        const currentWatchers = ticket.watchers ? ticket.watchers.split(',').filter(w => w) : [];

        // Zaten var mı?
        if (currentWatchers.includes(user.id)) {
            return interaction.editReply({
                content: `❌ ${user} zaten bu ticket\'ın izleyicisi!`,
            });
        }

        // Ekle
        currentWatchers.push(user.id);
        await ticketDB.update(interaction.channel.id, {
            watchers: currentWatchers.join(','),
        });

        // Kanala erişim ver
        await interaction.channel.permissionOverwrites.edit(user.id, {
            ViewChannel: true,
            ReadMessageHistory: true,
        }).catch(() => {});

        const ticketNum = ticket.ticketNumber.toString().padStart(4, '0');

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('👁️ İzleyici Eklendi')
            .setDescription(`${user} artık **Ticket #${ticketNum}** izleyicisi.`)
            .addFields(
                { name: '➕ Eklenen', value: `${user}`, inline: true },
                { name: '👤 Ekleyen', value: `${interaction.user}`, inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Watcher ${user.tag} added to ticket #${ticketNum}`);

    } catch (error) {
        logger.error('Watcher add hatası:', error);
        await interaction.editReply({ content: '❌ İzleyici eklenirken bir hata oluştu!' });
    }
}

async function removeWatcher(interaction, ticket) {
    const user = interaction.options.getUser('kullanıcı');

    await interaction.deferReply();

    try {
        const currentWatchers = ticket.watchers ? ticket.watchers.split(',').filter(w => w) : [];

        if (!currentWatchers.includes(user.id)) {
            return interaction.editReply({
                content: `❌ ${user} bu ticket\'ın izleyicisi değil!`,
            });
        }

        // Çıkar
        const newWatchers = currentWatchers.filter(w => w !== user.id);
        await ticketDB.update(interaction.channel.id, {
            watchers: newWatchers.join(','),
        });

        // Kanaldan erişimi kaldır
        await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});

        const ticketNum = ticket.ticketNumber.toString().padStart(4, '0');

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('👁️ İzleyici Çıkarıldı')
            .setDescription(`${user} artık **Ticket #${ticketNum}** izleyicisi değil.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Watcher remove hatası:', error);
        await interaction.editReply({ content: '❌ İzleyici çıkarılırken bir hata oluştu!' });
    }
}

async function listWatchers(interaction, ticket) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const watchers = ticket.watchers ? ticket.watchers.split(',').filter(w => w) : [];

        if (watchers.length === 0) {
            return interaction.editReply({
                content: '👁️ Bu ticket\'ın izleyicisi yok.',
            });
        }

        const ticketNum = ticket.ticketNumber.toString().padStart(4, '0');

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`👁️ İzleyiciler - Ticket #${ticketNum}`)
            .setDescription(watchers.map((w, i) => `${i + 1}. <@${w}>`).join('\n'))
            .setFooter({ text: `Toplam ${watchers.length} izleyici` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('Watcher list hatası:', error);
        await interaction.editReply({ content: '❌ İzleyiciler listelenirken bir hata oluştu!' });
    }
}
