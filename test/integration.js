const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Startet den Adapter in einer echten js-controller-Testinstanz
tests.integration(path.join(__dirname, '..'));
