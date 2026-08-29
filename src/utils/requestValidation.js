const isJsonObject = (value) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getRequestAction = (req) => {
    if (req.path.endsWith("/create")) {
        return "create";
    }

    if (req.path.endsWith("/update")) {
        return "update";
    }

    if (req.path.endsWith("/delete")) {
        return "delete";
    }

    if (req.path.endsWith("/getall")) {
        return "getall";
    }

    return "request";
};

const validateJsonBody = (req) => {
    if (req.method !== "POST") {
        return "Use POST method (browser address bar sends GET with no body)";
    }

    if (!isJsonObject(req.body)) {
        return "No JSON body received. In Postman: POST → Body → raw → JSON";
    }

    if (Object.keys(req.body).length === 0) {
        return "Request body is empty. Send orgId and payload in JSON";
    }

    return null;
};

const validateOrgIdInBody = (req, orgIdResult, isOrganizationCreate) => {
    if (!orgIdResult.missing && !orgIdResult.invalid) {
        return null;
    }

    if (orgIdResult.invalid) {
        return "orgId must be an integer (example: 1)";
    }

    if (
        req.body?.payload &&
        (req.body.payload.orgId !== undefined ||
            req.body.payload.org_id !== undefined)
    ) {
        return "orgId must be at the root of the body, not inside payload";
    }

    if (isOrganizationCreate) {
        return 'orgId is required at root to register a new shop (example: { "orgId": 1, "payload": { "creation": { ... } } })';
    }

    const action = getRequestAction(req);
    const collection = req.params.collection || "collection";

    return `orgId is required at root for ${collection}/${action} (example: { "orgId": 1, "payload": { ... } })`;
};

module.exports = {
    isJsonObject,
    getRequestAction,
    validateJsonBody,
    validateOrgIdInBody,
};
