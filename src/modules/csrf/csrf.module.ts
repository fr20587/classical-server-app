import { Module } from '@nestjs/common';

import { CachingModule } from 'src/common/cache/cache.module';

import { CsrfService } from './csrf.service';

import { CsrfController } from './csrf.controller';

@Module({
  imports: [CachingModule],
  controllers: [CsrfController],
  providers: [CsrfService],
  exports: [CsrfService],
})
export class CsrfModule { }
