const { findOrganization, getCanonicalOrgId, parseOrgId } = require("../services/orgService");
const { sendError } = require("../utils/response");
const { validateJsonBody, validateOrgIdInBody } = require("../utils/requestValidation");

const extractOrgId = (req) => {
    const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? req.body
            : {};

    return parseOrgId(
        body.org_id ?? req.query.org_id ?? req.headers["x-org-id"]
    );
};

const requireOrg = async (req, res, next) => {
    try {
        const bodyError = validateJsonBody(req);

        if (bodyError) {
            return sendError(res, bodyError);
        }

        const orgIdResult = extractOrgId(req);
        const orgIdError = validateOrgIdInBody(req, orgIdResult, false);

        if (orgIdError) {
            return sendError(res, orgIdError);
        }

        const organization = await findOrganization(orgIdResult.value);

        if (!organization) {
            return sendError(
                res,
                `No shop found with org_id ${orgIdResult.value}. Create it first using POST /organization/create`
            );
        }

        const canonicalOrgId = getCanonicalOrgId(organization);

        if (canonicalOrgId === undefined) {
            return sendError(
                res,
                `Shop record for org_id ${orgIdResult.value} has invalid org_id in database`
            );
        }

        req.org_id = canonicalOrgId;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = requireOrg;
