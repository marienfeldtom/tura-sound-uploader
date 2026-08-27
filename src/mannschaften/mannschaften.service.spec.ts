import { Test, TestingModule } from '@nestjs/testing';
import { MannschaftenService } from './mannschaften.service';
import { LowdbService } from '../lowdb/lowdb.service';

describe('MannschaftenService', () => {
  let service: MannschaftenService;
  const mockLowdbService = {
    add: jest.fn().mockImplementation((record) => Promise.resolve(record)),
    find: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findWhere: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MannschaftenService,
        {
          provide: LowdbService,
          useValue: mockLowdbService,
        },
      ],
    }).compile();

    service = module.get<MannschaftenService>(MannschaftenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a mannschaft with generated ID', async () => {
    const mannschaft = await service.create('Test Team', 'user-123');
    expect(mannschaft).toBeDefined();
    expect(mannschaft.name).toBe('Test Team');
    expect(mannschaft.ownerId).toBe('user-123');
    expect(mannschaft.id).toMatch(/^#[A-Z0-9]{3}$/);
    expect(mockLowdbService.add).toHaveBeenCalled();
  });

  it('should update owner of a mannschaft', async () => {
    await service.updateOwner('#T12', 'new-owner-id');
    expect(mockLowdbService.update).toHaveBeenCalledWith(
      { id: '#T12' },
      { ownerId: 'new-owner-id' },
      'mannschaften',
    );
  });
});
