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

        // Forward other query parameters
        for (k, v) in url.query_pairs() {
          if k != "host" && k != "headers" {
            target_url.query_pairs_mut().append_pair(&k, &v);
          }
        }

        // Build headers for the upstream request
        let mut client_headers = reqwest::header::HeaderMap::new();
        client_headers.insert(reqwest::header::ACCEPT, "*/*".parse().unwrap());
        client_headers.insert(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9".parse().unwrap());

        if let Some(h_json) = headers_str {
          let mut decoded_json = h_json.clone();
          if decoded_json.contains("%22") || decoded_json.contains("%7B") {
            if let Ok(dec) = percent_decode_str(&decoded_json).decode_utf8() {
              decoded_json = dec.into_owned();
            }
          }
          if decoded_json.contains("%22") || decoded_json.contains("%7B") {
            if let Ok(dec) = percent_decode_str(&decoded_json).decode_utf8() {
              decoded_json = dec.into_owned();
            }
          }

          if let Ok(parsed_headers) = serde_json::from_str::<HashMap<String, String>>(&decoded_json) {
            for (k, v) in parsed_headers {
              let lower_key = k.toLowerCase();
              if let Ok(hdr_name) = reqwest::header::HeaderName::from_bytes(lower_key.as_bytes()) {
                if let Ok(hdr_val) = reqwest::header::HeaderValue::from_str(&v) {
                  client_headers.insert(hdr_name, hdr_val);
                }
              }
            }
          }
        }

        // Forward Range header from client if present
        if let Some(range) = range_header_value {
          if let Ok(hdr_val) = reqwest::header::HeaderValue::from_str(&range) {
            client_headers.insert(reqwest::header::RANGE, hdr_val);
          }
        }

        // Fallback User-Agent if missing
        if !client_headers.contains_key(reqwest::header::USER_AGENT) {
          client_headers.insert(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36".parse().unwrap()
          );
        }

        // Perform reqwest fetch
        let client = reqwest::Client::new();
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
            responder.respond(
              Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(format!("Upstream request failed: {}", err).into_bytes())
                .unwrap(),
            );
            return;
          }
        };

        let status_code = StatusCode::from_u16(res.status().as_u16()).unwrap_or(StatusCode::OK);

        // Read body
        let mut body_bytes = match res.bytes().await {
          Ok(b) => b.to_vec(),
          Err(_) => Vec::new(),
        };

        // M3U8 Interception & Rewriting
        let path_lower = url.path().to_lowercase();
        let is_m3u8 = path_lower.ends_with(".m3u8") || path_lower.contains("m3u8");

        if is_m3u8 && status_code.is_success() {
          if let Ok(text) = String::from_utf8(body_bytes.clone()) {
            let lines: Vec<&str> = text.split('\n').collect();
            let mut rewritten_lines = Vec::new();

            for line in lines {
              let trimmed = line.trim();
              if !trimmed.is_empty() && !trimmed.starts_with('#') {
                if let Ok(chunk_url) = target_url.join(trimmed) {
                  // Construct rewritten proxy URI: proxy://localhost/path?host=...&headers=...
                  let mut rewritten_uri = format!(
                    "proxy://localhost{}?host={}",
                    chunk_url.path(),
                    percent_encoding::utf8_percent_encode(chunk_url.origin().ascii_serialization().as_str(), percent_encoding::NON_ALPHANUMERIC)
                  );

                  if let Some(ref h_str) = url.query_pairs().find(|(k, _)| k == "headers").map(|(_, v)| v.into_owned()) {
                    rewritten_uri.push_str("&headers=");
                    rewritten_uri.push_str(&percent_encoding::utf8_percent_encode(h_str, percent_encoding::NON_ALPHANUMERIC).to_string());
                  }

                  for (k, v) in chunk_url.query_pairs() {
                    rewritten_uri.push_str(&format!(
                      "&{}={}",
                      k,
                      percent_encoding::utf8_percent_encode(&v, percent_encoding::NON_ALPHANUMERIC)
                    ));
                  }

                  rewritten_lines.push(rewritten_uri);
                } else {
                  rewritten_lines.push(line.to_string());
                }
              } else {
                rewritten_lines.push(line.to_string());
              }
            }

            let rewritten_text = rewritten_lines.join("\n");
            body_bytes = rewritten_text.into_bytes();
          }
        }

        // Build response with CORS headers
        let mut builder = Response::builder()
          .status(status_code)
          .header("Access-Control-Allow-Origin", "*")
          .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
          .header("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Requested-With")
          .header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type");

        // Copy safe response headers from upstream
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
              builder = builder.header(*h, val_str);
            }
          }
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
