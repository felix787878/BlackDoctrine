FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 6004

CMD ["npx", "nodemon", "mock-external-server.js"]
