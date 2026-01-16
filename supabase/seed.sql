insert into public.settings (id, qbo_item_id_50, qbo_item_id_90, keyword_1, keyword_2)
values (1, 'PLACEHOLDER_50', 'PLACEHOLDER_90', 'Tutoring', 'Session')
on conflict (id) do nothing;

insert into public.qbo_tokens (id)
values (1)
on conflict (id) do nothing;
