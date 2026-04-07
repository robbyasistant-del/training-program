/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js headers
jest.mock('next/headers', () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));

// Mock Next.js server
jest.mock('next/server', () => {
  class MockNextResponse extends Response {
    static json(body, init) {
      return new MockNextResponse(JSON.stringify(body), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers || {}),
        },
      });
    }
  }
  
  return {
    NextResponse: MockNextResponse,
  };
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
global.matchMedia =
  global.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  };

// Polyfill for TextEncoder/TextDecoder (needed for Prisma/pg)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for Request/Response (needed for Next.js API route tests)
const { Request, Response, Headers } = require('node-fetch');
if (!global.Request) global.Request = Request;
if (!global.Response) global.Response = Response;
if (!global.Headers) global.Headers = Headers;

// Mock URL constructor for tests
const { URL, URLSearchParams } = require('url');
if (!global.URL) global.URL = URL;
if (!global.URLSearchParams) global.URLSearchParams = URLSearchParams;
