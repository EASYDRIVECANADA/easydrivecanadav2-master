import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { Resend } from 'resend';
import prisma from '../lib/prisma';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET + '-refresh';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Log Resend status on startup
console.log('Resend configured:', !!resend, process.env.RESEND_API_KEY ? '(API key present)' : '(API key missing)');

// Security: Rate limiting storage (in production, use Redis)
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();

// Security: Clean up old attempts every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.firstAttempt > 900000) { // 15 minutes
      loginAttempts.delete(key);
    }
  }
}, 3600000);

// Generate JWT token with secure settings
const generateToken = (userId: string, email: string, role: string) => {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { 
      expiresIn: '15m', // Short-lived access token
      issuer: 'easydrive-canada',
      audience: 'easydrive-api'
    }
  );
};

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Store refresh token in database
const storeRefreshToken = async (userId: string) => {
  const token = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
};

// Security: Check rate limiting
const checkRateLimit = (identifier: string): { allowed: boolean; lockedUntil?: number } => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts) {
    return { allowed: true };
  }

  // Check if account is locked
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    return { allowed: false, lockedUntil: attempts.lockedUntil };
  }

  // Reset if window expired
  if (now - attempts.firstAttempt > 900000) { // 15 minutes
    loginAttempts.delete(identifier);
    return { allowed: true };
  }

  // Check if max attempts reached
  if (attempts.count >= 5) {
    const lockedUntil = now + 900000; // Lock for 15 minutes
    loginAttempts.set(identifier, { ...attempts, lockedUntil });
    return { allowed: false, lockedUntil };
  }

  return { allowed: true };
};

// Security: Record failed attempt
const recordFailedAttempt = (identifier: string) => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts) {
    loginAttempts.set(identifier, { count: 1, firstAttempt: now });
  } else {
    loginAttempts.set(identifier, { ...attempts, count: attempts.count + 1 });
  }
};

// Security: Clear attempts on successful login
const clearAttempts = (identifier: string) => {
  loginAttempts.delete(identifier);
};

