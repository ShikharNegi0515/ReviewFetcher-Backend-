import { Controller, Get, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import * as qs from 'qs';
import { OAuthService } from './OAuth.service';

@Controller('auth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get('google')
  redirectToGoogle(@Res() res: Response, @Query('clinicId') clinicId?: string) {
    const query = qs.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      // We need userinfo.email and userinfo.profile to call the userinfo endpoint
      scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/business.manage',
      access_type: 'offline',
      prompt: 'consent',
      state: clinicId, // state helps optionally pass clinicId through the OAuth flow
    });

    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
    );
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!code) {
      return res.redirect(`${frontendUrl}?success=false&error=missing_code`);
    }

    try {
      await this.oauthService.getTokensFromCode(code, state);
      return res.redirect(`${frontendUrl}?success=true`);
    } catch (error) {
      return res.redirect(`${frontendUrl}?success=false&error=oauth_failed`);
    }
  }
}