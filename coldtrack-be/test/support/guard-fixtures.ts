import { Body, Controller, Get, HttpCode, Module, Post, Query, Req } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { ApiModule } from '../../libs/api/api.module.js';
import { Public, RequirePermission } from '../../libs/api/auth.js';
import { assertVersion, type ApiRequest } from '../../libs/api/errors.js';
import { Idempotent } from '../../libs/api/idempotency.js';

export const fixtureState = {
  calls: 0, entered: undefined as (() => void) | undefined,
  release: undefined as Promise<void> | undefined,
};

class MutationDto {
  @IsOptional() @IsBoolean() fail?: boolean;
  @IsOptional() @IsBoolean() wait?: boolean;
  @IsOptional() @IsInt() @Min(0) value?: number;
}

@Controller('_t')
class GuardFixtureController {
  @Get('any-auth')
  anyAuth(@Req() req: ApiRequest) { return req.principal; }

  @Get('perm-shipments-read') @RequirePermission('shipments.read')
  read() { return { ok: true }; }

  @Get('approve') @RequirePermission('shipments.approve')
  approve() { return { ok: true }; }

  @Post('mutate') @Idempotent() @HttpCode(202)
  async mutate(@Body() body: MutationDto) {
    fixtureState.calls++;
    if (body.wait) { fixtureState.entered?.(); await fixtureState.release; }
    if (body.fail) throw new Error('SQL secret: select * from private_table');
    return { call: fixtureState.calls, value: body.value ?? 0 };
  }

  @Get('version-check')
  version(@Query('version') version: string) {
    assertVersion({ version: 7 }, Number(version));
    return { version: 7 };
  }

  @Get('public') @Public()
  publicRoute() { return { ok: true }; }

  @Get('internal')
  internal() { throw new Error('SQL secret: select * from private_table'); }
}

// Imported only by integration tests; never by the production AppModule.
@Module({ imports: [ApiModule], controllers: [GuardFixtureController] })
export class GuardFixturesModule {}
