import { Note } from './Note';

export class Vault {
  constructor(
    public readonly id: string,
    public readonly basePath: string,
    public readonly name: string
  ) {}

  public getFullNotePath(notePath: string): string {
    return `${this.basePath}/${notePath}`;
  }
}
