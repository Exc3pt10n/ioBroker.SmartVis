/** Liest den Namen eines Objekts in der gewünschten Sprache */
export function getName(obj: ioBroker.Object | undefined, lang: string): string | undefined {
    const name = obj?.common?.name;
    if (!name) {
        return undefined;
    }
    if (typeof name === 'string') {
        return name;
    }
    const translated = name as Record<string, string>;
    return translated[lang] || translated.en || Object.values(translated)[0];
}
