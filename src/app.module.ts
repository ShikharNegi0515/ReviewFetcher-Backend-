import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReviewModule } from './review/review.module';
import { GetReviewModule } from './review/FetchReview/get-review.module';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleOauthToken } from './review/Entity/google-oauth-token.entity';
import { GoogleBusinessLocation } from './review/Entity/google-business-location.entity';
import { GoogleReview } from './review/Entity/google-review.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USERNAME') || 'postgres',
        password: configService.get<string>('DB_PASSWORD') || 'postgres',
        database: configService.get<string>('DB_DATABASE') || 'postgres',
        entities: [GoogleOauthToken, GoogleBusinessLocation, GoogleReview],
        autoLoadEntities: true,
        synchronize: true,
        ssl: true,
        extra: {
          ssl: {
            rejectUnauthorized: false,
          },
        },
      }),
      inject: [ConfigService],
    }),
    ReviewModule,
    GetReviewModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
