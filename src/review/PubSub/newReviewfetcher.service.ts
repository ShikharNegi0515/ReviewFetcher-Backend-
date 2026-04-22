import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { OAuthService } from '../OAuth/OAuth.service';
import { GetReviewService } from '../FetchReview/get-review.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NewReviewfetcherService {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly getReviewService: GetReviewService,
    private readonly configService: ConfigService,
  ) {}

  async setupNotifications(clinicId: number) {
    try {
      const accessToken = await this.oauthService.getValidAccessToken(clinicId);
      const accountId = await this.getReviewService.getAccountId(accessToken);

      const projectId =
        this.configService.get<string>('GCP_PROJECT_ID') ||
        'weather-app-477112';
      const topicId = 'google-review-notifications'; // Target topic for Google to publish to
      const pubsubTopic = `projects/${projectId}/topics/${topicId}`;

      // This endpoint tells Google to start sending NEW_REVIEW events to your Pub/Sub topic
      const url = `https://mybusinessnotifications.googleapis.com/v1/accounts/${accountId}/notificationSetting?updateMask=notificationTypes,pubsubTopic`;

      const response = await axios.patch(
        url,
        {
          pubsubTopic: pubsubTopic,
          notificationTypes: ['NEW_REVIEW', 'UPDATED_REVIEW'],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      console.log(
        `[NewReviewfetcherService] Notifications enabled for account ${accountId} to topic ${topicId}`,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error(
        '[NewReviewfetcherService] Setup error:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        error.response?.data?.error?.message ||
          'Failed to setup Google Business notifications',
      );
    }
  }
}
