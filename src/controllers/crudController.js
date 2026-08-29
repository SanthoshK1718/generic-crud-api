const crudService = require("../services/crudService");
const { sendSuccess, sendError } = require("../utils/response");
const { isJsonObject } = require("../utils/requestValidation");

const toBoolean = (value, defaultValue = false) => {
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

const stripSystemFields = (data) => {
    const {
        orgId,
        org_id,
        _id,
        id,
        find,
        creation,
        updation,
        deletion,
        created_on,
        modified_on,
        createdAt,
        updatedAt,
        ...fields
    } = data;

    return fields;
};

const getBodyPayload = (req) => {
    if (!isJsonObject(req.body)) {
        return {
            error: "Request body must be a JSON object with org_id and payload",
        };
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, "payload")) {
        return {
            error: 'payload is required under org_id (example: { "org_id": 1, "payload": { ... } })',
        };
    }

    const { payload } = req.body;

    if (!isJsonObject(payload)) {
        return {
            error: "payload must be a JSON object",
        };
    }

    return { payload };
};

const getCreatePayload = (req) => {
    const parsed = getBodyPayload(req);

    if (parsed.error) {
        return parsed;
    }

    if (!isJsonObject(parsed.payload.creation)) {
        return {
            error: 'payload.creation is required (example: { "org_id": 1, "payload": { "creation": { "name": "Ice Cream Shop" } } })',
        };
    }

    return { data: stripSystemFields(parsed.payload.creation) };
};

const getUpdatePayload = (req) => {
    const parsed = getBodyPayload(req);

    if (parsed.error) {
        return parsed;
    }

    const { find, updation } = parsed.payload;

    if (!isJsonObject(find)) {
        return {
            error: "payload.find is required and must be a JSON object",
        };
    }

    if (Object.keys(find).length === 0) {
        return {
            error: "payload.find must contain at least one field",
        };
    }

    if (!isJsonObject(updation)) {
        return {
            error: "payload.updation is required and must be a JSON object",
        };
    }

    const data = stripSystemFields(updation);

    if (Object.keys(data).length === 0) {
        return {
            error: "payload.updation must contain at least one field to update",
        };
    }

    return { find, data };
};

const getDeletePayload = (req) => {
    const parsed = getBodyPayload(req);

    if (parsed.error) {
        return parsed;
    }

    const { find } = parsed.payload;

    if (!isJsonObject(find)) {
        return {
            error: "payload.find is required and must be a JSON object",
        };
    }

    if (Object.keys(find).length === 0) {
        return {
            error: "payload.find must contain at least one field",
        };
    }

    return { find };
};

const getReadPayload = (req) => {
    if (!isJsonObject(req.body)) {
        return {
            error: "Request body must be a JSON object",
        };
    }

    const pagination = toBoolean(req.body.pagination, false);
    const sorting = toBoolean(req.body.sorting, false);

    if (!isJsonObject(req.body.payload)) {
        return {
            error: 'payload is required (example: { "org_id": 1, "payload": { "find": {} } })',
        };
    }

    if (!Object.prototype.hasOwnProperty.call(req.body.payload, "find")) {
        return {
            error: 'payload.find is required (use {} to get all records)',
        };
    }

    if (!isJsonObject(req.body.payload.find)) {
        return {
            error: "payload.find must be a JSON object",
        };
    }

    const readOptions = {
        filters: req.body.payload.find,
        pagination,
        sorting,
        paginationDetails: null,
        sortingDetails: null,
    };

    if (pagination) {
        if (!isJsonObject(req.body.paginationDetails)) {
            return {
                error:
                    "paginationDetails is required when pagination is true",
            };
        }

        const page = Number(req.body.paginationDetails.page);
        const limit = Number(req.body.paginationDetails.limit);

        if (!Number.isInteger(page) || page < 1) {
            return {
                error: "paginationDetails.page must be an integer >= 1",
            };
        }

        if (!Number.isInteger(limit) || limit < 1) {
            return {
                error: "paginationDetails.limit must be an integer >= 1",
            };
        }

        readOptions.paginationDetails = { page, limit };
    }

    if (sorting) {
        if (!isJsonObject(req.body.sortingDetails)) {
            return {
                error: "sortingDetails is required when sorting is true",
            };
        }

        const sort = {};

        for (const [key, direction] of Object.entries(
            req.body.sortingDetails
        )) {
            const numericDirection = Number(direction);

            if (numericDirection !== 1 && numericDirection !== -1) {
                return {
                    error: `sortingDetails.${key} must be 1 or -1`,
                };
            }

            const mongoKey = key === "id" ? "_id" : key;
            sort[mongoKey] = numericDirection;
        }

        if (Object.keys(sort).length === 0) {
            return {
                error: "sortingDetails must contain at least one field",
            };
        }

        readOptions.sortingDetails = sort;
    }

    return readOptions;
};

const createDocument = async (req, res, next) => {
    try {
        const { collection } = req.params;
        const parsed = getCreatePayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const document = await crudService.createDocument(
            collection,
            parsed.data,
            req.org_id
        );

        return sendSuccess(res, [document], 1);
    } catch (error) {
        next(error);
    }
};

const getDocuments = async (req, res, next) => {
    try {
        const { collection } = req.params;
        const parsed = getReadPayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const result = await crudService.getDocuments(
            collection,
            parsed.filters,
            req.org_id,
            {
                pagination: parsed.pagination,
                paginationDetails: parsed.paginationDetails,
                sorting: parsed.sorting,
                sortingDetails: parsed.sortingDetails,
            }
        );

        return sendSuccess(res, result.data, result.totalCount);
    } catch (error) {
        next(error);
    }
};

const updateDocument = async (req, res, next) => {
    try {
        const { collection } = req.params;
        const parsed = getUpdatePayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const document = await crudService.updateDocument(
            collection,
            parsed.find,
            parsed.data,
            req.org_id
        );

        if (!document) {
            return sendError(res, "Document not found");
        }

        return sendSuccess(res, document);
    } catch (error) {
        next(error);
    }
};

const deleteDocument = async (req, res, next) => {
    try {
        const { collection } = req.params;
        const parsed = getDeletePayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const deleted = await crudService.deleteDocument(
            collection,
            parsed.find,
            req.org_id
        );

        if (!deleted) {
            return sendError(res, "Document not found");
        }

        return sendSuccess(res, {});
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createDocument,
    getDocuments,
    updateDocument,
    deleteDocument,
};
