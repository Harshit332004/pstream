use tauri::http::{Response, StatusCode};
use tauri::async_runtime;
use std::collections::HashMap;
use percent_encoding::percent_decode_str;
use url::Url;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .register_asynchronous_uri_scheme_protocol("proxy", |_app_handle, request, responder| {
      // 1. Extract required data from the request reference before moving into the async block
      let uri_string = request.uri().to_string();
      let method_string = request.method().to_string();

      let mut range_header_value = None;
      for (k, v) in request.headers() {
        if k.as_str().eq_ignore_ascii_case("range") {
          if let Ok(val_str) = v.to_str() {
            range_header_value = Some(val_str.to_string());
          }
        }
      }

      // 2. Spawn async task
      async_runtime::spawn(async move {
        let url = match Url::parse(&uri_string) {
          Ok(u) => u,
          Err(_) => {
            responder.respond(
              Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(b"Invalid proxy URI".to_vec())
                .unwrap(),
            );
            return;
          }
        };

        // Extract target host from query parameter
        let host = match url.query_pairs().find(|(k, _)| k == "host").map(|(_, v)| v.into_owned()) {
          Some(h) => h,
          None => {
            responder.respond(
              Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(b"Missing host parameter".to_vec())
                .unwrap(),
            );
            return;
          }
        };

        // Extract headers JSON from query parameter
        let headers_str = url.query_pairs()
          .find(|(k, _)| k == "headers")
          .map(|(_, v)| v.into_owned());

        // Collect all "extra" query params to forward to every segment request
        // (e.g. `auth` tokens that the CDN requires on every segment)
        let mut extra_query_params: Vec<(String, String)> = Vec::new();
        for (k, v) in url.query_pairs() {
          if k != "host" && k != "headers" && k != "auth" {
            // keep non-special params for normal forwarding
          }
          if k != "host" && k != "headers" {
            extra_query_params.push((k.into_owned(), v.into_owned()));
          }
        }

        // Construct target URL
        let target_host = match Url::parse(&host) {
          Ok(h) => h,
          Err(_) => {
            responder.respond(
              Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(b"Invalid target host".to_vec())
                .unwrap(),
            );
            return;
          }
        };

        let path = url.path();
        let mut target_url = match target_host.join(path) {
          Ok(u) => u,
          Err(_) => {
            responder.respond(
              Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(b"Failed to join path and host".to_vec())
                .unwrap(),
            );
            return;
          }
        };

        // Forward all query params (except host/headers meta-params)
        for (k, v) in &extra_query_params {
          target_url.query_pairs_mut().append_pair(k, v);
        }

        // Parse and inject request headers
        let mut client_headers = reqwest::header::HeaderMap::new();

        // Start with browser-like base headers (order matters for fingerprinting)
        let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
        client_headers.insert(reqwest::header::USER_AGENT, ua.parse().unwrap());
        client_headers.insert(reqwest::header::ACCEPT, "*/*".parse().unwrap());
        client_headers.insert(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9".parse().unwrap());
        client_headers.insert(
          reqwest::header::HeaderName::from_static("sec-fetch-dest"),
          "empty".parse().unwrap(),
        );
        client_headers.insert(
          reqwest::header::HeaderName::from_static("sec-fetch-mode"),
          "cors".parse().unwrap(),
        );
        client_headers.insert(
          reqwest::header::HeaderName::from_static("sec-fetch-site"),
          "cross-site".parse().unwrap(),
        );

        // Overlay with headers from the `?headers=` query param (referer, origin, user-agent, etc.)
        if let Some(h_json) = &headers_str {
          let mut decoded_json = h_json.clone();

          // Handle percent-encoded JSON (may be double-encoded)
          for _ in 0..2 {
            if decoded_json.contains('%') {
              if let Ok(dec) = percent_decode_str(&decoded_json).decode_utf8() {
                decoded_json = dec.into_owned();
              }
            } else {
              break;
            }
          }

          // Replace '+' with space (form-urlencoded encoding of spaces)
          decoded_json = decoded_json.replace('+', " ");

          if let Ok(parsed_headers) = serde_json::from_str::<HashMap<String, String>>(&decoded_json) {
            eprintln!("[proxy] Applying {} custom headers from ?headers= param", parsed_headers.len());
            for (k, v) in &parsed_headers {
              eprintln!("[proxy]   {} = {}", k, v);
              let lower_key = k.to_lowercase();
              if let Ok(hdr_name) = reqwest::header::HeaderName::from_bytes(lower_key.as_bytes()) {
                if let Ok(hdr_val) = reqwest::header::HeaderValue::from_str(v) {
                  client_headers.insert(hdr_name, hdr_val);
                }
              }
            }
          } else {
            eprintln!("[proxy] WARNING: Failed to parse ?headers= JSON: {}", decoded_json);
          }
        }

        // Forward Range header from the browser if present
        if let Some(range) = range_header_value {
          if let Ok(hdr_val) = reqwest::header::HeaderValue::from_str(&range) {
            client_headers.insert(reqwest::header::RANGE, hdr_val);
          }
        }

        eprintln!("[proxy] --> {} {}", method_string, target_url.as_str());

        // Build reqwest client — no redirect following for streaming CDNs
        let client = reqwest::Client::builder()
          .redirect(reqwest::redirect::Policy::limited(5))
          .build()
          .unwrap_or_default();

        let method = match method_string.as_str() {
          "GET" => reqwest::Method::GET,
          "POST" => reqwest::Method::POST,
          "HEAD" => reqwest::Method::HEAD,
          _ => reqwest::Method::GET,
        };

        let req_builder = client.request(method, target_url.as_str()).headers(client_headers);

        let res = match req_builder.send().await {
          Ok(r) => r,
          Err(err) => {
            eprintln!("[proxy] upstream request error: {}", err);
            responder.respond(
              Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(format!("Upstream request failed: {}", err).into_bytes())
                .unwrap(),
            );
            return;
          }
        };

        let upstream_status = res.status().as_u16();
        eprintln!("[proxy] <-- {} {}", upstream_status, target_url.as_str());

        let status_code = StatusCode::from_u16(upstream_status).unwrap_or(StatusCode::OK);

        // Copy safe response headers from upstream BEFORE consuming the body
        let mut headers_map = HashMap::new();
        let headers_to_forward = [
          "content-type",
          "content-range",
          "accept-ranges",
          "cache-control",
          "expires",
        ];
        for h in &headers_to_forward {
          if let Some(val) = res.headers().get(*h) {
            if let Ok(val_str) = val.to_str() {
              headers_map.insert((*h).to_string(), val_str.to_string());
            }
          }
        }

        // Read body (this consumes res)
        let mut body_bytes = match res.bytes().await {
          Ok(b) => b.to_vec(),
          Err(_) => Vec::new(),
        };

        // M3U8 Interception & Rewriting
        let path_lower = url.path().to_lowercase();
        let is_m3u8 = path_lower.ends_with(".m3u8")
          || headers_map.get("content-type").map(|ct| ct.contains("mpegurl")).unwrap_or(false);

        if is_m3u8 && status_code.is_success() {
          if let Ok(text) = String::from_utf8(body_bytes.clone()) {
            eprintln!("[proxy] Rewriting M3U8 ({} bytes)", text.len());
            let lines: Vec<&str> = text.split('\n').collect();
            let mut rewritten_lines = Vec::new();

            // Grab the original encoded headers string to re-embed in rewritten chunk URLs
            let orig_headers_encoded = headers_str.as_deref().unwrap_or("").to_string();

            for line in &lines {
              let trimmed = line.trim();
              if trimmed.is_empty() || trimmed.starts_with('#') {
                rewritten_lines.push(line.to_string());
                continue;
              }

              // Resolve the chunk URL relative to the M3U8 target URL
              let chunk_url_result = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                Url::parse(trimmed).ok()
              } else {
                target_url.join(trimmed).ok()
              };

              if let Some(chunk_url) = chunk_url_result {
                let chunk_origin = chunk_url.origin().ascii_serialization();
                let chunk_path = chunk_url.path().to_string();

                // Start building the proxy URI
                let mut rewritten_uri = format!(
                  "proxy://localhost{}?host={}",
                  chunk_path,
                  percent_encoding::utf8_percent_encode(&chunk_origin, percent_encoding::NON_ALPHANUMERIC)
                );

                // Re-embed the custom headers
                if !orig_headers_encoded.is_empty() {
                  rewritten_uri.push_str("&headers=");
                  rewritten_uri.push_str(
                    &percent_encoding::utf8_percent_encode(&orig_headers_encoded, percent_encoding::NON_ALPHANUMERIC).to_string()
                  );
                }

                // Forward ALL query params from the chunk URL (incl. auth tokens)
                for (k, v) in chunk_url.query_pairs() {
                  rewritten_uri.push_str(&format!(
                    "&{}={}",
                    k,
                    percent_encoding::utf8_percent_encode(&v, percent_encoding::NON_ALPHANUMERIC)
                  ));
                }

                // Also forward any extra query params from the original M3U8 request
                // that weren't already on the chunk URL (e.g. auth from the playlist request)
                let chunk_keys: Vec<String> = chunk_url.query_pairs().map(|(k, _)| k.into_owned()).collect();
                for (k, v) in &extra_query_params {
                  if !chunk_keys.contains(k) {
                    rewritten_uri.push_str(&format!(
                      "&{}={}",
                      k,
                      percent_encoding::utf8_percent_encode(v, percent_encoding::NON_ALPHANUMERIC)
                    ));
                  }
                }

                rewritten_lines.push(rewritten_uri);
              } else {
                rewritten_lines.push(line.to_string());
              }
            }

            let rewritten_text = rewritten_lines.join("\n");
            body_bytes = rewritten_text.into_bytes();
          }
        }

        // Build response with permissive CORS headers
        let mut builder = Response::builder()
          .status(status_code)
          .header("Access-Control-Allow-Origin", "*")
          .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
          .header("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With")
          .header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type");

        for (k, v) in headers_map {
          builder = builder.header(k, v);
        }

        builder = builder.header("content-length", body_bytes.len().to_string());

        responder.respond(builder.body(body_bytes).unwrap());
      });
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
