import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleOauthToken } from '../Entity/google-oauth-token.entity';
import axios from 'axios';
import * as qs from 'qs';

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(GoogleOauthToken)
    private readonly googleOauthRepo: Repository<GoogleOauthToken>,
  ) {}

  async getTokensFromCode(code: string, clinicIdStr?: string) {
    try {
      const tokenRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        qs.stringify({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const tokens = tokenRes.data;
      // Fallback clinicId if none was passed in state
      const clinicId = clinicIdStr ? parseInt(clinicIdStr, 10) : 1;

      await this.saveTokensToDB(tokens, clinicId);
      return {
        success: true,
        message: 'Google Business connected successfully.',
      };
    } catch (error: any) {
      console.error(
        'Error fetching tokens:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'Failed to exchange code for tokens',
      );
    }
  }

  async saveTokensToDB(tokens: any, clinicId: number) {
    try {
      // Get user info to fetch googleAccountId and googleEmail
      const userInfoRes = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        },
      );

      const userInfo = userInfoRes.data;

      // Check if we already have a record for this clinicId
      let record = await this.googleOauthRepo.findOne({ where: { clinicId } });

      if (!record) {
        record = this.googleOauthRepo.create({ clinicId });
      }

      record.googleAccountId = userInfo.id;
      record.googleEmail = userInfo.email;
      record.accessToken = tokens.access_token;
      record.refreshToken = tokens.refresh_token || record.refreshToken;
      record.scope = tokens.scope;
      record.tokenType = tokens.token_type;
      record.expiryDate = new Date(Date.now() + tokens.expires_in * 1000);

      await this.googleOauthRepo.save(record);
    } catch (error: any) {
      console.error(
        'Error saving tokens:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'Failed to save tokens to database',
      );
    }
  }

  async getValidAccessToken(clinicId: number): Promise<string> {
    const record = await this.googleOauthRepo.findOne({ where: { clinicId } });
    if (!record) {
      throw new InternalServerErrorException(
        'Google OAuth token not found for this clinic',
      );
    }

    const bufferInMs = 5 * 60 * 1000; // 5 minutes buffer
    if (new Date().getTime() >= record.expiryDate.getTime() - bufferInMs) {
      return await this.refreshAccessToken(record);
    }

    return record.accessToken;
  }

  async getValidAccessTokenRecord(clinicId: number): Promise<GoogleOauthToken> {
    const record = await this.googleOauthRepo.findOne({ where: { clinicId } });
    if (!record) {
      throw new InternalServerErrorException(
        'Google OAuth token not found for this clinic',
      );
    }
    return record;
  }

  private async refreshAccessToken(record: GoogleOauthToken): Promise<string> {
    try {
      const tokenRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        qs.stringify({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: record.refreshToken,
          grant_type: 'refresh_token',
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const tokens = tokenRes.data;

      record.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        record.refreshToken = tokens.refresh_token;
      }
      record.expiryDate = new Date(Date.now() + tokens.expires_in * 1000);

      await this.googleOauthRepo.save(record);

      return record.accessToken;
    } catch (error: any) {
      console.error(
        'Error refreshing token:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException('Failed to refresh access token');
    }
  }
}
