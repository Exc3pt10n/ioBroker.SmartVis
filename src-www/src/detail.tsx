import { createContext, useContext } from 'react';

/** Öffnet die Detailansicht eines Geräts (App-weit) */
export const DetailContext = createContext<(deviceId: string) => void>(() => undefined);

export function useOpenDetail(): (deviceId: string) => void {
    return useContext(DetailContext);
}
