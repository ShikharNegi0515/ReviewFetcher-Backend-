import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthController } from './OAuth.controller';
import { OAuthService } from './OAuth.service';
import { GoogleOauthToken } from '../Entity/google-oauth-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GoogleOauthToken])],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService], // export if needed by other modules
})
export class OAuthModule {}
