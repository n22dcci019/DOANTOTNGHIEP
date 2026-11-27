import { Body, Controller, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { Public, RequirePermission } from '../../../../libs/api/auth.js';
import type { ApiRequest } from '../../../../libs/api/errors.js';
import { Idempotent } from '../../../../libs/api/idempotency.js';
import { DatabaseModule } from '../../../../libs/database/database.module.js';
import { EmailModule } from '../../../../libs/email/email-sender.js';
import { AcceptInvitationDto, InviteDto, UpdateProfileDto } from './accounts.dto.js';
import { AccountsService } from './accounts.service.js';

@Controller()
class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Patch('me') @RequirePermission('profiles.update') @Idempotent()
  update(@Req() req: ApiRequest, @Body() body: UpdateProfileDto) {
    return this.accounts.updateProfile(req.principal!.userId, body);
  }

  @Post('invitations') @HttpCode(202) @RequirePermission('account.invite') @Idempotent()
  invite(@Req() req: ApiRequest, @Body() body: InviteDto) {
    return this.accounts.invite(req.principal!.userId, req.principal!.roleCode, body);
  }

  // Explicit step 2.2 exception: public accept has NO Idempotency-Key requirement.
  // The one-use invitation is checked under SELECT FOR UPDATE; reuse returns 404.
  @Post('invitations/accept') @Public()
  accept(@Req() req: ApiRequest, @Body() body: AcceptInvitationDto) {
    return this.accounts.accept(body, req.requestId);
  }

  @Post('accounts/:userId/suspend') @HttpCode(200) @RequirePermission('account.manage') @Idempotent()
  suspend(@Req() req: ApiRequest, @Param('userId', new ParseUUIDPipe()) id: string) {
    return this.accounts.setStatus(req.principal!.userId, id, 'suspended');
  }

  @Post('accounts/:userId/activate') @HttpCode(200) @RequirePermission('account.manage') @Idempotent()
  activate(@Req() req: ApiRequest, @Param('userId', new ParseUUIDPipe()) id: string) {
    return this.accounts.setStatus(req.principal!.userId, id, 'active');
  }
}

@Module({ imports: [DatabaseModule, EmailModule], controllers: [AccountsController], providers: [AccountsService] })
export class AccountsModule {}
