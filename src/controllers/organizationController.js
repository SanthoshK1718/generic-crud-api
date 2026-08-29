const organizationService = require("../services/organizationService");
const { parseOrgId } = require("../services/orgService");
const { sendSuccess, sendError } = require("../utils/response");
const { isJsonObject, validateJsonBody } = require("../utils/requestValidation");

const getPayload = (req) => {
    const bodyError = validateJsonBody(req);

    if (bodyError) {
        return { error: bodyError };
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, "payload")) {
        return {
            error: 'payload is required (example: { "org_id": 1, "payload": { "creation": { "name": "Shop" } } })',
        };
    }

    if (!isJsonObject(req.body.payload)) {
        return { error: "payload must be a JSON object" };
    }

    return { payload: req.body.payload };
};

const createOrganization = async (req, res, next) => {
    try {
        const parsedOrgId = parseOrgId(req.body?.org_id);

        if (parsedOrgId.missing) {
            return sendError(
                res,
                'org_id is required at root to register a shop (example: { "org_id": 1, "payload": { "creation": { "name": "Ice Cream Shop" } } })'
            );
        }

        if (parsedOrgId.invalid) {
            return sendError(res, "org_id must be an integer");
        }

        const parsed = getPayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const name = parsed.payload.creation?.name;

        if (!name || typeof name !== "string" || !name.trim()) {
            return sendError(
                res,
                'payload.creation.name is required (example: { "org_id": 1, "payload": { "creation": { "name": "Ice Cream Shop" } } })'
            );
        }

        const document = await organizationService.createOrganization(
            parsedOrgId.value,
            name.trim()
        );

        return sendSuccess(res, [document], 1);
    } catch (error) {
        next(error);
    }
};

const getOrganizations = async (req, res, next) => {
    try {
        const parsed = getPayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        if (!isJsonObject(parsed.payload.find)) {
            return sendError(
                res,
                'payload.find is required (use {} to get all shops)'
            );
        }

        const result = await organizationService.getOrganizations(
            parsed.payload.find
        );

        return sendSuccess(res, result.data, result.totalCount);
    } catch (error) {
        next(error);
    }
};

const updateOrganization = async (req, res, next) => {
    try {
        const parsed = getPayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const { find, updation } = parsed.payload;

        if (!isJsonObject(find) || Object.keys(find).length === 0) {
            return sendError(
                res,
                "payload.find is required with at least one field"
            );
        }

        if (!isJsonObject(updation) || Object.keys(updation).length === 0) {
            return sendError(
                res,
                "payload.updation is required with fields to update"
            );
        }

        const document = await organizationService.updateOrganization(
            find,
            updation
        );

        if (!document) {
            return sendError(res, "Shop not found");
        }

        return sendSuccess(res, document);
    } catch (error) {
        next(error);
    }
};

const deleteOrganization = async (req, res, next) => {
    try {
        const parsed = getPayload(req);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const { find } = parsed.payload;

        if (!isJsonObject(find) || Object.keys(find).length === 0) {
            return sendError(
                res,
                "payload.find is required with at least one field"
            );
        }

        const deleted = await organizationService.deleteOrganization(find);

        if (!deleted) {
            return sendError(res, "Shop not found");
        }

        return sendSuccess(res, {});
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createOrganization,
    getOrganizations,
    updateOrganization,
    deleteOrganization,
};
