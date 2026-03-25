import { Note } from './Note';

export class Memory {
  constructor(
    public readonly id: string,
    public readonly basePath: string,
    public readonly name: string
  ) {}

  public getFullNotePath(notePath: string): string {
    return `${this.basePath}/${notePath}`;
  }
}
