import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import { isBusinessHours, getBusinessHoursSummary } from '../../utils/businessHours.js';

export default {
    data: new SlashCommandBuilder()
        .setName('businesshours')
        .setDescription('Çalışma saatleri ayarları')
        .addSubcommand(s => s.setName('set').setDescription('Çalışma saatlerini ayarla')
            .addBooleanOption(o => o.setName('aktif').setDescription('Çalışma saatleri aktif mi?'))
            .addStringOption(o => o.setName('başlangıç').setDescription('Başlangıç saati (örn: 09:00)'))
            .addStringOption(o => o.setName('bitiş').setDescription('Bitiş saati (örn: 18:00)'))
            .addStringOption(o => o.setName('günler').setDescription('Çalışma günleri (örn: 1,2,3,4,5)')))
        .addSubcommand(s => s.setName('status').setDescription('Mevcut durumu göster'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        
        if (sub === 'set') {
            const data = {};
            const aktif = interaction.options.getBoolean('aktif');
            if (aktif !== null) data.businessHoursEnabled = aktif;
            if (interaction.options.getString('başlangıç')) data.businessHoursStart = interaction.options.getString('başlangıç');
            if (interaction.options.getString('bitiş')) data.businessHoursEnd = interaction.options.getString('bitiş');
            if (interaction.options.getString('günler')) data.businessDays = interaction.options.getString('günler');
            
            await guildDB.update(interaction.guild.id, data);
            await interaction.reply({ content: '✅ Çalışma saatleri güncellendi!', ephemeral: true });
        } else {
            const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const status = isBusinessHours(config);
            const summary = getBusinessHoursSummary(config);
            
            const embed = new EmbedBuilder()
                .setColor(status.isOpen ? '#57F287' : '#ED4245')
                .setTitle('🕐 Çalışma Saatleri')
                .addFields(
                    { name: '📊 Durum', value: status.isOpen ? '✅ Açık' : '❌ Kapalı', inline: true },
                    { name: '⏰ Saatler', value: summary, inline: true },
                );
            await interaction.reply({ embeds: [embed] });
        }
    },
};
