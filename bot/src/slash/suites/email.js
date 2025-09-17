import { User } from '../../database/models.js';
import { logger } from '../../utils/logger.js';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function emailHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const userId = interaction.user.id;
  const email = interaction.options.getString('email');
  
  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    return interaction.editReply({
      content: '❌ Please provide a valid email address.',
    });
  }
  
  try {
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      discordId: { $ne: userId } // exclude current user
    });
    
    if (existingUser) {
      return interaction.editReply({
        content: '❌ This email is already registered to another account.',
      });
    }
    
    // Update or create user record
    const user = await User.findOneAndUpdate(
      { discordId: userId },
      {
        discordId: userId,
        username: interaction.user.username,
        email: email.toLowerCase(),
        emailCollectedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    logger.info({
      discordId: userId,
      username: interaction.user.username,
      hasEmail: !!user.email
    }, 'Email collected via slash command');
    
    return interaction.editReply({
      content: `✅ Email saved successfully! You'll receive updates about:\n` +
               `• $MemO Collective announcements\n` +
               `• Badge achievements\n` +
               `• DRIP collection drops\n` +
               `• Community events\n\n` +
               `Use \`/email remove\` to unsubscribe anytime.`,
    });
    
  } catch (error) {
    logger.error({ error: String(error), discordId: userId }, 'Failed to save email');
    return interaction.editReply({
      content: '❌ Failed to save email. Please try again later.',
    });
  }
}

export async function emailRemoveHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const userId = interaction.user.id;
  
  try {
    const user = await User.findOneAndUpdate(
      { discordId: userId },
      { 
        $unset: { email: 1, emailCollectedAt: 1 }
      },
      { new: true }
    );
    
    if (!user) {
      return interaction.editReply({
        content: '❌ No user record found.',
      });
    }
    
    logger.info({
      discordId: userId,
      username: interaction.user.username
    }, 'Email removed via slash command');
    
    return interaction.editReply({
      content: '✅ Email removed successfully. You will no longer receive updates.',
    });
    
  } catch (error) {
    logger.error({ error: String(error), discordId: userId }, 'Failed to remove email');
    return interaction.editReply({
      content: '❌ Failed to remove email. Please try again later.',
    });
  }
}

export async function emailStatusHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const userId = interaction.user.id;
  
  try {
    const user = await User.findOne({ discordId: userId });
    
    if (!user || !user.email) {
      return interaction.editReply({
        content: '📧 No email registered.\nUse `/email set` to add your email for updates.',
      });
    }
    
    const maskedEmail = user.email.replace(/(.{2}).*(@.*)/, '$1***$2');
    const collectedDate = user.emailCollectedAt ? 
      new Date(user.emailCollectedAt).toLocaleDateString() : 'Unknown';
    
    return interaction.editReply({
      content: `📧 **Email Status**\n` +
               `• Email: ${maskedEmail}\n` +
               `• Registered: ${collectedDate}\n` +
               `• Status: Active ✅\n\n` +
               `Use \`/email remove\` to unsubscribe.`,
    });
    
  } catch (error) {
    logger.error({ error: String(error), discordId: userId }, 'Failed to get email status');
    return interaction.editReply({
      content: '❌ Failed to retrieve email status.',
    });
  }
}
