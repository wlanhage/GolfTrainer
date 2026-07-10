// Thin client for the GolfTrainer backend. All paths are /api/v1.
export function createApi(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  let token = null;

  const call = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      throw new Error(`${method} ${path} -> HTTP ${res.status}: ${await res.text()}`);
    }
    return res.status === 204 ? null : res.json();
  };

  return {
    async login(email, password) {
      const result = await call('POST', '/api/v1/auth/login', { email, password });
      token = result.accessToken;
    },
    getCourse: (id) => call('GET', `/api/v1/courses/${id}`),
    patchHoleLayout: (courseId, holeNumber, geometry) =>
      call('PATCH', `/api/v1/courses/${courseId}/holes/${holeNumber}/layout`, { geometry })
  };
}
