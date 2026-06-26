FROM node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.js ./

EXPOSE 8189
CMD ["node", "index.js"]
