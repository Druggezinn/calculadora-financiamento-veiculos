import { describe, expect, it, vi } from "vitest";
import { applySecurityHeaders, requireJsonForApiMutations } from "./security";

function createResponse() {
  const headers = new Map<string, string>();
  const response = {
    setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
    status: vi.fn(() => response),
    json: vi.fn(),
  };
  return { headers, response };
}

describe("proteções HTTP", () => {
  it("envia cabeçalhos que bloqueiam framing, MIME sniffing e plugins", () => {
    const { headers, response } = createResponse();
    const next = vi.fn();

    applySecurityHeaders({} as never, response as never, next);

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(next).toHaveBeenCalledOnce();
  });

  it("aceita consultas e mutações JSON, mas rejeita formulários na API", () => {
    const next = vi.fn();
    const getResponse = createResponse();
    requireJsonForApiMutations({ method: "GET", is: vi.fn() } as never, getResponse.response as never, next);
    expect(next).toHaveBeenCalledOnce();

    const jsonResponse = createResponse();
    requireJsonForApiMutations({ method: "POST", is: vi.fn((type: string) => type === "application/json") } as never, jsonResponse.response as never, next);
    expect(next).toHaveBeenCalledTimes(2);

    const formResponse = createResponse();
    requireJsonForApiMutations({ method: "POST", is: vi.fn(() => false) } as never, formResponse.response as never, next);
    expect(formResponse.response.status).toHaveBeenCalledWith(415);
    expect(formResponse.response.json).toHaveBeenCalledWith({ error: "Use application/json para operações de escrita." });
  });
});
