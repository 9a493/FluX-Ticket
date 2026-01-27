import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('watch')
        .setDescription('Ticket takip listesine ekle/çıkar')
        .addSubcommand(s => s.setName('add').setDescription('Takibe al')
            .addUserOption(o => o.setName('kullanıcı').setDescription('Takibe alınacak kullanıcı').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Takipten çıkar')
            .addUserOption(o => o.setName('kullanıcı').setDescription('Çıkarılacak kullanıcı').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('Takip listesini göster'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu komut sadece ticket kanallarında!', ephemeral: true });
        
        const sub = interaction.options.getSubcommand();
        const watchers = ticket.watchers ? ticket.watchers.split(',').filter(w => w) : [];
        
        if (sub === 'add') {
            const user = interaction.options.getUser('kullanıcı');
            if (watchers.includes(user.id)) return interaction.reply({ content: '❌ Bu kullanıcı zaten takipte!', ephemeral: true });
            
            watchers.push(user.id);
            await ticketDB.update(interaction.channel.id, { watchers: watchers.join(',') });
            await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: false });
            
            await interaction.reply({ content: `✅ ${user} takip listesine eklendi.` });
        } else if (sub === 'remove') {
            const user = interaction.options.getUser('kullanıcı');
            const idx = watchers.indexOf(user.id);
            if (idx === -1) return interaction.reply({ content: '❌ Bu kullanıcı takipte değil!', ephemeral: true });
            
            watchers.splice(idx, 1);
            await ticketDB.update(interaction.channel.id, { watchers: watchers.join(',') });
            await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
            
            await interaction.reply({ content: `✅ ${user} takipten çıkarıldı.` });
        } else {
            if (watchers.length === 0) return interaction.reply({ content: '👁️ Bu ticketta izleyici yok.', ephemeral: true });
            await interaction.reply({ content: `👁️ **İzleyiciler:** ${watchers.map(w => `<@${w}>`).join(', ')}`, ephemeral: true });
        }
    },
};
