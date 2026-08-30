const BLOCKED_TERMS = [
    "porn",
    "pornography",
    "pornographic",
    "nude",
    "nudes",
    "nudity",
    "naked",
    "xxx",
    "nsfw",
    "hentai",
    "erotic",
    "erotica",
    "sex tape",
    "sex video",
    "send nudes",
    "send nude",
    "nude pic",
    "xnxx",
    "nude photo",
    "child porn",
    "childporn",
    "blowjob",
    "handjob",
    "masturbat",
    "orgasm",
    "horny",
    "slut",
    "whore",
    "prostitut",
    "bestiality",
    "incest",
    "rape",
    "rapist",
    "molest",
    "pedophile",
    "paedophile",
    "fuck",
    "fucking",
    "motherfucker",
    "shit",
    "bitch",
    "bastard",
    "asshole",
    "dick",
    "pussy",
    "cock",
    "vagina",
    "penis",
    "boobs",
    "tits",
    "cumshot",
    "onlyfans",
];

const BLOCKED_CONTENT_ERROR = "Inappropriate or abusive content is not allowed";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (text) =>
    String(text).toLowerCase().replace(/\s+/g, " ").trim();

const findBlockedTerm = (text) => {
    const normalized = normalizeText(text);

    for (const term of BLOCKED_TERMS) {
        const pattern = term.includes(" ")
            ? new RegExp(escapeRegExp(term), "i")
            : new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");

        if (pattern.test(normalized)) {
            return term;
        }
    }

    return null;
};

const containsBlockedContent = (text) => Boolean(findBlockedTerm(text));

module.exports = {
    BLOCKED_CONTENT_ERROR,
    containsBlockedContent,
    findBlockedTerm,
};
