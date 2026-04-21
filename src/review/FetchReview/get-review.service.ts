import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { OAuthService } from '../OAuth/OAuth.service';
import { GoogleBusinessLocation } from '../Entity/google-business-location.entity';
import { GoogleReview } from '../Entity/google-review.entity';

const RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

@Injectable()
export class GetReviewService {
  constructor(
    private readonly oauthService: OAuthService,
    @InjectRepository(GoogleBusinessLocation)
    private readonly locationRepo: Repository<GoogleBusinessLocation>,
    @InjectRepository(GoogleReview)
    private readonly reviewRepo: Repository<GoogleReview>,
  ) { }

  // ─── Step 2: Get Business Account ID from Google ──────────────────────────
  async getAccountId(accessToken: string): Promise<string> {
    const res = await axios.get(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    console.log(accessToken)
    const accounts: any[] = res.data?.accounts ?? [];
    if (!accounts.length) {
      throw new NotFoundException('No Google Business accounts found for this user.');
    }
    // name = "accounts/123456789"  →  accountId = "123456789"
    return accounts[0].name.split('/')[1];
  }

  // ─── Step 3: Fetch & persist clinic locations ──────────────────────────────
  async syncLocations(clinicId: number): Promise<{ locations: GoogleBusinessLocation[]; tokens: { access: string | null; refresh: string | null } }> {
    try {
      const accessToken = await this.oauthService.getValidAccessToken(clinicId);
      const accountId = await this.getAccountId(accessToken);

      const res = await axios.get(
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            readMask: 'name,title,metadata,storefrontAddress',
          },
        },
      );

      const locations: any[] = res.data?.locations ?? [];
      const saved: GoogleBusinessLocation[] = [];

      for (const loc of locations) {
        // name = "accounts/123/locations/987"
        const locationId = loc.name?.split('/').pop();
        const placeId = loc.locationKey?.placeId ?? loc.metadata?.placeId ?? null;
        const mapsUri = loc.metadata?.mapsUri ?? null;
        const title = loc.title ?? null;

        let record = await this.locationRepo.findOne({ where: { locationId } });
        if (!record) {
          record = this.locationRepo.create({ clinicId, accountId, locationId });
        }
        record.accountId = accountId;
        record.placeId = placeId;
        record.title = title;
        record.mapsUri = mapsUri;

        await this.locationRepo.save(record);
        saved.push(record);
      }

      const tokenRecord = await this.oauthService.getValidAccessTokenRecord(clinicId);

      return {
        locations: saved,
        tokens: {
          access: tokenRecord.accessToken,
          refresh: tokenRecord.refreshToken,
        },
      };
    } catch (error: any) {
      console.error('syncLocations error:', error.response?.data ?? error.message);
      throw new InternalServerErrorException('Failed to fetch locations from Google.');
    }
  }

  // Get saved locations from DB
  async getLocations(clinicId: number): Promise<GoogleBusinessLocation[]> {
    return this.locationRepo.find({ where: { clinicId } });
  }

  // Fetch raw reviews from Google without persisting them
  async fetchRawReviews(clinicId: number, locationId: string, pageToken?: string): Promise<{ reviews: any[]; nextPageToken?: string }> {
    try {
      const accessToken = await this.oauthService.getValidAccessToken(clinicId);
      const location = await this.locationRepo.findOne({ where: { locationId } });
      if (!location) {
        throw new NotFoundException(`Location ${locationId} not found.`);
      }

      const { accountId } = location;
      const res = await axios.get(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { pageToken },
        },
      );

      return {
        reviews: res.data?.reviews ?? [],
        nextPageToken: res.data?.nextPageToken,
      };
    } catch (error: any) {
      console.error('fetchRawReviews error:', error.response?.data ?? error.message);
      throw new InternalServerErrorException('Failed to fetch reviews from Google.');
    }
  }

  // ─── Step 4: Fetch & persist reviews (with pagination) ────────────────────
  async syncReviews(clinicId: number, locationId: string): Promise<{ synced: number }> {
    try {
      const accessToken = await this.oauthService.getValidAccessToken(clinicId);

      // Look up accountId from stored location
      const location = await this.locationRepo.findOne({ where: { locationId } });
      if (!location) {
        throw new NotFoundException(`Location ${locationId} not found. Run /reviews/locations first.`);
      }

      const { accountId } = location;
      let pageToken: string | undefined = undefined;
      let totalSynced = 0;

      do {
        const res = await axios.get(
          // `https://mybusinessreviews.googleapis.com/v1/accounts/${accountId}/locations/${locationId}/reviews`,
          `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { pageToken },
          },
        );

        const reviews: any[] = res.data?.reviews ?? [];
        pageToken = res.data?.nextPageToken;

        for (const r of reviews) {
          let record = await this.reviewRepo.findOne({ where: { reviewId: r.reviewId } });
          if (!record) {
            record = this.reviewRepo.create({ reviewId: r.reviewId, locationId });
          }
          record.reviewerName = r.reviewer?.displayName ?? 'Anonymous';
          record.starRating = r.starRating ?? null;
          record.comment = r.comment ?? null;
          record.reviewCreateTime = r.createTime ? new Date(r.createTime) : null;

          await this.reviewRepo.save(record);
          totalSynced++;
        }
      } while (pageToken);

      return { synced: totalSynced };
    } catch (error: any) {
      console.error('syncReviews error:', error.response?.data ?? error.message);
      throw new InternalServerErrorException('Failed to sync reviews from Google.');
    }
  }

  // Get saved reviews + computed breakdown from DB
  async getReviews(locationId: string): Promise<{
    reviews: GoogleReview[];
    summary: { total: number; average: number; breakdown: Record<string, number> };
  }> {
    const reviews = await this.reviewRepo.find({ where: { locationId }, order: { reviewCreateTime: 'DESC' } });

    const total = reviews.length;
    const breakdown: Record<string, number> = { ONE: 0, TWO: 0, THREE: 0, FOUR: 0, FIVE: 0 };
    let sum = 0;

    for (const r of reviews) {
      const key = (r.starRating ?? '').toUpperCase();
      if (breakdown[key] !== undefined) breakdown[key]++;
      sum += RATING_MAP[key] ?? 0;
    }

    return {
      reviews,
      summary: {
        total,
        average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
        breakdown,
      },
    };
  }

  // Fetch and persist a single review by its full name (hint from Pub/Sub)
  async syncSingleReview(reviewName: string): Promise<GoogleReview> {
    try {
      // reviewName = "accounts/{accountId}/locations/{locationId}/reviews/{reviewId}"
      const parts = reviewName.split('/');
      const locationId = parts[3];
      const reviewId = parts[5];

      // Find the clinicId by searching for the locationId in our DB
      const location = await this.locationRepo.findOne({ where: { locationId } });
      if (!location) {
        throw new NotFoundException(`Location ${locationId} not found in DB for review ${reviewId}`);
      }

      const accessToken = await this.oauthService.getValidAccessToken(location.clinicId);

      const res = await axios.get(
        `https://mybusiness.googleapis.com/v4/${reviewName}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const r = res.data;
      let record = await this.reviewRepo.findOne({ where: { reviewId } });
      if (!record) {
        record = this.reviewRepo.create({ reviewId, locationId });
      }
      record.reviewerName = r.reviewer?.displayName ?? 'Anonymous';
      record.starRating = r.starRating ?? null;
      record.comment = r.comment ?? null;
      record.reviewCreateTime = r.createTime ? new Date(r.createTime) : null;

      return await this.reviewRepo.save(record);
    } catch (error: any) {
      console.error('syncSingleReview error:', error.response?.data ?? error.message);
      throw new InternalServerErrorException('Failed to sync single review from Google.');
    }
  }
}
