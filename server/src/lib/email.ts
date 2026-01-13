import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from = 'Easy Drive Canada <info@easydrivecanada.com>' }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('✅ Email sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

// Email Templates
export const emailTemplates = {
  passwordReset: (resetLink: string, userName: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #118df0 0%, #0a6bc4 100%); border-radius: 16px 16px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Password Reset</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi ${userName},
                  </p>
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    We received a request to reset your password for your Easy Drive Canada account. Click the button below to create a new password:
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #118df0 0%, #0a6bc4 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
                  </div>
                  <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    This link will expire in 1 hour for security reasons.
                  </p>
                  <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px; text-align: center; background-color: #f9fafb; border-radius: 0 0 16px 16px;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    © ${new Date().getFullYear()} Easy Drive Canada. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `,

  newInquiry: (inquiry: { name: string; email: string; phone: string; message: string; vehicleInterest?: string }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Customer Inquiry</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #118df0 0%, #0a6bc4 100%); border-radius: 16px 16px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">New Customer Inquiry</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px; color: #111827; font-size: 20px; font-weight: 600;">Contact Details</h2>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-weight: 600; width: 120px;">Name:</td>
                      <td style="padding: 8px 0; color: #374151;">${inquiry.name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Email:</td>
                      <td style="padding: 8px 0; color: #374151;"><a href="mailto:${inquiry.email}" style="color: #118df0; text-decoration: none;">${inquiry.email}</a></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Phone:</td>
                      <td style="padding: 8px 0; color: #374151;"><a href="tel:${inquiry.phone}" style="color: #118df0; text-decoration: none;">${inquiry.phone}</a></td>
                    </tr>
                    ${inquiry.vehicleInterest ? `
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Vehicle:</td>
                      <td style="padding: 8px 0; color: #374151;">${inquiry.vehicleInterest}</td>
                    </tr>
                    ` : ''}
                  </table>
                  ${inquiry.message ? `
                  <div style="margin-top: 30px;">
                    <h2 style="margin: 0 0 15px; color: #111827; font-size: 20px; font-weight: 600;">Message</h2>
                    <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #118df0;">
                      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${inquiry.message}</p>
                    </div>
                  </div>
                  ` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 30px; text-align: center; background-color: #f9fafb; border-radius: 0 0 16px 16px;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    © ${new Date().getFullYear()} Easy Drive Canada Admin Portal
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `,

  accountApproved: (userName: string, userEmail: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Approved</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0;">
                  <div style="width: 60px; height: 60px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                    <span style="font-size: 30px;">✓</span>
                  </div>
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Account Approved!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi ${userName},
                  </p>
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Great news! Your Easy Drive Canada account has been approved. You can now access the admin portal.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.CLIENT_URL}/login" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #118df0 0%, #0a6bc4 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Access Admin Portal</a>
                  </div>
                  <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    Your login email: <strong>${userEmail}</strong>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px; text-align: center; background-color: #f9fafb; border-radius: 0 0 16px 16px;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    © ${new Date().getFullYear()} Easy Drive Canada. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `,
};
