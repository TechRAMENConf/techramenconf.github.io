#!/bin/bash

# Build root redirect page
echo "Building root redirect page..."
npm run build

# Build 2025 site
echo "Building 2025 site..."
cd 2025
npm run build
cd ..

# Copy 2025 build output to dist/2025
echo "Copying 2025 build to main dist directory..."
mkdir -p dist/2025
cp -r 2025/dist/* dist/2025/

echo "Build complete!"