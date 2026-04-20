import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PubsubService } from '../infrastructure/pubsub/pubsub.service';
import { PUBSUB_SUBSCRIPTIONS, PUBSUB_TOPICS } from '../infrastructure/pubsub/pubsub.constants';

@Injectable()
export class EmailSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(EmailSubscriberService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly pubsub: PubsubService,
    private readonly configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('smtp_username'),
        pass: this.configService.get<string>('smtp_pass'),
      },
    });
  }

  async onModuleInit() {
    await this.pubsub.subscribe(
      PUBSUB_SUBSCRIPTIONS.SEND_EMAIL,
      PUBSUB_TOPICS.NEW_REVIEW,
      this.sendEmail.bind(this),
    );
  }

  async sendEmail(reviewData: any) {
    this.logger.log(`Preparing email notification for review: ${reviewData.reviewId}`);

    const targetEmail = 'shikharnegi31@gmail.com';
    const mailOptions = {
      from: this.configService.get<string>('smtp_username'),
      to: targetEmail,
      subject: `New Google Review: ${reviewData.starRating} Stars`,
      html: `
        <h3>New Review Received!</h3>
        <p><strong>Reviewer:</strong> ${reviewData.reviewerName}</p>
        <p><strong>Rating:</strong> ${reviewData.starRating} Stars</p>
        <p><strong>Comment:</strong> ${reviewData.comment || 'No comment provided.'}</p>
        <p><strong>Time:</strong> ${new Date(reviewData.createTime).toLocaleString()}</p>
        <hr>
        <p>Location ID: ${reviewData.locationId}</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email notification sent to ${targetEmail} for review ${reviewData.reviewId}`);
    } catch (error) {
      this.logger.error(`Failed to send email for review ${reviewData.reviewId}: ${error.message}`);
      // Note: We might NOT want to throw/nack here if we don't want to spam notifications on retry,
      // but typically we should try again.
      throw error;
    }
  }
}
