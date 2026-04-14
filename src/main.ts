import { webcrypto } from 'node:crypto';
// Polyfill for Node 18 — @nestjs/typeorm uses globalThis.crypto.randomUUID()
(globalThis as any).crypto ??= webcrypto;

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the Vite dev server (and any configured FRONTEND_URL) to call the API
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:5173',
      'http://localhost:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
