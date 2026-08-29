const { getDatabase } = require("../config/database");

const { buildOrgIdQuery } = require("./orgService");

const COUNTERS_COLLECTION = "counters";

const getCounterKey = (collectionName, org_id) => {
    if (org_id === undefined || org_id === null) {
        return collectionName;
    }

    return `${collectionName}:${org_id}`;
};

const getMaxExistingDocId = async (collection, org_id) => {
    const match =
        org_id === undefined || org_id === null
            ? {}
            : buildOrgIdQuery(org_id);

    const [lastDoc] = await collection
        .find(match)
        .sort({ id: -1 })
        .limit(1)
        .toArray();

    const maxId = Number(lastDoc?.id);

    return Number.isInteger(maxId) && maxId > 0 ? maxId : 0;
};

const getNextDocId = async (collection, collectionName, org_id) => {
    const db = getDatabase();
    const counters = db.collection(COUNTERS_COLLECTION);
    const counterKey = getCounterKey(collectionName, org_id);

    const existingCounter = await counters.findOne({ _id: counterKey });

    if (!existingCounter) {
        const maxId = await getMaxExistingDocId(collection, org_id);

        await counters.updateOne(
            { _id: counterKey },
            { $setOnInsert: { seq: maxId } },
            { upsert: true }
        );
    } else {
        const maxId = await getMaxExistingDocId(collection, org_id);

        await counters.updateOne(
            { _id: counterKey },
            { $max: { seq: maxId } }
        );
    }

    const result = await counters.findOneAndUpdate(
        { _id: counterKey },
        { $inc: { seq: 1 } },
        { returnDocument: "after" }
    );

    return result.seq;
};

module.exports = {
    getNextDocId,
};
