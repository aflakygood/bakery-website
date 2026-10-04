-- Grant owner access only to the authenticated Google account for the bakery.
create or replace function public.assign_bakery_owner_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'aflakygood@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

create trigger assign_bakery_owner_role_after_signup
  after insert on auth.users
  for each row execute procedure public.assign_bakery_owner_role();

-- Also grant access when the account already exists before this migration runs.
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = 'aflakygood@gmail.com'
on conflict (user_id, role) do nothing;
