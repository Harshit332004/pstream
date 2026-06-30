FROM node:20-alpine

WORKDIR /app

# Install main backend dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY server.js ./
COPY scrapers/ ./scrapers/

# Create a non-root user (appuser) and set ownership
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Expose port required by Hugging Face Spaces
EXPOSE 7860

# Start the application
CMD ["npm", "start"]
