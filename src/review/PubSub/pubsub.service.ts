import {
  Injectable,
  OnModuleInit,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PubSubService implements OnModuleInit {
  private pubSubClient: PubSub;
  private readonly logger = new Logger(PubSubService.name);
  // It is better to pull the topic name from Config
  private readonly internalTopicName =
    this.configService.get<string>('INTERNAL_TOPIC_NAME') ||
    'review.internal.events';
  private internalTopic: Topic;

  constructor(private readonly configService: ConfigService) {
    this.pubSubClient = new PubSub({
      projectId: this.configService.get<string>('GCP_PROJECT_ID'),
      // If you have a service account JSON for your project, add it to Render env vars
      credentials: this.configService.get('GCP_CREDENTIALS')
        ? JSON.parse(this.configService.get('GCP_CREDENTIALS'))
        : undefined,
    });
  }

  async onModuleInit() {
    // We initialize the topic reference
    this.internalTopic = this.pubSubClient.topic(this.internalTopicName);
    this.logger.log(
      `PubSub Service Initialized for topic: ${this.internalTopicName}`,
    );
  }

  private async ensureTopicExists(topicName: string): Promise<Topic> {
    const topic = this.pubSubClient.topic(topicName);
    try {
      const [exists] = await topic.exists();
      if (!exists) {
        this.logger.log(
          `Topic ${topicName} not found, attempting to create...`,
        );
        await topic.create();
      }
      return topic;
    } catch (error: any) {
      // On Render, if your Service Account doesn't have 'Pub/Sub Editor',
      // creation will fail. We log it but return the topic reference anyway.
      this.logger.warn(
        `Could not verify/create topic ${topicName}: ${error.message}`,
      );
      return topic;
    }
  }

  async publishInternalEvent(data: any) {
    try {
      // Ensure data is a valid Buffer
      const dataBuffer = Buffer.from(JSON.stringify(data));

      // Google Pub/Sub publishMessage expects an object with a data property
      const messageId = await this.internalTopic.publishMessage({
        data: dataBuffer,
        attributes: {
          origin: 'google-webhook',
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(`✅ Internal Event Dispatched: ${messageId}`);
      return messageId;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to publish internal event: ${error.message}`,
      );
      throw new InternalServerErrorException('Internal Dispatch Error');
    }
  }

  async listenToSubscription(
    subscriptionName: string,
    messageHandler: (data: any) => Promise<void>,
  ) {
    try {
      const subscription = this.internalTopic.subscription(subscriptionName);
      const [exists] = await subscription.exists();

      if (!exists) {
        this.logger.log(`Creating subscription ${subscriptionName}...`);
        await subscription.create();
      }

      subscription.on('message', async (message) => {
        try {
          const parsedData = JSON.parse(message.data.toString());
          await messageHandler(parsedData);
          message.ack(); // Acknowledge success
        } catch (error: any) {
          this.logger.error(
            `Handler error for ${subscriptionName}: ${error.message}`,
          );

          // If it's a temporary error (like DB busy), nack to retry
          // Otherwise, ack to drop the "bad" message
          if (error.isTemporary) {
            message.nack();
          } else {
            message.ack();
          }
        }
      });

      subscription.on('error', (error) => {
        this.logger.error(
          `Subscription ${subscriptionName} stream error: ${error.message}`,
        );
      });
    } catch (error: any) {
      this.logger.error(`Subscription setup failed: ${error.message}`);
    }
  }
}
