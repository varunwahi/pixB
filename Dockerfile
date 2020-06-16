FROM node:current-slim
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm i

COPY . .
CMD ["npm", "start"]
