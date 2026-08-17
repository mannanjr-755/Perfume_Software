import api from './api.js';

export async function fetchResource(path, params) {
  const { data } = await api.get(path, { params });
  return data;
}

export async function fetchOne(path, id) {
  const { data } = await api.get(`${path}/${id}`);
  return data;
}

export async function createResource(path, payload) {
  const { data } = await api.post(path, payload);
  return data;
}

export async function updateResource(path, id, payload) {
  const { data } = await api.put(`${path}/${id}`, payload);
  return data;
}

export async function deleteResource(path, id) {
  const { data } = await api.delete(`${path}/${id}`);
  return data;
}

export async function fetchDashboardStats(params) {
  const { data } = await api.get('/dashboard/stats', { params });
  return data;
}

export async function fetchReports(params) {
  const { data } = await api.get('/reports', { params });
  return data;
}

export async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await api.post('/upload/product-image', formData, {
    timeout: 30000,
    transformRequest: [
      (payload, headers) => {
        if (headers && typeof headers.delete === 'function') {
          headers.delete('Content-Type');
        } else if (headers) {
          delete headers['Content-Type'];
          delete headers['content-type'];
        }
        return payload;
      },
    ],
  });
  return data;
}

export async function fetchProductByBarcode(barcode) {
  const { data } = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
  return data;
}

export async function generateProductBarcode() {
  const { data } = await api.post('/products/barcode/generate');
  return data;
}

export async function assignProductBarcode(id) {
  const { data } = await api.post(`/products/${id}/generate-barcode`);
  return data;
}
