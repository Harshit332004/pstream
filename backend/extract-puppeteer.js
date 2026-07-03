const puppeteer = require('puppeteer');

async function extractKey() {
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Spoof user agent to avoid basic blocks
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36');

  // Intercept requests to look for API calls
  await page.setRequestInterception(true);
  
  let extractedKey = null;

  page.on('request', request => {
    const url = request.url();
    // Usually the API request looks like /api/v/550?token=...
    if (url.includes('/api/') && !extractedKey) {
      console.log(`Intercepted API Request: ${url}`);
      // In advanced reversing, we inject a hook into the encryption method,
      // but let's first check if there are global variables we can dump.
    }
    request.continue();
  });

  page.on('console', msg => console.log('Browser Console:', msg.text()));

  try {
    console.log('Navigating to Vidlink embed...');
    await page.goto('https://vidlink.pro/tv/94997/1/1', { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Dump all global variables that might hold the key
    const globals = await page.evaluate(() => {
      let possibleKeys = [];
      for (let key in window) {
        try {
          let val = window[key];
          if (typeof val === 'string' && val.length === 64 && /^[0-9a-fA-F]+$/.test(val)) {
            possibleKeys.push({ varName: key, val: val });
          } else if (typeof val === 'object' && val !== null) {
              // check one level deep
              for (let k in val) {
                  let v = val[k];
                  if (typeof v === 'string' && v.length === 64 && /^[0-9a-fA-F]+$/.test(v)) {
                      possibleKeys.push({ varName: `${key}.${k}`, val: v });
                  }
              }
          }
        } catch(e) {}
      }
      return possibleKeys;
    });

    console.log('--- FOUND IN WINDOW GLOBALS ---');
    console.log(globals);
    
  } catch (err) {
    console.error('Error navigating:', err.message);
  } finally {
    await browser.close();
  }
}

extractKey();
