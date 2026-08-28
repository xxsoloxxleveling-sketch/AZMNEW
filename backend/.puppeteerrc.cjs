const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer so Render includes it in the project root deploy artifact
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
