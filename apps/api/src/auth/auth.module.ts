import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { PasswordService } from './password.service.js';
import { TotpService } from './totp.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, PasswordService, TotpService],
  exports: [TokenService],
})
export class AuthModule {}
