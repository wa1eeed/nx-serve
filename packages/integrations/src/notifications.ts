import { type Logger, consoleLogger } from './logger.js';

export type NotificationChannel = 'push' | 'sms' | 'whatsapp' | 'email' | 'inapp';

export interface SendResult {
  channel: NotificationChannel;
  providerMessageId: string;
  status: 'sent' | 'queued' | 'failed';
}

export interface SmsMessage {
  to: string;
  body: string;
  senderName?: string;
}
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
export interface WhatsAppMessage {
  to: string;
  template: string;
  variables?: Record<string, string>;
}
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

/**
 * One interface for all notification channels. Real adapters (Expo push, a Saudi
 * SMS provider, WhatsApp Business, SMTP) are wired in Phase 5 (docs/14); the
 * console provider lets the whole pipeline exist from Phase 0.
 */
export interface NotificationProvider {
  sendSms(message: SmsMessage): Promise<SendResult>;
  sendPush(message: PushMessage): Promise<SendResult>;
  sendWhatsApp(message: WhatsAppMessage): Promise<SendResult>;
  sendEmail(message: EmailMessage): Promise<SendResult>;
}

export class ConsoleNotificationProvider implements NotificationProvider {
  private counter = 0;

  constructor(private readonly logger: Logger = consoleLogger) {}

  private record(channel: NotificationChannel, to: string): SendResult {
    this.counter += 1;
    this.logger.debug('notification.send', { channel, to });
    return { channel, providerMessageId: `fake_msg_${this.counter}`, status: 'sent' };
  }

  sendSms(message: SmsMessage): Promise<SendResult> {
    return Promise.resolve(this.record('sms', message.to));
  }
  sendPush(message: PushMessage): Promise<SendResult> {
    return Promise.resolve(this.record('push', message.token));
  }
  sendWhatsApp(message: WhatsAppMessage): Promise<SendResult> {
    return Promise.resolve(this.record('whatsapp', message.to));
  }
  sendEmail(message: EmailMessage): Promise<SendResult> {
    return Promise.resolve(this.record('email', message.to));
  }
}
