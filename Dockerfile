FROM node:18.18.0
WORKDIR /home/node/app
COPY . .
CMD [ "node", "app.js" ]
