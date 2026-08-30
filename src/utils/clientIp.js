const getClientIp = (req) => {
    const forwarded = req.headers["x-forwarded-for"];

    if (forwarded) {
        return String(forwarded).split(",")[0].trim();
    }

    const realIp = req.headers["x-real-ip"];

    if (realIp) {
        return String(realIp).trim();
    }

    const remoteAddress = req.socket?.remoteAddress;

    if (remoteAddress) {
        return remoteAddress.replace(/^::ffff:/, "");
    }

    return "unknown";
};

const buildBlockedContentReply = (ip) => `Is this your IP address? ${ip} :)`;

module.exports = {
    getClientIp,
    buildBlockedContentReply,
};
