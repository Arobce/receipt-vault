import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";

const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: "testpassword123",
  name: "Test User",
};

describe("Auth API", () => {
  beforeAll(async () => {
    // Clean up test user if exists
    await prisma.user.deleteMany({ where: { email: testUser.email } });
  });

  describe("POST /api/auth/register", () => {
    it("creates a new user and returns tokens", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.name).toBe(testUser.name);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("rejects duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser);

      expect(res.status).toBe(409);
    });

    it("rejects invalid email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "notanemail", password: "password123", name: "Test" });

      expect(res.status).toBe(400);
    });

    it("rejects short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@example.com", password: "short", name: "Test" });

      expect(res.status).toBe(400);
    });

    it("rejects missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@example.com" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns tokens for valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it("rejects wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("rejects non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("returns new access token", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it("rejects invalid refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" });

      expect(res.status).toBe(401);
    });

    it("rejects missing refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/health", () => {
    it("returns ok", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
