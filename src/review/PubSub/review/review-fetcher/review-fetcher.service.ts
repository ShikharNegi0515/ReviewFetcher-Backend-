import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PUBSUB_TOPICS } from '../../infrastructure/pubsub/pubsub.constants';
import { PubsubService } from '../../infrastructure/pubsub/pubsub.service';
import { GetReviewService } from '../../../FetchReview/get-review.service';
import { GoogleBusinessLocation } from '../../../Entity/google-business-location.entity';

@Injectable()
export class ReviewFetcherService {
  private readonly logger = new Logger(ReviewFetcherService.name);

  constructor(
    private readonly pubsub: PubsubService,
    private readonly getReviewService: GetReviewService,
    @InjectRepository(GoogleBusinessLocation)
    private readonly locationRepo: Repository<GoogleBusinessLocation>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkForNewReviews() {
    this.logger.log('Checking for new reviews across all locations...');

    try {
      const locations = await this.locationRepo.find();
      
      for (const location of locations) {
        this.logger.log(`Fetching reviews for location: ${location.title} (${location.locationId})`);
        
        // Fetch the first page of reviews (we only need the most recent ones for the cron)
        const { reviews } = await this.getReviewService.fetchRawReviews(
          location.clinicId,
          location.locationId,
        );

        for (const review of reviews) {
          // Prepare the event payload
          const reviewEvent = {
            clinicId: location.clinicId,
            locationId: location.locationId,
            reviewId: review.reviewId,
            reviewerName: review.reviewer?.displayName ?? 'Anonymous',
            starRating: review.starRating,
            comment: review.comment,
            createTime: review.createTime,
          };

          await this.pubsub.publish(PUBSUB_TOPICS.NEW_REVIEW, reviewEvent);
        }
      }
    } catch (error) {
      this.logger.error(`Error in ReviewFetcherService: ${error.message}`);
    }
  }
}
