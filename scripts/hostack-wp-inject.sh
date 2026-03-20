#!/bin/bash
# hostack-wp-inject.sh
# Purpose: Inject JSON content into WordPress using WP-CLI.

POSTS_DIR="./content/posts"

echo "💉 Injecting JSON posts into WordPress..."

# Loop through all JSON files in the posts directory
for f in $POSTS_DIR/*.json; do
  echo "Processing $f..."
  
  TITLE=$(jq -r '.title' "$f")
  CONTENT=$(jq -r '.content' "$f")
  STATUS=$(jq -r '.status' "$f")
  
  # Use WP-CLI to create the post
  # Note: Hostack runs this inside a container with wp-cli pre-installed.
  wp-cli post create --post_title="$TITLE" \
                     --post_content="$CONTENT" \
                     --post_status="$STATUS" \
                     --allow-root
done

echo "✅ All posts injected!"
