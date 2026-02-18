# UI Review

Review recently modified UI components for design system violations, then validate the build.

## Steps

1. Read `apps/web/app/globals.css` to extract all allowed colors and CSS variables from the `@theme` block.

2. Identify recently modified component files using `git diff --name-only HEAD` filtered to `components/`.

3. For each modified component file, check for violations:
   - Colors not defined in the `@theme` block (hardcoded hex values, rgb(), hsl() not from the theme)
   - Unauthorized visual effects: purple gradients, glow effects (`box-shadow` with color, `text-shadow`, `drop-shadow` filters not in the codebase)
   - Image handling: cropping (`object-cover` with fixed height) instead of CSS scaling

4. Check that no unrelated components were modified (files outside the scope of the task).

5. Run `bun run build` from `apps/web` as final validation and report any errors.

## Output

Report: which files were checked, any violations found (file + line), and whether the build passed.
