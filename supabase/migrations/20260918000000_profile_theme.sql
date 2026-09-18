alter table profiles
  add column theme text not null default 'grimdark'
    check (theme in ('grimdark', 'astartes', 'aeldari', 'parchment'));
