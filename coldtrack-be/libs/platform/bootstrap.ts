import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  ConsoleLogger,
  Controller,
  Get,
  HttpException,
  Inject,
  Module,
  ServiceUnavailableException,
  ValidationPipe,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { loadEnvironment, type ServiceRole } from './environment.js';
import { Resources } from './resources.js';

class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    response.status(status).json({
      code:
        status === 503
          ? 'DEPENDENCY_UNAVAILABLE'
          : status === 500
            ? 'INTERNAL_ERROR'
            : `HTTP_${status}`,
      message:
        status === 500
          ? 'Internal server error'
          : error instanceof HttpException
            ? error.message
            : 'Request failed',
      details: error instanceof HttpException ? error.getResponse() : undefined,
      request_id: response.getHeader('x-request-id'),
    });
  }
}

export async function bootstrap(role: ServiceRole) {
  const env = loadEnvironment();

  @Controller('health')
  class HealthController {
    constructor(@Inject(Resources) private readonly resources: Resources) {}

    @Get('live')
    live() {
      return { status: 'ok', service: role, stage: 'infrastructure' };
    }

    @Get('ready')
    async ready() {
      const status = await this.resources.readiness(role);
      if (!status.ready)
        throw new ServiceUnavailableException({ service: role, ...status });
      return { service: role, stage: 'infrastructure', ...status };
    }
  }

  @Module({
    controllers: [HealthController],
    providers: [
      { provide: Resources, useFactory: () => new Resources(role, env) },
    ],
  })
  class AppModule {}

  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
    bodyParser: true,
  });
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('x-request-id', randomUUID());
    next();
  });
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  if (role === 'api') {
    app.enableCors({
      origin: env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    });
    if (env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('ColdTrack API')
        .setDescription(
          'Infrastructure scaffold; business endpoints are not implemented yet.',
        )
        .setVersion('0.1.0')
        .addBearerAuth()
        .build();
      SwaggerModule.setup(
        'api/docs',
        app,
        SwaggerModule.createDocument(app, config),
      );
    }
  }
  const port =
    role === 'api'
      ? env.API_PORT
      : role === 'ingest'
        ? env.INGEST_PORT
        : env.WORKER_PORT;
  await app.listen(port, env.HOST);
  return app;
}
