import { TFile } from 'obsidian'; // We should avoid TFile in Domain.
// TemplateMatch currently uses TFile. We need a Domain entity for Template.

export interface Template {
    path: string;
    basename: string; // or name
    content: string;
    config: any; // TemplateConfig
}

export interface TemplateMatch {
    template: Template;
    score: number;
}

export interface TemplateRepositoryPort {
    getAllTemplates(): Promise<TemplateMatch[]>;
}
