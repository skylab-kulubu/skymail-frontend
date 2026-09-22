/**
 * The simple-rest provider parses every response body as JSON, including the
 * one from a delete. SkyMail answers an archive with 204 No Content and no
 * body, so that parse throws after the row is already archived and Refine
 * reports a failure for a request that worked.
 *
 * A 204 response cannot carry a body, so the status has to change with it.
 * Only the provider sees this; the server still answers 204.
 */
export const emptyBodyAsJSON = (response: Response): Response =>
  response.status === 204
    ? new Response("{}", { status: 200, statusText: response.statusText })
    : response;
