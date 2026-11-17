#!/bin/bash
# usage: ./run.sh  — recrée la base de test et applique migrations + tests
set -e
cd "$(dirname "$0")"
P="su postgres -c"
su postgres -c "psql -q -c 'drop database if exists bl_test' -c 'create database bl_test'"
run(){ su postgres -c "psql -q -v ON_ERROR_STOP=1 -d bl_test -f $1"; }
cp 00_stub.sql ../migrations/*.sql 01_*.sql /tmp/ 2>/dev/null || true
run /tmp/00_stub.sql
for f in 0001_schema 0002_functions 0003_storage 0004_unique_discord 0005_seed_tracks 0006_phone_login 0007_track_video; do echo "== $f"; run /tmp/$f.sql; done
