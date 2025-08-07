import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
  username: 'api',
  key: process.env.EMAIL_SERVICE_API_KEY!,
  url: 'https://api.mailgun.net',
});

export interface InvitationEmailData {
  email: string;
  ticketUrl: string;
  firstName?: string;
  lastName?: string;
}

export async function sendInvitationEmail({
  email,
  ticketUrl,
  firstName,
  lastName,
}: InvitationEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!process.env.EMAIL_SERVICE_API_KEY) {
    return {
      success: false,
      error: 'Email service API key is not configured',
    };
  }

  if (!process.env.EMAIL_SERVICE_DOMAIN) {
    return {
      success: false,
      error: 'Email service domain is not configured',
    };
  }

  if (!process.env.EMAIL_SERVICE_SENDER) {
    return {
      success: false,
      error: 'Email service sender is not configured',
    };
  }

  try {
    const userName =
      firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName;

    const emailData = {
      from: process.env.EMAIL_SERVICE_SENDER,
      to: email,
      subject: 'Welcome! Complete Your Account Setup',
      html: createInvitationEmailTemplate(ticketUrl, userName),
      text: createInvitationEmailText(ticketUrl, userName),
    };

    const response = await mg.messages.create(process.env.EMAIL_SERVICE_DOMAIN!, emailData);

    return {
      success: true,
      messageId: response.id,
    };
  } catch (error) {
    console.error('Full error object:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

function createInvitationEmailTemplate(ticketUrl: string, userName?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Complete Your Account Setup</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #4F46E5; }
        .content { padding: 30px 0; }
        .button { 
          display: inline-block; 
          background-color: #4F46E5; 
          color: white !important; 
          padding: 15px 30px; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: bold;
          text-align: center;
        }
        .button-container { text-align: center; margin: 30px 0; }
        .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 40px; }
        .small-text { font-size: 12px; color: #666; }
        .link-backup { word-break: break-all; color: #4F46E5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="color: #4F46E5; margin: 0;">Welcome${userName ? `, ${userName}` : ''}!</h1>
        </div>
        
        <div class="content">
          <p>You've been invited to join our platform. To complete your account setup, please create your password by clicking the button below:</p>
          
          <div class="button-container">
            <a href="${ticketUrl}" class="button">Complete Account Setup</a>
          </div>
          
          <p style="color: #666;">This invitation link will expire in 7 days. After setting your password, you'll be able to access your account immediately.</p>
        </div>
        
        <div class="footer">
          <p class="small-text">
            <strong>Having trouble with the button?</strong> Copy and paste this link into your browser:
          </p>
          <p class="small-text link-backup">${ticketUrl}</p>
          
          <p class="small-text" style="margin-top: 20px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function createInvitationEmailText(ticketUrl: string, userName?: string): string {
  return `
Welcome${userName ? `, ${userName}` : ''}!

You've been invited to join our platform. To complete your account setup, please create your password using this link:

${ticketUrl}

This invitation link will expire in 7 days. After setting your password, you'll be able to access your account immediately.

If you didn't expect this invitation, you can safely ignore this email.

---
If the link doesn't work, copy and paste it directly into your browser.
  `.trim();
}
