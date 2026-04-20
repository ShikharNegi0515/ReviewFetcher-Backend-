import { Injectable, Logger } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';

@Injectable()
export class PubsubService {
  private readonly logger = new Logger(PubsubService.name);
  private client: PubSub;

  constructor() {
    this.client = new PubSub();
  }

  async publish<T>(topicName: string, payload: T) {
    try {
      const topic = this.client.topic(topicName);
      const [exists] = await topic.exists();
      if (!exists) {
        await topic.create();
        this.logger.log(`Created topic: ${topicName}`);
      }

      const dataBuffer = Buffer.from(JSON.stringify(payload));
      const messageId = await topic.publishMessage({ data: dataBuffer });
      this.logger.log(`Message ${messageId} published to topic: ${topicName}`);
    } catch (error) {
      this.logger.error(`Error publishing to topic ${topicName}: ${error.message}`);
      throw error;
    }
  }

  async subscribe<T>(subscriptionName: string, topicName: string, handler: (data: T) => Promise<void>) {
    try {
      const topic = this.client.topic(topicName);
      const [topicExists] = await topic.exists();
      if (!topicExists) {
        await topic.create();
      }

      const subscription = topic.subscription(subscriptionName);
      const [subExists] = await subscription.exists();
      if (!subExists) {
        await subscription.create();
        this.logger.log(`Created subscription: ${subscriptionName}`);
      }

      subscription.on('message', async (message) => {
        try {
          const data: T = JSON.parse(message.data.toString());
          await handler(data);
          message.ack();
        } catch (err) {
          this.logger.error(`Error processing message from ${subscriptionName}: ${err.message}`);
          message.nack(); // retry
        }
      });

      this.logger.log(`Subscribed to: ${subscriptionName}`);
    } catch (error) {
      this.logger.error(`Error subscribing to ${subscriptionName}: ${error.message}`);
      throw error;
    }
  }
}
