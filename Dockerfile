# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases

# Install dependencies
RUN yarn install --immutable

# Copy the rest of the application
COPY . .

ARG VITE_API_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_ADMIN_URL
ARG VITE_FORMS_ADMIN_URL
ARG VITE_MAIL_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_ADMIN_URL=$VITE_ADMIN_URL
ENV VITE_FORMS_ADMIN_URL=$VITE_FORMS_ADMIN_URL
ENV VITE_MAIL_URL=$VITE_MAIL_URL
RUN test -n "$VITE_API_URL" \
    && test -n "$VITE_KEYCLOAK_URL" \
    && test -n "$VITE_KEYCLOAK_REALM" \
    && test -n "$VITE_KEYCLOAK_CLIENT_ID" \
    && test -n "$VITE_ADMIN_URL" \
    && test -n "$VITE_FORMS_ADMIN_URL" \
    && test -n "$VITE_MAIL_URL" \
    && yarn build

# Final stage
FROM node:22-alpine

WORKDIR /app

# Install serve to host the static files
RUN npm install -g serve

# Copy only the built assets from the builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Serve the 'dist' directory on port 3000
# -s flag is for SPA (Single Page Application) routing
CMD ["serve", "-s", "dist", "-l", "3000"]
