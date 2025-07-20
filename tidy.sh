#!/bin/bash

# Exit on first error with status 2
set -e
trap 'exit 2' ERR

npx next lint --fix
npx eslint koala/ --fix
npx tsc --noEmit
npx prettier pages/ --write
npx prettier koala/ --write
