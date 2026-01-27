import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getAuditLogs, createAuditEmbed } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('auditlog')
        .setDescription('Denetim günlüğünü görüntüle')
        .addStringOption(o => o.setName('işlem').setDescription('İşlem türü filtresi'))
        .addUserOption(o => o.setName('kullanıcı').setDescription('Kullanıcı filtresi'))
        .addIntegerOption(o => o.setName('limit').setDescription('Kayıt sayısı').setMinValue(1).setMaxValue(50))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const action = interaction.options.getString('işlem');
        const user = interaction.options.getUser('kullanıcı');
        const limit = interaction.options.getInteger('limit') || 20;
        
        const logs = await getAuditLogs(interaction.guild.id, {
            action,
            userId: user?.id,
            limit,
        });
        
        if (logs.length === 0) {
            return interaction.editReply({ content: '📋 Denetim kaydı bulunamadı.' });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📜 Denetim Günlüğü')
            .setDescription(logs.slice(0, 15).map(log => {
                const time = `<t:${Math.floor(new Date(log.createdAt).getTime() / 1000)}:R>`;
                return `**${log.action}** - ${log.userName}\n   └ ${log.targetType}:${log.targetId || 'N/A'} • ${time}`;
            }).join('\n\n'))
            .setFooter({ text: `${logs.length} kayıt gösteriliyor` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },
};
