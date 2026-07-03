import { request } from 'undici';

async function scan() {
  const url = 'https://vidlink.pro/tv/94997/1/1';
  console.log(`Fetching ${url}...`);
  try {
    const res = await request(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36' }
    });
    const html = await res.body.text();
    
    const scriptRegex = /src=["']([^"']+\.js[^"']*)["']/g;
    let match;
    const scriptUrls: string[] = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      let src = match[1];
      if (src.startsWith('/')) {
        src = 'https://vidlink.pro' + src;
      } else if (!src.startsWith('http')) {
          src = 'https://vidlink.pro/' + src;
      }
      scriptUrls.push(src);
    }
    
    console.log(`Found ${scriptUrls.length} scripts to scan.`);
    
    // Look for 64-char hex strings wrapped in quotes
    const hexRegex = /(?:['"`])([0-9a-fA-F]{64})(?:['"`])/g;
    const foundKeys = new Set<string>();

    for (const scriptUrl of scriptUrls) {
      try {
        const sRes = await request(scriptUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const js = await sRes.body.text();
        let kMatch;
        while ((kMatch = hexRegex.exec(js)) !== null) {
          foundKeys.add(kMatch[1]);
        }
      } catch (e) {
        // ignore
      }
    }

    console.log('--- FOUND 64-CHAR HEX STRINGS ---');
    for (const k of foundKeys) {
      console.log(k);
    }
  } catch (e) {
      console.error(e);
  }
}

scan();
