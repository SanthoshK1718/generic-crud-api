const { connectDatabase, getDatabase } = require("../config/database");
const { getNextDocId } = require("./idService");

const SEATS_COLLECTION = "seats";

const getOrgId = () => {
    const orgId = Number(process.env.SEATS_ORG_ID ?? process.env.CHATBOX_ORG_ID ?? 1);
    return Number.isInteger(orgId) ? orgId : 1;
};

const getSeatsCollection = async () => {
    await connectDatabase();
    return getDatabase().collection(SEATS_COLLECTION);
};

const toSeatPayload = (doc) => ({
    id: doc.id,
    hallId: doc.hall_id,
    x: doc.x,
    y: doc.y,
    seatLabel: doc.seat_label,
    status: doc.status || "available",
    blockedBy: doc.blocked_by || null,
});

const buildSeatLabel = (x, y) => {
    const row = String.fromCharCode(65 + y);
    return `${row}${x + 1}`;
};

const getHallFilter = (hallId) => ({
    hall_id: hallId,
    is_deleted: { $ne: true },
});

const getSeatsByHall = async (hallId) => {
    const collection = await getSeatsCollection();
    const seats = await collection
        .find(getHallFilter(hallId))
        .sort({ y: 1, x: 1 })
        .toArray();

    return seats.map(toSeatPayload);
};

const getHallLayout = async (hallId) => {
    const seats = await getSeatsByHall(hallId);

    if (!seats.length) {
        return { hallId, rows: 0, cols: 0, seats: [] };
    }

    const rows = Math.max(...seats.map((seat) => seat.y)) + 1;
    const cols = Math.max(...seats.map((seat) => seat.x)) + 1;

    return { hallId, rows, cols, seats };
};

const initializeHall = async ({ hallId, rows, cols, reset = false }) => {
    const collection = await getSeatsCollection();
    const org_id = getOrgId();
    const safeRows = Math.min(Math.max(Number(rows) || 0, 1), 26);
    const safeCols = Math.min(Math.max(Number(cols) || 0, 1), 30);

    const existing = await collection.countDocuments(getHallFilter(hallId));

    if (existing > 0 && !reset) {
        return getHallLayout(hallId);
    }

    if (existing > 0 && reset) {
        await collection.deleteMany(getHallFilter(hallId));
    }

    const now = new Date();
    const documents = [];

    for (let y = 0; y < safeRows; y += 1) {
        for (let x = 0; x < safeCols; x += 1) {
            const docId = await getNextDocId(collection, SEATS_COLLECTION, org_id);

            documents.push({
                _id: docId,
                id: docId,
                org_id,
                hall_id: hallId,
                x,
                y,
                seat_label: buildSeatLabel(x, y),
                status: "available",
                blocked_by: null,
                is_active: true,
                is_deleted: false,
                created_on: now,
                modified_on: now,
            });
        }
    }

    if (documents.length) {
        await collection.insertMany(documents);
    }

    return getHallLayout(hallId);
};

const blockSeat = async ({ hallId, x, y, userId }) => {
    const collection = await getSeatsCollection();
    const numericX = Number(x);
    const numericY = Number(y);

    const seat = await collection.findOne({
        ...getHallFilter(hallId),
        x: numericX,
        y: numericY,
    });

    if (!seat) {
        return { error: "Seat not found" };
    }

    if (seat.status === "booked") {
        return { error: "Seat is already booked" };
    }

    if (seat.status === "blocked" && seat.blocked_by !== userId) {
        return { error: "Seat is blocked by another user" };
    }

    if (seat.status === "blocked" && seat.blocked_by === userId) {
        return toSeatPayload(seat);
    }

    const updated = await collection.findOneAndUpdate(
        {
            ...getHallFilter(hallId),
            x: numericX,
            y: numericY,
            status: "available",
        },
        {
            $set: {
                status: "blocked",
                blocked_by: userId,
                modified_on: new Date(),
            },
        },
        { returnDocument: "after" }
    );

    if (!updated) {
        const current = await collection.findOne({
            ...getHallFilter(hallId),
            x: numericX,
            y: numericY,
        });

        if (current?.status === "blocked" && current.blocked_by === userId) {
            return toSeatPayload(current);
        }

        return { error: "Seat is no longer available" };
    }

    return toSeatPayload(updated);
};

const unblockSeat = async ({ hallId, x, y, userId }) => {
    const collection = await getSeatsCollection();
    const numericX = Number(x);
    const numericY = Number(y);

    const updated = await collection.findOneAndUpdate(
        {
            ...getHallFilter(hallId),
            x: numericX,
            y: numericY,
            status: "blocked",
            blocked_by: userId,
        },
        {
            $set: {
                status: "available",
                blocked_by: null,
                modified_on: new Date(),
            },
        },
        { returnDocument: "after" }
    );

    if (!updated) {
        return { error: "You cannot release this seat" };
    }

    return toSeatPayload(updated);
};

const releaseSeatsByUser = async (hallId, userId) => {
    if (!hallId || !userId) {
        return [];
    }

    const collection = await getSeatsCollection();
    const seats = await collection
        .find({
            ...getHallFilter(hallId),
            status: "blocked",
            blocked_by: userId,
        })
        .toArray();

    if (!seats.length) {
        return [];
    }

    await collection.updateMany(
        {
            ...getHallFilter(hallId),
            status: "blocked",
            blocked_by: userId,
        },
        {
            $set: {
                status: "available",
                blocked_by: null,
                modified_on: new Date(),
            },
        }
    );

    return seats.map((seat) =>
        toSeatPayload({
            ...seat,
            status: "available",
            blocked_by: null,
        })
    );
};

module.exports = {
    getSeatsByHall,
    getHallLayout,
    initializeHall,
    blockSeat,
    unblockSeat,
    releaseSeatsByUser,
    toSeatPayload,
};
