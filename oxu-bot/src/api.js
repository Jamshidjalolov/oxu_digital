// Axios HTTP mijozi — barcha so'rovlar shu orqali yuboriladi
require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

const client = axios.create({ baseURL: BASE_URL, timeout: 20000 });
client.interceptors.response.use((response) => {
  const addIds = (value) => {
    if (Array.isArray(value)) return value.map(addIds);
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) value[key] = addIds(value[key]);
      if (value._id) value.id = value._id;
    }
    return value;
  };
  response.data = addIds(response.data);
  return response;
});

function headers(token, supplied = {}) {
  const result = { ...supplied };
  if (token) {
    for (const key of Object.keys(result)) {
      if (key.toLowerCase() === 'authorization') delete result[key];
    }
    result.Authorization = `Bearer ${token}`;
  }
  return result;
}

module.exports = {
  get: (url, opts = {}) =>
    client.get(url, { headers: headers(opts.token, opts.headers), params: opts.params }).then((r) => r.data),
  post: (url, data, opts = {}) =>
    client.post(url, data, { headers: headers(opts.token, opts.headers) }).then((r) => r.data),
  put: (url, data, opts = {}) =>
    client.put(url, data, { headers: headers(opts.token, opts.headers) }).then((r) => r.data),
  del: (url, opts = {}) =>
    client.delete(url, { headers: headers(opts.token, opts.headers) }).then((r) => r.data),
};
