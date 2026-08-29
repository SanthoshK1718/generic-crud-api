const { getDatabase, collectionExists } = require("../config/database");

const ORGANIZATION_COLLECTION = "organization";
const BLOCKED_COLLECTIONS = ["vendors", "organizations"];

const isOrganizationCollection = (collectionName) =>
    collectionName === ORGANIZATION_COLLECTION;

const resolveCollectionName = (collectionName) =>
    isOrganizationCollection(collectionName)
        ? ORGANIZATION_COLLECTION
        : collectionName;

const isBlockedCollection = (collectionName) =>
    BLOCKED_COLLECTIONS.includes(collectionName);

const getOrganizationCollection = () =>
    getDatabase().collection(ORGANIZATION_COLLECTION);

const parseOrgId = (value) => {
    if (value === undefined || value === null || value === "") {
        return { missing: true };
    }

    if (typeof value === "boolean") {
        return { invalid: true };
    }

    if (typeof value === "number") {
        if (!Number.isInteger(value)) {
            return { invalid: true };
        }

        return { value };
    }

    if (typeof value === "string") {
        const trimmed = value.trim();

        if (!trimmed) {
            return { missing: true };
        }

        if (!/^-?\d+$/.test(trimmed)) {
            return { invalid: true };
        }

        const parsed = Number(trimmed);

        if (!Number.isInteger(parsed)) {
            return { invalid: true };
        }

        return { value: parsed };
    }

    return { invalid: true };
};

const buildOrgIdQuery = (org_id) => ({
    $or: [
        { org_id: { $in: [org_id, String(org_id)] } },
        { orgId: { $in: [org_id, String(org_id)] } },
    ],
});

const getOrgIdFromDocument = (document) =>
    document?.org_id ?? document?.orgId;

const findOrganization = async (org_id) => {
    const parsed = parseOrgId(org_id);

    if (!parsed.value && parsed.value !== 0) {
        return null;
    }

    if (!(await collectionExists(ORGANIZATION_COLLECTION))) {
        return null;
    }

    return getOrganizationCollection().findOne({
        ...buildOrgIdQuery(parsed.value),
        is_deleted: { $ne: true },
    });
};

const getCanonicalOrgId = (organization) => {
    const parsed = parseOrgId(getOrgIdFromDocument(organization));

    return parsed.value;
};

module.exports = {
    ORGANIZATION_COLLECTION,
    BLOCKED_COLLECTIONS,
    isOrganizationCollection,
    resolveCollectionName,
    isBlockedCollection,
    getOrganizationCollection,
    parseOrgId,
    buildOrgIdQuery,
    getOrgIdFromDocument,
    findOrganization,
    getCanonicalOrgId,
};
