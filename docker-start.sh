#!/bin/sh

if [ "$ENV" = "prod" ]
then 
    npm ci --omit=dev && crawl serve
else
    npm i && npm run watch
fi