cd ~/kama-qc
echo "START $(date)"
docker compose stop app
if docker compose build app && docker compose up -d app; then
  echo DEPLOY_DONE
else
  echo DEPLOY_FAILED
  docker compose up -d app
fi
echo "END $(date)"
