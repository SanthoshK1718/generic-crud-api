const { MongoClient, ServerApiVersion } = require("mongodb");

let client;
let database;

const getMongoUri = () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI is not defined");
    }

    if (uri.includes("retryWrites=")) {
        return uri;
    }

    const separator = uri.includes("?") ? "&" : "?";
    return `${uri}${separator}retryWrites=true&w=majority`;
};

const connectDatabase = async () => {
    if (database) {
        return database;
    }

    client = new MongoClient(getMongoUri(), {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        autoSelectFamily: false,
    });

    try {
        await client.connect();
    } catch (error) {
        throw new Error(
            `MongoDB connection failed: ${error.message}. Verify Atlas Network Access has 0.0.0.0/0 and MONGODB_URI on Vercel matches Atlas (URL-encode special characters in password).`
        );
    }

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