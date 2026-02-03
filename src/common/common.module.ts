// Nest Modules
import { Module } from '@nestjs/common';

// Modules
import { SmsModule } from './sms/sms.module';
import { HttpModule } from './http/http.module';
import { CryptoModule } from './crypto/crypto.module';

@Module({
  imports: [SmsModule, HttpModule, CryptoModule],
  exports: [SmsModule, HttpModule, CryptoModule],
})
export class CommonModule {}
