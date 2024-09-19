#!/bin/bash

# Script to build, tag, and push Reiverr Docker image

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print error messages
error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

# Function to print success messages
success() {
    echo -e "${GREEN}$1${NC}"
}

# Build the image
echo "Building the Docker image..."
if docker-compose -f docker-compose.yml -f docker-compose.prod.yml build; then
    success "Docker image built successfully."
else
    error "Failed to build Docker image."
fi

# Tag the image
echo "Tagging the Docker image..."
if docker tag ghcr.io/wonderalice/modified-reiverr:latest wonderalice/modified-reiverr:v1.1; then
    success "Docker image tagged successfully."
else
    error "Failed to tag Docker image."
fi

# Push the image to Docker Hub
echo "Pushing the Docker image to Docker Hub..."
if docker push wonderalice/modified-reiverr:v1.1; then
    success "Docker image pushed to Docker Hub successfully."
else
    error "Failed to push Docker image to Docker Hub."
fi

success "All operations completed successfully!"