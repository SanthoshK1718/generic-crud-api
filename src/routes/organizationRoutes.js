const express = require("express");
const {
    createOrganization,
    getOrganizations,
    updateOrganization,
    deleteOrganization,
} = require("../controllers/organizationController");

const router = express.Router();

router.post("/create", createOrganization);
router.post("/getall", getOrganizations);
router.post("/update", updateOrganization);
router.post("/delete", deleteOrganization);

module.exports = router;
