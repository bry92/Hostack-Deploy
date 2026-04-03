@echo off
cd C:\Users\pageb\Documents\GitHub\Hostack-Deploy
git add pnpm-lock.yaml
git commit -m "chore(ci): regenerate pnpm-lock.yaml for Linux"
git push origin ci/regenerate-pnpm-lockfile-linux
echo.
echo Push complete - PR can now be created at:
echo https://github.com/bry92/Hostack-Deploy/compare/main...ci/regenerate-pnpm-lockfile-linux
pause
