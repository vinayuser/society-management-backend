const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');
const societyInviteRoutes = require('./routes/societyInvite');
const societyRoutes = require('./routes/society');
const flatsRoutes = require('./routes/flats');
const residentsRoutes = require('./routes/residents');
const membersRoutes = require('./routes/members');
const guardsRoutes = require('./routes/guards');
const visitorsRoutes = require('./routes/visitors');
const complaintsRoutes = require('./routes/complaints');
const noticesRoutes = require('./routes/notices');
const billingRoutes = require('./routes/billing');
const adsRoutes = require('./routes/ads');
const analyticsRoutes = require('./routes/analytics');
const vendorsRoutes = require('./routes/vendors');
const deliveriesRoutes = require('./routes/deliveries');
const marketplaceRoutes = require('./routes/marketplace');
const lostFoundRoutes = require('./routes/lostFound');
const pollsRoutes = require('./routes/polls');
const chatRoutes = require('./routes/chat');
const signupRequestsRoutes = require('./routes/signupRequests');
const paymentsRoutes = require('./routes/payments');
const plansRoutes = require('./routes/plans');
const notificationsRoutes = require('./routes/notifications');
const { getIO } = require('./socket');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/auth', authRoutes);
app.use('/app', appRoutes);
app.use('/society-invites', societyInviteRoutes);
app.use('/societies', societyRoutes);
app.use('/flats', flatsRoutes);
app.use('/residents', residentsRoutes);
app.use('/members', membersRoutes);
app.use('/guards', guardsRoutes);
app.use('/visitors', visitorsRoutes);
app.use('/complaints', complaintsRoutes);
app.use('/notices', noticesRoutes);
app.use('/billing', billingRoutes);
app.use('/ads', adsRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/vendors', vendorsRoutes);
app.use('/deliveries', deliveriesRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/lost-found', lostFoundRoutes);
app.use('/polls', pollsRoutes);
app.use('/chat', chatRoutes);
app.use('/signup-requests', signupRequestsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/plans', plansRoutes);
app.use('/notifications', notificationsRoutes);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`API running on port ${config.port}`);
});

const io = getIO(server);
app.set('io', io);

module.exports = { app, server, io };
