import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('mp_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const errMsg = (e) => e?.response?.data?.message || 'Something went wrong. Please try again.';
export default api;
