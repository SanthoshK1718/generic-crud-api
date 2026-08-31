const { connectDatabase, getDatabase } = require("../config/database");
const { getNextDocId } = require("./idService");

const CHATBOX_COLLECTION = "chatbox";

const getOrgId = () => {
    const orgId = Number(process.env.CHATBOX_ORG_ID ?? 1);
    return Number.isInteger(orgId) ? orgId : 1;
};

const getChatboxCollection = async () => {
    await connectDatabase();
    return getDatabase().collection(CHATBOX_COLLECTION);
};

const toChatPayload = (doc) => ({
    id: doc.id,
    sessionId: doc.sessionId || doc.session_id || "unknown",
    message: doc.message || doc.text || "",
    roomId: doc.room_id || "global",
    timestamp: (doc.created_on || doc.timestamp || new Date()).toISOString(),
});

const saveMessage = async ({
    sessionId,
    message,
    roomId = "global",
}) => {
    const collection = await getChatboxCollection();
    const org_id = getOrgId();
    const now = new Date();
    const docId = await getNextDocId(collection, CHATBOX_COLLECTION, org_id);

    const document = {
        _id: docId,
        id: docId,
        org_id,
        sessionId,
        message,
        room_id: roomId,
        is_active: true,
        is_deleted: false,
        created_on: now,
        modified_on: now,
    };

    await collection.insertOne(document);

    return toChatPayload(document);
};

const getMessages = async ({ roomId = "global", limit = 100, afterId } = {}) => {
    const collection = await getChatboxCollection();
    const org_id = getOrgId();
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const numericAfterId = Number(afterId);

    const roomFilter =
        roomId === "global"
            ? {
                  $or: [{ room_id: "global" }, { room_id: { $exists: false } }],
              }
            : { room_id: roomId };

    const idFilter =
        Number.isInteger(numericAfterId) && numericAfterId > 0
            ? { id: { $gt: numericAfterId } }
            : {};

    const messages = await collection
        .find({
            is_deleted: { $ne: true },
            $and: [
                { $or: [{ org_id }, { org_id: { $exists: false } }] },
                roomFilter,
                idFilter,
            ],
        })
        .sort({ created_on: 1, id: 1 })
        .limit(safeLimit)
        .toArray();

    return messages.map(toChatPayload);
};

module.exports = {
    saveMessage,
    getMessages,
};
