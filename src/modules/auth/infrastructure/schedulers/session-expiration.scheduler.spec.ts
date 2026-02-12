import { Test, TestingModule } from '@nestjs/testing';
import { SessionExpirationScheduler } from './session-expiration.scheduler';
import { SessionPersistenceService } from '../services/session-persistence.service';
import { AuditService } from 'src/modules/audit/application/audit.service';

describe('SessionExpirationScheduler', () => {
  let scheduler: SessionExpirationScheduler;
  let sessionPersistenceService: SessionPersistenceService;
  let auditService: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionExpirationScheduler,
        {
          provide: SessionPersistenceService,
          useValue: {
            expireExpiredSessions: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logAllow: jest.fn(),
            logError: jest.fn(),
          },
        },
      ],
    }).compile();

    scheduler = module.get<SessionExpirationScheduler>(SessionExpirationScheduler);
    sessionPersistenceService =
      module.get<SessionPersistenceService>(SessionPersistenceService);
    auditService = module.get<AuditService>(AuditService);
  });

  describe('expireExpiredSessions', () => {
    it('should expire sessions successfully and log to audit', async () => {
      const mockResult = { isSuccess: true, count: 5 };
      jest.spyOn(sessionPersistenceService, 'expireExpiredSessions').mockResolvedValue(
        mockResult,
      );

      await scheduler.expireExpiredSessions();

      expect(sessionPersistenceService.expireExpiredSessions).toHaveBeenCalled();
      expect(auditService.logAllow).toHaveBeenCalledWith(
        'SESSION_EXPIRATION_SCHEDULER',
        'system',
        'scheduler',
        expect.objectContaining({
          severity: 'LOW',
          tags: expect.arrayContaining(['session-management', 'scheduler', 'expiration']),
        }),
      );
    });

    it('should handle case when no sessions are expired', async () => {
      const mockResult = { isSuccess: true, count: 0 };
      jest.spyOn(sessionPersistenceService, 'expireExpiredSessions').mockResolvedValue(
        mockResult,
      );

      await scheduler.expireExpiredSessions();

      expect(sessionPersistenceService.expireExpiredSessions).toHaveBeenCalled();
      // auditService.logAllow should not be called when count is 0
      expect(auditService.logAllow).not.toHaveBeenCalled();
    });

    it('should log error if expiration fails', async () => {
      const mockResult = { isSuccess: false, count: 0, error: 'Database error' };
      jest.spyOn(sessionPersistenceService, 'expireExpiredSessions').mockResolvedValue(
        mockResult,
      );

      await scheduler.expireExpiredSessions();

      expect(auditService.logError).toHaveBeenCalledWith(
        'SESSION_EXPIRATION_SCHEDULER',
        'system',
        'scheduler',
        expect.any(Error),
        expect.objectContaining({
          severity: 'MEDIUM',
          tags: expect.arrayContaining(['session-management', 'scheduler', 'error']),
        }),
      );
    });

    it('should catch and log exceptions', async () => {
      const error = new Error('Unexpected error');
      jest.spyOn(sessionPersistenceService, 'expireExpiredSessions').mockRejectedValue(
        error,
      );

      await scheduler.expireExpiredSessions();

      expect(auditService.logError).toHaveBeenCalledWith(
        'SESSION_EXPIRATION_SCHEDULER',
        'system',
        'scheduler',
        error,
        expect.objectContaining({
          severity: 'HIGH',
          tags: expect.arrayContaining(['session-management', 'scheduler', 'error']),
        }),
      );
    });

    it('should handle non-Error exceptions', async () => {
      jest.spyOn(sessionPersistenceService, 'expireExpiredSessions').mockRejectedValue(
        'String error',
      );

      await scheduler.expireExpiredSessions();

      expect(auditService.logError).toHaveBeenCalled();
    });
  });
});
