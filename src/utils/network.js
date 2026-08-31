const os = require("os");

const getLocalNetworkAddresses = () => {
    const addresses = [];
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }

    return addresses;
};

module.exports = {
    getLocalNetworkAddresses,
};
