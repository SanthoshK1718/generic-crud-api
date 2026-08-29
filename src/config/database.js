const { MongoClient } = require("mongodb");

let client;
let database;

const connectDatabase = async () => {
    if (database) {
        return database;
    }

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not defined");
    }

    client = new MongoClient(process.env.MONGODB_URI);

    await client.connect();

    database = client.db(process.env.MONGODB_DATABASE);

    console.log("MongoDB connected successfully");

    return database;
};

const getDatabase = () => {
    if (!database) {
        throw new Error("Database is not connected");
    }

    return database;
};

const collectionExists = async (collectionName) => {
    const existing = await getDatabase()
        .listCollections({ name: collectionName }, { nameOnly: true })
        .toArray();

    return existing.length > 0;
};

module.exports = {
    connectDatabase,
    getDatabase,
    collectionExists,
};