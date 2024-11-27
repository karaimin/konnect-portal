FROM node:18.20.5 as builder

WORKDIR /app
# Copy package.json and yarn.lock first
COPY . .
RUN yarn install --frozen-lockfile
# Then copy the rest of the files
RUN yarn build

FROM node:18.20.5-alpine

WORKDIR /app
# Copy server files including its yarn.lock
COPY server ./server
WORKDIR /app/server
RUN yarn install --frozen-lockfile

# Copy built frontend to /app/dist
COPY --from=builder /app/dist ../dist

EXPOSE 3000
CMD ["node", "server.js"] 