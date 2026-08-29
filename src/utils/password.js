const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

const getEncryptionKey = () => {
    const secret = process.env.PASSWORD_SECRET || process.env.MONGODB_URI;

    if (!secret) {
        throw new Error("PASSWORD_SECRET is not defined");
    }

    return crypto.createHash("sha256").update(secret).digest();
};

const encryptPassword = (plainPassword) => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(plainPassword), "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptPassword = (storedPassword) => {
    const [ivHex, tagHex, encryptedHex] = String(storedPassword).split(":");

    if (!ivHex || !tagHex || !encryptedHex) {
        throw new Error("Invalid encrypted password format");
    }

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(ivHex, "hex")
    );

    decipher.setAuthTag(Buffer.from(tagHex, "hex"));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
};

const matchesPassword = (plainPassword, storedPassword) => {
    try {
        return decryptPassword(storedPassword) === String(plainPassword);
    } catch {
        return false;
    }
};

module.exports = {
    encryptPassword,
    decryptPassword,
    matchesPassword,
};
