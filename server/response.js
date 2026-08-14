export function sendOk(res, data = {}, status = 200) {
  return res.status(status).json({
    ok: true,
    data,
    requestId: res.req?.id
  });
}

export function sendError(res, status, error) {
  return res.status(status).json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    requestId: res.req?.id
  });
}
