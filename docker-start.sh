#!/bin/sh

if [ "$ENV" = "prod" ]
then 
    npm ci --omit=dev && npm run serve
else
    npm i && npm run watch
fi