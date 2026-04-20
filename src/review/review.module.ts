import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthModule } from './OAuth/OAuth.module';
import { PubsubModule } from './PubSub/infrastructure/pubsub/pubsub.module';
import { ReviewFetcherService } from './PubSub/review/review-fetcher/review-fetcher.service';
import { ReviewProcessorService } from './PubSub/review/review-processor/review-processor.service';
import { GetReviewModule } from './FetchReview/get-review.module';
import { NotificationModule } from './PubSub/notification/notification.module';
import { GoogleBusinessLocation } from './Entity/google-business-location.entity';
import { GoogleReview } from './Entity/google-review.entity';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    OAuthModule,
    PubsubModule,
    GetReviewModule,
    NotificationModule,
    TypeOrmModule.forFeature([GoogleBusinessLocation, GoogleReview]),
  ],
  providers: [ReviewFetcherService, ReviewProcessorService],
})
export class ReviewModule { }
