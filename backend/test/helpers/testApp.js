const http = require("http");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-quill";
process.env.NODE_ENV = "test";

const app = require("../../src/app");
const { setClient } = require("../../src/services/supabase");
const { createFakeSupabase } = require("./fakeSupabase");

async function startTestServer(initialData = {}) {
  const db = createFakeSupabase(initialData);
  setClient(db);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(method, path, { token, body, headers: extraHeaders = {} } = {}) {
    const headers = { ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { status: res.status, data, text, headers: res.headers };
  }

  let seq = 0;
  async function registerStudent(overrides = {}) {
    seq += 1;
    const payload = {
      name: `Student ${seq}`,
      email: `student${seq}@example.com`,
      password: "password123",
      branch: "CS",
      year: 2,
      subjects: ["CS101"],
      ...overrides,
    };
    const res = await request("POST", "/api/auth/register", { body: payload });
    if (res.status !== 200) {
      throw new Error(`Failed to register test student: ${res.status} ${res.text}`);
    }
    return { token: res.data.token, student: res.data.student, password: payload.password };
  }

  async function close() {
    setClient(null);
    await new Promise((resolve) => server.close(resolve));
  }

  return { db, baseUrl, request, registerStudent, close };
}

module.exports = { startTestServer };
