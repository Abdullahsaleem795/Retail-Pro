// Distinguishes "the request never reached the server" (offline, backend
// down, dev server mid-restart) from "the server responded but something's
// wrong" - the first needs "check your connection", the second doesn't.
// Neither should ever be confused with an empty-but-successful response
// (a normal 200 with an empty array) - that's not a failure, and every page
// already has its own "No X yet" copy for that case.
export const describeLoadFailure = (err, fallback) => {
  if (!err?.response) return "Couldn't reach the server. Check your connection and try again.";
  return fallback;
};
