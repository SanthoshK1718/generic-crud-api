const { login, LOGIN_ERROR } = require("../services/loginService");
const {
    findOrganization,
    getCanonicalOrgId,
    parseOrgId,
} = require("../services/orgService");
const { sendSuccess, sendError } = require("../utils/response");
const { isJsonObject } = require("../utils/requestValidation");

const loginUser = async (req, res, next) => {
    try {
        if (!isJsonObject(req.body)) {
            return sendError(res, LOGIN_ERROR);
        }

        const orgIdResult = parseOrgId(req.body.orgId);

        if (orgIdResult.missing || orgIdResult.invalid) {
            return sendError(res, LOGIN_ERROR);
        }

        const organization = await findOrganization(orgIdResult.value);

        if (!organization) {
            return sendError(res, LOGIN_ERROR);
        }

        const orgId = getCanonicalOrgId(organization);

        if (orgId === undefined) {
            return sendError(res, LOGIN_ERROR);
        }

        const user = await login({
            type: req.body.type,
            orgId,
            email: req.body.email,
            phone: req.body.phone,
            password: req.body.password,
        });

        return sendSuccess(res, user);
    } catch (error) {
        if (error.message === LOGIN_ERROR) {
            return sendError(res, LOGIN_ERROR);
        }

        next(error);
    }
};

module.exports = {
    loginUser,
};
