import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

// Common
import { CryptoModule } from '../../common/crypto/crypto.module';
import { HttpModule } from '../../common/http/http.module';

// Infrastructure
import { TransactionSchemaFactory } from './infrastructure/schemas/transaction.schema';
import { TransactionSequenceSchema } from './infrastructure/schemas/transaction-sequence.schema';
import { MongoDbSequenceAdapter } from './infrastructure/adapters/sequence.adapter';
import { MongoDbTransactionsRepository } from './infrastructure/adapters/mongodb-transactions.repository';
import { TransactionsController } from './infrastructure/controllers/transactions.controller';
import { TransactionExpirationTask } from './infrastructure/tasks/transaction-expiration.task';

// Application
import { TransactionService } from './application/services/transaction.service';
import { TransactionQueryService } from './application/services/transaction-query.service';
import { TenantWebhookDispatcher } from './application/services/tenant-webhook.dispatcher';

// Ports
import { ISequencePort } from './domain/ports/sequence.port';
import { ITransactionsRepository } from './domain/ports/transactions.repository';
import { Tenant, TenantSchema } from '../tenants/infrastructure/schemas/tenant.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: 'Transaction',
                schema: TransactionSchemaFactory,
                collection: 'transactions',
            },
            {
                name: 'TransactionSequence',
                schema: TransactionSequenceSchema,
                collection: 'transaction_sequences',
            },
            {
                name: 'Tenant',
                schema: TenantSchema,
                collection: 'tenants',
            },
        ]),
        ScheduleModule.forRoot(),
        CryptoModule,
        HttpModule,
    ],
    controllers: [TransactionsController],
    providers: [
        // Adapters
        MongoDbSequenceAdapter,
        MongoDbTransactionsRepository,
        
        // Services
        TransactionService,
        TransactionQueryService,
        TenantWebhookDispatcher,

        // Tasks
        TransactionExpirationTask,
    ],
    exports: [TransactionService, TransactionQueryService],
})
export class TransactionsModule { }
