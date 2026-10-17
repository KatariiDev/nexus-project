-- Cập nhật trigger handle_new_user: Không ghi đè tên server BCN bằng tên global
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'global_name',
      new.raw_user_meta_data->'custom_claims'->>'global_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Thành viên'
    ),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null)
  )
  on conflict (id) do update set
    name = case when public.profiles.name in ('Thành viên', '') or public.profiles.name is null then excluded.name else public.profiles.name end,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

