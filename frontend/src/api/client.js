const API_BASE_URL = "http://localhost:3000";

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error("API request failed");
  }

  return response.json();
}

export const get = (endpoint) => apiRequest(endpoint);

export const post = (endpoint, data) =>
  apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });