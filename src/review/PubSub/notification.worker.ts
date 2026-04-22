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
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // Assuming gmail based on the username
      auth: {
        user: this.configService.get<string>('smtp_username'),
        pass: this.configService.get<string>('smtp_pass'),
      },
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
    const recipient = this.configService.get<string>('smtp_username');
    const mailOptions = {
      from: this.configService.get<string>('smtp_username'),
      to: recipient,
      subject: 'New Google Review Received!',
      text: `Hello,\n\nA new review has been posted or updated for your business.\n\nDetails:\n- Review Name: ${data.reviewName}\n- Account: ${data.accountName}\n\nOur system is currently fetching and saving the full content.\n\nRegards,\nReview Fetcher App`,
      html: `<h3>New Google Review Received!</h3>
             <p>A new review has been posted or updated for your business.</p>
             <ul>
               <li><b>Review Name:</b> ${data.reviewName}</li>
               <li><b>Account:</b> ${data.accountName}</li>
             </ul>
             <p>Our system is currently fetching and saving the full content.</p>`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`[NotificationWorker] Email sent to ${recipient}`);
    } catch (error: any) {
      console.error('[NotificationWorker] Error sending email:', error.message);
    }
  }
}
