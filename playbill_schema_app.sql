SET search_path TO app_playbill, public;

--
-- PostgreSQL database dump
--

\restrict j82worMtAYhLCcqpl9WZylerdBctevXazA85w9jGrspgjVKtoL2e9vK1WolUPGl

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid,
    person_id uuid,
    asset_type text NOT NULL,
    storage_path text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity text NOT NULL,
    entity_id uuid NOT NULL,
    field text NOT NULL,
    before_value jsonb,
    after_value jsonb,
    changed_by uuid,
    reason text DEFAULT ''::text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backup_role_templates_20260224; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.backup_role_templates_20260224 (
    id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name text,
    category text,
    scope text,
    show_id uuid,
    is_hidden boolean
);


--
-- Name: backup_show_roles_20260224; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.backup_show_roles_20260224 (
    id uuid,
    show_id uuid,
    person_id uuid,
    role_name text,
    category text,
    billing_order integer,
    bio_order integer,
    hidden_from_cast_list boolean,
    hidden_from_bios boolean,
    created_at timestamp with time zone,
    role_template_id uuid
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    website text DEFAULT ''::text NOT NULL,
    contact_email text DEFAULT ''::text NOT NULL,
    contact_phone text DEFAULT ''::text NOT NULL
);


--
-- Name: exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    export_type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    file_path text DEFAULT ''::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: note_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.note_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    request_type text NOT NULL,
    scope text DEFAULT 'global'::text NOT NULL,
    show_id uuid,
    is_archived boolean DEFAULT false NOT NULL
);


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    program_id uuid NOT NULL,
    full_name text NOT NULL,
    role_title text NOT NULL,
    bio text NOT NULL,
    team_type text DEFAULT 'cast'::text NOT NULL,
    headshot_url text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    submission_status text DEFAULT 'pending'::text NOT NULL,
    submitted_at timestamp with time zone,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    preferred_name text DEFAULT ''::text NOT NULL,
    pronouns text DEFAULT ''::text NOT NULL,
    submission_type text DEFAULT 'bio'::text NOT NULL,
    no_bio boolean DEFAULT false NOT NULL
);


--
-- Name: program_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.program_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    module_type text NOT NULL,
    display_title text DEFAULT ''::text NOT NULL,
    module_order integer DEFAULT 0 NOT NULL,
    visible boolean DEFAULT true NOT NULL,
    filler_eligible boolean DEFAULT false NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    theatre_name text NOT NULL,
    show_dates text NOT NULL,
    poster_image_url text DEFAULT ''::text NOT NULL,
    director_notes text DEFAULT ''::text NOT NULL,
    dramaturgical_note text DEFAULT ''::text NOT NULL,
    billing_page text DEFAULT ''::text NOT NULL,
    acts_songs text DEFAULT ''::text NOT NULL,
    department_info text DEFAULT ''::text NOT NULL,
    actf_ad_image_url text DEFAULT ''::text NOT NULL,
    acknowledgements text DEFAULT ''::text NOT NULL,
    season_calendar text DEFAULT ''::text NOT NULL,
    production_photo_urls text[] DEFAULT '{}'::text[] NOT NULL,
    custom_pages jsonb DEFAULT '[]'::jsonb NOT NULL,
    layout_order text[] DEFAULT '{poster,director_note,dramaturgical_note,music_director_note,billing,acts_songs,cast_bios,team_bios,department_info,actf_ad,acknowledgements,season_calendar,production_photos,custom_pages}'::text[] NOT NULL,
    performance_schedule jsonb DEFAULT '[]'::jsonb NOT NULL,
    music_director_note text DEFAULT ''::text NOT NULL,
    special_thanks text DEFAULT ''::text NOT NULL,
    sponsorships text DEFAULT ''::text NOT NULL
);


--
-- Name: role_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.role_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'production'::text NOT NULL,
    scope text DEFAULT 'global'::text NOT NULL,
    show_id uuid,
    is_hidden boolean DEFAULT false NOT NULL
);


--
-- Name: season_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.season_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    season_id uuid NOT NULL,
    title text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    event_start_date date NOT NULL,
    event_end_date date,
    time_text text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.seasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL
);


--
-- Name: show_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.show_departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    department_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: show_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.show_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role_name text NOT NULL,
    category text DEFAULT 'production'::text NOT NULL,
    billing_order integer,
    bio_order integer,
    hidden_from_cast_list boolean DEFAULT false NOT NULL,
    hidden_from_bios boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role_template_id uuid
);


