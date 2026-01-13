import prisma from '../lib/prisma';

// Clean up expired refresh tokens
export const cleanupExpiredTokens = async () => {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      console.log(`Cleaned up ${result.count} expired refresh tokens`);
    }
  } catch (error) {
    console.error('Token cleanup error:', error);
  }
};

// Run cleanup every hour
export const startTokenCleanupSchedule = () => {
  // Run immediately on startup
  cleanupExpiredTokens();

  // Then run every hour
  setInterval(() => {
    cleanupExpiredTokens();
  }, 3600000); // 1 hour
};
