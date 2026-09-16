import { expect, request } from '@playwright/test';

/** Direct API access for arranging test data. Never used by the application itself. */
export const e2eEnv = {
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3100/api/v1',
  mailUrl: process.env.E2E_MAIL_URL ?? 'http://127.0.0.1:1080',
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e.test',
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdminPassw0rd',
};

export const TECHNICIAN_PASSWORD = 'TechnicianPassw0rd';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

async function call<T>(method: 'get' | 'post' | 'patch', path: string, options: { token?: string; data?: unknown } = {}): Promise<T> {
  const context = await request.newContext();
  try {
    const response = await context[method](`${e2eEnv.apiUrl}${path}`, {
      headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
      data: options.data,
    });
    const body = (await response.json()) as Envelope<T>;
    expect(response.ok(), `${method.toUpperCase()} ${path} → ${response.status()} ${body.message}`).toBe(true);
    return body.data;
  } finally {
    await context.dispose();
  }
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; mustChangePassword: boolean }> {
  const session = await call<{ mustChangePassword: boolean; tokens: { accessToken: string } }>('post', '/auth/login', {
    data: { email, password },
  });
  return { token: session.tokens.accessToken, mustChangePassword: session.mustChangePassword };
}

export async function adminToken(): Promise<string> {
  return (await apiLogin(e2eEnv.adminEmail, e2eEnv.adminPassword)).token;
}

export interface TestMachine {
  id: number;
  name: string;
  serialNumber: string;
  status: string;
}

export async function createMachine(token: string, name = `E2E Machine ${uniqueSuffix()}`): Promise<TestMachine> {
  return call<TestMachine>('post', '/machines', {
    token,
    data: { name, serialNumber: `E2E-${uniqueSuffix()}`, description: 'Created by end-to-end tests' },
  });
}

export async function listMachines(token: string): Promise<TestMachine[]> {
  return call<TestMachine[]>('get', '/machines?limit=100', { token });
}

export async function getMachine(token: string, id: number): Promise<TestMachine> {
  return call<TestMachine>('get', `/machines/${id}`, { token });
}

export async function createLog(
  token: string,
  body: { machineId: number; entryStatus: string; resultingState: string; faultDescription: string; logStatus?: string; endedAt?: string; startedAt?: string },
): Promise<{ id: number }> {
  return call<{ id: number }>('post', '/machine-logs', { token, data: { logStatus: 'OPEN', ...body } });
}

/** Reads the temporary password from the SMTP sink's copy of the onboarding email. */
export async function readTemporaryPassword(email: string): Promise<string> {
  const context = await request.newContext();
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await context.get(`${e2eEnv.mailUrl}/messages?to=${encodeURIComponent(email)}`);
      const messages = (await response.json()) as Array<{ text: string }>;
      const match = messages.map((message) => /Temporary password:\s*(\S+)/.exec(message.text)).find(Boolean);
      if (match?.[1]) return match[1];
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } finally {
    await context.dispose();
  }
  throw new Error(`No onboarding email received for ${email}`);
}

export interface TestTechnician {
  id: number;
  fullName: string;
  email: string;
  temporaryPassword: string;
}

export async function createTechnician(token: string): Promise<TestTechnician> {
  const suffix = uniqueSuffix().toLowerCase();
  const created = await call<{ user: { id: number; fullName: string; email: string } }>('post', '/users', {
    token,
    data: {
      fullName: `Tech ${suffix}`,
      email: `tech.${suffix}@e2e.test`,
      phone: `07${String(Date.now()).slice(-8)}`,
      position: 'Maintenance Technician',
    },
  });
  return { ...created.user, temporaryPassword: await readTemporaryPassword(created.user.email) };
}

/** A technician who has already replaced the temporary password (can use the API and live board). */
export async function createActivatedTechnician(token: string): Promise<TestTechnician & { password: string; token: string }> {
  const technician = await createTechnician(token);
  const first = await apiLogin(technician.email, technician.temporaryPassword);
  const changed = await call<{ tokens: { accessToken: string } }>('post', '/auth/change-password', {
    token: first.token,
    data: { currentPassword: technician.temporaryPassword, newPassword: TECHNICIAN_PASSWORD },
  });
  return { ...technician, password: TECHNICIAN_PASSWORD, token: changed.tokens.accessToken };
}
