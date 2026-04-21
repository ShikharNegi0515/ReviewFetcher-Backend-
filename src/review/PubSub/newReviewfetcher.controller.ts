import { Body, Controller, Post } from '@nestjs/common';
import { PubSubService } from './pubsub.service';

@Controller('reviews')
export class GoogleWebhookController {
    constructor(private readonly pubSubService: PubSubService) {}

    @Post('webhook/google-review')
    async handle(@Body() body: any) {
        console.log('GOOGLE EVENT RECEIVED');
        
        try {
            const encodedData = body.message?.data;
            if (!encodedData) {
                console.warn('Received PubSub message with no data');
                return { success: false };
            }

            const decodedString = Buffer.from(encodedData, 'base64').toString();
            const data = JSON.parse(decodedString);
            
            console.log('Decoded Data => ', JSON.stringify(data));

            // Publish internal event for fan-out
            await this.pubSubService.publishInternalEvent({
                type: 'REVIEW_UPDATED',
                ...data
            });

            return { success: true };
        } catch (error: any) {
            console.error('Error in webhook handler:', error.message);
            return { success: false };
        }
    }
}