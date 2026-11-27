import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { RequirePermission } from '../../../../libs/api/auth.js';
import type { ApiRequest } from '../../../../libs/api/errors.js';
import { Idempotent } from '../../../../libs/api/idempotency.js';
import { DatabaseModule } from '../../../../libs/database/database.module.js';
import { AssignShipmentDto, CreateShipmentDto, RejectShipmentDto, ShipmentVersionDto, UpdateShipmentDto } from './shipments.dto.js';
import { ShipmentsService } from './shipments.service.js';

@Controller('shipments')
class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Post() @RequirePermission('shipments.create') @Idempotent()
  create(@Req() req: ApiRequest, @Body() body: CreateShipmentDto) { return this.shipments.create(req.principal!, body); }

  @Get() @RequirePermission('shipments.read')
  list(@Req() req: ApiRequest) { return this.shipments.list(req.principal!); }

  @Get(':id') @RequirePermission('shipments.read')
  get(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.shipments.get(req.principal!, id); }

  @Patch(':id') @RequirePermission('shipments.update') @Idempotent()
  update(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: UpdateShipmentDto) {
    return this.shipments.update(req.principal!, id, body);
  }

  @Post(':id/submit') @HttpCode(200) @RequirePermission('shipments.submit') @Idempotent()
  submit(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: ShipmentVersionDto) {
    return this.shipments.transition(req.principal!, id, 'submit', body);
  }

  @Post(':id/approve') @HttpCode(200) @RequirePermission('shipments.approve') @Idempotent()
  approve(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: ShipmentVersionDto) {
    return this.shipments.transition(req.principal!, id, 'approve', body);
  }

  @Post(':id/reject') @HttpCode(200) @RequirePermission('shipments.reject') @Idempotent()
  reject(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: RejectShipmentDto) {
    return this.shipments.transition(req.principal!, id, 'reject', body);
  }

  @Post(':id/assign') @HttpCode(200) @RequirePermission('shipments.assign') @Idempotent()
  assign(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: AssignShipmentDto) {
    return this.shipments.assign(req.principal!, id, body);
  }

  @Post(':id/cancel') @HttpCode(200) @RequirePermission('shipments.cancel') @Idempotent()
  cancel(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: ShipmentVersionDto) {
    return this.shipments.cancel(req.principal!, id, body);
  }
}

@Module({ imports: [DatabaseModule], controllers: [ShipmentsController], providers: [ShipmentsService] })
export class ShipmentsModule {}
