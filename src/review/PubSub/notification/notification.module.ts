import { Module } from '@nestjs/common';
import { PubsubModule } from '../infrastructure/pubsub/pubsub.module';
import { EmailSubscriberService } from './email-subscriber.service';

@Module({
  imports: [PubsubModule],
  providers: [EmailSubscriberService],
})
export class NotificationModule {}
