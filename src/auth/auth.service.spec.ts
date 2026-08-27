import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MannschaftenService } from '../mannschaften/mannschaften.service';

describe('AuthService', () => {
  let service: AuthService;
  const mockUsersService = {
    findByEmail: jest.fn(),
    validatePassword: jest.fn(),
    create: jest.fn(),
  };
  const mockMannschaftenService = {
    create: jest.fn(),
    updateOwner: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: MannschaftenService, useValue: mockMannschaftenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a new user and update mannschaft owner', async () => {
    mockMannschaftenService.create.mockResolvedValue({ id: '#ABC', name: 'Team A' });
    mockUsersService.create.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
    mockMannschaftenService.updateOwner.mockResolvedValue({});

    const result = await service.register('test@example.com', 'password123', 'Team A');

    expect(mockMannschaftenService.create).toHaveBeenCalledWith('Team A', 'temp');
    expect(mockUsersService.create).toHaveBeenCalledWith('test@example.com', 'password123', '#ABC');
    expect(mockMannschaftenService.updateOwner).toHaveBeenCalledWith('#ABC', 'user-1');
    expect(result.mannschaft.ownerId).toBe('user-1');
  });

  it('should validate valid user credentials', async () => {
    mockUsersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
    });
    mockUsersService.validatePassword.mockResolvedValue(true);

    const user = await service.validateUser('test@example.com', 'password123');
    expect(user).toEqual({ id: 'user-1', email: 'test@example.com' });
  });

  it('should return null for invalid user credentials', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    const user = await service.validateUser('notfound@example.com', 'pass');
    expect(user).toBeNull();
  });
});
