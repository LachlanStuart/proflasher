type CardModel = {
    Back: string;
    Front: string;
};
interface NoteModel {
    description: string;
    noteType: string;
    fieldDescriptions: Record<string, string>;
    fieldGroups: string[][];
    requiredFields: string[];
    cardDescriptions: Record<string, string>;
    cards: Record<string, CardModel>;
}
type Templates = Record<string, NoteModel>;
const templates: Templates = {};

const keyDescription = (
    "Primary key for the card. Use the dictionary form of the word/phrase. "
    + "If there is a reported clash, search for it and choose to either update the existing card or "
    + " create a new card with a suffixed key."
)

const deFlag = `<td><div class="de">DE</div>:</td>`;
const frFlag = `<td><div class="fr">FR</div>:</td>`;
const zhFlag = `<td><div class="中文">中文</div>:</td>`;
const pyFlag = `<td><div class="zh">ZH</div>:</td>`;
const jpFlag = `<td><div class="jp">日本語</div>:</td>`;
const kanaFlag = `<td><div class="jp">仮名</div>:</td>`;
const enFlag = `<td><div class="en">EN</div>:</td>`;


const escapeHTMLAttribute = (str: string) =>
    str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const langFieldGroups = {
    de: [["DE", "EN"]],
    fr: [["FR", "EN"], ["ExtraFR", "ExtraEN"]],
    zh: [["ZH", "Hant", "Pinyin", "EN"]],
    jp: [["JP", "Kana", "EN"]],
}

const langFieldLangs = {
    de: { DE: "de", EN: "en" },
    fr: { FR: "fr", EN: "en", ExtraFR: "fr", ExtraEN: "en" },
    zh: { ZH: "zh", Hant: "zh", Pinyin: "zh", EN: "en" },
    jp: { JP: "jp", Kana: "jp", EN: "en" },
}

type CardRow = [flag: string, field: string, attrs: string]
const cards = (lang: keyof typeof langFieldGroups, ...rows: CardRow[]) => {
    const r = []
    const fieldGroups = langFieldGroups[lang]!;
    const fieldLangs = langFieldLangs[lang]!;
    const frontFirstRow = `<div class='bsp-card front' data-lang='${lang}'>`
    const backFirstRow = `<div class='bsp-card back' data-lang='${lang}'>`
    r.push(`<table data-debug class='pairs_table speakchild'>`)
    for (const [flag, field, attrs] of rows) {
        r.push(`<tr>${flag}<td ${attrs} data-field-display="${field}"></td></tr>`)
    }
    r.push("</table>")
    r.push(`<div class="hide hiddenCardData" data-field-groups="${escapeHTMLAttribute(JSON.stringify(fieldGroups))}" data-field-langs="${escapeHTMLAttribute(JSON.stringify(fieldLangs))}">`)
    for (const field of fieldGroups.flat()) {
        r.push(`<div data-field-data="${field}">{{${field}}}</div>`)
    }
    r.push("</div>")
    r.push('<div class="only-back backData">')
    r.push(`{{#Mnemonic}}<div>{{Mnemonic}}</div>{{/Mnemonic}}`)
    r.push(`{{#Related}}<div>{{Related}}</div>{{/Related}}`)
    r.push('</div>')
    r.push("</div>")
    return {
        Front: [frontFirstRow, ...r].join("\n"),
        Back: [backFirstRow, ...r].join("\n"),
    }
}

templates["de"] = {
    description: `
This card model is for learning German. Each card should have a word/phrase and 3 example sentences using the word/phrase.
This is represented by the DE and EN fields, using semicolons to separate the word/phrase and each sentence.
When there are multiple English translations for the word/phrase, use a comma to separate them.
The word/phrase should be infinitive/dictionary form with an article if appropriate, e.g. "können"/"to be able to", "die Katze"/"the cat", "rot"/"red".
However, reflexive verbs should be in first or second person so that the case is clear, e.g. "ich stelle mir vor"/"I imagine".
The English sentences may also use variations of the word when appropriate.
E.g.
DE: der Betrieb;der Betrieb ist sehr groß.;der Betrieb macht viel Geld.;der Betrieb ist sehr erfolgreich.
EN: the operation, business;the operation is very large.;the company makes a lot of money.;the business is very successful.

The other fields (Key, Mnemonic, Related) should not be semicolon-separated.
`,
    noteType: "DE<->EN",
    fieldDescriptions: {
        Key: keyDescription,
        DE: "(Semicolon-separated list)",
        EN: "(Semicolon-separated list)",
        Mnemonic: "Leave blank for normal words that have English equivalents. Otherwise specify how their usage differs to English.",
        Related: "Related words (if any). Include German and English, e.g. 'die Katze (the cat); das Meerschweinchen (the hamster)'",
    },
    requiredFields: ["Key", "DE", "EN"],
    fieldGroups: langFieldGroups.de,
    cardDescriptions: {
        "DE->EN": "German to English",
        "EN->DE": "English to German",
    },
    cards: {
        "DE->EN": cards("de",
            [deFlag, 'DE', `lang="de" class="prompt speaknow"`],
            [enFlag, 'EN', `lang="en" class="response"`],
        ),
        "EN->DE": cards("de",
            [enFlag, 'EN', `lang="en" class="prompt"`],
            [deFlag, 'DE', `lang="de" class="response speaknow"`],
        ),
    },
};

