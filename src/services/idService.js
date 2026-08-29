const { getDatabase } = require("../config/database");

const COUNTERS_COLLECTION = "counters";

const getCounterKey = (collectionName, orgId) => {
    if (orgId === undefined || orgId === null) {
        return collectionName;
    }

    return `${collectionName}:${orgId}`;
};

const getMaxExistingDocId = async (collection, orgId) => {
    const match =
        orgId === undefined || orgId === null
            ? {}
            : { orgId: { $in: [orgId, String(orgId)] } };

    const [lastDoc] = await collection
        .find(match)
        .sort({ id: -1 })
        .limit(1)
        .toArray();

    const maxId = Number(lastDoc?.id);

    return Number.isInteger(maxId) && maxId > 0 ? maxId : 0;
};

const getNextDocId = async (collection, collectionName, orgId) => {
    const db = getDatabase();
    const counters = db.collection(COUNTERS_COLLECTION);
    const counterKey = getCounterKey(collectionName, orgId);

    const existingCounter = await counters.findOne({ _id: counterKey });

    if (!existingCounter) {
        const maxId = await getMaxExistingDocId(collection, orgId);

        await counters.updateOne(
            { _id: counterKey },
            { $setOnInsert: { seq: maxId } },
            { upsert: true }
        );
    } else {
        const maxId = await getMaxExistingDocId(collection, orgId);

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
