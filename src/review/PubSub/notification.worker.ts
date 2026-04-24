import { Injectable, OnModuleInit } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationWorker implements OnModuleInit {
  private readonly subscriptionName = 'review-internal-notifier-sub';
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly configService: ConfigService,
  ) {
    const user =
      this.configService.get<string>('SMTP_USERNAME') ||
      this.configService.get<string>('smtp_username');
    const pass =
      this.configService.get<string>('SMTP_PASS') ||
      this.configService.get<string>('smtp_pass');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  onModuleInit() {
    this.pubSubService.listenToSubscription(
      this.subscriptionName,
      async (data) => {
        console.log(`[NotificationWorker] Processing event: ${data.type}`);

        if (data.type === 'REVIEW_UPDATED') {
          await this.sendNotificationEmail(data);
        }
      },
    );
  }

  private async sendNotificationEmail(data: any) {
    const smtpUser =
      this.configService.get<string>('SMTP_USERNAME') ||
      this.configService.get<string>('smtp_username');
    const recipient =
      this.configService.get<string>('NOTIFICATION_RECIPIENT') || smtpUser;

    const mailOptions = {
      from: `"Review Sync" <${smtpUser}>`,
      to: recipient,
      subject: `🔔 New Google Review: ${data.reviewName.split('/').pop()}`,
      text: `Hello,\n\nA new review has been received for your business.\n\nReview Resource: ${data.reviewName}\nLocation: ${data.locationName || 'Unspecified'}\n\nOur system is currently syncing this review to your database.\n\nRegards,\nReview Sync System`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4285F4;">New Google Review Received!</h2>
          <p>A new review has been posted or updated for your business.</p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
            <p><b>Review Resource:</b> <code style="color: #d11;">${data.reviewName}</code></p>
            <p><b>Location:</b> ${data.locationName || 'Unspecified'}</p>
          </div>
          <p style="margin-top: 20px;">Our system is currently fetching and saving the full content (stars, comment, and reviewer details) to your database.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #888;">This is an automated notification from your Review Sync App.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`[NotificationWorker] Email sent to ${recipient}`);
    } catch (error: any) {
      console.error('[NotificationWorker] Error sending email:', error.message);
    }
  }
}
