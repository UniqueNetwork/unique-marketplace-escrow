FROM node:latest

WORKDIR /src

COPY src/Marketplace.Escrow.JS.Unique .

RUN npm install

CMD ["node", "unique_vault.js"]