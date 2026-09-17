FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE 3000
ENV PORT=3000 MAX_PLAYERS=700
CMD ["node","server.js"]
