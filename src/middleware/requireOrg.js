const { findOrganization, getCanonicalOrgId, parseOrgId } = require("../services/orgService");
const { sendError } = require("../utils/response");
const { validateJsonBody, validateOrgIdInBody } = require("../utils/requestValidation");

const extractOrgId = (req) => {
    const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? req.body
            : {};

    return parseOrgId(
        body.orgId ??
            body.org_id ??
            req.query.orgId ??
            req.query.org_id ??
            req.headers["x-org-id"]
    );
};

const requireOrg = async (req, res, next) => {
    try {
        const bodyError = validateJsonBody(req);

        if (bodyError) {
            return sendError(res, bodyError);
        }

        const orgId = extractOrgId(req);
        const orgIdError = validateOrgIdInBody(req, orgId, false);

        if (orgIdError) {
            return sendError(res, orgIdError);
        }

        const organization = await findOrganization(orgId.value);

        if (!organization) {
            return sendError(
                res,
                `No shop found with orgId ${orgId.value}. Create it first using POST /organization/create`
            );
        }

        const canonicalOrgId = getCanonicalOrgId(organization);

        if (canonicalOrgId === undefined) {
            return sendError(
                res,
                `Shop record for orgId ${orgId.value} has invalid orgId in database`
            );
        }

        req.orgId = canonicalOrgId;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = requireOrg;
