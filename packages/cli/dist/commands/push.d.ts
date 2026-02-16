interface PushOptions {
    date?: string;
    days?: number;
    dryRun?: boolean;
}
export declare function pushCommand(options: PushOptions): Promise<void>;
export {};
