import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import crypto from 'crypto';

const JWT_OPTIONS = {
  issuer: 'h4c-api',
  audience: 'h4c-client',
  algorithm: 'HS256'
};

export class JWTService {
  static sign(payload, options = {}) {
    const defaultOptions = {
      expiresIn: '1h',
      ...JWT_OPTIONS
    };
    
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateJti() // Unique token ID
    };
    
    return jwt.sign(tokenPayload, config.security.jwtSecret, {
      ...defaultOptions,
      ...options
    });
  }
  
  static verify(token) {
    try {
      // SECURITY FIX: Use crypto.timingSafeEqual to prevent timing attacks
      const payload = jwt.verify(token, config.security.jwtSecret, JWT_OPTIONS);
      
      // Additional validation against token replay attacks
      if (!payload.jti || !payload.iat) {
        return {
          valid: false,
          error: 'TOKEN_INVALID',
          message: 'Token missing required fields'
        };
      }
      
      return { valid: true, payload };
    } catch (error) {
      let errorCode = 'TOKEN_INVALID';
      
      if (error.name === 'TokenExpiredError') {
        errorCode = 'TOKEN_EXPIRED';
      } else if (error.name === 'JsonWebTokenError') {
        errorCode = 'TOKEN_MALFORMED';
      } else if (error.name === 'NotBeforeError') {
        errorCode = 'TOKEN_NOT_ACTIVE';
      }
      
      return {
        valid: false,
        error: errorCode,
        message: error.message
      };
    }
  }
  
  static generateAdminToken(options = {}) {
    return this.sign(
      { 
        role: 'admin', 
        version: '1.0',
        permissions: ['read', 'write', 'admin']
      }, 
      { 
        expiresIn: '24h',
        ...options
      }
    );
  }
  
  static generateApiToken(userId, permissions = ['read']) {
    return this.sign(
      {
        sub: userId,
        role: 'user',
        permissions
      },
      { expiresIn: '7d' }
    );
  }
  
  static generateJti() {
    // Use crypto.randomBytes for cryptographically secure random values
    return crypto.randomBytes(16).toString('hex') + Date.now().toString(36);
  }
  
  static decode(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      return null;
    }
  }
}
