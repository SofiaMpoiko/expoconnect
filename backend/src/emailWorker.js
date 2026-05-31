import fs from 'node:fs';
import sgMail from '@sendgrid/mail';
import { paths } from './paths.js';

function brandingHtml({ name }) {
  const safeName = escapeHtml(name || 'there');
  return `
  <div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#111827;">
    <p>Hi ${safeName},</p>
    <p>Thank you for visiting <strong>Carbon Zapp</strong>. As promised, you will find our product catalogue attached to this email.</p>
    <p>If you have any questions about our equipment or spare parts, reply to this message and our team will get back to you.</p>
    <p style="margin-top:24px;">Kind regards,<br/><strong>Carbon Zapp</strong></p>
  </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function configureClient() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    return { ok: false, reason: 'missing_api_key' };
  }
  sgMail.setApiKey(key);
  return { ok: true };
}

function readCatalogueAttachment() {
  try {
    if (!fs.existsSync(paths.cataloguePdf)) return null;
    const content = fs.readFileSync(paths.cataloguePdf).toString('base64');
    return {
      content,
      filename: 'Carbon-Zapp-catalogue.pdf',
      type: 'application/pdf',
      disposition: 'attachment',
    };
  } catch {
    return null;
  }
}

export async function sendThankYouEmail({ toEmail, toName }) {
  const cfg = configureClient();
  if (!cfg.ok) {
    throw new Error('SendGrid is not configured (SENDGRID_API_KEY).');
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || 'Carbon Zapp';
  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL is not set.');
  }

  const attachment = readCatalogueAttachment();
  const msg = {
    to: toEmail,
    from: { email: fromEmail, name: fromName },
    subject: 'Thank you for visiting Carbon Zapp',
    html: brandingHtml({ name: toName }),
    text: `Hi ${toName || 'there'},\n\nThank you for visiting Carbon Zapp. Our catalogue is attached to this email.\n\nKind regards,\nCarbon Zapp`,
    attachments: attachment ? [attachment] : [],
  };

  await sgMail.send(msg);
}

/** Thank-you emails are disabled; no background worker runs. */
export function startEmailWorker(_opts = {}) {
  return undefined;
}
