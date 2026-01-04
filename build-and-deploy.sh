#!/bin/bash

# Build root redirect page
echo "Building root redirect page..."
npm run build

# Build 2026 site
echo "Building 2026 site..."
cd 2026
npm run build
cd ..

# Copy 2026 build output to dist/2026
echo "Copying 2026 build to main dist directory..."
mkdir -p dist/2026
cp -r 2026/dist/* dist/2026/

echo "Build complete!"