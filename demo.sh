#!/bin/bash
printf "$ "
sleep 1
cmd="npx escapekit validate ./tests/fixtures/validation-buggy-project --auto-fix"
for (( i=0; i<${#cmd}; i++ )); do
  printf "%s" "${cmd:$i:1}"
  sleep 0.05
done
echo
sleep 0.5
npx tsx cli/index.ts validate ./tests/fixtures/validation-buggy-project --auto-fix
sleep 2
