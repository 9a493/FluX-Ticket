import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB, ticketDB } from '../../utils/database.js';
import { getSLAStatus } from '../../utils/sla.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('sla')
        .setDescription('SLA (Service Level Agreement) yönetimi')
        .addSubcommand(sub => sub.setName('status').setDescription('Bu ticket\'ın SLA durumunu göster'))
        .addSubcommand(sub => sub.setName('config').setDescription('SLA ayarlarını yapılandır')
            .addBooleanOption(o => o.setName('aktif').setDescription('SLA aktif mi?'))
            .addIntegerOption(o => o.setName('ilk_yanıt').setDescription('İlk yanıt süresi (dakika)').setMinValue(1).setMaxValue(1440))
            .addIntegerOption(o => o.setName('çözüm').setDescription('Çözüm süresi (saat)').setMinValue(1).setMaxValue(720))
            .addRoleOption(o => o.setName('eskalasyon_rol').setDescription('Eskalasyon yapılacak rol')))
        .addSubcommand(sub => sub.setName('report').setDescription('SLA performans raporu'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        
        if (sub === 'status') {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.reply({ content: '❌ Bu komut sadece ticket kanallarında!', ephemeral: true });
            
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            if (!guildConfig.slaEnabled) return interaction.reply({ content: '⚠️ SLA aktif değil.', ephemeral: true });
            
            const sla = getSLAStatus(ticket, guildConfig);
            const emojis = { pending: '⏳', warning: '⚠️', met: '✅', breached: '❌' };
            
            const embed = new EmbedBuilder()
                .setColor(sla?.breached ? '#ED4245' : '#57F287')
                .setTitle(`📊 SLA - Ticket #${ticket.ticketNumber.toString().padStart(4, '0')}`)
                .addFields(
                    { name: '⏱️ İlk Yanıt', value: `${emojis[sla?.firstResponse?.status]} ${sla?.firstResponse?.targetMins || 60}dk`, inline: true },
                    { name: '🎯 Çözüm', value: `${emojis[sla?.resolution?.status]} ${sla?.resolution?.targetHours || 24}sa`, inline: true },
                );
            await interaction.reply({ embeds: [embed] });
            
        } else if (sub === 'config') {
            if (!interaction.member.permissions.has('Administrator')) 
                return interaction.reply({ content: '❌ Yönetici olmalısınız!', ephemeral: true });
            
            const data = {};
            const enabled = interaction.options.getBoolean('aktif');
            const first = interaction.options.getInteger('ilk_yanıt');
            const res = interaction.options.getInteger('çözüm');
            const role = interaction.options.getRole('eskalasyon_rol');
            
            if (enabled !== null) data.slaEnabled = enabled;
            if (first) data.slaFirstResponseMins = first;
            if (res) data.slaResolutionHours = res;
            if (role) data.slaEscalationRole = role.id;
            
            await guildDB.update(interaction.guild.id, data);
            await interaction.reply({ content: '✅ SLA ayarları güncellendi!', ephemeral: true });
            
        } else if (sub === 'report') {
            const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const stats = config.stats;
            const total = (stats?.slaMetCount || 0) + (stats?.slaBreachedCount || 0);
            const rate = total > 0 ? ((stats?.slaMetCount || 0) / total * 100).toFixed(1) : 0;
            
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 SLA Raporu')
                .addFields(
                    { name: '✅ Karşılanan', value: `${stats?.slaMetCount || 0}`, inline: true },
                    { name: '❌ İhlal', value: `${stats?.slaBreachedCount || 0}`, inline: true },
                    { name: '📈 Oran', value: `%${rate}`, inline: true },
                );
            await interaction.reply({ embeds: [embed] });
        }
    },
};
