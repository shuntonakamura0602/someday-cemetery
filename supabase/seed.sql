-- Idempotent example garden and graves. Examples never have owners, recovery
-- tokens, flowers, purchase intents, or entitlements.

insert into public.gardens(id, ordinal, capacity, layout_version)
values ('10000000-0000-4000-8000-000000000001', 1, 100, 1)
on conflict (id) do update
set ordinal = excluded.ordinal,
    capacity = excluded.capacity,
    layout_version = excluded.layout_version;

insert into public.graves(
  id, garden_id, plot_index, owner_user_id, title, epitaph, started_year,
  selected_style, accent, status, is_example, version, flower_count,
  created_at, updated_at
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 2,  null, 'My Weekend App', 'The weekend was never specified.', null, 'classic',     'stone',  'published', true, 1, 0, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 7,  null, 'My First Novel', 'The map was finished. The story wasn’t.', null, 'moss',        'fern',   'published', true, 1, 0, '2026-10-02T00:00:00Z', '2026-10-02T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 13, null, 'Our Podcast', 'We agreed on everything except a recording date.', null, 'wildflowers', 'violet', 'published', true, 1, 0, '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 18, null, 'My Daily Blog', 'Three days of excellent consistency.', null, 'classic',     'slate',  'published', true, 1, 0, '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 25, null, 'The Perfect Portfolio', 'Always one redesign away.', null, 'lantern',     'ember',  'published', true, 1, 0, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 31, null, 'My Game Prototype', 'The menu had excellent atmosphere.', null, 'classic',     'moon',   'published', true, 1, 0, '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 46, null, 'The Newsletter', 'Issue zero was very promising.', null, 'moss',        'sage',   'published', true, 1, 0, '2026-10-07T00:00:00Z', '2026-10-07T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 53, null, 'The Online Course', 'I completed the introduction to the introduction.', null, 'wildflowers', 'gold',   'published', true, 1, 0, '2026-10-08T00:00:00Z', '2026-10-08T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 67, null, 'My Photo Project', 'I’m glad I tried.', null, 'classic',     'stone',  'published', true, 1, 0, '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 74, null, 'The Short Film', 'The storyboard still makes me smile.', null, 'lantern',     'amber',  'published', true, 1, 0, '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 86, null, 'My Recipe Book', 'A few good dinners came out of it.', null, 'moss',        'lichen', 'published', true, 1, 0, '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 94, null, 'The App With a Great Name', 'The name was the finished product.', null, 'classic',     'slate',  'published', true, 1, 0, '2026-10-12T00:00:00Z', '2026-10-12T00:00:00Z')
on conflict (id) do update
set garden_id = excluded.garden_id,
    plot_index = excluded.plot_index,
    owner_user_id = null,
    title = excluded.title,
    epitaph = excluded.epitaph,
    started_year = excluded.started_year,
    selected_style = excluded.selected_style,
    accent = excluded.accent,
    status = 'published',
    is_example = true,
    flower_count = 0,
    deleted_at = null,
    updated_at = excluded.updated_at;
