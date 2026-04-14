import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetReviewController } from './get-review.controller';
import { GetReviewService } from './get-review.service';
import { OAuthModule } from '../OAuth/OAuth.module';
import { GoogleBusinessLocation } from '../Entity/google-business-location.entity';
import { GoogleReview } from '../Entity/google-review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoogleBusinessLocation, GoogleReview]),
    OAuthModule,  // gives us OAuthService via its exports
  ],
  controllers: [GetReviewController],
  providers: [GetReviewService],
})
export class GetReviewModule {}
