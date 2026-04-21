import { Module } from "@nestjs/common";
import { GoogleWebhookController } from "./newReviewfetcher.controller";
import { PubSubService } from "./pubsub.service";
import { ConfigModule } from "@nestjs/config";
import { ReviewSaverWorker } from "./review-saver.worker";
import { NotificationWorker } from "./notification.worker";
import { GetReviewModule } from "../FetchReview/get-review.module";

@Module({
  imports: [
    ConfigModule,
    GetReviewModule,
  ],
  controllers: [GoogleWebhookController],
  providers: [
    PubSubService,
    ReviewSaverWorker,
    NotificationWorker,
  ],
  exports: [PubSubService],
})
export class PubSubNewFercherModule {}