export interface NetworkPort {
    getText(url: string): Promise<string>;
    postJson<T = any>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
}
