require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'society_management',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED === 'true',
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@yourplatform.com',
  },

  platform: {
    domain: process.env.PLATFORM_DOMAIN || 'yourplatform.com',
    inviteBaseUrl: process.env.INVITE_BASE_URL || 'https://app.yourplatform.com/invite',
  },

  roles: {
    SUPER_ADMIN: 'super_admin',
    SOCIETY_ADMIN: 'society_admin',
    RESIDENT: 'resident',
    SECURITY_GUARD: 'security_guard',
  },

  inviteStatus: {
    INVITED: 'invited',
    ONBOARDING_COMPLETED: 'onboarding_completed',
    ACTIVE: 'active',
  },

  planTypes: {
    SHARED_APP: 'shared_app',
    WHITE_LABEL: 'white_label',
  },

  complaintStatus: {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
  },

  billingType: {
    SETUP: 'setup',
    MONTHLY: 'monthly',
  },

  paymentStatus: {
    PENDING: 'pending',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
  },
};
