# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases

# Install dependencies
RUN yarn install

# Copy the rest of the application
COPY . .

ARG VITE_API_URL=https://api.yildizskylab.com/api/skymail/v1
ENV VITE_API_URL=$VITE_API_URL
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
