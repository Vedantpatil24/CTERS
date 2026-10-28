const API_BASE = '/api';

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: { field: string; message: string }[];
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('cters_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Do not set Content-Type for FormData (multipart)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  // Handle CSV and binary downloads
  const contentType = response.headers.get('content-type');
  if (contentType && (contentType.includes('text/csv') || contentType.includes('application/pdf'))) {
    if (!response.ok) {
      throw new Error('Download failed');
    }
    return response.blob() as unknown as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: ApiError = {
      code: data.code || 'REQUEST_FAILED',
      message: data.message || `Request failed with status ${response.status}`,
      fieldErrors: data.fieldErrors
    };
    throw error;
  }

  return data as T;
}
