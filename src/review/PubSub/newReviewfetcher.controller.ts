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

    this.logger.log('================================================');
    this.logger.log('🔔 GOOGLE PUB/SUB EVENT RECEIVED');
    this.logger.log('================================================');

    try {
      const encodedData = body.message?.data;

      if (!encodedData) {
        this.logger.warn('⚠️ Received PubSub message with no data');
        return;
      }

      const decodedString = Buffer.from(encodedData, 'base64').toString();
      const data = JSON.parse(decodedString);

      this.logger.log(`📥 DATA RECEIVED: ${JSON.stringify(data, null, 2)}`);

      if (data.reviewName) {
        this.logger.log(`📝 New/Updated Review detected: ${data.reviewName}`);
        await this.pubSubService.publishInternalEvent({
          type: 'REVIEW_UPDATED',
          ...data,
        });
      }

      this.logger.log('================================================');
      return; 
    } catch (error: any) {
      this.logger.error(`❌ Error in webhook handler: ${error.message}`);
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
