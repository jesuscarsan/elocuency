import { App, TFile, TFolder } from 'obsidian';

export class SessionLogger {
    private app: App;
    private logFolderPath = '!!metadatos/Sesiones';

    constructor(app: App) {
        this.app = app;
    }

    private async ensureLogFile(): Promise<TFile | null> {
        // Ensure folder exists
        let folder = this.app.vault.getAbstractFileByPath(this.logFolderPath);
        if (!folder) {
            try {
                folder = await this.app.vault.createFolder(this.logFolderPath);
            } catch (e) {
                console.error('Error creating logging folder', e);
                return null;
            }
        }

        if (!(folder instanceof TFolder)) {
            console.error('Log path exists but is not a folder');
            return null;
        }

        const date = new Date();
        // Format: YYYY-MM-DD.md
        const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const filename = `${this.logFolderPath}/${dateStr}.md`;

        // Create file if not exists
        let file = this.app.vault.getAbstractFileByPath(filename);
        if (!file) {
            try {
                file = await this.app.vault.create(filename, '');
            } catch (e) {
                console.error('Error creating log file', e);
                return null;
            }
        }

        return file instanceof TFile ? file : null;
    }

    private formatTime(date: Date): string {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    private async appendLine(line: string) {
        try {
            const file = await this.ensureLogFile();
            if (file) {
                await this.app.vault.append(file, line + '\n');
            }
        } catch (e) {
            console.error('Failed to log session', e);
        }
    }

    async logStart(date: Date) {
        await this.appendLine(`[${this.formatTime(date)}] Inicio sesión`);
    }

    async logEnd(date: Date, durationMinutes: number) {
        // "cuando acabe, en otra linea hora fin, y minnutos totales."
        await this.appendLine(`[${this.formatTime(date)}] Fin sesión. Duración: ${Math.round(durationMinutes)} min.`);
    }

    async logQuestion(question: string) {
        // "cada vez que se cambie de pregunta que guarde una linea"
        const date = new Date();
        await this.appendLine(`[${this.formatTime(date)}] Pregunta: ${question}`);
    }

    async logScore(score: number) {
        // "y cada score tambien"
        const date = new Date();
        await this.appendLine(`[${this.formatTime(date)}] Score: ${score}`);
    }

    async logTranscript(speaker: string, text: string) {
        const date = new Date();
        // Format: [10:30] User: Hello
        await this.appendLine(`[${this.formatTime(date)}] ${speaker}: ${text}`);
    }
}
