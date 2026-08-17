import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      (status
        ? `Server error (${status}). Check the API terminal logs.`
        : 'Network error. Is the backend running?');

    const enhanced = new Error(message);
    enhanced.status = status;
    enhanced.original = error;
    return Promise.reject(enhanced);
  }
);

export function getErrorMessage(error) {
  return error?.message || 'Something went wrong';
}

export default api;