--
-- Name: show_style_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.show_style_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_id uuid NOT NULL,
    title_font text DEFAULT 'Oswald'::text NOT NULL,
    body_font text DEFAULT 'Merriweather'::text NOT NULL,
    section_title_color text DEFAULT '#006b54'::text NOT NULL,
    body_color text DEFAULT '#000000'::text NOT NULL,
    bio_name_color text DEFAULT '#006b54'::text NOT NULL,
    section_title_size_pt integer DEFAULT 14 NOT NULL,
    body_size_pt integer DEFAULT 10 NOT NULL,
    bio_name_size_pt integer DEFAULT 11 NOT NULL,
    safe_margin_in numeric(4,2) DEFAULT 0.5 NOT NULL,
    density_mode text DEFAULT 'normal'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.shows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    start_date date,
    end_date date,
    venue text DEFAULT ''::text NOT NULL,
    season_tag text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    program_id uuid,
    reminders_paused boolean DEFAULT false NOT NULL,
    season_id uuid
);


--
-- Name: submission_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.submission_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    show_role_id uuid NOT NULL,
    request_type text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    constraints jsonb DEFAULT '{}'::jsonb NOT NULL,
    due_date timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    rich_text_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    plain_text text DEFAULT ''::text NOT NULL,
    asset_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE app_playbill.user_profiles (
    user_id uuid NOT NULL,
    email text NOT NULL,
    platform_role text DEFAULT 'contributor'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: exports exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.exports
    ADD CONSTRAINT exports_pkey PRIMARY KEY (id);


--
-- Name: note_templates note_templates_name_request_type_scope_show_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.note_templates
    ADD CONSTRAINT note_templates_name_request_type_scope_show_id_key UNIQUE (name, request_type, scope, show_id);


--
-- Name: note_templates note_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.note_templates
    ADD CONSTRAINT note_templates_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: program_modules program_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.program_modules
    ADD CONSTRAINT program_modules_pkey PRIMARY KEY (id);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: programs programs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.programs
    ADD CONSTRAINT programs_slug_key UNIQUE (slug);


--
-- Name: role_templates role_templates_name_category_scope_show_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.role_templates
    ADD CONSTRAINT role_templates_name_category_scope_show_id_key UNIQUE (name, category, scope, show_id);


--
-- Name: role_templates role_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.role_templates
    ADD CONSTRAINT role_templates_pkey PRIMARY KEY (id);


--
-- Name: season_events season_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.season_events
    ADD CONSTRAINT season_events_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.seasons
    ADD CONSTRAINT seasons_name_key UNIQUE (name);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: show_departments show_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_departments
    ADD CONSTRAINT show_departments_pkey PRIMARY KEY (id);


--
-- Name: show_departments show_departments_show_id_department_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_departments
    ADD CONSTRAINT show_departments_show_id_department_id_key UNIQUE (show_id, department_id);


--
-- Name: show_roles show_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_roles
    ADD CONSTRAINT show_roles_pkey PRIMARY KEY (id);


--
-- Name: show_style_settings show_style_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_style_settings
    ADD CONSTRAINT show_style_settings_pkey PRIMARY KEY (id);


--
-- Name: show_style_settings show_style_settings_show_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_style_settings
    ADD CONSTRAINT show_style_settings_show_id_key UNIQUE (show_id);


--
-- Name: shows shows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.shows
    ADD CONSTRAINT shows_pkey PRIMARY KEY (id);


--
-- Name: shows shows_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.shows
    ADD CONSTRAINT shows_slug_key UNIQUE (slug);


--
-- Name: submission_requests submission_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.submission_requests
    ADD CONSTRAINT submission_requests_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.user_profiles
    ADD CONSTRAINT user_profiles_email_key UNIQUE (email);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: idx_note_templates_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_templates_archived ON app_playbill.note_templates USING btree (is_archived);


--
-- Name: idx_note_templates_scope_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_templates_scope_show ON app_playbill.note_templates USING btree (scope, show_id);


--
-- Name: idx_note_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_templates_type ON app_playbill.note_templates USING btree (request_type);


--
-- Name: idx_people_program_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_program_email ON app_playbill.people USING btree (program_id, email);


--
-- Name: idx_people_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_program_id ON app_playbill.people USING btree (program_id);


--
-- Name: idx_people_program_submission_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_program_submission_status ON app_playbill.people USING btree (program_id, submission_status);


--
-- Name: idx_program_modules_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_modules_show_id ON app_playbill.program_modules USING btree (show_id);


--
-- Name: idx_program_modules_show_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_modules_show_order ON app_playbill.program_modules USING btree (show_id, module_order);


--
-- Name: idx_program_modules_show_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_modules_show_visible ON app_playbill.program_modules USING btree (show_id, visible);


--
-- Name: idx_programs_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_programs_slug ON app_playbill.programs USING btree (slug);


--
-- Name: idx_role_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_templates_category ON app_playbill.role_templates USING btree (category);


--
-- Name: idx_role_templates_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_templates_hidden ON app_playbill.role_templates USING btree (is_hidden);


--
-- Name: idx_role_templates_scope_show; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_templates_scope_show ON app_playbill.role_templates USING btree (scope, show_id);


--
-- Name: idx_season_events_season_start_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_season_events_season_start_sort ON app_playbill.season_events USING btree (season_id, event_start_date, sort_order);


--
-- Name: idx_show_departments_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_departments_department ON app_playbill.show_departments USING btree (department_id);


--
-- Name: idx_show_departments_show_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_departments_show_sort ON app_playbill.show_departments USING btree (show_id, sort_order);


--
-- Name: idx_show_roles_person_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_roles_person_id ON app_playbill.show_roles USING btree (person_id);


--
-- Name: idx_show_roles_show_billing_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_roles_show_billing_order ON app_playbill.show_roles USING btree (show_id, billing_order);


--
-- Name: idx_show_roles_show_bio_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_roles_show_bio_order ON app_playbill.show_roles USING btree (show_id, bio_order);


--
-- Name: idx_show_roles_show_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_roles_show_category ON app_playbill.show_roles USING btree (show_id, category);


--
-- Name: idx_show_roles_show_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_show_roles_show_id ON app_playbill.show_roles USING btree (show_id);


--
-- Name: idx_shows_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shows_is_published ON app_playbill.shows USING btree (is_published);


--
-- Name: idx_shows_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shows_program_id ON app_playbill.shows USING btree (program_id);


--
-- Name: idx_shows_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shows_slug ON app_playbill.shows USING btree (slug);


--
-- Name: idx_shows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shows_status ON app_playbill.shows USING btree (status);


--
-- Name: idx_submission_requests_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_requests_due_date ON app_playbill.submission_requests USING btree (due_date);


--
-- Name: idx_submission_requests_show_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_requests_show_role_id ON app_playbill.submission_requests USING btree (show_role_id);


--
-- Name: idx_submission_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submission_requests_status ON app_playbill.submission_requests USING btree (status);


--
-- Name: idx_submissions_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_request_id ON app_playbill.submissions USING btree (request_id);


--
-- Name: idx_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_status ON app_playbill.submissions USING btree (status);


--
-- Name: idx_submissions_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_updated_at ON app_playbill.submissions USING btree (updated_at);


--
-- Name: assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: assets assets_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.assets
    ADD CONSTRAINT assets_person_id_fkey FOREIGN KEY (person_id) REFERENCES app_playbill.people(id) ON DELETE SET NULL;


--
-- Name: assets assets_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.assets
    ADD CONSTRAINT assets_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.audit_log
    ADD CONSTRAINT audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: exports exports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.exports
    ADD CONSTRAINT exports_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: exports exports_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.exports
    ADD CONSTRAINT exports_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: note_templates note_templates_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.note_templates
    ADD CONSTRAINT note_templates_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: people people_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.people
    ADD CONSTRAINT people_program_id_fkey FOREIGN KEY (program_id) REFERENCES app_playbill.programs(id) ON DELETE CASCADE;


--
-- Name: program_modules program_modules_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.program_modules
    ADD CONSTRAINT program_modules_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: role_templates role_templates_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.role_templates
    ADD CONSTRAINT role_templates_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: season_events season_events_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.season_events
    ADD CONSTRAINT season_events_season_id_fkey FOREIGN KEY (season_id) REFERENCES app_playbill.seasons(id) ON DELETE CASCADE;


--
-- Name: show_departments show_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_departments
    ADD CONSTRAINT show_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES app_playbill.departments(id) ON DELETE CASCADE;


--
-- Name: show_departments show_departments_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_departments
    ADD CONSTRAINT show_departments_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: show_roles show_roles_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_roles
    ADD CONSTRAINT show_roles_person_id_fkey FOREIGN KEY (person_id) REFERENCES app_playbill.people(id) ON DELETE CASCADE;


--
-- Name: show_roles show_roles_role_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_roles
    ADD CONSTRAINT show_roles_role_template_id_fkey FOREIGN KEY (role_template_id) REFERENCES app_playbill.role_templates(id) ON DELETE SET NULL;


--
-- Name: show_roles show_roles_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_roles
    ADD CONSTRAINT show_roles_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: show_style_settings show_style_settings_show_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.show_style_settings
    ADD CONSTRAINT show_style_settings_show_id_fkey FOREIGN KEY (show_id) REFERENCES app_playbill.shows(id) ON DELETE CASCADE;


--
-- Name: shows shows_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.shows
    ADD CONSTRAINT shows_program_id_fkey FOREIGN KEY (program_id) REFERENCES app_playbill.programs(id) ON DELETE SET NULL;


--
-- Name: shows shows_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.shows
    ADD CONSTRAINT shows_season_id_fkey FOREIGN KEY (season_id) REFERENCES app_playbill.seasons(id) ON DELETE SET NULL;


--
-- Name: submission_requests submission_requests_show_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.submission_requests
    ADD CONSTRAINT submission_requests_show_role_id_fkey FOREIGN KEY (show_role_id) REFERENCES app_playbill.show_roles(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.submissions
    ADD CONSTRAINT submissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: submissions submissions_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.submissions
    ADD CONSTRAINT submissions_request_id_fkey FOREIGN KEY (request_id) REFERENCES app_playbill.submission_requests(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.submissions
    ADD CONSTRAINT submissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY app_playbill.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: assets authenticated manage assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage assets" ON app_playbill.assets TO authenticated USING (true) WITH CHECK (true);


--
-- Name: departments authenticated manage departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage departments" ON app_playbill.departments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: exports authenticated manage exports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage exports" ON app_playbill.exports TO authenticated USING (true) WITH CHECK (true);


--
-- Name: note_templates authenticated manage note_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage note_templates" ON app_playbill.note_templates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: people authenticated manage people; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage people" ON app_playbill.people TO authenticated USING (true) WITH CHECK (true);


--
-- Name: program_modules authenticated manage program_modules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage program_modules" ON app_playbill.program_modules TO authenticated USING (true) WITH CHECK (true);


--
-- Name: programs authenticated manage programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage programs" ON app_playbill.programs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: role_templates authenticated manage role_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage role_templates" ON app_playbill.role_templates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: season_events authenticated manage season_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage season_events" ON app_playbill.season_events TO authenticated USING (true) WITH CHECK (true);


--
-- Name: seasons authenticated manage seasons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage seasons" ON app_playbill.seasons TO authenticated USING (true) WITH CHECK (true);


--
-- Name: show_departments authenticated manage show_departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage show_departments" ON app_playbill.show_departments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: show_roles authenticated manage show_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage show_roles" ON app_playbill.show_roles TO authenticated USING (true) WITH CHECK (true);


--
-- Name: show_style_settings authenticated manage show_style_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage show_style_settings" ON app_playbill.show_style_settings TO authenticated USING (true) WITH CHECK (true);


--
-- Name: shows authenticated manage shows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage shows" ON app_playbill.shows TO authenticated USING (true) WITH CHECK (true);


--
-- Name: submission_requests authenticated manage submission_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage submission_requests" ON app_playbill.submission_requests TO authenticated USING (true) WITH CHECK (true);


--
-- Name: submissions authenticated manage submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated manage submissions" ON app_playbill.submissions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: audit_log authenticated read audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read audit_log" ON app_playbill.audit_log FOR SELECT TO authenticated USING (true);


--
-- Name: user_profiles authenticated read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read own profile" ON app_playbill.user_profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_profiles authenticated upsert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated upsert own profile" ON app_playbill.user_profiles TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: exports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.exports ENABLE ROW LEVEL SECURITY;

--
-- Name: note_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.note_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: people; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.people ENABLE ROW LEVEL SECURITY;

--
-- Name: program_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.program_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.programs ENABLE ROW LEVEL SECURITY;

--
-- Name: people public can read people; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can read people" ON app_playbill.people FOR SELECT USING (true);


--
-- Name: programs public can read programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public can read programs" ON app_playbill.programs FOR SELECT USING (true);


--
-- Name: shows public read published shows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read published shows" ON app_playbill.shows FOR SELECT USING ((is_published = true));


--
-- Name: role_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.role_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: season_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.season_events ENABLE ROW LEVEL SECURITY;

--
-- Name: seasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.seasons ENABLE ROW LEVEL SECURITY;

--
-- Name: show_departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.show_departments ENABLE ROW LEVEL SECURITY;

--
-- Name: show_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.show_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: show_style_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.show_style_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: shows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.shows ENABLE ROW LEVEL SECURITY;

--
-- Name: submission_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.submission_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE app_playbill.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict j82worMtAYhLCcqpl9WZylerdBctevXazA85w9jGrspgjVKtoL2e9vK1WolUPGl

