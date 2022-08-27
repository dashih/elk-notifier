FROM node:16.17.0
WORKDIR /home/node/app
COPY . .
CMD [ "node", "app.js" ]