// POST /api/auth/login - Email/Password login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Security: Check rate limiting by IP and email
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ipCheck = checkRateLimit(clientIp);
    const emailCheck = checkRateLimit(normalizedEmail);

    if (!ipCheck.allowed) {
      const remainingTime = Math.ceil((ipCheck.lockedUntil! - Date.now()) / 60000);
      return res.status(429).json({ 
        error: `Too many login attempts. Please try again in ${remainingTime} minutes.` 
      });
    }

    if (!emailCheck.allowed) {
      const remainingTime = Math.ceil((emailCheck.lockedUntil! - Date.now()) / 60000);
      return res.status(429).json({ 
        error: `Account temporarily locked. Please try again in ${remainingTime} minutes.` 
      });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Security: Same error message for non-existent user and wrong password
    if (!user || !user.isActive) {
      recordFailedAttempt(clientIp);
      recordFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.password) {
      recordFailedAttempt(clientIp);
      recordFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: 'Please use Google Sign In for this account' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      recordFailedAttempt(clientIp);
      recordFailedAttempt(normalizedEmail);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Security: Clear failed attempts on successful login
    clearAttempts(clientIp);
    clearAttempts(normalizedEmail);

    // Generate tokens
    const token = generateToken(user.id, user.email, user.role);
    const refreshToken = await storeRefreshToken(user.id);

    // Security: Log successful login (in production, log to secure audit system)
    console.log(`Successful login: ${user.email} from IP: ${clientIp} at ${new Date().toISOString()}`);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/google - Google OAuth login
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential required' });
    }

    if (!googleClient) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    // Security: Rate limiting for OAuth attempts
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ipCheck = checkRateLimit(`oauth_${clientIp}`);
    
    if (!ipCheck.allowed) {
      const remainingTime = Math.ceil((ipCheck.lockedUntil! - Date.now()) / 60000);
      return res.status(429).json({ 
        error: `Too many authentication attempts. Please try again in ${remainingTime} minutes.` 
      });
    }

    // Verify Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      recordFailedAttempt(`oauth_${clientIp}`);
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      recordFailedAttempt(`oauth_${clientIp}`);
      return res.status(400).json({ error: 'Email not verified with Google' });
    }

    const { sub: googleId, email, name } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    // Security: Check email whitelist for new users
    const allowedEmails = process.env.ALLOWED_STAFF_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    
    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { googleId }],
      },
    });

    if (!user) {
      // Create new user - requires admin approval unless in whitelist
      const isAutoApproved = allowedEmails.includes(normalizedEmail);
      
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name || normalizedEmail.split('@')[0],
          googleId,
          role: 'STAFF',
          isActive: isAutoApproved, // Auto-approve if in whitelist, otherwise pending
        },
      });
      
      if (isAutoApproved) {
        console.log(`New staff account created and auto-approved via Google OAuth: ${normalizedEmail} at ${new Date().toISOString()}`);
      } else {
        console.log(`New staff account pending approval: ${normalizedEmail} at ${new Date().toISOString()}`);
        return res.status(403).json({ 
          error: 'Your access request has been submitted. Please wait for admin approval.',
          pending: true
        });
      }
    } else if (!user.isActive) {
      recordFailedAttempt(`oauth_${clientIp}`);
      return res.status(403).json({ 
        error: 'Your account is pending admin approval.',
        pending: true
      });
    } else if (!user.googleId) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    // Clear rate limit attempts
    clearAttempts(`oauth_${clientIp}`);

    const token = generateToken(user.id, user.email, user.role);
    const refreshToken = await storeRefreshToken(user.id);

    // Security: Log successful OAuth login
    console.log(`Successful Google login: ${user.email} from IP: ${clientIp} at ${new Date().toISOString()}`);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Security: Verify token with all claims
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'easydrive-canada',
      audience: 'easydrive-api'
    }) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({ user });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Find refresh token in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      // Delete expired token
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Check if user is still active
    if (!tokenRecord.user.isActive) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Generate new access token
    const newAccessToken = generateToken(
      tokenRecord.user.id,
      tokenRecord.user.email,
      tokenRecord.user.role
    );

    // Optional: Token rotation - generate new refresh token
    const newRefreshToken = await storeRefreshToken(tokenRecord.user.id);
    
    // Delete old refresh token (rotation) - use deleteMany to avoid error if already deleted
    await prisma.refreshToken.deleteMany({ where: { id: tokenRecord.id } });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        name: tokenRecord.user.name,
        role: tokenRecord.user.role,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/logout - Logout and invalidate refresh token
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Security: Always return success even if user doesn't exist (prevent email enumeration)
    if (!user) {
      return res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
    }

    // Check if user uses Google OAuth
    if (!user.password && user.googleId) {
      return res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Store reset token
    await prisma.passwordReset.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send password reset email
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    if (resend) {
      try {
        console.log('Attempting to send password reset email to:', user.email);
        const { data, error } = await resend.emails.send({
          from: 'Easy Drive Canada <info@easydrivecanada.com>',
          to: user.email,
          subject: 'Reset Your Password - Easy Drive Canada',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #118df0 0%, #0d6ebd 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Easy Drive Canada</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                  <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
                  <p style="color: #666; font-size: 16px;">Hello ${user.name || 'there'},</p>
                  <p style="color: #666; font-size: 16px;">We received a request to reset your password for your Easy Drive Canada account. Click the button below to create a new password:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background: #118df0; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">Reset Password</a>
                  </div>
                  <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                  <p style="color: #118df0; font-size: 14px; word-break: break-all;">${resetLink}</p>
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour for security reasons.</p>
                  <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                  <p style="color: #999; font-size: 12px; text-align: center;">Easy Drive Canada - Your trusted car dealership<br>This is an automated message, please do not reply to this email.</p>
                </div>
              </body>
            </html>
          `,
        });
        
        if (error) {
          console.error('Resend API error:', error);
        } else {
          console.log('✅ Password reset email sent successfully to:', user.email, 'ID:', data?.id);
        }
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
        // Continue anyway - don't expose email sending errors to user
      }
    } else {
      // Fallback if Resend is not configured
      console.log('⚠️ Resend not configured - printing reset link to console');
      console.log(`Password reset link: ${resetLink}`);
      console.log(`Reset token for ${user.email}: ${resetToken}`);
    }

    res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find reset token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token is expired
    if (new Date() > resetRecord.expiresAt) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Check if token was already used
    if (resetRecord.used) {
      return res.status(400).json({ error: 'Reset token has already been used' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    });

    // Mark token as used
    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    // Invalidate all refresh tokens for this user (force re-login)
    await prisma.refreshToken.deleteMany({
      where: { userId: resetRecord.userId },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
