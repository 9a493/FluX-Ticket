import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB, categoryDB, templateDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Ticket paneli yönetimi')
        .addSubcommand(s => s.setName('send').setDescription('Panel gönder')
            .addChannelOption(o => o.setName('kanal').setDescription('Panel kanalı')))
        .addSubcommand(s => s.setName('categories').setDescription('Kategori paneli gönder'))
        .addSubcommand(s => s.setName('templates').setDescription('Şablon paneli gönder'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const channel = interaction.options.getChannel('kanal') || interaction.channel;

        if (sub === 'send') {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎫 Destek Talebi')
                .setDescription('Destek almak için aşağıdaki butona tıklayın.\n\nTicket açmadan önce:\n• Sorununuzu detaylı açıklayın\n• Sabırlı olun, en kısa sürede yanıt vereceğiz')
                .setImage('https://i.imgur.com/7WdehGN.png')
                .setFooter({ text: 'FluX Ticket • Destek Sistemi' });

            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('🎫 Ticket Aç')
                    .setStyle(ButtonStyle.Primary),
            );

            const msg = await channel.send({ embeds: [embed], components: [button] });
            await guildDB.update(interaction.guild.id, { panelChannelId: channel.id, panelMessageId: msg.id });
            await interaction.editReply({ content: `✅ Panel ${channel} kanalına gönderildi!` });

        } else if (sub === 'categories') {
            const categories = await categoryDB.getAll(interaction.guild.id);
            if (categories.length === 0) return interaction.editReply({ content: '❌ Önce kategori ekleyin!' });

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎫 Destek Talebi')
                .setDescription('Aşağıdan bir kategori seçerek ticket oluşturun.')
                .addFields(categories.map(c => ({ name: `${c.emoji || '📁'} ${c.name}`, value: c.description || 'Açıklama yok', inline: true })));

            const select = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('category_select')
                    .setPlaceholder('Kategori seçin...')
                    .addOptions(categories.map(c => ({ label: c.name, value: c.id, emoji: c.emoji || '📁', description: c.description?.substring(0, 50) }))),
            );

            await channel.send({ embeds: [embed], components: [select] });
            await interaction.editReply({ content: '✅ Kategori paneli gönderildi!' });

        } else if (sub === 'templates') {
            const templates = await templateDB.getAll(interaction.guild.id);
            if (templates.length === 0) return interaction.editReply({ content: '❌ Önce şablon ekleyin!' });

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎫 Destek Talebi')
                .setDescription('Aşağıdan bir şablon seçerek ticket oluşturun.');

            const select = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('template_select')
                    .setPlaceholder('Şablon seçin...')
                    .addOptions(templates.map(t => ({ label: t.name, value: t.id, emoji: t.emoji || '📋', description: t.description?.substring(0, 50) }))),
            );

            await channel.send({ embeds: [embed], components: [select] });
            await interaction.editReply({ content: '✅ Şablon paneli gönderildi!' });
        }
    },
};
