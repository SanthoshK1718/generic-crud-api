const express = require("express");
const {
    createDocument,
    getDocuments,
    updateDocument,
    deleteDocument,
} = require("../controllers/crudController");
const requireOrg = require("../middleware/requireOrg");
const { isOrganizationCollection, isBlockedCollection } = require("../services/orgService");
const { sendError } = require("../utils/response");

const router = express.Router();

const blockReservedCollection = (req, res, next) => {
    if (isBlockedCollection(req.params.collection)) {
        if (req.params.collection === "organizations") {
            return sendError(
                res,
                "Use /organization instead of /organizations"
            );
        }

        return sendError(
            res,
            "Collection 'vendors' is not supported. Use /organization"
        );
    }

    if (isOrganizationCollection(req.params.collection)) {
        return sendError(
            res,
            "Use /organization/create|getall|update|delete for shop management"
        );
    }

    next();
};

router.post("/:collection/getall", blockReservedCollection, requireOrg, getDocuments);
router.post("/:collection/create", blockReservedCollection, requireOrg, createDocument);
router.post("/:collection/update", blockReservedCollection, requireOrg, updateDocument);
router.post("/:collection/delete", blockReservedCollection, requireOrg, deleteDocument);

module.exports = router;
