import type { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// FIXED: Circuit breaker for bot API
const circuitBreaker = {
  isOpen: false,
  failureCount: 0,
  lastFailure: 0,
  timeout: 300000, // 5 minutes
  threshold: 3, // failures before opening circuit
  
  canAttempt(): boolean {
    if (!this.isOpen) return true;
    
    // Check if circuit should close (timeout passed)
    if (Date.now() - this.lastFailure > this.timeout) {
      this.isOpen = false;
      this.failureCount = 0;
      return true;
    }
    
    return false;
  },
  
  recordSuccess(): void {
    this.failureCount = 0;
    this.isOpen = false;
  },
  
  recordFailure(): void {
    this.failureCount++;
    this.lastFailure = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.isOpen = true;
    }
  }
};

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

// FIXED: Enhanced bot API communication with circuit breaker
async function notifyBotApi(email: string, clientIp: string, userAgent: string): Promise<boolean> {
  const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3000';
  const adminSecret = process.env.ADMIN_JWT_SECRET;

  if (!adminSecret) {
    console.warn('ADMIN_JWT_SECRET not set, skipping bot notification');
    return false;
  }

  // Check circuit breaker
  if (!circuitBreaker.canAttempt()) {
    console.warn('Bot API circuit breaker is open, skipping notification');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bot API error:', response.status, errorText);
      circuitBreaker.recordFailure();
      return false;
    } else {
      const result = await response.json();
      console.log('Bot API success:', result);
      circuitBreaker.recordSuccess();
      return true;
    }
  } catch (error) {
    console.error('Failed to notify bot API:', error);
    circuitBreaker.recordFailure();
    return false;
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

// FIXED: Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000); // Clean up every minute

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

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Enhanced domain validation (block obvious disposable emails)
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
      'mailinator.com', 'trashmail.com', 'yopmail.com',
      'temp-mail.org', 'mohmal.com', 'throwaway.email'
    ];
    const domain = cleanEmail.split('@')[1];
    if (disposableDomains.includes(domain)) {
      return res.status(400).json({ 
        error: 'Please use a permanent email address' 
      });
    }

    // Log the subscription attempt
    console.log(`Email subscription: ${cleanEmail} from ${clientIp}`);

    // FIXED: Parallel operations with proper error handling
    // Bot API failure won't block the user signup anymore
    const [botApiResult, emailServiceResult, confirmationResult] = await Promise.allSettled([
      notifyBotApi(cleanEmail, clientIp, req.headers['user-agent'] || ''),
      addToEmailService(cleanEmail),
      sendConfirmationEmail(cleanEmail)
    ]);

    // Log results but don't fail the request
    if (botApiResult.status === 'rejected') {
      console.warn('Bot API notification failed:', botApiResult.reason);
    }
    
    if (emailServiceResult.status === 'rejected') {
      console.warn('Email service failed:', emailServiceResult.reason);
    }
    
    if (confirmationResult.status === 'rejected') {
      console.warn('Confirmation email failed:', confirmationResult.reason);
    }

    // Success response regardless of bot API status
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully subscribed! Check your email for confirmation.',
      // Include status for debugging (remove in production)
      debug: process.env.NODE_ENV === 'development' ? {
        botApiNotified: botApiResult.status === 'fulfilled' && botApiResult.value,
        circuitBreakerOpen: !circuitBreaker.canAttempt()
      } : undefined
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
