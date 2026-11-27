import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module.js';
import { AuthGuard } from './auth.js';
import { ApiError, ApiExceptionFilter, requestId } from './errors.js';
import { IdempotencyInterceptor } from './idempotency.js';
import { JwtVerifier } from './jwt-verifier.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    JwtVerifier,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class ApiModule {}

export function configureApi(app: INestApplication) {
  app.use(requestId);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
    exceptionFactory: () => new ApiError('VALIDATION_FAILED'),
  }));
}
