import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { OAuthService } from '../OAuth/OAuth.service';
import { GetReviewService } from '../FetchReview/get-review.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NewReviewfetcherService {
  private readonly logger = new Logger(NewReviewfetcherService.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly getReviewService: GetReviewService,
    private readonly configService: ConfigService,
  ) {}

  async setupNotifications(clinicId: number) {
    try {
      const accessToken = await this.oauthService.getValidAccessToken(clinicId);
      const accountId = await this.getReviewService.getAccountId(accessToken);

      // 1. Get Project ID and Topic Name from Config or Defaults
      const projectId =
        this.configService.get<string>('GCP_PROJECT_ID') ||
        'weather-app-477112';
      const topicId =
        this.configService.get<string>('GCP_PUBSUB_TOPIC') ||
        'business-reviews-topic';

      const pubsubTopic = `projects/${projectId}/topics/${topicId}`;

      // 2. Updated URL with the correct updateMask for the v1 Notifications API
      // Note: mybusinessnotifications.googleapis.com is the correct modern endpoint
      const url = `https://mybusinessnotifications.googleapis.com/v1/accounts/${accountId}/notificationSetting?updateMask=notificationSetting`;

      const response = await axios.patch(
        url,
        {
          name: `accounts/${accountId}/notificationSetting`,
          pubsubTopic: pubsubTopic,
          notificationTypes: ['NEW_REVIEW', 'UPDATED_REVIEW'],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `✅ Notifications enabled for account ${accountId}. Topic: ${pubsubTopic}`,
      );

      return {
        success: true,
        message: 'Google Pub/Sub notifications linked successfully',
        data: response.data,
      };
    } catch (error: any) {
      // Extract Google-specific error messages
      const googleError = error.response?.data?.error;

      this.logger.error(
        `❌ Setup error for Clinic ${clinicId}: ${googleError?.message || error.message}`,
        googleError?.details ? JSON.stringify(googleError.details) : '',
      );

      // Handle specific "Permission Denied" errors
      if (error.response?.status === 403) {
        throw new InternalServerErrorException(
          "Google API Permission Denied. Ensure My Business Notifications API is enabled in your friend's console.",
        );
      }

      throw new InternalServerErrorException(
        googleError?.message || 'Failed to setup Google Business notifications',
      );
    }
  }
}
