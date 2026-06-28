# Design System

## UI Ownership

Reusable editor UI lives in `packages/excalidraw/components/`. App-only shell and service-integrated UI lives in `excalidraw-app/components/`, `excalidraw-app/share/`, and related app directories.

Do not move app-only dependencies such as Firebase, Sentry, or socket collaboration into reusable package components.

## Component Patterns

| Area | Files |
| --- | --- |
| Main editor shell | `packages/excalidraw/components/App.tsx`, `LayerUI.tsx` |
| Canvas layers | `packages/excalidraw/components/canvases/` |
| Toolbars/actions | `Actions.tsx`, `Toolbar.scss`, `ToolButton.tsx`, `MobileToolBar.tsx` |
| Dialogs | `Dialog.tsx`, `ConfirmDialog.tsx`, `ExportDialog.scss`, `JSONExportDialog.tsx` |
| Sidebar/library | `DefaultSidebar.tsx`, `LibraryMenu.tsx`, `LibraryUnit.tsx` |
| Color picker | `components/ColorPicker/` |
| Font picker | `components/FontPicker/` |
| Text-to-diagram | `components/TTDDialog/` |
| Welcome screen | `components/welcome-screen/` |
| App menus/share | `excalidraw-app/components/`, `excalidraw-app/share/` |

## Styling

| Path | Purpose |
| --- | --- |
| `packages/excalidraw/css/app.scss` | Main app/editor styles. |
| `packages/excalidraw/css/styles.scss` | Shared package styles entry. |
| `packages/excalidraw/css/theme.scss` | Theme definitions. |
| `packages/excalidraw/css/variables.module.scss` | Shared SCSS variables exported to TS where needed. |
| colocated `*.scss` | Component-specific styles. |
| `excalidraw-app/index.scss` | App shell styles. |

Prefer existing classes, CSS variables, and component patterns. Keep styles local to the owning component unless a token/theme variable is genuinely shared.

## Icons And Visual Assets

- Editor icons are centralized in `packages/excalidraw/components/icons.tsx`.
- Shape-related UI helpers are in `packages/excalidraw/components/shapes.tsx`.
- Static public assets live in `public/`.
- Docs static assets live in `dev-docs/static/`.

Before adding a new icon, check `icons.tsx` and adjacent components for an existing symbol.

## Localization

User-facing editor text should go through i18n:

- Translation helpers: `packages/excalidraw/i18n.ts`
- Locale files: `packages/excalidraw/locales/`
- App language selection: `excalidraw-app/app-language/`
- Coverage scripts: `yarn locales-coverage`, `yarn locales-coverage:description`

Do not hardcode user-visible strings in reusable editor UI unless the surrounding code already does and there is a reason.

## App State And UI State

- Editor defaults: `packages/excalidraw/appState.ts`
- Shared UI app-state context: `packages/excalidraw/context/ui-appState.ts`
- App Jotai store: `excalidraw-app/app-jotai.ts`
- Collaboration atoms: `excalidraw-app/collab/Collab.tsx`

Keep persistent scene data separate from transient UI state.

## Accessibility And Interaction Notes

- Reuse established controls such as `ToolButton`, `ButtonIcon`, `Dialog`, `Tooltip`, `Switch`, and `Range`.
- Check mobile-specific components (`MobileMenu.tsx`, `MobileToolBar.tsx`) when changing global tools or layout.
- Keyboard shortcuts are registered through `packages/excalidraw/actions/shortcuts.ts` and action definitions.

## Tests To Consider

| Change | Test candidates |
| --- | --- |
| Dialog/sidebar/UI behavior | `packages/excalidraw/components/*.test.tsx` |
| Mobile menus | `excalidraw-app/tests/MobileMenu.test.tsx` |
| Localization/language list | `excalidraw-app/tests/LanguageList.test.tsx` |
| TTD/Mermaid UI or utils | `packages/excalidraw/components/TTDDialog/**/*.test.ts` |
| Action UI behavior | `packages/excalidraw/actions/*.test.tsx` |
