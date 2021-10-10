# Unique Marketplace Escrow

## Glossary

- *Quote* - an ID of a currency used to pay for NFT tokens.
- *Seller* - a person who wants to sell a NFT token.
- *Buyer* - a person who wants to buy a NFT token.

## How does the whole system works

Seller sends token to escrow admin and sets it's quote price.
Escrow creates an offer.
Buyer sends quote to Escrow.
Escrow sends token to the Buyer and quote to the Seller.
The Buyer and the Seller can get back what they sent.

## What does it do

- For each NFT token sent to escrow admin it calls [Matcher Contract's]() method `registerNftDeposit` to store real token's owner in blockchain.
- It calls [Matcher Contract's]() method `registerDeposit` to store quote deposit after [Kusama Escrow](https://github.com/UniqueNetwork/unique-marketplace-escrow-kusama) schedules quote income registration.
- On successful [Matcher Contract's]() `ask` call it creates an offer for [Marketplace Backend](https://github.com/UniqueNetwork/unique-marketplace-api) to show.
- On successful [Matcher Contract's]() `buy` call it sends bought token to the buyer, schedules quote outcome for [Kusama Escrow](https://github.com/UniqueNetwork/unique-marketplace-escrow-kusama) to handle and creates a trade for [Marketplace Backend](https://github.com/UniqueNetwork/unique-marketplace-api) to show.
- On successful [Matcher Contract's]() `cancel` call it sends NFT token back to seller and removes the offer.
- On successful [Matcher Contract's]() `withdraw` schedules quote outcome back to buyer.


## How to run

Copy `lib/config.global.js` to `lib/config.dev.js` and edit it, or set env variables. See `docker-compose.example.yml` for details.
Run either with `npm install & npm run` or with docker.
