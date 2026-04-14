import { Module } from '@nestjs/common';
import { OAuthModule } from './OAuth/OAuth.module';


@Module({
  imports:[OAuthModule]
})
export class ReviewModule {}
