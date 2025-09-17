import type { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function rateLimit(ip: string, limit = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress;
  return ip || 'unknown';
}

async function notifyBotApi(email: string, clientIp: string, userAgent: string) {
  const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3000';
  const adminSecret = process.env.ADMIN_JWT_SECRET;

  if (!adminSecret) {
    console.warn('ADMIN_JWT_SECRET not set, skipping bot notification');
    return;
  }

  try {
    const response = await fetch(`${botApiUrl}/api/email/web-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}`,
      },
      body: JSON.stringify({ 
        email,
        source: 'web',
        userAgent,
        ip: clientIp
      }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bot API error:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('Bot API success:', result);
    }
  } catch (error) {
    console.error('Failed to notify bot API:', error);
    // Don't fail the request if bot API is unavailable
  }
}

async function addToEmailService(email: string) {
  // TODO: Add to your email service provider
  // Examples:
  
  // SendGrid example:
  // if (process.env.SENDGRID_API_KEY) {
  //   const sgMail = require('@sendgrid/mail');
  //   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  //   // Add to contact list
  // }
  
  // Mailchimp example:
  // if (process.env.MAILCHIMP_API_KEY) {
  //   const mailchimp = require('@mailchimp/mailchimp_marketing');
  //   mailchimp.setConfig({
  //     apiKey: process.env.MAILCHIMP_API_KEY,
  //     server: process.env.MAILCHIMP_SERVER_PREFIX,
  //   });
  //   // Add subscriber
  // }
  
  console.log(`Would add ${email} to email service`);
}

async function sendConfirmationEmail(email: string) {
  // TODO: Send confirmation email
  console.log(`Would send confirmation email to ${email}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  
  // Rate limiting
  if (!rateLimit(clientIp)) {
    return res.status(429).json({ 
      error: 'Too many requests. Please try again in a minute.' 
    });
  }

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Basic domain validation (block obvious disposable emails)
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
      'mailinator.com', 'trashmail.com'
    ];
    const domain = cleanEmail.split('@')[1];
    if (disposableDomains.includes(domain)) {
      return res.status(400).json({ 
        error: 'Please use a permanent email address' 
      });
    }

    // Log the subscription attempt
    console.log(`Email subscription: ${cleanEmail} from ${clientIp}`);

    // Parallel operations for better performance
    await Promise.allSettled([
      notifyBotApi(cleanEmail, clientIp, req.headers['user-agent'] || ''),
      addToEmailService(cleanEmail),
      sendConfirmationEmail(cleanEmail)
    ]);

    return res.status(200).json({ 
      success: true, 
      message: 'Successfully subscribed! Check your email for confirmation.'
    });

  } catch (error) {
    console.error('Email subscription error:', error);
    return res.status(500).json({ 
      error: 'Something went wrong. Please try again.' 
    });
  }
}

// Export config for body parsing
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
