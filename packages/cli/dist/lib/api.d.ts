import type { StraudeConfig } from "./auth.js";
export interface ApiError {
    error: string;
    status: number;
}
export declare function apiRequest<T>(config: StraudeConfig, path: string, options?: RequestInit): Promise<T>;
export declare function apiRequestNoAuth<T>(apiUrl: string, path: string, options?: RequestInit): Promise<T>;
