# Ne rien écraser — fusion Grok UI + ASTRA 10

Cette branche `fusion-grok-astra` part de `gpt6-astra` (`f76fe72`) et n'ajoute que les garde-fous.
Elle ne réécrit **pas** `main` ni `gpt6-astra`.

Le chrome Grok officiel (v0.13.0) vit dans le projet Cursor Cloud : **historiques sans ancêtre commun**.
Ne **pas** `git push --force`. Ne **pas** `git pull origin gpt6-astra` pour « obtenir la fusion ».

## Sur le PC (`C:\Users\grego\grok_bot_local`)

1. PowerShell, cwd = ce dossier :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\preserve-then-fuse.ps1
```

(si le fichier n'est pas encore là : `git fetch origin fusion-grok-astra` puis
`git checkout origin/fusion-grok-astra -- scripts/preserve-then-fuse.ps1` **seulement si**
le working tree est déjà committé, sinon colle le bloc du README cloud.)

2. Ça copie `data\grok_bot.db` vers `data\backups\`, crée `backup/pre-fusion-astra`,
   commit `WIP: état ASTRA local avant fusion Grok UI` (hardware.ts / models.ts inclus).

3. Recopie le projet fusion **par-dessus** le code, **sans** toucher `data\`.

4. `npm run dev` — ports 48731 / 48732.

Si oracle + vulcan-forge existent, le seed ne DELETE FROM agents / messages / memory.
