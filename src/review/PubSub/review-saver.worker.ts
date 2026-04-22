import { Injectable, OnModuleInit } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { GetReviewService } from '../FetchReview/get-review.service';

@Injectable()
export class ReviewSaverWorker implements OnModuleInit {
  private readonly subscriptionName = 'review-internal-saver-sub';

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly getReviewService: GetReviewService,
  ) {}

  onModuleInit() {
    this.pubSubService.listenToSubscription(
      this.subscriptionName,
      async (data) => {
        try {
          console.log(`[ReviewSaverWorker] Processing event: ${data.type}`);

          if (data.type === 'REVIEW_UPDATED' && data.reviewName) {
            console.log(
              `[ReviewSaverWorker] Syncing review: ${data.reviewName}`,
            );
            await this.getReviewService.syncSingleReview(data.reviewName);
            console.log(`[ReviewSaverWorker] Successfully synced review.`);
          }
        } catch (error: any) {
          console.error(
            `[ReviewSaverWorker] Failed to process ${data.type} for ${data.reviewName || 'unknown'}:`,
            error.message,
          );
          // We re-throw so PubSubService can handle the ACK/NACK logic
          throw error;
        }
      },
    );
  }
}
