-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Classrooms Table
create table if not exists classrooms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Students Table
create table if not exists students (
  id text primary key, -- Using email/string ID for simplicity as per GAS auth
  classroom_id uuid references classrooms(id),
  name text,
  status text check (status in ('flowing', 'editing', 'stalled', 'distressed')) default 'flowing',
  last_active timestamp with time zone default timezone('utc'::text, now())
);

-- Documents Table
create table if not exists documents (
  id text primary key, -- Google Doc ID
  student_id text references students(id),
  title text,
  last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- Snapshots Table (History of document states)
create table if not exists snapshots (
  id uuid default uuid_generate_v4() primary key,
  document_id text references documents(id),
  content text, -- Full text content
  version_hash text, -- Simple hash to avoid duplicate storage if needed
  timestamp bigint, -- Client timestamp
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Analysis Logs Table (AI Insights)
create table if not exists analysis_logs (
  id uuid default uuid_generate_v4() primary key,
  snapshot_id uuid references snapshots(id),
  behavior_category text,
  ai_feedback text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
