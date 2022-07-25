FROM node:16
WORKDIR /home/node/app
COPY . .
CMD [ "node", "app.js" ]
