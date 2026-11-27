import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export interface EmailMessage { to: string; subject: string; text: string }
export interface EmailSender { send(message: EmailMessage): Promise<void> }
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

@Injectable()
export class NoopEmailSender implements EmailSender {
  readonly messages: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> { this.messages.push({ ...message }); }
}

export class MailpitEmailSender implements EmailSender {
  private readonly transport;
  constructor(config: ConfigService) {
    const host = config.get<string>('MAILPIT_SMTP_HOST') ?? '127.0.0.1';
    const port = Number(config.get<string>('MAILPIT_SMTP_PORT') ?? 54325);
    // This step supports local Mailpit only, never an external mail provider.
    if (!['localhost', '127.0.0.1', '::1', 'mailpit', 'inbucket', 'supabase_inbucket_DoAnTotNghiep'].includes(host) ||
        !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local Mailpit SMTP configuration');
    this.transport = nodemailer.createTransport({
      host, port, secure: false, ignoreTLS: true,
      connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000,
    });
  }
  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: 'ColdTrack <no-reply@coldtrack.local>', ...message });
    } catch {
      // SMTP errors can include message content. Never propagate invitation tokens.
      throw new Error('Local invitation email delivery failed');
    }
  }
}

@Module({
  providers: [{
    provide: EMAIL_SENDER, inject: [ConfigService],
    useFactory: (config: ConfigService): EmailSender => {
      const provider = config.get<string>('EMAIL_PROVIDER') ?? 'mailpit';
      if (provider === 'noop') return new NoopEmailSender();
      if (provider === 'mailpit') return new MailpitEmailSender(config);
      throw new Error('EMAIL_PROVIDER must be mailpit or noop');
    },
  }],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
