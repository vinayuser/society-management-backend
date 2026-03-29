const { signSignupSessionToken } = require('../utils/jwt');

const DEMO_OTP = '000000';

function parseContact(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (t.includes('@')) {
    const email = t.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { contactType: 'email', contact: email };
  }
  const phone = t.replace(/[\s\-()]/g, '');
  if (phone.length < 8 || phone.length > 20) return null;
  if (!/^\+?\d+$/.test(phone)) return null;
  return { contactType: 'phone', contact: phone };
}

function maskEmail(e) {
  const [a, domain] = e.split('@');
  if (!domain) return '***';
  const show = a.length <= 2 ? a[0] + '*' : a.slice(0, 2) + '***';
  return `${show}@${domain}`;
}

function maskPhone(p) {
  if (p.length <= 4) return '****';
  return p.slice(0, 2) + '******' + p.slice(-2);
}

/** Public: request OTP for resident signup (demo: always accept OTP 000000). */
async function requestOtp(req, res) {
  const parsed = parseContact(req.body.contact);
  if (!parsed) {
    return res.status(400).json({ success: false, message: 'Enter a valid email or mobile number' });
  }
  res.json({
    success: true,
    data: {
      message: 'OTP sent. Use 000000 to verify (demo default).',
      maskedContact: parsed.contactType === 'email' ? maskEmail(parsed.contact) : maskPhone(parsed.contact),
    },
  });
}

/** Public: verify OTP and return signup session JWT for completing signup-requests. */
async function verifyOtp(req, res, next) {
  try {
    const parsed = parseContact(req.body.contact);
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Enter a valid email or mobile number' });
    }
    const otp = String(req.body.otp || '').trim();
    if (otp !== DEMO_OTP) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const signupSessionToken = signSignupSessionToken(parsed.contactType, parsed.contact);
    res.json({
      success: true,
      data: {
        signupSessionToken,
        contactType: parsed.contactType,
        contact: parsed.contact,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { requestOtp, verifyOtp, parseContact };
