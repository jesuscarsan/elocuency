export interface TemplateInfo {
  template: string;
  description: string;
}

export interface TemplateCachePort {
  buildCache(): Promise<TemplateInfo[]>;
  getCachedTemplates(): Promise<TemplateInfo[]>;
}
