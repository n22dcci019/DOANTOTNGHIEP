import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { RequirePermission } from '../../../../libs/api/auth.js';
import type { ApiRequest } from '../../../../libs/api/errors.js';
import { Idempotent } from '../../../../libs/api/idempotency.js';
import { DatabaseModule } from '../../../../libs/database/database.module.js';
import { CreateTemperatureConfigDto } from './temperature-configs.dto.js';
import { TemperatureConfigsService } from './temperature-configs.service.js';

@Controller()
class TemperatureConfigsController {
  constructor(private readonly configs: TemperatureConfigsService) {}

  @Post('trips/:id/temperature-configs') @RequirePermission('temperature_configs.create') @Idempotent()
  create(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: CreateTemperatureConfigDto) {
    return this.configs.create(req.principal!, id, body);
  }

  @Get('trips/:id/temperature-configs') @RequirePermission('trips.read')
  list(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.configs.list(req.principal!, id); }

  // No new permission is invented: auth and DB scope are mandatory even without
  // a capability decorator, including commands whose trip_id is NULL (admin only).
  @Get('device-commands/:commandId')
  command(@Req() req: ApiRequest, @Param('commandId', new ParseUUIDPipe()) id: string) { return this.configs.command(req.principal!, id); }
}

@Module({ imports: [DatabaseModule], controllers: [TemperatureConfigsController], providers: [TemperatureConfigsService] })
export class TemperatureConfigsModule {}
