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
      firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || '';
    const templateVariables = {
      recipientName: userName,
      invitationUrl: ticketUrl,
    };

    const emailData = {
      from: process.env.EMAIL_SERVICE_SENDER,
      to: email,
      subject: 'Welcome! Complete Your Account Setup',
      template: 'user invite',
      'h:X-Mailgun-Variables': JSON.stringify(templateVariables),
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
