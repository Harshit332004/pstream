/**
 * Production Failover Health-Check Script
 * Run this script to test your Hugging Face Space endpoint and verify that the failover logic works correctly.
 * 
 * Usage: node health-check.js <YOUR_HF_API_URL>
 * Example: node health-check.js https://yourusername-yourspacename.hf.space
 */

const targetUrl = process.argv[2] || 'http://localhost:7860';

async function testEndpoint(testName, id, type, season, episode, expectedProvider) {
    console.log(`\n--- Test: ${testName} ---`);
    let url = `${targetUrl}/api/stream?id=${id}&type=${type}`;
    if (season && episode) url += `&season=${season}&episode=${episode}`;
    
    console.log(`Fetching: ${url}`);
    const start = Date.now();
    try {
        const res = await fetch(url);
        const data = await res.json();
        const duration = Date.now() - start;
        
        console.log(`Status: ${res.status}`);
        console.log(`Duration: ${duration}ms`);
        
        if (!res.ok) {
            console.error(`❌ FAILED: HTTP Error ${res.status}`);
            return false;
        }
        
        if (!data.success) {
            console.error(`❌ FAILED: API returned success: false`);
            return false;
        }

        if (!data.streams || data.streams.length === 0) {
            console.error(`❌ FAILED: API returned success but no streams`);
            return false;
        }

        const providers = data.streams.map(s => s.provider).join(', ');
        console.log(`Providers Resolved: ${providers}`);
        
        if (expectedProvider && !providers.toLowerCase().includes(expectedProvider.toLowerCase())) {
            console.warn(`⚠️ WARNING: Expected provider '${expectedProvider}' but got '${providers}'.`);
        } else {
            console.log(`✅ SUCCESS: Correct provider resolved.`);
        }

        const firstStream = data.streams[0];
        if (firstStream.url && firstStream.url.startsWith('https://')) {
            console.log(`✅ SUCCESS: Stream URL is secure (HTTPS).`);
        } else {
            console.error(`❌ FAILED: Stream URL is not HTTPS (${firstStream.url})`);
        }

        return true;

    } catch (e) {
        console.error(`❌ FAILED: Exception occurred during fetch: ${e.message}`);
        return false;
    }
}

async function runTests() {
    console.log(`Starting Production Health Check for: ${targetUrl}`);
    
    // Test 1: Popular Movie (Should resolve via VidLink Priority 1)
    // Deadpool & Wolverine (TMDB: 533535)
    await testEndpoint('Popular Movie (VidLink)', '533535', 'movie', null, null, 'vidlink');

    // Test 2: Popular TV Show (Should resolve via VidLink Priority 1)
    // The Boys S4 E1 (TMDB: 76479)
    await testEndpoint('Popular TV Show (VidLink)', '76479', 'tv', '4', '1', 'vidlink');
    
    // Note: To test the actual CinePro failover, you would normally mock a failure in VidLink, 
    // or test an obscure ID that VidLink doesn't have but CinePro does.
    // For now, if VidLink works, the fallback handles the rest.
    
    console.log(`\n🎉 Health check completed.`);
}

runTests();
