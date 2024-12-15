const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const { COLORS } = require('../utils/constants');
const supabase = require('../utils/supabase');
const { formatDistanceToNow } = require('date-fns');
const sharp = require('sharp');
const { AttachmentBuilder } = require('discord.js');
const { generateTokenImage } = require('../utils/imageGenerator');
const { ImageGenerationError } = require('../utils/imageGenerator');

// Add rate limiting map at the top of the file
const rateLimits = new Map();
const RATE_LIMIT_DURATION = 30000; // 30 seconds
const MAX_ATTEMPTS = 3;

// Add this function at the top of your file with other utility functions
function generateVerificationCode() {
    // Generate a random 6-character code in format XXX-XXX
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters I,1,0,O
    let code = '';
    
    // Generate first 3 characters
    for (let i = 0; i < 3; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Add hyphen
    code += '-';
    
    // Generate last 3 characters
    for (let i = 0; i < 3; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
}

module.exports = {
  name: 'matscraft',
  
  async execute(interaction) {
    // Get latest user data for real-time status
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', parseInt(interaction.user.id))
      .single();

    const embed = new EmbedBuilder()
      .setTitle('matsCraft Account Manager')
      .setDescription('Link your Discord account with your matsCraft account')
      .addFields(
        { name: '⚡ Account Status', value: 
          userData?.is_verified 
            ? `✅ Linked to \`${userData.minecraft_username}\``
            : '❌ No account linked'
        },
        { name: '📋 Available Actions', value:
          '• Generate a linking code\n' +
          '• View account details\n' +
          '• Check linking history\n' +
          '• View help & commands'
        }
      )
      .setColor(userData?.is_verified ? COLORS.SUCCESS : COLORS.PRIMARY)
      .setFooter({ text: '☁️ Nexus runs securely on Mallard Cloud' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('generate_code')
          .setLabel(userData?.is_verified ? 'Link Different Account' : 'Generate Code')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔗'),
        new ButtonBuilder()
          .setCustomId('view_account')
          .setLabel('Account Details')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId('view_history')
          .setLabel('History')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📋'),
        new ButtonBuilder()
          .setCustomId('show_help')
          .setLabel('Help')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );

    if (interaction.isButton()) {
      await interaction.update({ 
        embeds: [embed], 
        components: [row],
        files: [],
        attachments: []
      });
    } else {
      await interaction.reply({ 
        embeds: [embed], 
        components: [row], 
        ephemeral: true,
        files: [],
        attachments: []
      });
    }
  },

  async viewAccount(interaction) {
    const discordId = interaction.user.id;

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', parseInt(discordId))
        .single();

      if (error) throw error;

      const embed = new EmbedBuilder()
        .setTitle('Account Details')
        .setDescription(`
          Discord: ${user.discord_username}
          Minecraft: ${user.minecraft_username || 'Not linked'}
          Status: ${user.is_verified ? '✅ Verified' : '❌ Not verified'}
          ...
        `)
        .setColor(COLORS.PRIMARY)
        .setFooter({ text: '☁️ Nexus runs securely on Mallard Cloud' });

      if (!user) {
        embed.setDescription('No account found. Generate a verification code to get started!');
      } else {
        embed
          .addFields(
            { name: 'Discord Account', value: `<@${discordId}> (${user.discord_username})`, inline: true },
            { name: 'Status', value: user.is_verified ? '✅ Verified' : '❌ Unverified', inline: true }
          );

        if (user.is_verified && user.minecraft_username) {
          embed.addFields(
            { name: 'Minecraft Account', value: `\`${user.minecraft_username}\``, inline: true }
          );
        }

        // Add last updated timestamp
        embed.setFooter({ 
          text: `Last updated: ${new Date(user.updated_at).toLocaleString()}`
        });
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('generate_code')
            .setLabel(user?.is_verified ? 'Link Different Account' : 'Generate Code')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔗'),
          new ButtonBuilder()
            .setCustomId('back_to_matscraft')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      await interaction.update({ embeds: [embed], components: [row] });

    } catch (error) {
      console.error('Error:', error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('Failed to fetch account information. Please try again.')
        .setColor(COLORS.ERROR);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('back_to_matscraft')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      await interaction.update({ embeds: [errorEmbed], components: [row] });
    }
  },

  async generateCode(interaction) {
    const discordId = interaction.user.id;

    try {
      const { data: existingVerified } = await supabase
        .from('users')
        .select('minecraft_username')
        .eq('discord_id', parseInt(discordId))
        .eq('is_verified', true)
        .single();

      if (existingVerified) {
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Account Already Linked')
          .setDescription(
            `You currently have a Minecraft account linked: \`${existingVerified.minecraft_username}\`\n\n` +
            '**Warning:** Generating a new code will unlink your current account. ' +
            'Are you sure you want to proceed?'
          )
          .setColor(COLORS.WARNING)
          .setFooter({ text: 'This action cannot be undone' });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_new_link')
              .setLabel('Unlink & Generate New Code')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⚠️'),
            new ButtonBuilder()
              .setCustomId('back_to_matscraft')
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('↩️')
          );

        await interaction.update({ embeds: [confirmEmbed], components: [row] });
        return;
      }

      await this.generateNewCode(interaction);
    } catch (error) {
      console.error('Error:', error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('Failed to process request. Please try again.')
        .setColor(COLORS.ERROR);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('back_to_matscraft')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      await interaction.update({ embeds: [errorEmbed], components: [row] });
    }
  },

  // New method to handle the actual code generation
  async generateNewCode(interaction) {
    try {
        const discordId = parseInt(interaction.user.id);
        console.log('Generating new code for Discord ID:', discordId);

        // Ensure user exists BEFORE generating code
        const user = await this.ensureUserExists(discordId, interaction.user.username);
        console.log('User verified before code generation:', user);

        const verificationCode = generateVerificationCode();
        
        // Invalidate existing pending tokens
        await supabase
            .from('auth_tokens')
            .update({ status: 'invalidated' })
            .eq('discord_id', discordId)
            .eq('status', 'pending');
        
        // Save new token to database
        const expiryTime = new Date(Date.now() + 5 * 60 * 1000);
        const { data: token, error } = await supabase
            .from('auth_tokens')
            .insert({
                discord_id: discordId,
                verification_token: verificationCode,
                status: 'pending',
                expires_at: expiryTime.toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Token creation error:', error);
            throw error;
        }

        // Generate verification image
        const imageBuffer = await generateTokenImage(verificationCode);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'verification.png' });

        const embed = new EmbedBuilder()
            .setTitle('Account Verification Code')
            .setDescription('To link your account:\n' +
                '1. Join the matsCraft server\n' +
                '2. Type `/link` in the game chat\n' +
                '3. Enter the code shown below\n\n' +
                `⏱️ Code expires <t:${Math.floor(expiryTime.getTime() / 1000)}:R>`)
            .setImage('attachment://verification.png')
            .setColor(COLORS.PRIMARY)
            .setFooter({ text: '☁️ Nexus runs securely on Mallard Cloud' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('generate_code')
                    .setLabel('Generate New Code')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('back_to_matscraft')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
            );

        await interaction.update({ 
            embeds: [embed], 
            components: [row],
            files: [attachment]
        });

    } catch (error) {
        console.error('Error in generateNewCode:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription('Failed to generate verification code. Please try again.')
            .setColor(COLORS.ERROR);

        const errorRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_matscraft')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
            );

        await interaction.update({ 
            embeds: [errorEmbed],
            components: [errorRow]
        });
    }
  },

  async viewHistory(interaction) {
    const discordId = interaction.user.id;

    try {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('discord_id', parseInt(discordId))
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) throw error;

      const embed = new EmbedBuilder()
        .setTitle('Account Activity Log')
        .setColor(COLORS.PRIMARY);

      if (!logs || logs.length === 0) {
        embed.setDescription('No account activity found.');
      } else {
        const logEntries = logs.map(log => {
          const timeAgo = formatDistanceToNow(new Date(log.timestamp), { addSuffix: true });
          let emoji = '📝'; // default

          // Set emoji based on action type
          switch (log.action) {
            case 'verification_started':
              emoji = '🔄';
              break;
            case 'account_linked':
              emoji = '🔗';
              break;
            case 'account_unlinked':
              emoji = '❌';
              break;
            case 'verification_expired':
              emoji = '⏰';
              break;
            case 'verification_failed':
              emoji = '⚠️';
              break;
          }

          return `${emoji} ${log.action.replace(/_/g, ' ')} ${timeAgo}\n${log.details ? `\`${log.details}\`` : ''}`;
        }).join('\n\n');

        embed.setDescription(logEntries);
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('refresh_history')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄'),
          new ButtonBuilder()
            .setCustomId('back_to_matscraft')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      await interaction.update({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Error:', error);
      // ... error handling ...
    }
  },

  async showHelp(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('matsCraft Help & Commands')
      .setDescription('Learn how to use the matsCraft account manager')
      .addFields(
        { 
          name: '🔗 Account Linking',
          value: 
            '1. Click "Generate Code" to get a verification code\n' +
            '2. Join the matsCraft server\n' +
            '3. Type `/link` in the game chat\n' +
            '4. Enter the verification code\n' +
            '⚠️ Codes expire after 5 minutes'
        },
        {
          name: '👤 Account Management',
          value:
            '• View your linked account details\n' +
            '• Check account linking history\n' +
            '• Generate new codes\n' +
            '• Unlink existing accounts'
        },
        {
          name: '⏱️ Time Limits',
          value:
            '• Verification codes expire in 5 minutes\n' +
            '• You can generate a new code at any time\n' +
            '• Old codes become invalid when generating new ones'
        },
        {
          name: '❓ Common Issues',
          value:
            '• Code expired? Generate a new one\n' +
            '• Wrong account linked? Use "Link Different Account"\n' +
            '• Need help? Contact our support team'
        }
      )
      .setColor(COLORS.PRIMARY)
      .setFooter({ text: '☁️ Nexus runs securely on Mallard Cloud' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('back_to_matscraft')
          .setLabel('Back to matsCraft')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({ embeds: [embed], components: [row] });
  },

  async ensureUserExists(discordId, username) {
    console.log('Ensuring user exists for:', { discordId, username });
    
    try {
        // First, try to get existing user
        let { data: existingUsers, error: queryError } = await supabase
            .from('users')
            .select('*')
            .eq('discord_id', discordId);

        if (queryError) {
            console.error('Error querying user:', queryError);
            throw queryError;
        }

        // If user doesn't exist, create one
        if (!existingUsers || existingUsers.length === 0) {
            console.log('No existing user found - creating new user');
            
            const newUserData = {
                discord_id: discordId,
                discord_username: username,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_verified: false,
                minecraft_username: null,
                minecraft_id: null
            };
            
            console.log('Attempting to insert:', newUserData);

            // Perform insert without select
            const { error: insertError } = await supabase
                .from('users')
                .insert(newUserData);

            if (insertError) {
                console.error('Insert failed:', insertError);
                throw insertError;
            }

            // Query again to get the inserted user
            const { data: newUsers, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('discord_id', discordId);

            if (fetchError) {
                console.error('Error fetching new user:', fetchError);
                throw fetchError;
            }

            if (!newUsers || newUsers.length === 0) {
                throw new Error('User creation appeared to succeed but user not found');
            }

            console.log('Successfully created new user:', newUsers[0]);
            return newUsers[0];
        }

        console.log('Found existing user:', existingUsers[0]);
        return existingUsers[0];
    } catch (error) {
        console.error('Error in ensureUserExists:', error);
        throw error;
    }
  },

  async showMatsCraft(interaction) {
    try {
      const discordId = parseInt(interaction.user.id);
      
      // First, try to get existing user
      let { data: existingUsers, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordId);

      if (queryError) {
        console.error('Error querying user:', queryError);
        throw queryError;
      }

      // If user doesn't exist, create one
      if (!existingUsers || existingUsers.length === 0) {
        console.log('No existing user found - creating new user');
        
        const newUserData = {
          discord_id: discordId,
          discord_username: interaction.user.username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_verified: false,
          minecraft_username: null,
          minecraft_id: null
        };
        
        const { error: insertError } = await supabase
          .from('users')
          .insert(newUserData);

        if (insertError) {
          console.error('User creation failed:', insertError);
          throw insertError;
        }

        console.log('User created successfully');
        existingUsers = [newUserData];
      }

      const user = existingUsers[0];

      const embed = new EmbedBuilder()
        .setTitle('matsCraft Account Manager')
        .setDescription('Link your Discord account with your matsCraft account')
        .addFields(
          { 
            name: '⚡ Account Status',
            value: user?.is_verified 
              ? '✅ Account linked'
              : '❌ No account linked'
          },
          {
            name: '📋 Available Actions',
            value: '• Generate a linking code\n' +
                   '• View account details\n' +
                   '• Check linking history\n' +
                   '• View help & commands'
          }
        )
        .setColor(COLORS.PRIMARY)
        .setFooter({ text: '☁️ Nexus runs securely on Mallard Cloud' });

      // Create two rows of buttons
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('generate_code')
            .setLabel('Generate Code')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔗'),
          new ButtonBuilder()
            .setCustomId('view_account')
            .setLabel('Account Details')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👤'),
          new ButtonBuilder()
            .setCustomId('view_history')
            .setLabel('History')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
          new ButtonBuilder()
            .setCustomId('show_help')
            .setLabel('Help')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓')
        );

      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('back_to_nexus')
            .setLabel('Back to Nexus')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      if (interaction.isButton()) {
        await interaction.update({ 
          embeds: [embed], 
          components: [row1, row2],
          files: [] 
        });
      } else {
        await interaction.reply({ 
          embeds: [embed], 
          components: [row1, row2], 
          ephemeral: true,
          files: [] 
        });
      }

    } catch (error) {
      console.error('Error in showMatsCraft:', error);
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('Failed to load MatsCraft manager. Please try again.')
        .setColor(COLORS.ERROR);

      const errorRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('back_to_nexus')
            .setLabel('Back to Nexus')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      if (interaction.isButton()) {
        await interaction.update({ 
          embeds: [errorEmbed], 
          components: [errorRow] 
        });
      } else {
        await interaction.reply({ 
          embeds: [errorEmbed], 
          components: [errorRow], 
          ephemeral: true 
        });
      }
    }
  }
};

// Add logging function
async function logAction(discordId, action, details = null) {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        discord_id: parseInt(discordId),
        action: action,
        details: details,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging action:', error);
  }
}
