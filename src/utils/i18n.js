import tr from '../locales/tr.js';
import en from '../locales/en.js';

const locales = { tr, en };
const defaultLocale = 'tr';

export function t(locale, key, params = {}) {
    const lang = locales[locale] || locales[defaultLocale];
    const keys = key.split('.');
    
    let value = lang;
    for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
    }

    if (typeof value !== 'string') {
        // Fallback to default locale
        value = locales[defaultLocale];
        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
        }
    }

    if (typeof value !== 'string') {
        return key;
    }

    // Replace parameters
    return value.replace(/\{(\w+)\}/g, (_, param) => params[param] ?? `{${param}}`);
}

export function getLocale(locale) {
    return locales[locale] ? locale : defaultLocale;
}

export function getAvailableLocales() {
    return Object.keys(locales);
}

export default { t, getLocale, getAvailableLocales };
