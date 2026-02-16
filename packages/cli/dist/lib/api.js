export async function apiRequest(config, path, options = {}) {
    const url = `${config.api_url}${path}`;
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
        ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = (await res.json());
            if (body.error)
                message = body.error;
        }
        catch {
            // ignore parse errors
        }
        throw new Error(message);
    }
    return res.json();
}
export async function apiRequestNoAuth(apiUrl, path, options = {}) {
    const url = `${apiUrl}${path}`;
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = (await res.json());
            if (body.error)
                message = body.error;
        }
        catch {
            // ignore parse errors
        }
        throw new Error(message);
    }
    return res.json();
}
