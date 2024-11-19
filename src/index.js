const { Client, Events, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const supabase = require('./utils/supabase');

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.commands = new Collection();
client.modules = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
  }
}

// Load modules
const modulesPath = path.join(__dirname, 'modules');
const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));

for (const file of moduleFiles) {
  const filePath = path.join(modulesPath, file);
  const module = require(filePath);
  client.modules.set(module.name, module);
}

// Register commands with Discord
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

// Handle interactions
client.on(Events.InteractionCreate, async interaction => {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }
    
    // Handle button clicks
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case 'matscraft':
          try {
            const matsCraftModule = client.modules.get('matscraft');
            if (!matsCraftModule) {
              throw new Error('MatsCraft module not found');
            }
            await matsCraftModule.showMatsCraft(interaction);
          } catch (error) {
            console.error('Error handling matscraft button:', error);
            await interaction.reply({ 
              content: 'There was an error accessing MatsCraft manager. Please try again.', 
              ephemeral: true 
            });
          }
          break;
          
        case 'generate_code':
        case 'refresh_code':
        case 'generate_new_code':
          const genCodeModule = client.modules.get('matscraft');
          if (genCodeModule) {
            await genCodeModule.generateCode(interaction);
          }
          break;
          
        case 'view_account':
          const viewAccModule = client.modules.get('matscraft');
          if (viewAccModule) {
            await viewAccModule.viewAccount(interaction);
          }
          break;
          
        case 'back_to_matscraft':
          const backToMatsModule = client.modules.get('matscraft');
          if (backToMatsModule) {
            await backToMatsModule.execute(interaction);
          }
          break;
          
        case 'back_to_nexus':
          const nexusCommand = client.commands.get('nexus');
          if (nexusCommand) {
            await nexusCommand.execute(interaction);
          }
          break;
          
        case 'help':
          await interaction.update({ 
            content: 'Help documentation coming soon!', 
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('back_to_nexus')
                    .setLabel('Back to Nexus')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
                )
            ]
          });
          break;
          
        case 'confirm_new_link':
          const confirmModule = client.modules.get('matscraft');
          if (confirmModule) {
            await confirmModule.generateNewCode(interaction);
          }
          break;
          
        case 'show_help':
          const helpModule = client.modules.get('matscraft');
          if (helpModule) {
            await helpModule.showHelp(interaction);
          }
          break;
          
        case 'refresh_display':
          const refreshModule = client.modules.get('matscraft');
          if (refreshModule) {
            // Get current token and update its display
            const { data: token } = await supabase
              .from('auth_tokens')
              .select('*')
              .eq('discord_id', parseInt(interaction.user.id))
              .eq('status', 'pending')
              .single();

            if (token) {
              const expiresAt = new Date(token.expires_at);
              const now = new Date();
              
              if (expiresAt > now) {
                const verificationEmbed = new EmbedBuilder()
                  .setTitle('Account Verification Code')
                  .setDescription(`Your verification code is: \`${token.verification_token}\`\n\n` +
                    'To link your account:\n' +
                    '1. Join the matsCraft server\n' +
                    '2. Type `/link` in the game chat\n' +
                    '3. Enter this code when prompted\n\n' +
                    `⏱️ Code expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`)
                  .setColor(COLORS.PRIMARY)
                  .setFooter({ text: '⚠️ This code will expire in exactly 5 minutes' });

                await interaction.update({ 
                  embeds: [verificationEmbed],
                  components: [row] 
                });
              } else {
                // Token has expired, show expired message
                const expiredEmbed = new EmbedBuilder()
                  .setTitle('Code Expired')
                  .setDescription('This verification code has expired. Please generate a new one.')
                  .setColor(COLORS.ERROR);

                await interaction.update({ 
                  embeds: [expiredEmbed],
                  components: [row] 
                });
              }
            }
          }
          break;
          
        case 'view_history':
          const historyModule = client.modules.get('matscraft');
          if (historyModule) {
            await historyModule.viewHistory(interaction);
          }
          break;
      }
    }
  } catch (error) {
    console.error(error);
    try {
      const errorMessage = 'There was an error processing your request. Please try again.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (e) {
      console.error('Error while handling error:', e);
    }
  }
});

client.once(Events.ClientReady, async () => {
  console.log('Bot is ready!');
  
  // Invalidate all pending tokens on startup
  try {
    const { error } = await supabase
      .from('auth_tokens')
      .update({ status: 'invalid' })
      .in('status', ['pending', 'active']);

    if (error) {
      console.error('Failed to invalidate tokens on startup:', error);
    } else {
      console.log('Successfully invalidated all pending tokens on startup');
    }
  } catch (error) {
    console.error('Error during token invalidation on startup:', error);
  }
});

client.login(process.env.DISCORD_TOKEN); 