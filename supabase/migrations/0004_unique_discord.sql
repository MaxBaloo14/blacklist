-- 0004 : le pseudo Discord devient l'identifiant de connexion du pilote -> il doit être unique (sans tenir compte de la casse)
create unique index if not exists profiles_discord_unique on profiles (lower(discord_tag));
