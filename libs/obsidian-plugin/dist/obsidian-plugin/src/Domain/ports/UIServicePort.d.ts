export interface SelectionItem<T> {
    label: string;
    value: T;
}
export interface UIServicePort {
    showMessage(keyOrMessage: string, args?: Record<string, any>): void;
    showSelectionModal<T>(placeholder: string, items: T[], labelFn: (item: T) => string): Promise<T | null>;
}
