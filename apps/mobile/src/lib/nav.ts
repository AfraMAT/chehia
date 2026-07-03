import { router, type Href } from "expo-router";

/**
 * Navigate to a path built at runtime (e.g. `${basePath}/menu`).
 *
 * With `typedRoutes` enabled, expo-router's `Href` is a strict union of the
 * literal routes generated into `.expo/types`. Paths we assemble from a
 * dynamic `basePath` (which differs between the scanned `/r/[slug]/t/[token]`
 * and browse `/r/[slug]` flows) are valid routes but not literal members of
 * that union, so we assert the type at this single choke point instead of
 * scattering casts across every screen.
 */
export function go(path: string, mode: "push" | "replace" = "push"): void {
  const href = path as Href;
  if (mode === "replace") router.replace(href);
  else router.push(href);
}
