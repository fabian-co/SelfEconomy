---
name: Tailwind CSS & Shadcn UI
description: Best practices for styling with Tailwind CSS and building accessible, beautiful UIs using Shadcn components, with a focus on debuggability.
---

# 🎨 Tailwind CSS & Shadcn UI Development

This document establishes the standards for styling and component architecture using Tailwind CSS and the Shadcn UI library.

## 🧱 Shadcn UI as Core
- **Primary Library:** Always prefer Shadcn UI components for common UI patterns (buttons, dialogs, inputs, etc.).
- **Installation:** Add components as needed via `npx shadcn-ui@latest add [component-name]`.
- **Customization:** Modify the source code of Shadcn components in `components/ui` if deep customization is required, rather than fighting the default styles from the consumption side.

## 📍 Debuggability & Section IDs
To ensure that errors can be localized quickly and that communication during development is objective, follow this naming convention:

- **Rule:** Every significant logical section or container in a component MUST have a descriptive `id`.
- **Naming Pattern:** Use kebab-case that describes the purpose of the section (e.g., `id="transaction-summary"`, `id="upload-form-actions"`).

### 💡 Why use IDs?
1. **Targeted Debugging:** When an error occurs or styles break, you can refer to the specific ID in the DOM.
2. **Objective Communication:** Instead of saying "the button in the middle," you can say "the button inside `#auth-actions`."
3. **AI Precision:** Helping the agent identify exactly which block of code corresponds to which visual part of the app.
4. **Accessibility & Anchors:** Automatically provides targets for internal links and improves the structural clarity for screen readers.

## 🎨 Styling Guidelines
- **Utility First:** Use Tailwind utility classes for 99% of styling.
- **Arbitrary Values:** Avoid arbitrary values (e.g., `h-[432px]`) unless absolutely necessary. Use the design system tokens.
- **Dynamic Classes:** Use the `cn()` utility (usually in `@/lib/utils`) to merge Tailwind classes conditionally.

```tsx
// Example of identifying sections
export function Dashboard() {
  return (
    <div id="dashboard-container" className="p-8">
      <header id="dashboard-header" className="mb-6">
        <h1 className="text-2xl font-bold">Resumen Financiero</h1>
      </header>
      
      <section id="stats-overview" className="grid gap-4 md:grid-cols-3">
        {/* Shadcn Cards here */}
      </section>
      
      <main id="main-content" className="mt-8">
        {/* Content */}
      </main>
    </div>
  )
}
```
