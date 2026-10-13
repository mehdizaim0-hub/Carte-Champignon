@echo off
rem ============================================================
rem  Mise a jour de la carte des champignons - double-cliquer !
rem  1) recupere la derniere version du depot
rem  2) telecharge la meteo reelle (1 a 7 minutes)
rem  3) envoie le resultat sur GitHub (le site se met a jour)
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === 1/3 Recuperation de la derniere version ===
git pull --rebase
if errorlevel 1 goto err

echo.
echo === 2/3 Telechargement de la meteo (patiente 1 a 7 min) ===
set "PY=python"
where python >nul 2>nul || set "PY=py"
%PY% build_data.py
if errorlevel 1 goto err

echo.
echo === 3/3 Envoi sur GitHub ===
git add data.json
git diff --cached --quiet && echo Rien de nouveau a envoyer. && goto done
git commit -m "mise a jour manuelle des donnees"
git push
if errorlevel 1 (
    echo Premier envoi refuse, nouvel essai...
    git pull --rebase
    git push
    if errorlevel 1 goto err
)

:done
echo.
echo ============================================
echo  TERMINE ! Le site sera a jour dans 2 min :
echo  https://mehdizaim0-hub.github.io/Carte-Champignon/
echo ============================================
pause
exit /b 0

:err
echo.
echo ********************************************
echo  Une ERREUR est survenue, lis le message
echo  ci-dessus. Rien n'a ete casse : tu peux
echo  simplement relancer ce fichier.
echo ********************************************
pause
exit /b 1
