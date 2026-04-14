import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { GetReviewService } from './get-review.service';

@Controller('reviews')
export class GetReviewController {

  constructor(private readonly getReviewService: GetReviewService) {}

  // POST /reviews/locations?clinicId=1
  // Step 3 – Fetch locations from Google and persist them
  @Post('locations')
  async syncLocations(@Query('clinicId') clinicId: string) {
    const id = parseInt(clinicId ?? '1', 10);
    const locations = await this.getReviewService.syncLocations(id);
    return { success: true, count: locations.length, locations };
  }

  // GET /reviews/locations?clinicId=1
  // Returns saved locations from the DB
  @Get('locations')
  async getLocations(@Query('clinicId') clinicId: string) {
    const id = parseInt(clinicId ?? '1', 10);
    const locations = await this.getReviewService.getLocations(id);
    return { success: true, count: locations.length, locations };
  }

  // POST /reviews/locations/:locationId/sync?clinicId=1
  // Step 4 – Fetch all reviews for a location (paginated) and persist them
  @Post('locations/:locationId/sync')
  async syncReviews(
    @Param('locationId') locationId: string,
    @Query('clinicId') clinicId: string,
  ) {
    const id = parseInt(clinicId ?? '1', 10);
    const result = await this.getReviewService.syncReviews(id, locationId);
    return { success: true, ...result };
  }

  // GET /reviews/locations/:locationId
  // Returns saved reviews + rating summary from DB
  @Get('locations/:locationId')
  async getReviews(@Param('locationId') locationId: string) {
    return this.getReviewService.getReviews(locationId);
  }
}
