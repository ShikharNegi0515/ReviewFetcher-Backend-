import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthModule } from './OAuth/OAuth.module';
import { GoogleBusinessLocation } from './Entity/google-business-location.entity';
import { GoogleReview } from './Entity/google-review.entity';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    OAuthModule,
    TypeOrmModule.forFeature([GoogleBusinessLocation, GoogleReview]),
  ],
})
export class ReviewModule {}
