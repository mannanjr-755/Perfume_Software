export function success(res, message = 'Operation successful', data = null, status = 200) {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(status).json(payload);
}

export function fail(res, message = 'Something went wrong', status = 400) {
  return res.status(status).json({ success: false, message });
}
