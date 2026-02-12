import { Test, TestingModule } from '@nestjs/testing';
import { SessionPersistenceService } from './session-persistence.service';
import { SessionRepository } from '../adapters/session.repository';
import { SessionStatus, ISession } from '../../domain/models/session.model';
import { UserDTO } from 'src/modules/users/domain/ports/users.port';

describe('SessionPersistenceService', () => {
  let service: SessionPersistenceService;
  let sessionRepository: SessionRepository;

  const mockUserDTO: UserDTO = {
    id: 'user-123',
    fullname: 'John Doe',
    idNumber: '12345678',
    phone: '+50670000000',
    roleKey: 'user',
    additionalRoleKeys: [],
    status: 'ACTIVE' as any,
  };

  const mockSession: ISession = {
    id: 'session-123',
    userId: 'user-123',
    user: mockUserDTO,
    status: SessionStatus.ACTIVE,
    loginTimestamp: new Date('2026-02-12T10:00:00Z'),
    lastActivityTime: new Date('2026-02-12T10:00:00Z'),
    tokenUpdates: [],
    expiresAt: new Date('2026-02-19T10:00:00Z'),
    createdAt: new Date('2026-02-12T10:00:00Z'),
    updatedAt: new Date('2026-02-12T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionPersistenceService,
        {
          provide: SessionRepository,
          useValue: {
            create: jest.fn(),
            findByUserId: jest.fn(),
            updateTokenHistory: jest.fn(),
            updateStatus: jest.fn(),
            findExpiredSessions: jest.fn(),
            updateLastActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionPersistenceService>(SessionPersistenceService);
    sessionRepository = module.get<SessionRepository>(SessionRepository);
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const mockResult = { isSuccess: true, data: mockSession };
      jest.spyOn(sessionRepository, 'create').mockResolvedValue(mockResult);

      const result = await service.createSession(
        'user-123',
        mockUserDTO,
        new Date('2026-02-12T10:00:00Z'),
        'Bearer',
      );

      expect(result.isSuccess).toBe(true);
      expect(result.data).toEqual(mockSession);
      expect(sessionRepository.create).toHaveBeenCalled();
    });

    it('should handle errors when creating session', async () => {
      const mockError = { isSuccess: false, error: 'Database error' };
      jest.spyOn(sessionRepository, 'create').mockResolvedValue(mockError);

      const result = await service.createSession(
        'user-123',
        mockUserDTO,
        new Date(),
        'Bearer',
      );

      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('recordAccessTokenRefresh', () => {
    it('should record token refresh with preview format (first5...last5)', async () => {
      const mockToken = 'abcdefghijklmnopqrstuvwxyz'; // 26 characters
      const mockResult = {
        isSuccess: true,
        data: {
          ...mockSession,
          tokenUpdates: [{ timestamp: new Date(), tokenPreview: 'abcde...vwxyz' }],
        },
      };

      jest.spyOn(sessionRepository, 'updateTokenHistory').mockResolvedValue(mockResult);

      const result = await service.recordAccessTokenRefresh('user-123', mockToken);

      expect(result.isSuccess).toBe(true);
      expect(sessionRepository.updateTokenHistory).toHaveBeenCalledWith(
        'user-123',
        'abcde...vwxyz',
      );
    });

    it('should handle short tokens (less than 10 chars)', async () => {
      const mockShortToken = 'short';
      const mockResult = { isSuccess: true, data: mockSession };

      jest.spyOn(sessionRepository, 'updateTokenHistory').mockResolvedValue(mockResult);

      const result = await service.recordAccessTokenRefresh('user-123', mockShortToken);

      expect(result.isSuccess).toBe(true);
      expect(sessionRepository.updateTokenHistory).toHaveBeenCalledWith('user-123', 'short');
    });

    it('should handle errors when recording token refresh', async () => {
      const mockError = { isSuccess: false, error: 'Session not found' };
      jest.spyOn(sessionRepository, 'updateTokenHistory').mockResolvedValue(mockError);

      const result = await service.recordAccessTokenRefresh('user-123', 'token123');

      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('revokeSession', () => {
    it('should revoke session', async () => {
      const revokedSession = { ...mockSession, status: SessionStatus.REVOKED };
      const mockResult = { isSuccess: true, data: revokedSession };

      jest.spyOn(sessionRepository, 'updateStatus').mockResolvedValue(mockResult);

      const result = await service.revokeSession('user-123', 'User logout');

      expect(result.isSuccess).toBe(true);
      expect(result.data?.status).toBe(SessionStatus.REVOKED);
      expect(sessionRepository.updateStatus).toHaveBeenCalledWith(
        'user-123',
        SessionStatus.REVOKED,
      );
    });
  });

  describe('expireExpiredSessions', () => {
    it('should mark expired sessions as EXPIRED', async () => {
      const expiredSession = { ...mockSession, expiresAt: new Date('2026-02-01T00:00:00Z') };
      const findResult = { isSuccess: true, data: [expiredSession] };
      const updateResult = { isSuccess: true, data: { ...expiredSession, status: SessionStatus.EXPIRED } };

      jest.spyOn(sessionRepository, 'findExpiredSessions').mockResolvedValue(findResult);
      jest.spyOn(sessionRepository, 'updateStatus').mockResolvedValue(updateResult);

      const result = await service.expireExpiredSessions();

      expect(result.isSuccess).toBe(true);
      expect(result.count).toBe(1);
      expect(sessionRepository.updateStatus).toHaveBeenCalledWith(
        'user-123',
        SessionStatus.EXPIRED,
      );
    });

    it('should handle no expired sessions', async () => {
      const findResult = { isSuccess: true, data: [] };

      jest.spyOn(sessionRepository, 'findExpiredSessions').mockResolvedValue(findResult);

      const result = await service.expireExpiredSessions();

      expect(result.isSuccess).toBe(true);
      expect(result.count).toBe(0);
    });

    it('should handle errors finding expired sessions', async () => {
      const findResult = { isSuccess: false, error: 'Database error' };

      jest.spyOn(sessionRepository, 'findExpiredSessions').mockResolvedValue(findResult);

      const result = await service.expireExpiredSessions();

      expect(result.isSuccess).toBe(false);
      expect(result.count).toBe(0);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getActiveSession', () => {
    it('should get active session', async () => {
      const mockResult = { isSuccess: true, data: mockSession };
      jest.spyOn(sessionRepository, 'findByUserId').mockResolvedValue(mockResult);

      const result = await service.getActiveSession('user-123');

      expect(result.isSuccess).toBe(true);
      expect(result.data).toEqual(mockSession);
    });
  });

  describe('updateLastActivity', () => {
    it('should update last activity timestamp', async () => {
      const updatedSession = { ...mockSession, lastActivityTime: new Date() };
      const mockResult = { isSuccess: true, data: updatedSession };

      jest.spyOn(sessionRepository, 'updateLastActivity').mockResolvedValue(mockResult);

      const result = await service.updateLastActivity('user-123');

      expect(result.isSuccess).toBe(true);
      expect(sessionRepository.updateLastActivity).toHaveBeenCalledWith('user-123');
    });
  });
});
