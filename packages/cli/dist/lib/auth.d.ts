export interface StraudeConfig {
    token: string;
    username: string;
    api_url: string;
}
export declare function loadConfig(): StraudeConfig | null;
export declare function saveConfig(config: StraudeConfig): void;
export declare function requireAuth(): StraudeConfig;
