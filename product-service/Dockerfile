FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 7002

CMD ["npx", "nodemon", "index.js"]
