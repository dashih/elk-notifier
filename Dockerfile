FROM node:18.16.0
WORKDIR /home/node/app
COPY . .
CMD [ "node", "app.js" ]
