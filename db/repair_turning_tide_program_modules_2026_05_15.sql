do $$
declare
  target_show_id uuid := 'ef84604b-145d-4879-9d3c-1c3e2ae0b6e0';
  director_module_id uuid := gen_random_uuid();
  dramaturg_module_id uuid := '4c891e9b-491a-4d39-bd03-7ea118f5a079';
  playwright_module_id uuid := 'b0621c3b-9493-4ef8-abab-c2edb632e66c';
begin
  if exists (
    select 1
    from app_playbill.program_modules
    where show_id = target_show_id
  ) then
    raise notice 'Program modules already exist for show %, skipping repair.', target_show_id;
    return;
  end if;

  insert into app_playbill.program_modules
    (id, show_id, module_type, display_title, module_order, visible, filler_eligible, settings)
  values
    (gen_random_uuid(), target_show_id, 'cover', 'Cover', 0, true, false, '{"placement_mode":"isolated","separate_page":true,"show_header":false}'::jsonb),
    (gen_random_uuid(), target_show_id, 'production_info', 'Production Info', 1, true, false, '{"placement_mode":"flow","separate_page":false,"show_header":true}'::jsonb),
    (director_module_id, target_show_id, 'contributor_note', 'Director''s Note', 2, true, false, '{"placement_mode":"isolated","separate_page":true,"show_header":true,"allow_multiple_pages":true}'::jsonb),
    (dramaturg_module_id, target_show_id, 'contributor_note', 'Dramaturgical Note', 3, true, false, '{"placement_mode":"isolated","separate_page":true,"show_header":true,"allow_multiple_pages":true}'::jsonb),
    (playwright_module_id, target_show_id, 'contributor_note', 'Playwright''s Note', 4, true, false, '{"placement_mode":"isolated","separate_page":true,"show_header":true,"allow_multiple_pages":true}'::jsonb),
    (gen_random_uuid(), target_show_id, 'cast_list', 'Cast List', 5, true, false, '{"placement_mode":"flow","separate_page":false,"show_header":true,"role_list_grouping_enabled":true}'::jsonb),
    (gen_random_uuid(), target_show_id, 'creative_team', 'Creative Team', 6, true, false, '{"placement_mode":"flow","separate_page":false,"show_header":true,"role_list_grouping_enabled":true}'::jsonb),
    (gen_random_uuid(), target_show_id, 'production_team', 'Production Team', 7, true, false, '{"placement_mode":"flow","separate_page":false,"show_header":true,"role_list_grouping_enabled":true}'::jsonb),
    (gen_random_uuid(), target_show_id, 'bios', 'Bio Collection', 8, true, true, '{"placement_mode":"isolated","separate_page":true,"show_header":true,"allow_multiple_pages":true,"include_headshots":false}'::jsonb),
    (gen_random_uuid(), target_show_id, 'sponsors', 'Sponsors', 9, true, true, '{"placement_mode":"flow","separate_page":false,"show_header":true}'::jsonb),
    (gen_random_uuid(), target_show_id, 'actf_sponsorship', 'ACTF Sponsorship', 10, true, false, '{"placement_mode":"isolated","separate_page":true,"keep_together":true,"show_header":false,"allow_multiple_pages":false}'::jsonb),
    (gen_random_uuid(), target_show_id, 'special_thanks', 'Special Thanks', 11, true, true, '{"placement_mode":"flow","separate_page":false,"show_header":true}'::jsonb),
    (gen_random_uuid(), target_show_id, 'acknowledgements', 'Acknowledgements', 12, true, false, '{"placement_mode":"flow","separate_page":false,"show_header":true}'::jsonb),
    (gen_random_uuid(), target_show_id, 'season_calendar', 'Season Calendar', 13, true, false, '{"placement_mode":"isolated","separate_page":true,"show_header":true}'::jsonb);

  update app_playbill.submission_requests sr
  set
    constraints = coalesce(sr.constraints, '{}'::jsonb) || jsonb_build_object(
      'module_id',
      case
        when sr.label = 'Director''s Note Submission' then director_module_id::text
        when sr.label = 'Dramaturgical Note Submission' then dramaturg_module_id::text
        when sr.label = 'Playwright''s Note Submission' then playwright_module_id::text
        else coalesce(sr.constraints ->> 'module_id', '')
      end,
      'module_title',
      case
        when sr.label = 'Director''s Note Submission' then 'Director''s Note'
        when sr.label = 'Dramaturgical Note Submission' then 'Dramaturgical Note'
        when sr.label = 'Playwright''s Note Submission' then 'Playwright''s Note'
        else coalesce(sr.constraints ->> 'module_title', 'Contributor Note')
      end
    ),
    updated_at = now()
  from app_playbill.show_roles role
  where sr.show_role_id = role.id
    and role.show_id = target_show_id
    and sr.request_type = 'note'
    and sr.label in ('Director''s Note Submission', 'Dramaturgical Note Submission', 'Playwright''s Note Submission');

  update app_playbill.programs program
  set layout_order = array['poster', 'cast_bios', 'team_bios', 'sponsorships', 'special_thanks', 'acknowledgements', 'season_calendar']
  from app_playbill.shows show
  where show.program_id = program.id
    and show.id = target_show_id;
end $$;
