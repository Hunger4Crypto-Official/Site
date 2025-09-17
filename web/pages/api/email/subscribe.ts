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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = getClientIp(req);
  
  // Rate limiting
  if (!rateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Here you would typically:
    // 1. Save to your database
    // 2. Send confirmation email
    // 3. Add to mailing list service (Mailchimp, SendGrid, etc.)
    
    // For now, we'll make a request to the bot's API if available
    const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3000';
    const adminSecret = process.env.ADMIN_JWT_SECRET;

    if (adminSecret) {
      try {
        // Call bot API to save email (you'd need to create this endpoint)
        const botResponse = await fetch(`${botApiUrl}/api/email/web-subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminSecret}`,
          },
          body: JSON.stringify({ 
            email: cleanEmail,
            source: 'web',
            userAgent: req.headers['user-agent'] || '',
            ip: clientIp
          }),
        });

        if (!botResponse.ok) {
          console.error('Bot API error:', await botResponse.text());
        }
      } catch (error) {
        console.error('Failed to notify bot API:', error);
        // Don't fail the request if bot API is unavailable
      }
    }

    // Log the subscription (replace with proper logging)
    console.log(`Email subscription: ${cleanEmail} from ${clientIp}`);

    // In production, you might:
    // - Add to email service (SendGrid, Mailchimp, etc.)
    // - Send confirmation email
    // - Store in database with confirmation token
    
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully subscribed!' 
    });

  } catch (error) {
    console.error('Email subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
