---
name: Next.js 16
description: Best practices and new features for Next.js 16 development, including Cache Components, Turbopack, and Proxy.ts.
---

# Next.js 16 Development Skills

This document outlines component usage, strict rules, and new features available in Next.js 16.

## 🚀 Key New Features

### 1. Cache Components & `use cache`
Next.js 16 introduces a more explicit caching model.
- Use the `use cache` directive to control exactly what gets cached.
- This builds on Partial Pre-Rendering (PPR) for instant navigation.
- **Best Practice:** Apply `use cache` to expensive computations or database queries components that don't need real-time data on every request.

### 2. Turbopack as Default
Turbopack is now stable and the default bundler.
- Expect 2-5x faster production builds and up to 10x faster Fast Refresh.
- File System Caching (introduced in 16.1) significantly improves compile times.

### 3. Proxy.ts (Middleware Replacement)
The `middleware.ts` file is replaced by `proxy.ts`.
- **Purpose:** Clarify network boundaries and request handling.
- **Usage:** Use `proxy.ts` for request interception, rewriting, and header modification instead of the old middleware patterns.

### 4. React Compiler Support (Stable)
- Automatic memoization of components.
- Reduces the need for manual `useMemo` and `useCallback` optimizations.
- **Action:** You can write simpler React code relying on the compiler to optimize re-renders.

### 5. Enhanced Routing
- **Layout Deduplication:** Reduces network overhead during navigation.
- **Incremental Prefetching:** Improves page transition performance.

### 6. React 19.2 Features
- Leverages React 19.2 capabilities like View Transitions, `useEffectEvent()`, and `<Activity/>`.

## 🛠️ Development Guidelines

- **Node.js Version:** Ensure you are running Node.js 20.9 or later.
- **TypeScript:** Requires TypeScript 5.1+.
- **DevTools:** Utilize the new Next.js DevTools MCP for AI-assisted debugging.

## 📦 Project Structure
- Always use `@/` alias for imports.
- Place UI components in `components/ui` (shadcn strategy).
- Place reusable logic in `lib/` or `hooks/`.
