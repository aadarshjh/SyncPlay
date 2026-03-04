-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (syncs with auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS for profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Trigger to automatically create profile for new users
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Friendships Table (followers)
create table if not exists public.friendships (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id)
);

alter table public.friendships enable row level security;
create policy "Friendships are viewable by everyone." on friendships for select using (true);
create policy "Users can follow others." on friendships for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow others." on friendships for delete using (auth.uid() = follower_id);

-- 3. Favorite Rooms Table
create table if not exists public.favorite_rooms (
  user_id uuid references public.profiles(id) on delete cascade not null,
  room_id text not null,
  room_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, room_id)
);

alter table public.favorite_rooms enable row level security;
create policy "Users can see their own favorite rooms." on favorite_rooms for select using (auth.uid() = user_id);
create policy "Users can add favorite rooms." on favorite_rooms for insert with check (auth.uid() = user_id);
create policy "Users can remove favorite rooms." on favorite_rooms for delete using (auth.uid() = user_id);

-- 4. Rooms Table (Persistence)
create table if not exists public.rooms (
  id text primary key,
  host_id text,
  state_json jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.rooms enable row level security;
create policy "Rooms are viewable by everyone." on rooms for select using (true);
-- Anyone can update rooms right now to allow the backend to easily persist via RLS bypass or authenticated backend requests
create policy "Anyone can insert/update rooms." on rooms for all using (true) with check (true);

-- 5. Storage Bucket (Music)
insert into storage.buckets (id, name, public) 
values ('music', 'music', true)
on conflict (id) do nothing;

create policy "Public Access" on storage.objects for select using (bucket_id = 'music');
create policy "Anyone can upload music" on storage.objects for insert with check (bucket_id = 'music');
create policy "Anyone can update music" on storage.objects for update with check (bucket_id = 'music');
