-- Create snippets table
create table public.snippets (
  id text not null primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  created_at bigint not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.snippets enable row level security;

-- Create policy to allow users to see only their own snippets
create policy "Users can view their own snippets."
  on public.snippets for select
  using ( auth.uid() = user_id );

-- Create policy to allow users to insert their own snippets
create policy "Users can insert their own snippets."
  on public.snippets for insert
  with check ( auth.uid() = user_id );

-- Create policy to allow users to update their own snippets
create policy "Users can update their own snippets."
  on public.snippets for update
  using ( auth.uid() = user_id );

-- Create policy to allow users to delete their own snippets
create policy "Users can delete their own snippets."
  on public.snippets for delete
  using ( auth.uid() = user_id );
