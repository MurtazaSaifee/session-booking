import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ApiModule = typeof import("./api");

const user = {
  id: "u1",
  role: "MEMBER",
  name: "Mei Tan",
  email: "mei@example.com",
  timezone: "UTC",
  title: null,
  bio: null,
};
const unauthenticated = { error: "UNAUTHENTICATED", message: "Please log in." };
const refreshUrl = "/api/v1/auth/refresh";

function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;
let api: ApiModule["api"];
let ApiError: ApiModule["ApiError"];
let onSignedOut: ApiModule["onSignedOut"];

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  ({ api, ApiError, onSignedOut } = await import("./api"));
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("api", () => {
  it("sends JSON with an empty object body when a POST has no body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await api("/auth/logout", { method: "POST" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/auth/logout");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe("{}");
  });

  it("refreshes once on 401 and retries the original request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated))
      .mockResolvedValueOnce(jsonResponse(200, { user }))
      .mockResolvedValueOnce(jsonResponse(200, { user }));

    const result = await api<{ user: typeof user }>("/auth/me");

    expect(result).toEqual({ user });
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual(["/api/v1/auth/me", refreshUrl, "/api/v1/auth/me"]);
  });

  it("calls the signed-out handler and rejects with the 401 when refresh fails", async () => {
    const handler = vi.fn();
    onSignedOut(handler);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated))
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated));

    const request = api("/auth/me");

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("a 401 on the retried request also signs the user out", async () => {
    const handler = vi.fn();
    onSignedOut(handler);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated))
      .mockResolvedValueOnce(jsonResponse(200, { user }))
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated));

    const request = api("/auth/me");

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shares one refresh between requests that get 401 at the same time", async () => {
    let finishRefresh!: (res: Response) => void;
    let refreshed = false;
    fetchMock.mockImplementation((url: string) => {
      if (url === refreshUrl) {
        return new Promise<Response>((resolve) => {
          finishRefresh = resolve;
        });
      }
      return Promise.resolve(refreshed ? jsonResponse(200, { user }) : jsonResponse(401, unauthenticated));
    });

    const first = api<{ user: typeof user }>("/auth/me");
    const second = api<{ user: typeof user }>("/auth/me");
    await new Promise((resolve) => setTimeout(resolve, 0));
    refreshed = true;
    finishRefresh(jsonResponse(200, { user }));

    await expect(Promise.all([first, second])).resolves.toEqual([{ user }, { user }]);
    expect(fetchMock.mock.calls.filter(([url]) => url === refreshUrl)).toHaveLength(1);
  });

  it("throws a 401 from login straight away without refreshing", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: "BAD_CREDENTIALS", message: "Email or password is incorrect." }),
    );

    const body = { email: "mei@example.com", password: "wrong" };
    const request = api("/auth/login", { method: "POST", body });

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 401,
      code: "BAD_CREDENTIALS",
      message: "Email or password is incorrect.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing stops the handler being called", async () => {
    const handler = vi.fn();
    const unsubscribe = onSignedOut(handler);
    unsubscribe();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated))
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated));

    await expect(api("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("errorMessage", () => {
  it("uses the message of an error", async () => {
    const { ApiError, errorMessage } = await import("./api");

    expect(errorMessage(new ApiError(409, "SLOT_TAKEN", "That time was just booked."))).toBe(
      "That time was just booked.",
    );
  });

  it("falls back for anything that isn't an error", async () => {
    const { errorMessage } = await import("./api");

    expect(errorMessage("nope")).toBe("Something went wrong.");
  });
});
