-- Documents two columns already added directly to this live project
-- (studio-kit-demo-thornwood, bhpfrrksglqxmmtvokpb) ahead of this
-- migration file, for the record and for reproducibility on any other
-- project. Both are additive and idempotent — safe to run here (no-op)
-- or on a fresh project.
--
-- theme_base: the page's overall light/dark background, a per-client
-- brand choice — not the visitor's OS setting. Read by
-- assets/js/site-config.js's applyTheme(), which sets
-- documentElement's [data-theme] attribute from it; the dark neutral
-- token block in assets/css/styles.css selects on that attribute.
-- Defaults to 'light', matching the kit's original bare :root palette.
--
-- palette_id: which curated preset (if any) last set
-- primary_color/accent_color/font_heading/font_body from the admin
-- panel's Theme picker (assets/js/admin-settings.js). Nullable and
-- purely informational — editing the underlying colors/fonts directly
-- clears it client-side so a customized site is never misreported as
-- still matching a named preset. Existing rows' primary_color,
-- accent_color, and font_heading/font_body are untouched by this
-- migration.

alter table public.site_config
  add column if not exists theme_base text not null default 'light';

alter table public.site_config
  drop constraint if exists site_config_theme_base_check;
alter table public.site_config
  add constraint site_config_theme_base_check check (theme_base in ('light', 'dark'));

alter table public.site_config
  add column if not exists palette_id text;
