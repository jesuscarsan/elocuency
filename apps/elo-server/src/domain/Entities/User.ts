export class User {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email?: string,
    public readonly preferences: Record<string, unknown> = {}
  ) {}

  public getPreference<T>(key: string): T | undefined {
    return this.preferences[key] as T | undefined;
  }
}
