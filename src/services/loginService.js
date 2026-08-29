const { getDocuments } = require("./crudService");
const { isBlockedCollection, isOrganizationCollection } = require("./orgService");
const { matchesPassword } = require("../utils/password");

const LOGIN_ERROR = "Internal server error";

const normalizeValue = (value) => String(value).trim();

const buildLoginFilter = (email, phone) => {
    if (email !== undefined && email !== null && String(email).trim() !== "") {
        return { email: normalizeValue(email) };
    }

    const normalizedPhone = normalizeValue(phone);
    const phoneValues = [normalizedPhone];
    const numericPhone = Number(normalizedPhone);

    if (!Number.isNaN(numericPhone)) {
        phoneValues.push(numericPhone);
    }

    return { phone: { $in: phoneValues } };
};

const validateCollectionType = (type) => {
    if (!type || typeof type !== "string") {
        throw new Error(LOGIN_ERROR);
    }

    const collectionName = type.trim();

    if (!/^[a-zA-Z0-9_-]+$/.test(collectionName)) {
        throw new Error(LOGIN_ERROR);
    }

    if (isBlockedCollection(collectionName) || isOrganizationCollection(collectionName)) {
        throw new Error(LOGIN_ERROR);
    }

    return collectionName;
};

const stripPassword = (user) => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

const login = async ({ type, orgId, email, phone, password }) => {
    const collectionName = validateCollectionType(type);

    if (orgId === undefined || orgId === null) {
        throw new Error(LOGIN_ERROR);
    }

    const hasEmail = email !== undefined && email !== null && String(email).trim() !== "";
    const hasPhone = phone !== undefined && phone !== null && String(phone).trim() !== "";

    if (!hasEmail && !hasPhone) {
        throw new Error(LOGIN_ERROR);
    }

    if (hasEmail && hasPhone) {
        throw new Error(LOGIN_ERROR);
    }

    if (password === undefined || password === null || String(password) === "") {
        throw new Error(LOGIN_ERROR);
    }

    const filter = buildLoginFilter(email, phone);

    const result = await getDocuments(collectionName, filter, orgId);
    const users = result.data.filter((user) => {
        if (hasEmail) {
            return normalizeValue(user.email) === normalizeValue(email);
        }

        return normalizeValue(user.phone) === normalizeValue(phone);
    });

    if (users.length !== 1) {
        throw new Error(LOGIN_ERROR);
    }

    const user = users[0];

    if (
        user.password === undefined ||
        user.password === null ||
        String(user.password).trim() === ""
    ) {
        throw new Error(LOGIN_ERROR);
    }

    if (!matchesPassword(password, user.password)) {
        throw new Error(LOGIN_ERROR);
    }

    return stripPassword(user);
};

module.exports = {
    login,
    LOGIN_ERROR,
};
