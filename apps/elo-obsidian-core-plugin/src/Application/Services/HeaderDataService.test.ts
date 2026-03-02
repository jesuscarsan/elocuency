import { HeaderDataService } from './HeaderDataService';
import { HeaderDataPort, HeaderProgress, HeaderData } from "@elo/core";

describe('HeaderDataService', () => {
    let service: HeaderDataService;
    let mockRepository: jest.Mocked<HeaderDataPort>;

    beforeEach(() => {
        mockRepository = {
            getHeaderData: jest.fn(),
            getHeaderProgress: jest.fn(),
        } as unknown as jest.Mocked<HeaderDataPort>;

        service = new HeaderDataService(mockRepository);
    });

    describe('getHeaderData', () => {
        it('should call repository getHeaderData', async () => {
            const path = 'test.md';
            const mockData = {} as HeaderData;
            mockRepository.getHeaderData.mockResolvedValue(mockData);

            const result = await service.getHeaderData(path);

            expect(result).toBe(mockData);
            expect(mockRepository.getHeaderData).toHaveBeenCalledWith(path);
        });
    });

    describe('getHeaderProgress', () => {
        it('should call repository getHeaderProgress', async () => {
            const path = 'test.md';
            const mockProgress = {} as HeaderProgress;
            mockRepository.getHeaderProgress.mockResolvedValue(mockProgress);

            const result = await service.getHeaderProgress(path);

            expect(result).toBe(mockProgress);
            expect(mockRepository.getHeaderProgress).toHaveBeenCalledWith(path);
        });
    });

    describe('findMissingHeaders', () => {
        it('should return headers that are in progress but not in currentHeaders', () => {
            const progress: HeaderProgress = {
                'Header 1': { count: 1, lastChecked: 0 },
                'Header 2': { count: 2, lastChecked: 0 }
            } as unknown as HeaderProgress;
            
            const currentHeaders = ['Header 1', 'Header 3'];

            const result = service.findMissingHeaders(progress, currentHeaders);

            expect(result).toEqual(['Header 2']);
        });

        it('should be case sensitive (preserving original key casing)', () => {
            const progress: HeaderProgress = {
                'HeaderA': { count: 1 }
            } as any;
            const currentHeaders = ['headera'];

            const result = service.findMissingHeaders(progress, currentHeaders);

            expect(result).toEqual(['HeaderA']);
        });

        it('should trim current headers before comparison', () => {
             const progress: HeaderProgress = {
                'Header 1': { count: 1 }
            } as any;
            const currentHeaders = ['  Header 1  '];

            const result = service.findMissingHeaders(progress, currentHeaders);

            expect(result).toEqual([]);
        });
    });
});
