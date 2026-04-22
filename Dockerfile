# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json yarn.lock* .yarnrc.yml* .npmrc* ./

# Install dependencies
RUN yarn install

# Copy the rest of the application
COPY . .

# Build the application
RUN yarn build

# Final stage
FROM node:24-alpine

WORKDIR /app

# Install serve to host the static files
RUN npm install -g serve

# Copy only the built assets from the builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Serve the 'dist' directory on port 3000
# -s flag is for SPA (Single Page Application) routing
CMD ["serve", "-s", "dist", "-l", "3000"]
