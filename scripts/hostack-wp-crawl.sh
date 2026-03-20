#!/bin/bash
# hostack-wp-crawl.sh
# Purpose: Scrape a local WordPress instance into a static HTML bundle.

URL="http://localhost:8080"
OUTPUT="./dist"

echo "🚀 Starting Hostack Static WP Crawl..."

# Create the output directory
mkdir -p $OUTPUT

# Use wget to mirror the site
# --mirror: Get all files
# --convert-links: Make links relative
# --adjust-extension: Append .html to files if needed
# --page-requisites: Get CSS/Images
wget --mirror \
     --convert-links \
     --adjust-extension \
     --page-requisites \
     --no-parent \
     $URL \
     -P $OUTPUT

# ... existing wget commands ...

echo "🎨 Injecting Hostack Branding with Tailwind CSS..."

# 1. Run Tailwind to generate the minified, purged CSS
# -i: Input CSS file
# -o: Output CSS file in the static directory
# --minify: Purge unused styles and compress
npx tailwindcss -i ./styles/hostack-theme.css -o $OUTPUT/hostack-brand.min.css --minify

# 2. Inject the CSS link into every HTML file in the <head>
find $OUTPUT -type f -name "*.html" -exec sed -i 's|</head>|<link rel="stylesheet" href="./hostack-brand.min.css"></head>|g' {} +

# 3. Wrap the main content area in our "Glassmorphism" card
# (This assumes WP uses the standard .wp-block-post-content wrapper)
find $OUTPUT -type f -name "*.html" -exec sed -i 's|class="wp-block-post-content"|class="wp-block-post-content hostack-card"|g' {} +

echo "✅ WP Crawl + Hostack Branding Complete! Static files are in $OUTPUT"
