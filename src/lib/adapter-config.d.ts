// Typisierung von adapter.config (native-Bereich aus io-package.json)
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            port: number;
            bind: string;
            language: string;
            ignoreAdapters: string;
            ignoreInstances: string;
            rediscoverDelay: number;
            allowEdit: boolean;
        }
    }
}

export {};
