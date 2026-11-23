#!/bin/bash
# Recrée la base d'essai bl_e2e : stub Supabase + migrations réelles + colonnes d'auth nécessaires au banc d'essai
set -e
cd "$(dirname "$0")/../.."
su postgres -c "psql -q -c \"alter user postgres password 'e2e'\" -c 'drop database if exists bl_e2e' -c 'create database bl_e2e'"
run(){ su postgres -c "psql -q -v ON_ERROR_STOP=1 -d bl_e2e -f $1"; }
cp supabase/tests/00_stub.sql supabase/migrations/*.sql /tmp/
run /tmp/00_stub.sql
su postgres -c "psql -q -d bl_e2e" <<'SQL'
create extension if not exists pgcrypto;
alter table auth.users add column if not exists encrypted_password text, add column if not exists created_at timestamptz default now();
grant all on all tables in schema storage to anon, authenticated, service_role;
SQL
for f in 0001_schema 0002_functions 0003_storage 0004_unique_discord 0005_seed_tracks 0006_phone_login 0007_track_video 0008_demo_pilots 0009_duel_reminders 0010_bank_iban 0011_predictions_templates 0012_iban_reminder 0013_push 0014_course_routes 0016_economy 0017_remove_test_track 0018_zigollars 0019_random_third_map 0020_claims_suggestions 0021_bettors_warmup_votes 0022_duel_win_editor 0023_locked_welcome_staff_limits 0024_delete_account 0025_observer_account; do run /tmp/$f.sql; done
echo "bl_e2e prête"
