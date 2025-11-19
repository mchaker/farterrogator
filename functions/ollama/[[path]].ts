export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Strip '/ollama' from the path to get the target path
  // e.g. /ollama/api/tags -> /api/tags
  const targetPath = url.pathname.replace(/^\/ollama/, '');
  
  // Construct the target URL
  const targetUrl = `https://ollama.gpu.garden${targetPath}${url.search}`;

  // Create a new request with the same method and body
  const newRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });

  // Forward the request
  try {
    const response = await fetch(newRequest);
    
    // Re-create response to ensure we can modify headers if needed
    // (Optional: Cloudflare usually handles this well, but we can ensure CORS here if we wanted, 
    // though since it's same-origin now, we don't strictly need it)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (e) {
    return new Response(`Proxy error: ${e.message}`, { status: 500 });
  }
}