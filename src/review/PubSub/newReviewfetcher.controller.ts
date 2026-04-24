import {
  Body,
  Controller,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { NewReviewfetcherService } from './newReviewfetcher.service';
import { ConfigService } from '@nestjs/config';

@Controller('reviews')
export class GoogleWebhookController {
  private readonly logger = new Logger(GoogleWebhookController.name);

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly newReviewfetcherService: NewReviewfetcherService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook/google-review')
  @HttpCode(HttpStatus.NO_CONTENT)
  async handle(@Body() body: any, @Query('secret') secret: string) {
    const expectedSecret = this.configService.get<string>('WEBHOOK_SECRET');

    if (expectedSecret && secret !== expectedSecret) {
      this.logger.warn('Unauthorized webhook attempt');
      return; // Return 204 still, to avoid Google retry loops
    }

    this.logger.log('GOOGLE EVENT RECEIVED');

    try {
      const encodedData = body.message?.data;

      if (!encodedData) {
        this.logger.warn('Received PubSub message with no data');
        // We still return success to Google so they don't keep retrying a broken message
        return;
      }

      const decodedString = Buffer.from(encodedData, 'base64').toString();
      const data = JSON.parse(decodedString);

      this.logger.log(`Decoded Review Data => ${JSON.stringify(data)}`);

      /**
       * DATA STRUCTURE CHECK:
       * Google sends: { "reviewName": "...", "locationName": "..." }
       */
      if (data.reviewName) {
        await this.pubSubService.publishInternalEvent({
          type: 'REVIEW_UPDATED',
          ...data,
        });
      }

      return; // Nest sends 204 automatically due to @HttpCode
    } catch (error: any) {
      this.logger.error(`Error in webhook handler: ${error.message}`);
      // Returning 204 even on error prevents Google from spamming your endpoint
      // with retries for a message that your code can't parse.
      return;
    }
  }

  @Post('setup-notifications')
  async setupNotifications(@Query('clinicId') clinicId: string) {
    if (!clinicId) {
      return {
        success: false,
        message: 'clinicId query parameter is required',
      };
    }

    // Ensure you use the ID to fetch the specific user's OAuth tokens in your service
    return await this.newReviewfetcherService.setupNotifications(
      parseInt(clinicId, 10),
    );
  }
}
