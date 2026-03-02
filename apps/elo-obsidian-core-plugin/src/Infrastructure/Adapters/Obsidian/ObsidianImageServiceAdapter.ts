
import { ImageServicePort } from '../../../Domain/Ports/ImageServicePort';
import { ImageEnricherService } from '@/Application/Services/ImageEnricherService';

export class ObsidianImageServiceAdapter implements ImageServicePort {
    constructor(private readonly service: ImageEnricherService) { }

    async searchImages(query: string, count: number): Promise<string[]> {
        return this.service.searchImages(query, count);
    }
}
