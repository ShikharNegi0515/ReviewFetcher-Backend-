import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubsubService } from '../../infrastructure/pubsub/pubsub.service';
import { PUBSUB_SUBSCRIPTIONS, PUBSUB_TOPICS } from '../../infrastructure/pubsub/pubsub.constants';
import { GoogleReview } from '../../../Entity/google-review.entity';

@Injectable()
export class ReviewProcessorService implements OnModuleInit {
  private readonly logger = new Logger(ReviewProcessorService.name);

  constructor(
    private readonly pubsub: PubsubService,
    @InjectRepository(GoogleReview)
    private readonly reviewRepo: Repository<GoogleReview>,
  ) {}

  async onModuleInit() {
    await this.pubsub.subscribe(
      PUBSUB_SUBSCRIPTIONS.SAVE_REVIEW,
      PUBSUB_TOPICS.NEW_REVIEW,
      this.saveReview.bind(this),
    );
  }

  async saveReview(reviewData: any) {
    this.logger.log(`Processing review for DB: ${reviewData.reviewId}`);

    try {
      let record = await this.reviewRepo.findOne({ where: { reviewId: reviewData.reviewId } });
      
      if (!record) {
        record = this.reviewRepo.create({
          reviewId: reviewData.reviewId,
          locationId: reviewData.locationId,
        });
      }

      record.reviewerName = reviewData.reviewerName;
      record.starRating = reviewData.starRating;
      record.comment = reviewData.comment;
      record.reviewCreateTime = reviewData.createTime ? new Date(reviewData.createTime) : null;

      await this.reviewRepo.save(record);
      this.logger.log(`Successfully saved review ${reviewData.reviewId} to DB.`);
    } catch (error) {
      this.logger.error(`Failed to save review ${reviewData.reviewId}: ${error.message}`);
      throw error; // Re-throw to trigger nack/retry if appropriate
    }
  }
}
