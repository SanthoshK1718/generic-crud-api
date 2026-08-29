const { ObjectId } = require("mongodb");
const { getDatabase, collectionExists } = require("../config/database");
const { isBlockedCollection } = require("./orgService");
const { getNextDocId } = require("./idService");
const { encryptPassword } = require("../utils/password");

const validateCollectionName = (collectionName) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(collectionName)) {
        throw new Error("Invalid collection name");
    }

    if (isBlockedCollection(collectionName)) {
        throw new Error(`Collection '${collectionName}' is not supported`);
    }
};

const getCollection = async (collectionName) => {
    validateCollectionName(collectionName);

    const exists = await collectionExists(collectionName);

    if (!exists) {
        throw new Error(
            `Collection '${collectionName}' does not exist. Create it manually first`
        );
    }

    return getDatabase().collection(collectionName);
};

const stripClientOrgFields = (data) => {
    delete data._id;
    delete data.id;
    delete data.orgId;
    delete data.org_id;
    delete data.created_on;
    delete data.modified_on;
    delete data.createdAt;
    delete data.updatedAt;
};

const resolveBoolean = (value, defaultValue) => {
    if (value === undefined || value === null) {
        return defaultValue;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (normalized === "true") {
            return true;
        }

        if (normalized === "false") {
            return false;
        }
    }

    return Boolean(value);
};

const encryptPasswordIfPresent = (data) => {
    if (
        Object.prototype.hasOwnProperty.call(data, "password") &&
        data.password !== undefined &&
        data.password !== null &&
        String(data.password) !== ""
    ) {
        data.password = encryptPassword(String(data.password));
    }
};

const buildIdFilter = (id) => {
    const numericId = Number(id);

    if (Number.isInteger(numericId) && String(numericId) === String(id).trim()) {
        return {
            $or: [{ id: numericId }, { _id: numericId }],
        };
    }

    const value = String(id);

    if (ObjectId.isValid(value) && String(new ObjectId(value)) === value) {
        return {
            $or: [{ _id: new ObjectId(value) }, { id: value }],
        };
    }

    return {
        $or: [{ _id: value }, { id: value }],
    };
};

const buildCreateDocument = async (collection, collectionName, data, orgId) => {
    const now = new Date();
    const docId = await getNextDocId(collection, collectionName, orgId);
    const is_active = resolveBoolean(data.is_active, true);
    const is_deleted = resolveBoolean(data.is_deleted, false);

    delete data.is_active;
    delete data.is_deleted;
    stripClientOrgFields(data);
    encryptPasswordIfPresent(data);

    return {
        ...data,
        _id: docId,
        id: docId,
        orgId,
        is_active,
        is_deleted,
        created_on: now,
        modified_on: now,
    };
};

const notDeletedFilter = {
    is_deleted: { $ne: true },
};

const scopedFilter = (orgId, filter = {}) => {
    const query = {
        ...filter,
        ...notDeletedFilter,
        orgId: { $in: [orgId, String(orgId)] },
    };

    return query;
};

const buildFindFilter = (find, orgId) => {
    if (!find || typeof find !== "object" || Array.isArray(find)) {
        throw new Error("payload.find must be a JSON object");
    }

    if (Object.keys(find).length === 0) {
        throw new Error("payload.find must contain at least one field");
    }

    const query = { ...notDeletedFilter };
    const findCopy = { ...find };

    if (findCopy.id !== undefined) {
        Object.assign(query, buildIdFilter(findCopy.id));
        delete findCopy.id;
    }

    if (findCopy._id !== undefined) {
        Object.assign(query, buildIdFilter(findCopy._id));
        delete findCopy._id;
    }

    Object.assign(query, findCopy);
    query.orgId = { $in: [orgId, String(orgId)] };

    return query;
};

const ensureCollectionIndexes = async (collection) => {
    const indexes = await collection.indexes();

    for (const index of indexes) {
        const keys = Object.keys(index.key);

        if (index.name === "id_1" && keys.length === 1) {
            await collection.dropIndex("id_1");
        }

        if (
            index.name === "orgId_1_id_1" &&
            !index.partialFilterExpression
        ) {
            await collection.dropIndex("orgId_1_id_1");
        }
    }

    await collection.createIndex(
        { orgId: 1, id: 1 },
        {
            unique: true,
            partialFilterExpression: { is_deleted: false },
        }
    );
};

const createDocument = async (collectionName, data, orgId) => {
    const collection = await getCollection(collectionName);

    if (orgId === undefined || orgId === null) {
        throw new Error("orgId is required and must be an integer");
    }

    const document = await buildCreateDocument(
        collection,
        collectionName,
        data,
        orgId
    );

    await ensureCollectionIndexes(collection);
    await collection.insertOne(document);

    return document;
};

const getDocuments = async (
    collectionName,
    filter = {},
    orgId,
    options = {}
) => {
    const collection = await getCollection(collectionName);
    const {
        pagination = false,
        paginationDetails = null,
        sorting = false,
        sortingDetails = null,
    } = options;

    const query = scopedFilter(orgId, filter);
    let cursor = collection.find(query);

    if (sorting && sortingDetails) {
        cursor = cursor.sort(sortingDetails);
    }

    const total = await collection.countDocuments(query);

    if (pagination && paginationDetails) {
        const page = paginationDetails.page;
        const limit = Math.min(paginationDetails.limit, 100);
        const skip = (page - 1) * limit;
        const data = await cursor.skip(skip).limit(limit).toArray();

        return { totalCount: total, data };
    }

    const data = await cursor.toArray();

    return { totalCount: total, data };
};

const updateDocument = async (collectionName, find, data, orgId) => {
    const collection = await getCollection(collectionName);

    delete data._id;
    delete data.id;
    delete data.orgId;
    delete data.org_id;
    delete data.created_on;
    delete data.modified_on;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.is_active;
    delete data.is_deleted;
    delete data.find;

    encryptPasswordIfPresent(data);
    data.modified_on = new Date();

    return collection.findOneAndUpdate(
        buildFindFilter(find, orgId),
        { $set: data },
        { returnDocument: "after" }
    );
};

const deleteDocument = async (collectionName, find, orgId) => {
    const collection = await getCollection(collectionName);

    const result = await collection.findOneAndUpdate(
        buildFindFilter(find, orgId),
        {
            $set: {
                is_deleted: true,
                is_active: false,
                modified_on: new Date(),
            },
        },
        { returnDocument: "after" }
    );

    return Boolean(result);
};

module.exports = {
    createDocument,
    getDocuments,
    updateDocument,
    deleteDocument,
};
