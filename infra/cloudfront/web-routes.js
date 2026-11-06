// Pages like /my-sessions only exist in the browser, so anything that isn't a file gets the app. This runs on the
// web route alone: a site-wide custom error page would also replace the API's own 404 responses.
// oxlint-disable-next-line no-unused-vars -- CloudFront calls this by name.
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.substring(request.uri.lastIndexOf("/") + 1);
  if (lastSegment.indexOf(".") === -1) request.uri = "/index.html";
  return request;
}
