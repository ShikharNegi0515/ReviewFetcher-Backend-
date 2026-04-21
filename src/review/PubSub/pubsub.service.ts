import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PubSubService implements OnModuleInit {
  private pubSubClient: PubSub;
  private readonly internalTopicName = 'review.internal.events';
  private internalTopic: Topic;

  constructor(private readonly configService: ConfigService) {
    this.pubSubClient = new PubSub({
      projectId: this.configService.get<string>('GCP_PROJECT_ID') || 'weather-app-477112',
    });
  }

  async onModuleInit() {
    this.internalTopic = await this.ensureTopicExists(this.internalTopicName);
    console.log(`Internal topic service ready: ${this.internalTopicName}`);
  }

  private async ensureTopicExists(topicName: string): Promise<Topic> {
    try {
      const topic = this.pubSubClient.topic(topicName);
      const [exists] = await topic.exists();
      if (!exists) {
        console.log(`Creating topic ${topicName}...`);
        await topic.create();
      }
      return topic;
    } catch (error: any) {
      console.error(`Error ensuring topic ${topicName}:`, error.message);
      // Return the topic object anyway, we'll hit errors later if it's truly missing
      return this.pubSubClient.topic(topicName);
    }
  }

  async publishInternalEvent(data: any) {
    try {
      const dataBuffer = Buffer.from(JSON.stringify(data));
      const messageId = await this.internalTopic.publishMessage({ data: dataBuffer });
      console.log(`Message ${messageId} published to ${this.internalTopicName}`);
      return messageId;
    } catch (error: any) {
      console.error('Error publishing internal event:', error.message);
      throw new InternalServerErrorException('Failed to dispatch internal event');
    }
  }

  async listenToSubscription(subscriptionName: string, messageHandler: (data: any) => Promise<void>) {
    try {
      // Ensure the topic is ready before we try to attach a subscription
      if (!this.internalTopic) {
        this.internalTopic = await this.ensureTopicExists(this.internalTopicName);
      }

      const subscription = this.internalTopic.subscription(subscriptionName);
      const [exists] = await subscription.exists();
      
      if (!exists) {
        console.log(`Creating subscription ${subscriptionName} for topic ${this.internalTopicName}...`);
        await subscription.create();
      }

      subscription.on('message', async (message) => {
        try {
          const data = JSON.parse(message.data.toString());
          await messageHandler(data);
          message.ack();
        } catch (error: any) {
          console.error(`Error handling message from ${subscriptionName}:`, error.message);
          
          if (error.retryable) {
            console.log(`Retrying message from ${subscriptionName}...`);
            message.nack();
          } else {
            // Default to ACKing to prevent infinite loops of dead messages
            console.log(`Acknowledging failed message from ${subscriptionName} to prevent loop.`);
            message.ack();
          }
        }
      });

      subscription.on('error', (error) => {
        console.error(`Subscription ${subscriptionName} error:`, error.message);
      });

      console.log(`Listening to subscription: ${subscriptionName}`);
    } catch (error: any) {
      console.error(`Error in listenToSubscription for ${subscriptionName}:`, error.message);
    }
  }
}
