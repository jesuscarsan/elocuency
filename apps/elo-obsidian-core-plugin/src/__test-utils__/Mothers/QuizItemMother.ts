import { QuizItem } from '../../Domain/Models/QuizItem';

export class QuizItemMother {
	static create(overrides?: Partial<QuizItem>): QuizItem {
		return {
			heading: 'Test Heading',
			blockId: 'test-block-id',
			text: 'Test quiz question text',
			range: { start: 10, end: 50 },
			...overrides,
		};
	}

	static withText(text: string): QuizItem {
		return this.create({ text });
	}
}
