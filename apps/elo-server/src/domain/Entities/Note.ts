export class Note {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly content: string,
    public readonly tags: string[] = [],
    public readonly createdDate: Date = new Date(),
    public readonly updatedDate: Date = new Date(),
    public readonly properties: Record<string, unknown> = {}
  ) {}

  public isTaggedWith(tag: string): boolean {
    return this.tags.includes(tag);
  }

  public getProperty<T>(key: string): T | undefined {
    return this.properties[key] as T | undefined;
  }
}
