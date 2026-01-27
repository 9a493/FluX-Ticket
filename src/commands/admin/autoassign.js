import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB, staffDB } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('autoassign')
        .setDescription('Otomatik atama ayarları')
        .addSubcommand(s => s.setName('config').setDescription('Ayarları yapılandır')
            .addBooleanOption(o => o.setName('aktif').setDescription('Otomatik atama aktif mi?'))
            .addStringOption(o => o.setName('mod').setDescription('Atama modu')
                .addChoices(
                    { name: '🔄 Round-Robin', value: 'round-robin' },
                    { name: '⚖️ Yük Bazlı', value: 'load-based' },
                    { name: '⭐ Rating Bazlı', value: 'rating-based' },
                    { name: '🎲 Rastgele', value: 'random' },
                )))
        .addSubcommand(s => s.setName('toggle').setDescription('Kendin için açık/kapat'))
        .addSubcommand(s => s.setName('status').setDescription('Durumu göster'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        
        if (sub === 'config') {
            if (!interaction.member.permissions.has('Administrator')) 
                return interaction.reply({ content: '❌ Yönetici olmalısınız!', ephemeral: true });
            
            const data = {};
            const aktif = interaction.options.getBoolean('aktif');
            const mod = interaction.options.getString('mod');
            
            if (aktif !== null) data.autoAssignEnabled = aktif;
            if (mod) data.autoAssignMode = mod;
            
            await guildDB.update(interaction.guild.id, data);
            await interaction.reply({ content: '✅ Otomatik atama ayarları güncellendi!', ephemeral: true });
            
        } else if (sub === 'toggle') {
            const staff = await staffDB.getOrCreate(interaction.guild.id, interaction.user.id, interaction.user.username);
            await staffDB.update(interaction.guild.id, interaction.user.id, { autoAssignEnabled: !staff.autoAssignEnabled });
            await interaction.reply({ content: staff.autoAssignEnabled ? '❌ Artık otomatik atanmayacaksınız.' : '✅ Artık otomatik atanabilirsiniz.', ephemeral: true });
            
        } else {
            const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const modes = { 'round-robin': '🔄 Round-Robin', 'load-based': '⚖️ Yük Bazlı', 'rating-based': '⭐ Rating Bazlı', 'random': '🎲 Rastgele' };
            
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⚡ Otomatik Atama')
                .addFields(
                    { name: '📊 Durum', value: config.autoAssignEnabled ? '✅ Aktif' : '❌ Deaktif', inline: true },
                    { name: '🔧 Mod', value: modes[config.autoAssignMode] || '🔄 Round-Robin', inline: true },
                );
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
