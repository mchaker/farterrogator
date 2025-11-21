export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Strip '/interrogate/gpu-garden' from the path to get the target path
  // e.g. /interrogate/gpu-garden/interrogate -> /interrogate
  const targetPath = url.pathname.replace(/^\/interrogate\/gpu-garden/, '');
  
  // Construct the target URL
  const targetUrl = `https://localtagger.gpu.garden${targetPath}${url.search}`;

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
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (e) {
    return new Response(`Proxy error: ${e.message}`, { status: 500 });
  }
}
