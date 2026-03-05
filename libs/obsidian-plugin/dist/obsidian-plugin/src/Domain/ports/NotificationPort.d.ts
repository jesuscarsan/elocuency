export interface NotificationPort {
    showMessage(keyOrMessage: string, args?: Record<string, any>): void;
    showError(keyOrMessage: string, args?: Record<string, any>): void;
}
