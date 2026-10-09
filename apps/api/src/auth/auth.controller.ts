import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AppException } from '../common/app-exception.js';
import { Ctx, NoTenant } from '../common/decorators.js';
import { ZodValidationPipe } from '../common/zod.pipe.js';
import { type RequestContext } from '../context/request-context.js';
import { AuthService, type StaffLoginResult } from './auth.service.js';
import { type TokenPair } from './token.service.js';
import {
  type MfaVerifyDto,
  MfaVerifySchema,
  type OtpRequestDto,
  OtpRequestSchema,
  type OtpVerifyDto,
  OtpVerifySchema,
  type RefreshDto,
  RefreshSchema,
  type StaffLoginDto,
  StaffLoginSchema,
} from './dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  requestOtp(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(OtpRequestSchema)) body: OtpRequestDto,
  ): Promise<{ challenge_id: string }> {
    return this.auth.requestOtp(this.tenantId(ctx), body);
  }

  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body(new ZodValidationPipe(OtpVerifySchema)) body: OtpVerifyDto): Promise<TokenPair> {
    return this.auth.verifyOtp(body);
  }

  @Post('staff/login')
  @HttpCode(200)
  staffLogin(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(StaffLoginSchema)) body: StaffLoginDto,
  ): Promise<StaffLoginResult> {
    return this.auth.staffLogin(this.tenantId(ctx), body);
  }

  @Post('mfa/verify')
  @NoTenant()
  @HttpCode(200)
  mfaVerify(@Body(new ZodValidationPipe(MfaVerifySchema)) body: MfaVerifyDto): Promise<TokenPair> {
    return this.auth.mfaVerify(body);
  }

  @Post('token/refresh')
  @NoTenant()
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(RefreshSchema)) body: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(body);
  }

  @Post('logout')
  @NoTenant()
  @HttpCode(200)
  async logout(
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshDto,
  ): Promise<{ status: 'ok' }> {
    await this.auth.logout(body);
    return { status: 'ok' };
  }

  private tenantId(ctx: RequestContext): string {
    if (!ctx.tenantId) {
      throw new AppException('tenant_not_resolved');
    }
    return ctx.tenantId;
  }
}
