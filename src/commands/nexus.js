const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { COLORS } = require('../utils/constants');
const path = require('path');

module.exports = {
  name: 'nexus',
  data: new SlashCommandBuilder()
    .setName('nexus')
    .setDescription('Access the Nexus control panel for Mallard products'),

  async execute(interaction) {
    // Create attachment from local file
    const imagePath = path.join(__dirname, '..', 'assets', 'nexus.png');
    const attachment = new AttachmentBuilder(imagePath);

    const embed = new EmbedBuilder()
      .setTitle('Welcome to Nexus')
      .setDescription('Get Started\n\nManage your Mallard products and services all in one place!')
      .addFields(
        { name: '🔑 Key Features', value: 
          '• Manage MatsCraft account\n' +
          '• Monitor service status\n' +
          '• Access product support\n' +
          '• View server statistics'
        },
        { name: '💡 Quick Start', value: 'Click one of the buttons below to begin!' }
      )
      .setImage('attachment://nexus.png')
      .setFooter({ text: '☁️ Nexus runs securely on Mallard Cloud' })
      .setColor(COLORS.PRIMARY);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('matscraft')
          .setLabel('matsCraft Manager')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮'),
        new ButtonBuilder()
          .setCustomId('help')
          .setLabel('Help & Commands')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row],
      files: [attachment],
      ephemeral: true
    });
  }
};
