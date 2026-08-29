const { ObjectId } = require("mongodb");
const { collectionExists } = require("../config/database");
const {
    ORGANIZATION_COLLECTION,
    getOrganizationCollection,
    findOrganization,
} = require("./orgService");
const { getNextDocId } = require("./idService");

const notDeletedFilter = {
    is_deleted: { $ne: true },
};

const ensureOrganizationCollection = async () => {
    if (!(await collectionExists(ORGANIZATION_COLLECTION))) {
        throw new Error(
            `Collection '${ORGANIZATION_COLLECTION}' does not exist. Create it manually first`
        );
    }

    const collection = getOrganizationCollection();
    const indexes = await collection.indexes();

    for (const index of indexes) {
        if (index.name === "orgId_1") {
            await collection.dropIndex("orgId_1");
        }
    }

    return collection;
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

const buildFindFilter = (find = {}) => {
    const query = { ...notDeletedFilter };

    if (!find || typeof find !== "object" || Array.isArray(find)) {
        throw new Error("payload.find must be a JSON object");
    }

    if (Object.keys(find).length === 0) {
        return query;
    }

    const findCopy = { ...find };

    if (findCopy.id !== undefined) {
        Object.assign(query, buildIdFilter(findCopy.id));
        delete findCopy.id;
    }

    if (findCopy.org_id !== undefined || findCopy.orgId !== undefined) {
        const orgValue = findCopy.org_id ?? findCopy.orgId;
        Object.assign(query, {
            $or: [
                { org_id: { $in: [Number(orgValue), String(orgValue)] } },
                { orgId: { $in: [Number(orgValue), String(orgValue)] } },
            ],
        });
        delete findCopy.org_id;
        delete findCopy.orgId;
    }

    Object.assign(query, findCopy);

    return query;
};

const createOrganization = async (org_id, name) => {
    const collection = await ensureOrganizationCollection();
    const existing = await findOrganization(org_id);

    if (existing) {
        throw new Error(
            `Shop with org_id ${org_id} already exists. Use a different org_id`
        );
    }

    const now = new Date();
    const docId = await getNextDocId(collection, ORGANIZATION_COLLECTION, null);

    const document = {
        _id: docId,
        id: docId,
        org_id,
        name,
        is_active: true,
        is_deleted: false,
        created_on: now,
        modified_on: now,
    };

    await collection.createIndex({ org_id: 1 }, { unique: true });
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.insertOne(document);

    return document;
};

const getOrganizations = async (find = {}, options = {}) => {
    const collection = await ensureOrganizationCollection();
    const {
        pagination = false,
        paginationDetails = null,
        sorting = false,
        sortingDetails = null,
    } = options;

    const query = buildFindFilter(find);
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

const updateOrganization = async (find, data) => {
    const collection = await ensureOrganizationCollection();

    delete data._id;
    delete data.id;
    delete data.org_id;
    delete data.orgId;
    delete data.created_on;
    delete data.is_active;
    delete data.is_deleted;

    data.modified_on = new Date();

    return collection.findOneAndUpdate(
        buildFindFilter(find),
        { $set: data },
        { returnDocument: "after" }
    );
};

const deleteOrganization = async (find) => {
    const collection = await ensureOrganizationCollection();

    const result = await collection.findOneAndUpdate(
        buildFindFilter(find),
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
    createOrganization,
    getOrganizations,
    updateOrganization,
    deleteOrganization,
};
