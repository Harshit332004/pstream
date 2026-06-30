const url = "https://vod2.ironwallnet.com:6069/proxy/wiwii/1fc3d3529f806d8bce86f24cb321f11a19f1e5a189399de31c2f911b9c31b456e51ac54f85c1fcc23f44e8791f866df91c1a57d0674e13d4a370afc9ecbb7ea1/playlist.m3u8?auth=c18d4a6cba8d8a01b69f3b035b718086a9d928ef2dc49a847bf47177280490b589120eba6d3e6f91a0252e65dbd2e1d94f8ef5f2c2c7d5cb1e3654512054c65e9fe8df976caba0823fd6cfbd6018512da3d018d705a330a701607434da2667b46745da478cac3e4c0fb2dabb09dc3af8e8b9e82cefb88b4be8aba3cbf7b0a3a0021cfb916fbaa0838cf7420d8fae6319";
fetch(url, { 
    headers: {
        'referer':'https://megacloud.live/',
        'origin':'https://megacloud.live',
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    } 
})
.then(r => console.log(r.status, r.statusText))
.catch(e => console.error(e));
