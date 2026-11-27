import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { validateEnvironment } from '../../../libs/config/environment.js';
import { DatabaseModule } from '../../../libs/database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { TripsModule } from './trips/trips.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { ApiModule, configureApi } from '../../../libs/api/api.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve('..', '.env'),
      validate: validateEnvironment,
    }),
    DatabaseModule,
    ApiModule,
    HealthModule,
    ShipmentsModule,
    TripsModule,
    DevicesModule,
  ],
})
export class AppModule {}

export async function createApi() {
  const app = await NestFactory.create(AppModule);
  configureApi(app);
  return app;
}
