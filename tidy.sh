#!/bin/bash

# Exit on first error with status 2
set -e
trap 'exit 2' ERR

npx next lint --fix
npx tsc --noEmit
prettier pages/ --write
prettier koala/ --write
