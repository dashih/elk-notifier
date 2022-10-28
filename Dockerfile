FROM node:18.12.0
WORKDIR /home/node/app
COPY . .
CMD [ "node", "app.js" ]
