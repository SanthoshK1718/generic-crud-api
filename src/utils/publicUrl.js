const DEFAULT_PUBLIC_URL = "https://generic-crud-api.vercel.app";

const getPublicBaseUrl = (req) => {
    if (process.env.PUBLIC_APP_URL) {
        return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
    }

    if (req) {
        const host = req.get("x-forwarded-host") || req.get("host");
        const protocol = req.get("x-forwarded-proto") || req.protocol || "https";

        if (host) {
            return `${protocol}://${host}`;
        }
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }

    return DEFAULT_PUBLIC_URL;
};

module.exports = {
    getPublicBaseUrl,
};
