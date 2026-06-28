import { describe, expect, it } from "vitest";

import app from "../src/index";

import type { Env } from "../src/types";

class MemoryKv {
  private readonly store = new Map<string, string>();

  async get<T>(key: string, type?: "json") {
    const value = this.store.get(key);
    if (value == null) {
      return null;
    }
    return (type === "json" ? JSON.parse(value) : value) as T;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

const env = (): Env => ({
  PERSISTENCE_KV: new MemoryKv() as unknown as KVNamespace,
  TOKEN_HASH_PEPPER: "test-pepper",
  ALLOWED_ORIGINS: "https://draw.nikitayugov.com",
});

const createRoom = async (testEnv = env()) => {
  const response = await app.request("/api/rooms", { method: "POST" }, testEnv);
  expect(response.status).toBe(201);
  return {
    testEnv,
    body: (await response.json()) as {
      roomId: string;
      storageAccessToken: string;
      snapshot: { revision: number; contentHash: string };
    },
  };
};

describe("rooms API", () => {
  it("creates a room and returns the token only in the create response", async () => {
    const { body } = await createRoom();

    expect(body.roomId).toMatch(/^room_/);
    expect(body.storageAccessToken).toMatch(/^sat_/);
    expect(body.snapshot.revision).toBe(1);
  });

  it("loads a room snapshot with a valid bearer token", async () => {
    const { testEnv, body } = await createRoom();

    const response = await app.request(
      `/api/rooms/${body.roomId}/snapshot`,
      {
        headers: {
          Authorization: `Bearer ${body.storageAccessToken}`,
        },
      },
      testEnv,
    );

    expect(response.status).toBe(200);
    const snapshot = (await response.json()) as { roomId: string };
    expect(snapshot.roomId).toBe(body.roomId);
  });

  it("rejects invalid tokens", async () => {
    const { testEnv, body } = await createRoom();

    const response = await app.request(
      `/api/rooms/${body.roomId}/snapshot`,
      {
        headers: {
          Authorization: "Bearer sat_invalid",
        },
      },
      testEnv,
    );

    expect(response.status).toBe(403);
  });

  it("updates room config without incrementing snapshot revision", async () => {
    const { testEnv, body } = await createRoom();

    const response = await app.request(
      `/api/rooms/${body.roomId}/config`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${body.storageAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "  Sketch room  " }),
      },
      testEnv,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      config: { name: "Sketch room" },
    });

    const snapshotResponse = await app.request(
      `/api/rooms/${body.roomId}/snapshot`,
      {
        headers: {
          Authorization: `Bearer ${body.storageAccessToken}`,
        },
      },
      testEnv,
    );
    const snapshot = (await snapshotResponse.json()) as {
      snapshot: { revision: number };
    };
    expect(snapshot.snapshot.revision).toBe(1);
  });

  it("saves a changed snapshot and rejects stale revisions", async () => {
    const { testEnv, body } = await createRoom();

    const save = await app.request(
      `/api/rooms/${body.roomId}/snapshot`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${body.storageAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseRevision: 1,
          contentHash: "sha256:test",
          snapshot: {
            version: 1,
            encoding: "json",
            encryption: "none",
            payload: {
              elements: [{ id: "el" }],
              appState: {},
              files: {},
            },
          },
        }),
      },
      testEnv,
    );

    expect(save.status).toBe(200);
    const saved = (await save.json()) as {
      snapshot: { revision: number; contentHash: string };
    };
    expect(saved.snapshot.revision).toBe(2);
    expect(saved.snapshot.contentHash).toBe("sha256:test");

    const conflict = await app.request(
      `/api/rooms/${body.roomId}/snapshot`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${body.storageAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseRevision: 1,
          contentHash: "sha256:stale",
          snapshot: {
            version: 1,
            encoding: "json",
            encryption: "none",
            payload: {
              elements: [{ id: "stale" }],
              appState: {},
              files: {},
            },
          },
        }),
      },
      testEnv,
    );

    expect(conflict.status).toBe(409);
  });
});
