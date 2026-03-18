#!/bin/bash

set -e

echo "🚀 Kiwi TCMS Setup Script for EscapeKit"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
KIWI_PORT=${KIWI_PORT:-8080}
KIWI_CONTAINER_NAME="kiwi-tcms-escapekit"
CONFIG_FILE="config/kiwi-tcms.json"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed. Please install Docker first.${NC}"
    echo "  Visit: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed${NC}"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is installed${NC}"

# Create docker-compose file if it doesn't exist
if [ ! -f "docker-compose.kiwi.yml" ]; then
    echo ""
    echo "📝 Creating docker-compose.kiwi.yml..."
    cat > docker-compose.kiwi.yml << 'EOF'
version: '3.8'

services:
  kiwi-postgres:
    image: postgres:15-alpine
    container_name: kiwi-postgres-escapekit
    environment:
      POSTGRES_DB: kiwi_db
      POSTGRES_USER: kiwi
      POSTGRES_PASSWORD: kiwi_password
    volumes:
      - kiwi-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kiwi"]
      interval: 10s
      timeout: 5s
      retries: 5

  kiwi-tcms:
    image: kiwitcms/kiwi:latest
    container_name: kiwi-tcms-escapekit
    ports:
      - "8080:8080"
    environment:
      KIWI_DB_HOST: kiwi-postgres
      KIWI_DB_PORT: 5432
      KIWI_DB_NAME: kiwi_db
      KIWI_DB_USER: kiwi
      KIWI_DB_PASSWORD: kiwi_password
      KIWI_USE_EXTERNAL_EMAIL_SERVER: "False"
    depends_on:
      kiwi-postgres:
        condition: service_healthy
    volumes:
      - kiwi-media-files:/Kiwi/media_files
    restart: unless-stopped

volumes:
  kiwi-postgres-data:
  kiwi-media-files:
EOF
    echo -e "${GREEN}✓ docker-compose.kiwi.yml created${NC}"
else
    echo -e "${YELLOW}ℹ docker-compose.kiwi.yml already exists${NC}"
fi

# Check if Kiwi TCMS is already running
if docker ps | grep -q $KIWI_CONTAINER_NAME; then
    echo -e "${YELLOW}ℹ Kiwi TCMS is already running${NC}"
    echo "  URL: http://localhost:$KIWI_PORT"
else
    # Start Kiwi TCMS
    echo ""
    echo "🚀 Starting Kiwi TCMS..."
    if docker compose -f docker-compose.kiwi.yml up -d; then
        echo -e "${GREEN}✓ Kiwi TCMS started successfully${NC}"
        echo ""
        echo "⏳ Waiting for Kiwi TCMS to be ready (this may take 1-2 minutes)..."
        
        # Wait for Kiwi TCMS to be ready
        max_attempts=30
        attempt=0
        while [ $attempt -lt $max_attempts ]; do
            if curl -s http://localhost:$KIWI_PORT > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Kiwi TCMS is ready!${NC}"
                break
            fi
            attempt=$((attempt + 1))
            echo -n "."
            sleep 4
        done
        echo ""
        
        if [ $attempt -eq $max_attempts ]; then
            echo -e "${RED}✗ Kiwi TCMS failed to start within timeout${NC}"
            echo "  Check logs: docker compose -f docker-compose.kiwi.yml logs kiwi-tcms"
            exit 1
        fi
    else
        echo -e "${RED}✗ Failed to start Kiwi TCMS${NC}"
        exit 1
    fi
fi

# Create configuration file
echo ""
echo "📝 Creating Kiwi TCMS configuration..."
mkdir -p config

cat > $CONFIG_FILE << EOF
{
  "baseUrl": "http://localhost:${KIWI_PORT}",
  "username": "admin",
  "password": "admin",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": null,
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}
EOF
echo -e "${GREEN}✓ Configuration file created: $CONFIG_FILE${NC}"

echo ""
echo "========================================"
echo -e "${GREEN}✅ Kiwi TCMS Setup Complete!${NC}"
echo "========================================"
echo ""
echo "📋 Next Steps:"
echo "  1. Open Kiwi TCMS in your browser:"
echo "     ${GREEN}http://localhost:${KIWI_PORT}${NC}"
echo ""
echo "  2. Login with:"
echo "     Username: ${GREEN}admin${NC}"
echo "     Password: ${GREEN}admin${NC}"
echo ""
echo "  3. IMPORTANT: Change the default password immediately!"
echo "     Go to: Administration > Change Password"
echo ""
echo "  4. Create a product named 'EscapeKit':"
echo "     - Go to Products > New Product"
echo "     - Name: EscapeKit"
echo "     - Save and note the Product ID"
echo ""
echo "  5. Create a test plan for EscapeKit:"
echo "     - Go to Test Plans > New Test Plan"
echo "     - Product: EscapeKit"
echo "     - Name: Main Test Plan"
echo "     - Save and note the Test Plan ID"
echo ""
echo "  6. Update the configuration file with the Test Plan ID:"
echo "     Edit: $CONFIG_FILE"
echo "     Change: \"defaultPlanId\": null"
echo "     To: \"defaultPlanId\": YOUR_TEST_PLAN_ID"
echo ""
echo "  7. Test the upload script:"
echo "     npm test"
echo "     npx ts-node scripts/kiwi-upload.ts --file vitest-results.json"
echo ""
echo "  8. Stop Kiwi TCMS (when done):"
echo "     docker compose -f docker-compose.kiwi.yml down"
echo ""
echo "📚 Documentation:"
echo "  - Kiwi TCMS API: http://localhost:${KIWI_PORT}/api/"
echo "  - View test runs: http://localhost:${KIWI_PORT}/runs/"
echo ""
echo "Happy testing! 🚀"