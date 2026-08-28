create policy vehicle_brands_api_deny on public.vehicle_brands for select to anon, authenticated using (false);
create policy piece_categories_api_deny on public.piece_categories for select to anon, authenticated using (false);
create policy piece_category_keywords_api_deny on public.piece_category_keywords for select to anon, authenticated using (false);