const API_BASE = '';  // Empty because Vite proxy handles /api/*

export interface ApiResponse<T> {
  content: T;
  status?: number;
  message?: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface ConnectionsResponse {
  data: Array<{
    id: string;
    name: string;
    relatedSchema: string;
  }>;
}

export interface LayersResponse {
  data: Array<{
    id: number;
    name: string;
    tableName: string;
    recordsCount: number;
    connection?: {
      relatedSchema: string;
      name: string;
    };
  }>;
}

export interface AttributesResponse {
  data: Array<{
    id: number;
    columnName: string;
    attributeType: string;
    mainGeometry: boolean;
  }>;
}

class ApiService {
  private currentOrgId: string | null = null;

  setOrganization(orgId: string | null) {
    this.currentOrgId = orgId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.currentOrgId) {
      (headers as Record<string, string>)['X-Organization'] = this.currentOrgId;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',  // CRITICAL: Send HttpOnly cookies
    });

    if (!response.ok) {
      const text = await response.text();
      let message = `HTTP ${response.status}`;
      try {
        const json = JSON.parse(text);
        message = json.detail || json.message || message;
      } catch {
        message = text || message;
      }
      throw new Error(message);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors on logout
    }
  }

  // Debug
  async debugAuth(): Promise<{
    has_token: boolean;
    user_email?: string;
    token_source?: string;
  }> {
    const response = await fetch(`${API_BASE}/debug/auth`, {
      credentials: 'include',
    });
    return response.json();
  }

  // Organizations
  async checkOrganizationAccess(orgId: string): Promise<ApiResponse<ConnectionsResponse> | null> {
    try {
      const response = await fetch(`${API_BASE}/api/connections?pageSize=1`, {
        headers: {
          'X-Organization': orgId,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        return response.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  // Layers
  async getLayers(): Promise<ApiResponse<LayersResponse>> {
    return this.request('/api/core/layers?isSpatialLayer=true&pageSize=50');
  }

  async getLayerAttributes(layerId: number): Promise<ApiResponse<AttributesResponse>> {
    return this.request(`/api/core/layers/${layerId}/layer-attributes?pageSize=50`);
  }
}

export const api = new ApiService();
