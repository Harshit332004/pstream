const url = "https://pstream-kappa-seven.vercel.app/sources/293660?type=movie";
fetch(url).then(r => r.json()).then(async data => {
  const proxyUrl = "https://pstream-kappa-seven.vercel.app" + data.sources[0].url;
  const parsed = new URL(proxyUrl);
  const originalUrl = parsed.searchParams.get('host') + parsed.pathname.replace('/proxy', '') + parsed.search;
  const proxyHeaders = JSON.parse(Buffer.from(parsed.searchParams.get('proxyHeaders'), 'base64').toString());
  console.log("Original URL:", originalUrl);
  
  const res = await fetch(originalUrl, { headers: proxyHeaders });
  console.log("Status:", res.status);
  console.log("Text:", await res.text());
}).catch(console.error);
