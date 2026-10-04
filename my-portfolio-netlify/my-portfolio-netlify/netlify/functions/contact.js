// Netlify Function: /.netlify/functions/contact
// (reachable at /api/contact too, via the redirect in netlify.toml)
//
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

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, message: 'Method not allowed.' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }

  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const subject = (body.subject || '').toString().trim();
  const message = (body.message || '').toString().trim();
  const botcheck = body.botcheck;

  // Honeypot: real visitors never fill this hidden field.
  if (botcheck) {
    return json(200, { success: true });
  }

  if (!name || !email || !message) {
    return json(400, { success: false, message: 'Name, email and message are required.' });
  }
  if (name.length > 200 || message.length > 5000 || subject.length > 200) {
    return json(400, { success: false, message: 'One of the fields is too long.' });
  }
  if (!EMAIL_RE.test(email)) {
    return json(400, { success: false, message: 'Please provide a valid email address.' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const CONTACT_EMAIL = process.env.CONTACT_EMAIL;

  if (!RESEND_API_KEY || !CONTACT_EMAIL) {
    console.error('[contact] Missing RESEND_API_KEY or CONTACT_EMAIL env var');
    return json(500, { success: false, message: 'Server is not configured yet. Please email me directly.' });
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
        // Sandbox sender — only delivers to the email you signed up to
        // Resend with, until you verify your own domain there.
        from: 'Portfolio Contact Form <onboarding@resend.dev>',
        to: [CONTACT_EMAIL],
        reply_to: email,
        subject: subject ? `Portfolio contact: ${subject}` : `New message from ${name}`,
        html,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error('[contact] Resend API error:', r.status, data);
      return json(502, { success: false, message: 'Could not send the email right now. Please try again later.' });
    }

    return json(200, { success: true, message: 'Email sent.' });
  } catch (err) {
    console.error('[contact] Unexpected error:', err);
    return json(500, { success: false, message: 'Unexpected server error. Please try again later.' });
  }
};
