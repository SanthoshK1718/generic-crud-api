const DEFAULT_PUBLIC_URL = "https://generic-crud-api.vercel.app";

const getPublicBaseUrl = (req) => {
    if (process.env.PUBLIC_APP_URL) {
        return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }

    if (req) {
        const protocol = req.get("x-forwarded-proto") || req.protocol;
        return `${protocol}://${req.get("host")}`;
    }

    return DEFAULT_PUBLIC_URL;
};

module.exports = {
    getPublicBaseUrl,
};
