import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Req, UploadedFile } from '@nestjs/common';
import { RequirePermission } from '../../../../libs/api/auth.js';
import type { ApiRequest } from '../../../../libs/api/errors.js';
import { Idempotent } from '../../../../libs/api/idempotency.js';
import { ProofUpload } from '../../../../libs/api/proof-upload.js';
import { DatabaseModule } from '../../../../libs/database/database.module.js';
import { TripNotesDto, TripProofDto, TripVersionDto } from './trips.dto.js';
import { TripsService } from './trips.service.js';

@Controller('trips')
class TripsController {
  constructor(private readonly trips: TripsService) {}
  @Get() @RequirePermission('trips.read')
  list(@Req() req: ApiRequest) { return this.trips.list(req.principal!); }
  @Get(':id') @RequirePermission('trips.read')
  get(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string) { return this.trips.get(req.principal!, id); }
  @Post(':id/depart') @HttpCode(200) @RequirePermission('trips.depart') @Idempotent()
  depart(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: TripVersionDto) {
    return this.trips.depart(req.principal!, id, body);
  }
  @Post(':id/complete') @HttpCode(200) @RequirePermission('trips.complete') @Idempotent()
  complete(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: TripVersionDto) {
    return this.trips.complete(req.principal!, id, body);
  }
  @Patch(':id/notes') @RequirePermission('trips.update_notes') @Idempotent()
  notes(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: TripNotesDto) {
    return this.trips.notes(req.principal!, id, body);
  }
  @Post(':id/proof') @RequirePermission('delivery_proofs.upload') @ProofUpload() @Idempotent()
  proof(@Req() req: ApiRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: TripProofDto, @UploadedFile() file: Express.Multer.File) {
    return this.trips.proof(req.principal!, id, body, file, req.requestId);
  }
}

@Module({ imports: [DatabaseModule], controllers: [TripsController], providers: [TripsService] })
export class TripsModule {}
