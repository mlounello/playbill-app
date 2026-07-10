-- Allow Production Management to create a durable Playbill role before casting it.
-- Existing roles and song data remain unchanged.

alter table app_playbill.show_roles
  alter column person_id drop not null;

alter table app_playbill.show_roles
  drop constraint if exists show_roles_person_id_fkey;

alter table app_playbill.show_roles
  add constraint show_roles_person_id_fkey
  foreign key (person_id)
  references app_playbill.people (id)
  on delete set null;

comment on column app_playbill.show_roles.person_id is
  'Nullable while a role is vacant; filled when a person is assigned.';
