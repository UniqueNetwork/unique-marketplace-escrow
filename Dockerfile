FROM node:16-alpine

WORKDIR /src

COPY ./package.json .

RUN apk update && apk add --no-cache --virtual .build-deps g++ make python3

RUN npm install

RUN apk del .build-deps

COPY src .

CMD ["node", "unique_vault.js"]