templates["fr"] = {
    description: `
This card model is for learning French. Each card should have a word/phrase and 3 example sentences using the word/phrase.
This is represented by the FR and EN fields, using semicolons to separate the word/phrase and each sentence.
When there are multiple English translations for the word/phrase, use a comma to separate them.
The English sentences may also use variations of the word when appropriate.
When the French word's gender is not clear in its dictionary form, add a suffix like "(f)" or "(m)".
E.g.
FR: l'opération (f);l'opération est très grande.;l'opération fait beaucoup d'argent.;l'opération est très réussie.
EN: the operation, business;the operation is very large;the company makes a lot of money;the business is very successful

ExtraFR and ExtraEN are similar semicolon-separated lists, but follow different rules:
For Verbs, they should be a list of conjugations: Infinitive;Singular first-person present;Singular second-person present;Singular third-person present;Plural third-person present;Infinitif passé;First-person passé composé;Third-person passé composé
E.g.:
ExtraFR: savoir;je sais;tu sais;il sait;ils savent;avoir su;j'ai su;il a su
ExtraEN: know;I know;You know;He knows;They know;have known;I have known;he has known
For Adjectives, they should be a list of declinations: Singular masculine;Singular feminine;Plural masculine;Plural feminine
with the English a shorthand for the name of the form.
E.g.:
ExtraFR: grand;grande;grands;grandes
ExtraEN: m.;f.;m. pl.;f. pl.
For all other word types, leave these fields empty.
`,
    noteType: "FR<->EN",
    fieldDescriptions: {
        Key: keyDescription,
        FR: "(Semicolon-separated list)",
        EN: "(Semicolon-separated list aligned to FR)",
        Mnemonic: "Leave blank for normal words that have English equivalents. Otherwise specify how their usage differs to English.",
        Related: "Related words (if any). Include French and English, e.g. 'le chat (the cat); le chaton (the kitten)'",
        ExtraFR: "(Semicolon-separated list)",
        ExtraEN: "(Semicolon-separated list aligned to ExtraFR)",
    },
    requiredFields: ["Key", "FR", "EN"],
    fieldGroups: langFieldGroups.fr,
    cardDescriptions: {
        "FR->EN": "French to English",
        "EN->FR": "English to French",
    },
    cards: {
        "FR->EN": cards("fr",
            [frFlag, 'FR', `lang="fr" class="prompt speaknow"`],
            [enFlag, 'EN', `lang="en" class="response"`],
        ),
        "EN->FR": cards("fr",
            [enFlag, 'EN', `lang="en" class="prompt"`],
            [frFlag, 'FR', `lang="fr" class="response speaknow"`],
        ),
    },
};

templates["zh"] = {
    description: `
This card model is for learning Chinese. Each card should have a word/phrase and 3 example sentences using the word/phrase.
This is represented by the ZH, Hant, Pinyin and EN fields, using semicolons to separate the word/phrase and each sentence.

When there are multiple English translations for the word/phrase, use a comma to separate them.
The English sentences may also use variations of the word when appropriate.
E.g.
这是一件小事情。 (Zhè shì yī jiàn xiǎo shìqing.) - This is a small matter/thing.
我有很多事情要做。 (Wǒ yǒu hěn duō shìqing yào zuò.) - I have many things to do.
这件事情很重要。 (Zhè jiàn shìqing hěn zhòngyào.) - This matter is very important.

ZH: 事情;这是一件小事情;我有很多事情要做;这件事情很重要
Hant: 事情;這是一件小事情;我有很多事情要做;這件事情很重要
Pinyin: shìqing;zhè shì yī jiàn xiǎo shìqing;wǒ yǒu hěn duō shìqing yào zuò;zhè jiàn shìqing hěn zhòngyào
EN: affair, matter;this is a small matter/thing;I have many things to do;this matter is very important
HasHant:
(HasHant has been left blank because the simplified and traditional forms of the word are identical)`,
    noteType: "ZH<->EN",
    fieldDescriptions: {
        Key: keyDescription,
        ZH: "(Semicolon-separated list)",
        Hant: "(Semicolon-separated list aligned to ZH)",
        Pinyin: "(Semicolon-separated list aligned to ZH)",
        EN: "(Semicolon-separated list aligned to ZH)",
        HasHant: 'Whether the word/phrase has a different traditional form to its simplified form. Set to "Y" if so, leave blank if not.',
        Mnemonic: "Leave blank for normal words that have English equivalents. Otherwise specify how their usage differs to English. When using Chinese characters, also include their pinyin readings in parentheses.",
        Related: "Related words (if any). Include Chinese, Pinyin and English for each, e.g. '猫 (māo) cat, 狗 (gǒu) dog'",
    },
    requiredFields: ["Key", "ZH", "EN"],
    fieldGroups: langFieldGroups.zh,
    cardDescriptions: {
        "ZH->EN": "Simplified Chinese to English",
        "Hant->EN": "Traditional Chinese to English",
        "EN->ZH": "English to Chinese",
    },
    cards: {
        "ZH->EN": cards("zh",
            [zhFlag, 'ZH', `lang="zh" class="prompt speakback"`],
            [zhFlag, 'Hant', `lang="zh" class="response speakme back-only"`],
            [pyFlag, 'Pinyin', `lang="zh" class="response"`],
            [enFlag, 'EN', `lang="en" class="response"`],
        ),
        "Hant->EN": cards("zh",
            [zhFlag, 'Hant', `lang="zh" class="prompt speakback"`],
            [zhFlag, 'ZH', `lang="zh" class="response speakme back-only"`],
            [pyFlag, 'Pinyin', `lang="zh" class="response"`],
            [enFlag, 'EN', `lang="en" class="response"`],
        ),
        "EN->ZH": cards("zh",
            [enFlag, 'EN', `lang="en" class="prompt"`],
            [zhFlag, 'ZH', `lang="zh" class="response speakback"`],
            [zhFlag, 'Hant', `lang="zh" class="response speakme back-only"`],
            [pyFlag, 'Pinyin', `lang="zh" class="response"`],
        ),
    },
};

