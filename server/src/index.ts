import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import vehicleRoutes from './routes/vehicleRoutes';
import leadRoutes from './routes/leadRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import webhookRoutes from './routes/webhookRoutes';
import verificationRoutes from './routes/verificationRoutes';
import { startTokenCleanupSchedule } from './utils/tokenCleanup';

// Load .env from server directory (where the file actually is)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security: Helmet middleware for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for Google Sign-In to work
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow images to be loaded cross-origin
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Security: CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      'https://easydrivecanada.com',
      'https://www.easydrivecanada.com',
      'https://easydrivecanadav1.vercel.app',
      ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [])
    ]
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-JSON']
}));

// Security: Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security: Disable X-Powered-By header
app.disable('x-powered-by');

// Security: Rate limiting middleware (basic in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60000);

app.use((req, res, next) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 900000; // 15 minutes
  const maxRequests = 100;

  const requestInfo = requestCounts.get(clientIp);

  if (!requestInfo || now > requestInfo.resetTime) {
    requestCounts.set(clientIp, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (requestInfo.count >= maxRequests) {
    return res.status(429).json({ 
      error: 'Too many requests, please try again later' 
    });
  }

  requestInfo.count++;
  next();
});

// Static files with security and CORS for images
app.use('/uploads', express.static('uploads', {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/verification', verificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EasyDrive Canada v1 API' });
});

// Security: Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start token cleanup schedule
  startTokenCleanupSchedule();
});
