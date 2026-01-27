import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import * as triggers from '../../utils/triggers.js';

export default {
    data: new SlashCommandBuilder()
        .setName('trigger')
        .setDescription('Keyword trigger yönetimi')
        .addSubcommand(s => s.setName('add').setDescription('Trigger ekle')
            .addStringOption(o => o.setName('keywords').setDescription('Anahtar kelimeler (virgülle ayır)').setRequired(true))
            .addStringOption(o => o.setName('yanıt').setDescription('Otomatik yanıt'))
            .addIntegerOption(o => o.setName('öncelik').setDescription('Otomatik öncelik').addChoices(
                { name: '🔴 Acil', value: 4 }, { name: '🟠 Yüksek', value: 3 }, { name: '🟡 Normal', value: 2 }, { name: '🟢 Düşük', value: 1 }))
            .addStringOption(o => o.setName('etiketler').setDescription('Otomatik etiketler')))
        .addSubcommand(s => s.setName('list').setDescription('Triggerleri listele'))
        .addSubcommand(s => s.setName('delete').setDescription('Trigger sil')
            .addStringOption(o => o.setName('id').setDescription('Trigger ID').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });
        
        if (sub === 'add') {
            const trigger = await triggers.createTrigger(interaction.guild.id, {
                keywords: interaction.options.getString('keywords'),
                autoResponse: interaction.options.getString('yanıt'),
                autoPriority: interaction.options.getInteger('öncelik'),
                autoTags: interaction.options.getString('etiketler'),
            });
            await interaction.editReply({ content: `✅ Trigger oluşturuldu! Keywords: ${trigger.keywords}` });
        } else if (sub === 'list') {
            const list = await triggers.getTriggers(interaction.guild.id);
            if (list.length === 0) return interaction.editReply({ content: '📋 Henüz trigger yok.' });
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🔧 Keyword Triggerlari')
                .setDescription(list.map((t, i) => `**${i + 1}.** \`${t.keywords}\`\n   Kullanım: ${t.triggerCount} | ID: \`${t.id}\``).join('\n\n'));
            await interaction.editReply({ embeds: [embed] });
        } else if (sub === 'delete') {
            await triggers.deleteTrigger(interaction.options.getString('id'));
            await interaction.editReply({ content: '✅ Trigger silindi.' });
        }
    },
};
