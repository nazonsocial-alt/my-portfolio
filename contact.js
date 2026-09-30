// Vercel serverless function: /api/contact
// Receives the portfolio contact form, validates it server-side, and
// sends the message via the Resend API. Secrets (RESEND_API_KEY,
// CONTACT_EMAIL) are read from environment variables only — never
// hardcoded and never sent to the browser.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  // Vercel parses JSON bodies automatically when Content-Type is
  // application/json, but fall back to manual parsing just in case.
  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }

  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const subject = (body.subject || '').toString().trim();
  const message = (body.message || '').toString().trim();
  const botcheck = body.botcheck;

  // Honeypot: real visitors never fill this hidden field. Bots that
  // fill every field will trip it. Respond as if it succeeded so the
  // bot doesn't learn to avoid the field, but don't send an email.
  if (botcheck) {
    return res.status(200).json({ success: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
  }
  if (name.length > 200 || message.length > 5000 || subject.length > 200) {
    return res.status(400).json({ success: false, message: 'One of the fields is too long.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const CONTACT_EMAIL = process.env.CONTACT_EMAIL;

  if (!RESEND_API_KEY || !CONTACT_EMAIL) {
    // Don't leak configuration details to the client — just log server-side.
    console.error('[api/contact] Missing RESEND_API_KEY or CONTACT_EMAIL env var');
    return res.status(500).json({ success: false, message: 'Server is not configured yet. Please email me directly.' });
  }

  const submittedAt = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short',
  });

  const html = `
    <h2>New portfolio contact form submission</h2>
    <p><b>Name:</b> ${escapeHtml(name)}</p>
    <p><b>Email:</b> ${escapeHtml(email)}</p>
    ${subject ? `<p><b>Subject:</b> ${escapeHtml(subject)}</p>` : ''}
    <p><b>Message:</b></p>
    <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    <hr>
    <p style="color:#888;font-size:12px;">Submitted ${submittedAt} (Asia/Dhaka)</p>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 'onboarding@resend.dev' only works in Resend's sandbox mode,
        // and only delivers to the email you signed up to Resend with.
        // Once you verify your own domain in Resend, change this to
        // something like 'Portfolio <contact@yourdomain.com>'.
        from: 'Portfolio Contact Form <onboarding@resend.dev>',
        to: [CONTACT_EMAIL],
        reply_to: email,
        subject: subject ? `Portfolio contact: ${subject}` : `New message from ${name}`,
        html,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error('[api/contact] Resend API error:', r.status, data);
      return res.status(502).json({ success: false, message: 'Could not send the email right now. Please try again later.' });
    }

    return res.status(200).json({ success: true, message: 'Email sent.' });
  } catch (err) {
    console.error('[api/contact] Unexpected error:', err);
    return res.status(500).json({ success: false, message: 'Unexpected server error. Please try again later.' });
  }
};
