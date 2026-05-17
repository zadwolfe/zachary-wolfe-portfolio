import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const TO_ADDRESS = 'Hello@zawolfe.com';
// Initial sender uses Resend's shared sandbox address — works without verifying a domain,
// but it can only deliver to the address registered on your Resend account.
// Once zawolfe.com is verified in Resend (Settings → Domains), change FROM_ADDRESS to e.g.
//   'Wuf Labs <forms@zawolfe.com>'
// to send from your own domain (better deliverability + branded sender).
const FROM_ADDRESS = 'Wuf Labs <onboarding@resend.dev>';

const esc = (s = '') =>
  String(s).replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ success: false, message: 'Email service not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { name, email, message, inquiry_type, budget, botcheck } = body;

  if (botcheck) {
    return res.status(200).json({ success: true });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid input' });
  }
  if (name.length > 200 || email.length > 200 || message.length > 5000) {
    return res.status(400).json({ success: false, message: 'Input too long' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email' });
  }

  const type = (typeof inquiry_type === 'string' && inquiry_type) || 'general';
  const bud = (typeof budget === 'string' && budget) || '—';

  const subject = `[zawolfe.com] ${type} — ${name}`;

  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.55;color:#0E0D0A;max-width:560px;">
      <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#FF3B14;margin:0 0 12px;">New inquiry — zawolfe.com</p>
      <h2 style="font-style:italic;font-weight:300;font-size:26px;margin:0 0 18px;letter-spacing:-.02em;">${esc(name)} <span style="color:#847C68;">&lt;${esc(email)}&gt;</span></h2>
      <table style="border-collapse:collapse;font-family:Georgia,serif;font-size:14px;margin-bottom:18px;">
        <tr><td style="padding:4px 12px 4px 0;color:#847C68;">Inquiry</td><td><b>${esc(type)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#847C68;">Budget</td><td><b>${esc(bud)}</b></td></tr>
      </table>
      <div style="padding:14px 16px;background:#F4ECD8;border-left:3px solid #FF3B14;white-space:pre-wrap;">${esc(message)}</div>
      <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#847C68;margin:18px 0 0;">Reply directly to this email to respond.</p>
    </div>
  `.trim();

  const text =
`New inquiry — zawolfe.com

From: ${name} <${email}>
Inquiry: ${type}
Budget: ${bud}

${message}

Reply directly to this email to respond.`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [TO_ADDRESS],
      replyTo: email,
      subject,
      html,
      text,
    });

    if (error) {
      console.error('Resend send error:', error);
      return res.status(502).json({ success: false, message: 'Could not send email' });
    }
    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