templates["jp"] = {
    description: `
This card model is for learning Japanese. Each card should have a word/phrase (in dictionary or infinitive form), then 3 example sentences using the word/phrase.
This is represented by the JP, Kana and EN fields, using semicolons to separate the word/phrase and the 3 sentences.
This format may be changed if the user requests it (e.g. 5 sentences with a common grammar point).
Avoid using semicolons except to separate the list items, as they're treated as a list separator.

When there are multiple English translations for the word/phrase, use a comma to separate them.
The English sentences may also use variations of the word when appropriate.
E.g.
JP: 操作;この機械の操作は簡単です;リモコンでテレビを操作します;パソコンの操作を習っています
Kana: そうさ;この きかい の そうさ は かんたん です;リモコン で テレビ を そうさ します;パソコン の そうさ を ならっています
EN: to operate, to handle;the operation of this machine is simple;I operate the TV with a remote control;I am learning how to operate a computer
`,
    noteType: "JP<->EN",
    fieldDescriptions: {
        Key: keyDescription,
        JP: "(Semicolon-separated list)",
        Kana: "(Semicolon-separated list aligned to JP)",
        EN: "(Semicolon-separated list aligned to JP)",
        Mnemonic: "Leave blank for normal words that have English equivalents. Otherwise specify how their usage differs to English.",
        Related: "Related words (if any). Include Japanese, Kana and English for each, e.g. '猫 (ねこ) cat, 犬 (いぬ) dog'",
    },
    requiredFields: ["Key", "JP", "Kana", "EN"],
    fieldGroups: langFieldGroups.jp,
    cardDescriptions: {
        "JP->EN": "Japanese to English",
        "Kana->EN": "Kana to English",
        "EN->JP": "English to Japanese",
    },
    cards: {
        "JP->EN": cards("jp",
            [jpFlag, 'JP', `lang="jp" class="prompt speakback"`],
            [kanaFlag, 'Kana', `lang="jp" class="response speakme"`],
            [enFlag, 'EN', `lang="en" class="response"`],
        ),
        "Kana->EN": cards("jp",
            [kanaFlag, 'Kana', `lang="jp" class="prompt speaknow"`],
            [jpFlag, 'JP', `lang="jp" class="response speakme"`],
            [enFlag, 'EN', `lang="en" class="response"`],
        ),
        "EN->JP": cards("jp",
            [enFlag, 'EN', `lang="en" class="prompt"`],
            [jpFlag, 'JP', `lang="jp" class="response speakback"`],
            [kanaFlag, 'Kana', `lang="jp" class="response speakme"`],
        ),
    },
};

export function validateNote(noteType: string, note: Record<string, string>): { isValid: boolean; error?: string } {
    const errors = []

    if (!templates[noteType]) {
        errors.push(`Note type "${noteType}" not found.`)
    } else {
        const template = templates[noteType]
        const missingFields = template.requiredFields.filter(field => !note[field])
        if (missingFields.length > 0) {
            errors.push(`Missing required fields: ${missingFields.join(', ')}.`)
        }
        const extraFields = Object.keys(note).filter(field => !Object.hasOwn(template.fieldDescriptions, field))
        if (extraFields.length > 0) {
            errors.push(`Unrecognized fields: ${extraFields.join(', ')}.`)
        }
        for (const fieldGroup of template.fieldGroups) {
            const expectedLength = (note[fieldGroup[0]!] || '').split(';').length
            for (const field of fieldGroup) {
                const length = (note[field] || '').split(';').length
                if (length !== expectedLength) {
                    errors.push(`Inconsistent length between semicolon-separated lists ${fieldGroup[0]} and ${field}.`)
                }
            }
        }
    }
    if (errors.length > 0) {
        return { isValid: false, error: errors.join(' ') }
    } else {
        return { isValid: true }
    }
}



export default templates;
