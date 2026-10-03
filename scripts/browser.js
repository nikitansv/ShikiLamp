const fs = require('node:fs');
const puppeteer = require('puppeteer');

module.exports = async function launchBrowser() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  // Reuse installed Chrome when Puppeteer's optional browser download was skipped.
  const channel = !executablePath && !fs.existsSync(await puppeteer.executablePath()) ? 'chrome' : undefined;
  return puppeteer.launch({ headless: true, executablePath, channel });
};
