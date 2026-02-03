import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { apiKeyDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('apikey')
        .setDescription('API anahtarlarını yönet')
        .addSubcommand(s => s.setName('create').setDescription('Yeni API anahtarı oluştur')
            .addStringOption(o => o.setName('isim').setDescription('Anahtar ismi').setRequired(true))
            .addStringOption(o => o.setName('izin').setDescription('İzinler').addChoices(
                { name: 'Sadece Okuma', value: 'read' },
                { name: 'Okuma + Yazma', value: 'read,write' },
                { name: 'Admin', value: 'admin' },
            )))
        .addSubcommand(s => s.setName('list').setDescription('API anahtarlarını listele'))
        .addSubcommand(s => s.setName('delete').setDescription('API anahtarını sil')
            .addStringOption(o => o.setName('id').setDescription('Anahtar ID').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            if (sub === 'create') {
                const name = interaction.options.getString('isim');
                const permissions = interaction.options.getString('izin') || 'read';

                const apiKey = await apiKeyDB.create(interaction.guild.id, name, permissions, interaction.user.id);
                await logAudit({ guildId: interaction.guild.id, action: AuditActions.API_KEY_CREATE, targetType: TargetTypes.API_KEY, userId: interaction.user.id, userName: interaction.user.tag, targetId: apiKey.id });

                const embed = new EmbedBuilder().setColor('#57F287').setTitle('🔑 API Anahtarı Oluşturuldu')
                    .setDescription(`\`\`\`${apiKey.key}\`\`\``)
                    .addFields(
                        { name: 'İsim', value: name, inline: true },
                        { name: 'İzinler', value: permissions, inline: true },
                    )
                    .setFooter({ text: '⚠️ Bu anahtarı güvenli bir yerde saklayın!' });
                await interaction.editReply({ embeds: [embed] });
            }
            else if (sub === 'list') {
                const keys = await apiKeyDB.getAll(interaction.guild.id);
                if (!keys.length) return interaction.editReply({ content: '🔑 API anahtarı yok.' });

                const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🔑 API Anahtarları')
                    .setDescription(keys.map(k => `**${k.name}** (${k.permissions})\nID: \`${k.id}\` | Kullanım: ${k.usageCount} | ${k.enabled ? '🟢' : '🔴'}`).join('\n\n'));
                await interaction.editReply({ embeds: [embed] });
            }
            else if (sub === 'delete') {
                const id = interaction.options.getString('id');
                const key = await apiKeyDB.getById(id);
                if (!key || key.guildId !== interaction.guild.id) return interaction.editReply({ content: '❌ Anahtar bulunamadı!' });

                await apiKeyDB.delete(id);
                await logAudit({ guildId: interaction.guild.id, action: AuditActions.API_KEY_DELETE, targetType: TargetTypes.API_KEY, userId: interaction.user.id, userName: interaction.user.tag, targetId: id });
                await interaction.editReply({ content: `🗑️ API anahtarı silindi: ${key.name}` });
            }
        } catch (error) {
            logger.error('APIKey error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
