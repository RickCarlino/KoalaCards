#!/usr/bin/bash

while true
do
  echo "Clean up the the code and don't ask questions. Do it in a way that is super duper easy to understand and free of comments (even yours), nesting, complexity, defects and duplication. Clean it up so it helps learners study the code while bringing tears of joy to Donald Knuth. This is a cleanup for beauty, maintainability, readability, simplicity and elegance. Run tidy.sh when you are done." | codex exec
  git add -A
  git commit -am "Automated code cleanup"
  sleep 1
done